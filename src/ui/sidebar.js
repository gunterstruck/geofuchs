/**
 * Sidebar: Tabs (Daten / Gebiete / Filter / Tour), Datenstatus,
 * Gebietsebenen-Auswahl und Gebietsfilter.
 */

import { CONFIG } from '../core/config.js';
import { state, on, emit, UNASSIGNED, visibleCustomers, setCustomers, filterDimensionDefs, datasetSnapshot } from '../core/state.js';
import { geocodeExact } from '../services/geocode.js';
import { saveDataset, clearDataset, saveSettings } from '../services/storage.js';
import { isEnabled as vaultEnabled, removeVaultMeta } from '../services/vault.js';
import { STATUS_COLORS, STATUS_LABELS, isOpportunity } from '../features/visits.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/** Farbwert für <input type="color"> normalisieren (braucht #rrggbb) */
function toHexColor(value) {
    const v = String(value ?? '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(v)) return ('#' + v.slice(1).split('').map((c) => c + c).join('')).toLowerCase();
    // rgb(…)-Notation umwandeln, sonst neutrales Grau
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (m) return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    return '#94a3b8';
}

let geocodeHandle = null;
let autoRevealTimer = null;

const mobileQuery = window.matchMedia('(max-width: 768px)');
const MOBILE_DATA_TABS = new Set(['karte', 'tour']);
const MOBILE_EMPTY_TABS = new Set(['karte', 'daten']);
const SIDEBAR_WIDTH_KEY = 'gf_sidebar_width';
const SIDEBAR_POS_KEY = 'gf_sidebar_position';
const SHEET_HEIGHT_KEY = 'gf_sheet_height';
const PANEL_ZOOM_KEY = 'tf_panel_zoom';
const SIDEBAR_MIN = 340;
const SIDEBAR_MAX = 400;
const SHEET_MIN_HEIGHT = 140; // reicht für Griff + Tabs
const PANEL_ZOOM_MIN = 0.8;
const PANEL_ZOOM_MAX = 1.5;
const PANEL_ZOOM_STEP = 0.1;
const DOCK_THRESHOLD = 34;

function hasDataset() {
    return state.customers.length > 0 || Object.keys(state.territories).length > 0;
}

function isMobileUi() {
    return mobileQuery.matches;
}

function clampSidebarWidth(width) {
    return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.round(width)));
}

function setSidebarWidth(width, persist = false) {
    const next = clampSidebarWidth(width);
    document.documentElement.style.setProperty('--sidebar-width', `${next}px`);
    if (persist) {
        try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next)); } catch (e) { /* egal */ }
    }
}

function setPanelZoom(value, persist = false) {
    const next = Math.max(PANEL_ZOOM_MIN, Math.min(PANEL_ZOOM_MAX, Number(value) || 1));
    document.documentElement.style.setProperty('--panel-zoom', next.toFixed(2));
    const label = document.getElementById('panel-zoom-label');
    if (label) label.textContent = `${Math.round(next * 100)}%`;
    if (persist) {
        try { localStorage.setItem(PANEL_ZOOM_KEY, next.toFixed(2)); } catch (e) { /* egal */ }
    }
}

function currentPanelZoom() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--panel-zoom') || '1';
    return parseFloat(raw) || 1;
}

/**
 * Panel-Inhalt jeder Tab-Sektion in einen .panel-scale-Wrapper legen. Der Zoom
 * (CSS `zoom`) liegt auf dem Wrapper, während der Scrollcontainer (.tab-panel)
 * unskaliert bleibt – so skaliert der gesamte Inhalt (Text, Buttons, Abstände)
 * gleichmäßig und die Scrollhöhe stimmt weiterhin.
 */
function wrapPanelContentForZoom() {
    document.querySelectorAll('.tab-panel').forEach((panel) => {
        if (panel.querySelector(':scope > .panel-scale')) return;
        const wrap = document.createElement('div');
        wrap.className = 'panel-scale';
        while (panel.firstChild) wrap.appendChild(panel.firstChild);
        panel.appendChild(wrap);
    });
}

function initPanelZoom() {
    wrapPanelContentForZoom();
    const saved = parseFloat(localStorage.getItem(PANEL_ZOOM_KEY) || '');
    setPanelZoom(Number.isFinite(saved) ? saved : 1);
    document.getElementById('panel-zoom-out')?.addEventListener('click', () => setPanelZoom(currentPanelZoom() - PANEL_ZOOM_STEP, true));
    document.getElementById('panel-zoom-in')?.addEventListener('click', () => setPanelZoom(currentPanelZoom() + PANEL_ZOOM_STEP, true));
    // Doppelklick/-tipp auf die Prozentanzeige setzt auf 100 % zurück
    document.getElementById('panel-zoom-label')?.addEventListener('dblclick', () => setPanelZoom(1, true));
    // Reines Mausrad über dem Panel zoomt den Inhalt (Wunsch: wie die Karte)
    document.getElementById('sidebar')?.addEventListener('wheel', (ev) => {
        if (isMobileUi()) return;
        ev.preventDefault();
        setPanelZoom(currentPanelZoom() + (ev.deltaY < 0 ? PANEL_ZOOM_STEP : -PANEL_ZOOM_STEP), true);
    }, { passive: false });
}

function initDesktopSidebarResize() {
    const handle = document.getElementById('sidebar-resize');
    const sidebar = document.getElementById('sidebar');
    if (!handle || !sidebar) return;
    const saved = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '', 10);
    if (Number.isFinite(saved)) setSidebarWidth(saved);

    let resizing = false;
    handle.addEventListener('pointerdown', (ev) => {
        if (isMobileUi()) return;
        resizing = true;
        handle.setPointerCapture?.(ev.pointerId);
        document.body.classList.add('sidebar-resizing');
    });
    handle.addEventListener('pointermove', (ev) => {
        if (!resizing) return;
        setSidebarWidth(ev.clientX);
    });
    const stopResize = (ev) => {
        if (!resizing) return;
        resizing = false;
        document.body.classList.remove('sidebar-resizing');
        setSidebarWidth(ev.clientX, true);
    };
    handle.addEventListener('pointerup', stopResize);
    handle.addEventListener('pointercancel', () => {
        resizing = false;
        document.body.classList.remove('sidebar-resizing');
    });
}

/** Sidebar auf-/zuklappen (mobil) gemäß state.ui.sidebarOpen */
function applySidebarPosition(pos) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || !pos) return;
    const width = sidebar.getBoundingClientRect().width || SIDEBAR_MIN;
    const left = Math.max(8, Math.min(window.innerWidth - width - 12, Math.round(pos.left)));
    const top = Math.max(58, Math.min(window.innerHeight - 220, Math.round(pos.top)));
    sidebar.classList.add('floating-sidebar');
    sidebar.style.left = `${left}px`;
    sidebar.style.top = `${top}px`;
}

function resetSidebarPosition() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('floating-sidebar');
    sidebar.style.left = '';
    sidebar.style.top = '';
    try { localStorage.removeItem(SIDEBAR_POS_KEY); } catch (e) { /* egal */ }
}

let desktopNoteHideScheduled = false;
/**
 * Den Hinweis „Komplexe Gebietsplanung nur am Desktop" nach kurzer Zeit
 * automatisch ausblenden – erst wenn er sichtbar ist, dann sanft kollabieren.
 * Gewinnt Platz und beruhigt das Bild. Läuft einmal pro Sitzung.
 */
function scheduleDesktopNoteAutoHide() {
    if (desktopNoteHideScheduled) return;
    const note = document.getElementById('mobile-desktop-note');
    if (!note || note.classList.contains('auto-hidden')) return;
    if (!isMobileUi() || note.offsetParent === null) return; // nur wenn tatsächlich sichtbar
    desktopNoteHideScheduled = true;
    setTimeout(() => note.classList.add('auto-hidden'), 5000);
}

function applySidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('open', state.ui.sidebarOpen);
    document.getElementById('sidebar-toggle').setAttribute('aria-expanded', String(state.ui.sidebarOpen));
    const grip = document.getElementById('sheet-grip');
    if (grip) {
        if (isMobileUi()) {
            grip.setAttribute('aria-label', 'Panelgröße ändern');
            grip.title = 'Ziehen: Größe · Tippen: ein-/ausklappen';
        } else {
            grip.setAttribute('aria-label', 'Panel: Größe ändern oder verschieben');
            grip.title = 'Ziehen: ↕ Größe, ↔ verschieben · Doppelklick: zurück';
        }
    }
    scheduleDesktopNoteAutoHide();
}

// ---- Panelhöhe kontinuierlich per Griff ziehen (Maus + Touch) ----
function topbarPx() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--topbar-height');
    return parseInt(v, 10) || 56;
}
function sheetMaxHeight() {
    return Math.max(SHEET_MIN_HEIGHT, Math.round(window.innerHeight - topbarPx() - 8));
}
function clampSheetHeight(h) {
    return Math.max(SHEET_MIN_HEIGHT, Math.min(sheetMaxHeight(), Math.round(h)));
}
function setSheetHeight(h, persist = false) {
    const next = clampSheetHeight(h);
    document.documentElement.style.setProperty('--sheet-height', `${next}px`);
    document.getElementById('sidebar')?.classList.add('sheet-sized');
    if (persist) { try { localStorage.setItem(SHEET_HEIGHT_KEY, String(next)); } catch (e) { /* egal */ } }
    return next;
}
function restoreSheetHeight() {
    let saved = null;
    try { saved = localStorage.getItem(SHEET_HEIGHT_KEY); } catch (e) { /* egal */ }
    if (saved) setSheetHeight(Number(saved));
}

/**
 * Für die Live-Demos: das Blatt auf dem Handy weit aufziehen, damit die
 * Bedienelemente (Bezirk, Startpunkt, Vorschläge …) sichtbar sind, während der
 * Geister-Cursor sie bedient. Die gewählte Höhe wird NICHT gespeichert.
 */
export function expandSheetForDemo() {
    if (!isMobileUi()) return;
    state.ui.sidebarOpen = true;
    setSheetHeight(Math.round(sheetMaxHeight() * 0.92));
    applySidebar();
}

/** Nach einer Demo den vom Nutzer gewählten Blatt-Zustand wiederherstellen. */
export function restoreSheetAfterDemo() {
    if (!isMobileUi()) return;
    let saved = null;
    try { saved = localStorage.getItem(SHEET_HEIGHT_KEY); } catch (e) { /* egal */ }
    if (saved) {
        setSheetHeight(Number(saved));
    } else {
        document.getElementById('sidebar')?.classList.remove('sheet-sized');
        document.documentElement.style.removeProperty('--sheet-height');
    }
}

function toggleSheet() {
    const sidebar = document.getElementById('sidebar');
    if (isMobileUi()) {
        // Klick auf den Griff: ein-/ausklappen (auf „karte" stattdessen Tour öffnen).
        if (state.ui.activeTab === 'karte') { activateTab('tour'); return; }
        state.ui.sidebarOpen = !state.ui.sidebarOpen;
        applySidebar();
    } else if (sidebar?.classList.contains('sheet-sized')) {
        // Desktop: Klick setzt auf volle Höhe zurück.
        sidebar.classList.remove('sheet-sized');
        document.documentElement.style.removeProperty('--sheet-height');
        try { localStorage.removeItem(SHEET_HEIGHT_KEY); } catch (e) { /* egal */ }
    }
}

/**
 * Ein Griff für alles: senkrecht ziehen = Höhe ändern, waagerecht ziehen =
 * Panel verschieben/schweben (nur Desktop), kurzer Klick = ein-/ausklappen bzw.
 * volle Höhe, Doppelklick = Position zurücksetzen. Die Richtung entscheidet zu
 * Beginn der Bewegung, was gemeint ist (auf dem Handy immer Höhe).
 */
function initSheetGrip() {
    const grip = document.getElementById('sheet-grip');
    const sidebar = document.getElementById('sidebar');
    if (!grip || !sidebar) return;

    // Gemerkte Schwebe-Position wiederherstellen (Desktop).
    try {
        const saved = JSON.parse(localStorage.getItem(SIDEBAR_POS_KEY) || 'null');
        if (saved) applySidebarPosition(saved);
    } catch (e) { /* egal */ }

    let mode = null;             // 'pending' | 'resize' | 'move'
    let startX = 0, startY = 0, startH = 0, offsetX = 0, offsetY = 0, moved = false;

    grip.addEventListener('pointerdown', (ev) => {
        const rect = sidebar.getBoundingClientRect();
        startX = ev.clientX; startY = ev.clientY;
        startH = rect.height;
        offsetX = ev.clientX - rect.left; offsetY = ev.clientY - rect.top;
        mode = 'pending'; moved = false;
        grip.setPointerCapture?.(ev.pointerId);
        ev.preventDefault();
    });
    grip.addEventListener('pointermove', (ev) => {
        if (!mode) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (mode === 'pending') {
            if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            moved = true;
            // Desktop: überwiegend waagerecht -> verschieben, sonst Größe. Handy: immer Größe.
            mode = (!isMobileUi() && Math.abs(dx) > Math.abs(dy)) ? 'move' : 'resize';
            document.body.classList.add(mode === 'move' ? 'sidebar-dragging' : 'sheet-resizing');
            // Handy: erst beim tatsächlichen Ziehen das Blatt öffnen (translateY 0).
            if (mode === 'resize' && isMobileUi() && !state.ui.sidebarOpen) {
                state.ui.sidebarOpen = true; applySidebar();
                startH = sidebar.getBoundingClientRect().height;
            }
        }
        if (mode === 'resize') setSheetHeight(startH - dy);
        else if (mode === 'move') applySidebarPosition({ left: ev.clientX - offsetX, top: ev.clientY - offsetY });
    });
    const finish = () => {
        if (!mode) return;
        const done = mode; mode = null;
        document.body.classList.remove('sheet-resizing', 'sidebar-dragging');
        // Handy: reiner Tipp macht nichts – das Blatt wird nur durch Ziehen bewegt.
        if (!moved) { if (!isMobileUi()) toggleSheet(); return; }
        if (done === 'resize') {
            try { localStorage.setItem(SHEET_HEIGHT_KEY, String(Math.round(sidebar.getBoundingClientRect().height))); } catch (e) { /* egal */ }
        } else if (done === 'move') {
            const rect = sidebar.getBoundingClientRect();
            if (rect.left <= DOCK_THRESHOLD) resetSidebarPosition();
            else { try { localStorage.setItem(SIDEBAR_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top })); } catch (e) { /* egal */ } }
        }
    };
    grip.addEventListener('pointerup', finish);
    grip.addEventListener('pointercancel', finish);
    grip.addEventListener('dblclick', () => { if (!isMobileUi()) resetSidebarPosition(); });
}

/**
 * Beim Start ohne Daten das Menü nach kurzer Verzögerung automatisch einblenden,
 * damit der Nutzer nach der blanken Karte zum geführten Einstieg gelangt.
 * Nur wenn die Sidebar zu ist (mobil) und keine Daten vorliegen; bricht ab,
 * sobald der Nutzer die Sidebar selbst bedient oder Daten geladen werden.
 */
export function autoRevealIfEmpty() {
    if (state.ui.sidebarOpen || state.customers.length > 0) return;
    clearTimeout(autoRevealTimer);
    autoRevealTimer = setTimeout(() => {
        if (!state.ui.sidebarOpen && state.customers.length === 0) {
            state.ui.sidebarOpen = true;
            applySidebar();
        }
    }, 2500);
}

// Welche Tabs gehören zu welchem Modus, und welcher Tab ist der Einstieg?
const MODE_CONFIG = {
    aussendienst: {
        label: 'Außendienst',
        primaryTab: 'tour',
        // Karte startet mit Kundenmarkern statt Gebietsflächen
        areaColorModes: ['auto', 'bezirk', 'gruppe', 'luecken'],
        defaultColorMode: 'rep',
        hint: 'Alltag: Kundenkarte, Tour planen, Kunden in der Nähe, Übergabe an Maps.'
    },
    gebietsplanung: {
        label: 'Gebietsplanung',
        primaryTab: 'gebiete',
        markerColorModes: ['rep', 'status'],
        defaultColorMode: 'auto',
        hint: 'Experten-Modus: Gebiete schneiden, Zuständigkeiten, Cockpit, Simulation.'
    }
};

/** Einen Tab aktivieren (DOM + State); Persistenz steuern die Aufrufer */
function activateTab(tab) {
    state.ui.activeTab = tab;
    document.querySelectorAll('.tab-button').forEach((b) =>
        b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((p) =>
        p.classList.toggle('active', tab !== 'karte' && p.id === `tab-${tab}`));

    if (isMobileUi()) {
        if (tab === 'karte') state.ui.sidebarOpen = false;
        else if (tab === 'tour') state.ui.sidebarOpen = true;
        applySidebar();
    }
}

/** Mobil direkt zur Kartenansicht wechseln, z. B. nach "Route anzeigen". */
export function showMapView() {
    if (!isMobileUi()) return;
    activateTab('karte');
    persistSettings();
}

function hasTourRouteForMap() {
    return state.ui.mode === 'aussendienst'
        && !!state.tour.start
        && (state.tour.stops.length > 0 || !!state.tour.destination);
}

function handleMapTabRouteToggle(tab) {
    if (!isMobileUi() || tab !== 'karte' || !hasTourRouteForMap()) return;
    if (state.tour.mapFocus && state.ui.activeTab === 'karte') {
        state.tour.routeLineMode = state.tour.routeLineMode === 'road' ? 'air' : 'road';
    } else if (!state.tour.mapFocus) {
        state.tour.mapFocus = true;
        state.tour.routeLineMode ||= 'air';
    }
    emit('tour:changed');
}

/** Prüfen, ob ein Tab im gegebenen Modus sichtbar ist */
function tabInMode(tabBtn, mode) {
    if (isMobileUi()) {
        const mobileTabs = hasDataset() ? MOBILE_DATA_TABS : MOBILE_EMPTY_TABS;
        return mobileTabs.has(tabBtn.dataset.tab);
    }
    if (tabBtn.dataset.mobileOnly === 'true') return false;
    return (tabBtn.dataset.modes || '').split(/\s+/).includes(mode);
}

/**
 * Fokus-Modus anwenden: passende Tabs zeigen/verbergen, Einstieg wählen und
 * die Karte auf einen zum Modus passenden Standard einstellen.
 * @param {'aussendienst'|'gebietsplanung'} mode
 * @param {boolean} userInitiated  true bei Klick (Karte + Einstieg an Modus anpassen),
 *                                  false beim Wiederherstellen (gespeicherten Tab/Farbe behalten)
 * @param {boolean} persist  Einstellungen sichern (beim allerersten Init false,
 *                           damit der noch nicht geladene gespeicherte Tab nicht überschrieben wird)
 */
export function applyMode(mode, userInitiated = true, persist = true) {
    if (isMobileUi()) mode = 'aussendienst';
    if (!MODE_CONFIG[mode]) mode = 'aussendienst';
    const cfg = MODE_CONFIG[mode];
    state.ui.mode = mode;

    document.querySelectorAll('.mode-btn').forEach((b) =>
        b.classList.toggle('active', b.dataset.mode === mode));
    const hintEl = document.getElementById('mode-hint');
    if (hintEl) hintEl.textContent = cfg.hint;

    // Tabs des Modus ein-/ausblenden
    const tabs = [...document.querySelectorAll('.tab-button')];
    tabs.forEach((btn) => { btn.hidden = !tabInMode(btn, mode); });

    // Aktiven Tab wählen:
    // - leere App (keine Kunden/Gebiete) -> Daten-Tab als Einstieg (Onboarding)
    // - aktiver Wechsel -> Einstieg des Modus (man will die neue „Welt" sehen)
    // - Wiederherstellen -> gespeicherten Tab behalten, falls im Modus sichtbar
    const empty = state.customers.length === 0 && Object.keys(state.territories).length === 0;
    if (isMobileUi()) {
        const fallback = empty ? 'daten' : 'karte';
        const current = tabs.find((b) => b.dataset.tab === state.ui.activeTab);
        activateTab(!current || current.hidden ? fallback : state.ui.activeTab);
    } else if (empty) {
        activateTab('daten');
    } else if (userInitiated) {
        activateTab(cfg.primaryTab);
    } else {
        const current = tabs.find((b) => b.dataset.tab === state.ui.activeTab);
        activateTab(!current || current.hidden ? cfg.primaryTab : state.ui.activeTab);
    }

    // Karten-Standard an den Modus anpassen. Alte Personen-Farbmodi werden in
    // der Gebietsplanung auch beim Wiederherstellen auf den Bezirksmodus gehoben.
    const mismatched = mode === 'aussendienst'
        ? cfg.areaColorModes.includes(state.colorMode)
        : cfg.markerColorModes.includes(state.colorMode);
    if (userInitiated || (mode === 'gebietsplanung' && mismatched)) {
        if (mismatched) {
            state.colorMode = cfg.defaultColorMode;
            const sel = document.getElementById('colormode-select');
            if (sel) sel.value = state.colorMode;
            renderLegend();
            emit('colormode:changed');
        }
    }

    if (persist) persistSettings();
}

async function clearAllData() {
    if (state.customers.length === 0 && Object.keys(state.territories).length === 0) return;
    if (!confirm('Alle Kundendaten und Gebietszuordnungen aus dem Browser löschen?')) return;
    // Ohne Daten gibt es nichts zu schützen -> Tresor mit deaktivieren,
    // sonst bliebe beim nächsten Öffnen ein Sperrbildschirm ohne Inhalt.
    if (vaultEnabled()) removeVaultMeta();
    await clearDataset();
    state.tour.start = null;
    state.tour.destination = null;
    state.tour.stops = [];
    state.tour.mapFocus = false;
    state.fileName = null;
    state.territories = {};
    setCustomers([]);
    emit('tour:changed');
    showToast('Daten gelöscht.', 'success');
}

export function initSidebar() {
    initPanelZoom();
    initDesktopSidebarResize();
    initSheetGrip();
    restoreSheetHeight();

    // Fokus-Umschalter
    document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => applyMode(btn.dataset.mode, true));
    });

    // Tabs
    document.querySelectorAll('.tab-button').forEach((btn) => {
        btn.addEventListener('click', () => {
            handleMapTabRouteToggle(btn.dataset.tab);
            activateTab(btn.dataset.tab);
            persistSettings();
        });
    });

    // Standard-Modus anwenden – ohne zu persistieren, damit der gespeicherte
    // Tab/Modus beim anschließenden Wiederherstellen nicht überschrieben wird.
    applyMode(state.ui.mode, false, false);

    // Sidebar-Toggle (mobil)
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        clearTimeout(autoRevealTimer); // Nutzer übernimmt -> kein automatisches Einblenden mehr
        if (isMobileUi() && hasDataset()) {
            activateTab(state.ui.sidebarOpen ? 'karte' : 'tour');
            return;
        }
        state.ui.sidebarOpen = !state.ui.sidebarOpen;
        applySidebar();
    });
    applySidebar();


    mobileQuery.addEventListener('change', () => {
        applyMode(state.ui.mode, false, false);
        applySidebar();
    });

    // Gebietsebene
    const levelSelect = document.getElementById('level-select');
    levelSelect.innerHTML = Object.entries(CONFIG.levels)
        .map(([key, def]) => `<option value="${key}"${key === state.level ? ' selected' : ''}>${def.label}</option>`)
        .join('');
    levelSelect.addEventListener('change', () => {
        state.level = levelSelect.value;
        emit('level:changed');
        persistSettings();
    });

    on('map:loading', (loading) => {
        document.getElementById('level-loading').style.display = loading ? 'inline-block' : 'none';
    });

    // Anzeige-/Farbmodus
    const colorSelect = document.getElementById('colormode-select');
    colorSelect.value = state.colorMode;
    colorSelect.addEventListener('change', () => {
        state.colorMode = colorSelect.value;
        state.ui.opportunityOnly = false; // Gebietsplanung-Auswahl hebt den Chancen-Fokus auf
        renderLegend();
        emit('colormode:changed');
        persistSettings();
    });
    renderLegend();

    // Außendienst-Kartenansicht (Kunden / Status / Chancen)
    const basemapSelect = document.getElementById('basemap-select');
    if (basemapSelect) {
        basemapSelect.innerHTML = Object.entries(CONFIG.tileLayers || {})
            .map(([key, def]) => `<option value="${key}"${key === state.basemap ? ' selected' : ''}>${def.label}</option>`)
            .join('');
        basemapSelect.addEventListener('change', () => {
            state.basemap = basemapSelect.value;
            emit('basemap:changed');
            persistSettings();
        });
    }

    document.querySelectorAll('#aussen-view .seg').forEach((btn) => {
        btn.addEventListener('click', () => setAussenView(btn.dataset.view));
    });
    on('colormode:changed', syncAussenView);
    on('customers:changed', () => { syncAussenView(); updateChancenCount(); });
    on('filters:changed', updateChancenCount);
    syncAussenView();

    // Gebiets-Cockpit öffnen
    document.getElementById('btn-cockpit').addEventListener('click', () => {
        if (state.customers.length === 0) return showToast('Bitte zuerst Kundendaten laden.', 'info');
        emit('cockpit:open');
    });

    // Daten-Aktionen
    document.getElementById('btn-export').addEventListener('click', async () => {
        if (state.customers.length === 0) return showToast('Keine Kundendaten vorhanden.', 'info');
        const { exportCustomers } = await import('../services/excel.js');
        exportCustomers(state.customers);
    });
    document.getElementById('btn-clear').addEventListener('click', clearAllData);

    document.getElementById('btn-mobile-clear-data')?.addEventListener('click', clearAllData);

    // Exakte Geocodierung (Nominatim)
    document.getElementById('btn-geocode').addEventListener('click', toggleExactGeocoding);

    initTeamFilters();

    // Nach dem Demo-Laden: direkt in den Außendienst-Modus (Karte + Tour).
    // Mobil das Menü schließen, damit die bunten Pins auf der Karte den Aha-Moment liefern.
    on('demo:loaded', () => {
        clearTimeout(autoRevealTimer);
        applyMode('aussendienst', true);
        if (window.innerWidth < 768) {
            state.ui.sidebarOpen = false;
            applySidebar();
        }
    });

    on('customers:changed', () => {
        renderDataStatus();
        renderTeamFilters();
        renderLegend();
        applyMode(state.ui.mode, false, false);
    });
    on('filters:changed', renderDataStatus);
    renderDataStatus();
    renderTeamFilters();
}

function legendFromMap(entries) {
    return entries.length
        ? entries.map(([name, meta]) => `<span class="legend-item"><span class="dot" style="background:${meta.color}"></span>${escapeHtml(name)}</span>`).join('')
        : '<span class="muted small">Nach Datenimport sichtbar.</span>';
}

function renderLegend() {
    const el = document.getElementById('colormode-legend');
    const hint = document.getElementById('colormode-hint');
    if (!el) return;
    const mode = state.colorMode;

    const hints = {
        auto: 'Zoom bestimmt den Detailgrad: weit → Vertriebsgruppen, mittel/nah → Vertriebsbezirke mit Umsatz.',
        rep: 'Kunden als Punkte eingefärbt; diese Ansicht ist für den Außendienst gedacht.',
        bezirk: 'Gebiete flächig nach Vertriebsbezirk eingefärbt, mit Name und Umsatzsumme.',
        gruppe: 'Gebiete flächig nach Vertriebsgruppe eingefärbt, mit Name und Umsatzsumme.',
        status: 'Kunden als Punkte, eingefärbt nach Besuchsstatus.',
        luecken: 'Abdeckung je Gebiet: rot = keine Kunden (weißer Fleck), gelb = zugeordnet aber leer, grün = abgedeckt (je kräftiger, desto mehr Kunden).'
    };
    if (hint) hint.textContent = hints[mode] ?? '';

    if (mode === 'status') {
        const items = [
            ['ok', STATUS_LABELS.ok], ['faellig', STATUS_LABELS.faellig],
            ['ueberfaellig', STATUS_LABELS.ueberfaellig], ['none', STATUS_LABELS.none]
        ];
        el.innerHTML = items.map(([k, label]) =>
            `<span class="legend-item"><span class="dot" style="background:${STATUS_COLORS[k]}"></span>${label}</span>`).join('');
    } else if (mode === 'luecken') {
        el.innerHTML = [
            ['#dc2626', 'weißer Fleck (keine Kunden)'],
            ['#f59e0b', 'zugeordnet, aber leer'],
            ['#16a34a', 'abgedeckt']
        ].map(([c, l]) => `<span class="legend-item"><span class="dot" style="background:${c}"></span>${l}</span>`).join('');
    } else if (mode === 'bezirk' || mode === 'gruppe') {
        const dim = state.dims[mode];
        el.innerHTML = dim?.active
            ? legendFromMap([...dim.values.entries()].slice(0, 14))
            : `<span class="muted small">Keine Spalte „${mode === 'bezirk' ? 'Vertriebsbezirk' : 'Vertriebsgruppe'}" in den Daten.</span>`;
    } else if (mode === 'rep') {
        el.innerHTML = legendFromMap([...state.reps.entries()].slice(0, 14));
    } else {
        // auto: Gebietsplanung führt über Vertriebsbezirk, nicht über Personen.
        const dim = state.dims.bezirk?.active ? state.dims.bezirk : state.dims.gruppe;
        el.innerHTML = dim?.active
            ? legendFromMap([...dim.values.entries()].slice(0, 14))
            : '<span class="muted small">Nach Datenimport sichtbar.</span>';
    }
}

// ---- Außendienst-Kartenansicht ----

/** Aktuelle Ansicht aus State ableiten: 'chancen' | 'status' | 'rep' */
function currentAussenView() {
    if (state.ui.opportunityOnly) return 'chancen';
    return state.colorMode === 'status' ? 'status' : 'rep';
}

function setAussenView(view) {
    if (view === 'chancen') {
        state.colorMode = 'status';
        state.ui.opportunityOnly = true;
    } else {
        state.colorMode = view === 'status' ? 'status' : 'rep';
        state.ui.opportunityOnly = false;
    }
    const sel = document.getElementById('colormode-select');
    if (sel) sel.value = state.colorMode;
    renderLegend();
    emit('colormode:changed');
    persistSettings();
    // syncAussenView läuft über den colormode:changed-Listener; Zähler aktualisieren
    updateChancenCount();
}

/** Segment-Umschalter an den aktuellen Zustand anpassen */
function syncAussenView() {
    const view = currentAussenView();
    document.querySelectorAll('#aussen-view .seg').forEach((btn) =>
        btn.classList.toggle('active', btn.dataset.view === view));
    updateChancenCount();
}

/** Zähler „X von Y fällig/überfällig" unter dem Umschalter */
function updateChancenCount() {
    const el = document.getElementById('chancen-count');
    if (!el) return;
    if (state.customers.length === 0) { el.textContent = ''; return; }
    const shown = visibleCustomers();
    const chancen = shown.filter((c) => isOpportunity(c)).length;
    if (currentAussenView() === 'chancen') {
        el.textContent = chancen === 0
            ? 'Aktuell keine fälligen oder überfälligen Kunden (bei den sichtbaren).'
            : `Zeigt ${chancen} fällige/überfällige von ${shown.length} sichtbaren Kunden.`;
    } else {
        el.textContent = chancen > 0
            ? `${chancen} Kunde(n) fällig oder überfällig – „🎯 Chancen" hebt sie hervor.`
            : '';
    }
}

function persistSettings() {
    const dimVisibility = {};
    const dimColors = {};
    for (const def of filterDimensionDefs()) {
        const dim = state.dims[def.id];
        if (dim) {
            dimVisibility[def.id] = Object.fromEntries([...dim.values].map(([k, v]) => [k, v.visible]));
            dimColors[def.id] = Object.fromEntries([...dim.values].map(([k, v]) => [k, v.color]));
        }
    }
    saveSettings({
        mode: state.ui.mode,
        activeTab: state.ui.activeTab,
        level: state.level,
        colorMode: state.colorMode,
        basemap: state.basemap,
        repVisibility: Object.fromEntries([...state.reps].map(([k, v]) => [k, v.visible])),
        repColors: Object.fromEntries([...state.reps].map(([k, v]) => [k, v.color])),
        dimVisibility,
        dimColors,
        radiusKm: state.tour.radiusKm
    });
}

// ---- Daten-Tab ----

function renderDataStatus() {
    const onboarding = document.getElementById('onboarding');
    const loaded = document.getElementById('data-loaded');
    const el = document.getElementById('data-status');
    const sidebar = document.getElementById('sidebar');
    const empty = state.customers.length === 0;
    // Onboarding-Modus: Modus-Umschalter, Hinweis und Tab-Leiste ausblenden,
    // damit der Einstieg maximal einfach ist (nur Willkommen + Demo).
    if (sidebar) sidebar.classList.toggle('onboarding', empty);
    if (empty) {
        if (onboarding) onboarding.style.display = '';
        if (loaded) loaded.style.display = 'none';
        return;
    }
    if (onboarding) onboarding.style.display = 'none';
    if (loaded) loaded.style.display = 'block';
    const total = state.customers.length;
    const located = state.customers.filter((c) => c.lat !== null).length;
    const exact = state.customers.filter((c) => c.geo === 'exakt').length;
    const visible = visibleCustomers().length;
    const bezirkeCount = state.dims.bezirk?.active ? state.dims.bezirk.values.size : 0;
    const gruppenCount = state.dims.gruppe?.active ? state.dims.gruppe.values.size : 0;
    el.innerHTML = `
        <div class="stat-grid">
            <div class="stat"><b>${total}</b><span>Kunden</span></div>
            <div class="stat"><b>${bezirkeCount}</b><span>Bezirke</span></div>
            <div class="stat"><b>${gruppenCount}</b><span>Gruppen</span></div>
            <div class="stat"><b>${visible}</b><span>sichtbar</span></div>
        </div>
        <p class="muted small">${escapeHtml(state.fileName ?? '')}</p>
        <p class="muted small">📍 ${located} verortet (davon ${exact} adressgenau)</p>
    `;
}

async function toggleExactGeocoding() {
    const btn = document.getElementById('btn-geocode');
    const progress = document.getElementById('geocode-progress');

    if (geocodeHandle) {
        geocodeHandle.cancel();
        return;
    }
    const candidates = state.customers.filter((c) => c.geo !== 'exakt' && c.strasse);
    if (candidates.length === 0) {
        showToast('Keine Kunden mit Straßenadresse zum Nachschärfen gefunden.', 'info');
        return;
    }
    if (!confirm(
        `${candidates.length} Adressen werden über OpenStreetMap (Nominatim) exakt geocodiert.\n` +
        'Das dauert ca. 1 Sekunde pro Adresse und benötigt Internet. Fortfahren?'
    )) return;

    btn.textContent = '⏸ Abbrechen';
    progress.style.display = 'block';

    geocodeHandle = geocodeExact(state.customers, (done, totalCount) => {
        progress.textContent = `Geocodiere… ${done}/${totalCount}`;
    });

    const result = await geocodeHandle.run;
    geocodeHandle = null;
    btn.textContent = '🎯 Adressen exakt verorten';
    progress.style.display = 'none';

    await saveDataset(datasetSnapshot());
    emit('customers:changed');
    showToast(
        result.cancelled
            ? `Abgebrochen – ${result.updated} Adressen exakt verortet.`
            : `${result.updated} Adressen exakt verortet${result.failed ? `, ${result.failed} nicht gefunden` : ''}.`,
        'success', 6000
    );
}

// ---- Team-Tab (Filter) ----

/** Kunden je Feldwert zählen */
function countBy(field) {
    const counts = new Map();
    for (const c of state.customers) {
        const key = String(c[field] ?? '').trim() || UNASSIGNED;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

const COLLAPSE_THRESHOLD = 8;  // ab so vielen Werten standardmäßig eingeklappt
const SEARCH_THRESHOLD = 8;    // ab so vielen Werten ein Suchfeld zeigen
const ROW_CAP = 60;            // max. gerenderte Zeilen je Ebene
const filterUI = { expanded: {}, search: {}, enabled: {}, wired: false };

const DEFAULT_FILTER_SECTIONS = ['bezirk', 'gruppe'];

function dimFilterSection(id, optional = false) {
    const dim = state.dims[id];
    const def = filterDimensionDefs().find((d) => d.id === id);
    if (!dim?.active || !def) return null;
    return { id: def.id, label: dim.label, field: dim.field, entries: [...dim.values.entries()], optional };
}

/** Filter-Ebenen: standardmäßig Bezirk + Gruppe, weitere Gebietsebenen optional */
function filterSections() {
    return filterDimensionDefs().map((def) => def.id)
        .filter((id) => DEFAULT_FILTER_SECTIONS.includes(id) || filterUI.enabled[id])
        .map((id) => dimFilterSection(id, !DEFAULT_FILTER_SECTIONS.includes(id)))
        .filter(Boolean);
}

/** Wert-Eintrag ({visible,color}) einer Ebene holen */
function sectionEntry(sectionId, value) {
    return state.dims[sectionId]?.values.get(value);
}

function sectionCounts(section, visN) {
    const total = section.entries.length;
    return visN === total ? `alle · ${total}` : `${visN}/${total}`;
}

function renderRows(section, counts, search) {
    const q = search.trim().toLowerCase();
    let entries = section.entries;
    if (q) entries = entries.filter(([name]) => name.toLowerCase().includes(q));
    const shown = entries.slice(0, ROW_CAP);
    const rows = shown.map(([name, v]) => `
        <label class="filter-row">
            <input type="checkbox" data-filter="${section.id}" data-value="${escapeHtml(name)}" ${v.visible ? 'checked' : ''}>
            <input type="color" class="color-dot" data-color="${section.id}" data-value="${escapeHtml(name)}" value="${toHexColor(v.color)}" title="Farbe von „${escapeHtml(name)}" ändern" aria-label="Farbe ändern">
            <span class="filter-name">${escapeHtml(name)}</span>
            <span class="count">${counts.get(name) ?? 0}</span>
        </label>`).join('');
    const more = entries.length > ROW_CAP ? `<p class="muted small">… ${entries.length - ROW_CAP} weitere – bitte oben filtern.</p>` : '';
    const none = entries.length === 0 ? '<p class="muted small">Kein Treffer.</p>' : '';
    return rows + more + none;
}

function renderSection(section) {
    const counts = countBy(section.field);
    const total = section.entries.length;
    const visN = section.entries.filter(([, v]) => v.visible).length;
    const expanded = !!filterUI.expanded[section.id];
    const search = filterUI.search[section.id] || '';
    const body = expanded ? `<div class="filter-body">
        ${total > SEARCH_THRESHOLD ? `<input type="search" class="filter-search" data-search="${section.id}" placeholder="in „${escapeHtml(section.label)}" filtern…" value="${escapeHtml(search)}" autocomplete="off">` : ''}
        <div class="filter-rows" data-rows="${section.id}">${renderRows(section, counts, search)}</div>
        <div class="filter-bulk">
            <button type="button" data-bulk="${section.id}" data-on="1">Alle</button>
            <button type="button" data-bulk="${section.id}" data-on="0">Keine</button>
        </div>
    </div>` : '';
    return `<div class="filter-section">
        <button type="button" class="filter-head" data-toggle="${section.id}" aria-expanded="${expanded}">
            <span class="fh-caret">${expanded ? '▾' : '▸'}</span>
            <span class="fh-label">${escapeHtml(section.label)}</span>
            <span class="fh-badge${visN === total ? '' : ' partial'}">${sectionCounts(section, visN)}</span>
            ${section.optional ? `<span class="filter-remove" data-remove-filter="${section.id}" title="${escapeHtml(section.label)} ausblenden" aria-label="${escapeHtml(section.label)} ausblenden">×</span>` : ''}
        </button>
        ${body}
    </div>`;
}

function renderAddFilterControl(sections) {
    const shown = new Set(sections.map((s) => s.id));
    const candidates = filterDimensionDefs()
        .map((def) => def.id)
        .filter((id) => !DEFAULT_FILTER_SECTIONS.includes(id) && !shown.has(id))
        .map((id) => dimFilterSection(id, true))
        .filter(Boolean);
    if (candidates.length === 0) {
        return `<div class="filter-add">
            <select id="filter-add-select" aria-label="Weitere Ebene hinzufügen" disabled title="Keine weitere Ebene im Datensatz vorhanden">
                <option value="">+ Ebene hinzufügen</option>
            </select>
            <p class="muted small">Keine weitere Ebene im Datensatz vorhanden.</p>
        </div>`;
    }
    return `<div class="filter-add">
        <select id="filter-add-select" aria-label="Weitere Ebene hinzufügen">
            <option value="">+ Ebene hinzufügen</option>
            ${candidates.map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('')}
        </select>
    </div>`;
}

function renderTeamFilters() {
    const host = document.getElementById('team-filters');
    if (!host) return;
    if (state.customers.length === 0) {
        host.innerHTML = '<p class="muted">Keine Daten geladen.</p>';
        return;
    }
    const sections = filterSections();
    for (const s of sections) {
        if (filterUI.expanded[s.id] === undefined) filterUI.expanded[s.id] = s.entries.length <= COLLAPSE_THRESHOLD;
    }
    let html = sections.map(renderSection).join('') + renderAddFilterControl(sections);
    if (sections.length === 0) {
        html += '<p class="muted small">Keine Gebietsebenen in den Daten. Ergänzen Sie in der Excel-Liste mindestens den Vertriebsbezirk.</p>';
    }
    host.innerHTML = html;
}

/** Nur die Zeilen einer Ebene neu zeichnen (beim Tippen im Suchfeld – hält den Fokus) */
function renderSectionRows(sectionId) {
    const section = filterSections().find((s) => s.id === sectionId);
    const container = document.querySelector(`.filter-rows[data-rows="${sectionId}"]`);
    if (section && container) container.innerHTML = renderRows(section, countBy(section.field), filterUI.search[sectionId] || '');
}

/** Badge (sichtbar/gesamt) einer Ebene aktualisieren, ohne alles neu zu zeichnen */
function updateSectionBadge(sectionId) {
    const section = filterSections().find((s) => s.id === sectionId);
    const head = document.querySelector(`.filter-head[data-toggle="${sectionId}"] .fh-badge`);
    if (!section || !head) return;
    const visN = section.entries.filter(([, v]) => v.visible).length;
    head.textContent = sectionCounts(section, visN);
    head.classList.toggle('partial', visN !== section.entries.length);
}

function setSectionBulk(sectionId, value) {
    const section = filterSections().find((s) => s.id === sectionId);
    if (!section) return;
    const q = (filterUI.search[sectionId] || '').trim().toLowerCase();
    for (const [name, v] of section.entries) {
        if (q && !name.toLowerCase().includes(q)) continue;
        v.visible = value;
    }
    emit('filters:changed');
    persistSettings();
    renderTeamFilters();
}

/** Delegierte Ereignisse für die Team-Filter (einmalig verdrahtet) */
function initTeamFilters() {
    const host = document.getElementById('team-filters');
    if (!host || filterUI.wired) return;
    filterUI.wired = true;

    host.addEventListener('click', (e) => {
        const remove = e.target.closest('[data-remove-filter]');
        if (remove) {
            filterUI.enabled[remove.dataset.removeFilter] = false;
            renderTeamFilters();
            return;
        }
        const head = e.target.closest('[data-toggle]');
        if (head) {
            filterUI.expanded[head.dataset.toggle] = !filterUI.expanded[head.dataset.toggle];
            renderTeamFilters();
            return;
        }
        const bulk = e.target.closest('[data-bulk]');
        if (bulk) setSectionBulk(bulk.dataset.bulk, bulk.dataset.on === '1');
    });

    host.addEventListener('change', (e) => {
        const add = e.target.closest('#filter-add-select');
        if (add && add.value) {
            filterUI.enabled[add.value] = true;
            filterUI.expanded[add.value] = true;
            renderTeamFilters();
            return;
        }
        const cb = e.target.closest('input[data-filter]');
        if (cb) {
            const entry = sectionEntry(cb.dataset.filter, cb.dataset.value);
            if (entry) entry.visible = cb.checked;
            emit('filters:changed');
            persistSettings();
            updateSectionBadge(cb.dataset.filter);
        }
    });

    host.addEventListener('input', (e) => {
        const col = e.target.closest('input[data-color]');
        if (col) {
            const entry = sectionEntry(col.dataset.color, col.dataset.value);
            if (entry) entry.color = col.value;
            renderLegend();
            emit('filters:changed');
            persistSettings();
            return;
        }
        const se = e.target.closest('input[data-search]');
        if (se) {
            filterUI.search[se.dataset.search] = se.value;
            renderSectionRows(se.dataset.search);
        }
    });
}

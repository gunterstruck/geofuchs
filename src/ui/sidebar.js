/**
 * Sidebar: Tabs (Daten / Gebiete / Team / Tour), Datenstatus,
 * Gebietsebenen-Auswahl und Team-Filter (Vertriebsbeauftragte & Gruppen).
 */

import { CONFIG } from '../core/config.js';
import { state, on, emit, UNASSIGNED, visibleCustomers, setCustomers, activeDims, DIMENSIONS, datasetSnapshot } from '../core/state.js';
import { geocodeExact } from '../services/geocode.js';
import { saveDataset, clearDataset, saveSettings } from '../services/storage.js';
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

/** Sidebar auf-/zuklappen (mobil) gemäß state.ui.sidebarOpen */
function applySidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('open', state.ui.sidebarOpen);
    document.getElementById('sidebar-toggle').setAttribute('aria-expanded', String(state.ui.sidebarOpen));
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
        p.classList.toggle('active', p.id === `tab-${tab}`));
}

/** Prüfen, ob ein Tab im gegebenen Modus sichtbar ist */
function tabInMode(tabBtn, mode) {
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
    if (empty) {
        activateTab('daten');
    } else if (userInitiated) {
        activateTab(cfg.primaryTab);
    } else {
        const current = tabs.find((b) => b.dataset.tab === state.ui.activeTab);
        activateTab(!current || current.hidden ? cfg.primaryTab : state.ui.activeTab);
    }

    // Karten-Standard an den Modus anpassen (nur bei aktivem Umschalten)
    if (userInitiated) {
        const mismatched = mode === 'aussendienst'
            ? cfg.areaColorModes.includes(state.colorMode)
            : cfg.markerColorModes.includes(state.colorMode);
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

export function initSidebar() {
    // Fokus-Umschalter
    document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => applyMode(btn.dataset.mode, true));
    });

    // Tabs
    document.querySelectorAll('.tab-button').forEach((btn) => {
        btn.addEventListener('click', () => { activateTab(btn.dataset.tab); persistSettings(); });
    });

    // Standard-Modus anwenden – ohne zu persistieren, damit der gespeicherte
    // Tab/Modus beim anschließenden Wiederherstellen nicht überschrieben wird.
    applyMode(state.ui.mode, false, false);

    // Sidebar-Toggle (mobil)
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        clearTimeout(autoRevealTimer); // Nutzer übernimmt -> kein automatisches Einblenden mehr
        state.ui.sidebarOpen = !state.ui.sidebarOpen;
        applySidebar();
    });
    applySidebar();

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
    document.getElementById('btn-clear').addEventListener('click', async () => {
        if (state.customers.length === 0 && Object.keys(state.territories).length === 0) return;
        if (!confirm('Alle Kundendaten und Gebietszuordnungen aus dem Browser löschen?')) return;
        await clearDataset();
        state.tour.start = null;
        state.tour.stops = [];
        state.fileName = null;
        state.territories = {};
        setCustomers([]);
        emit('tour:changed');
        showToast('Daten gelöscht.', 'success');
    });

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

    on('customers:changed', () => { renderDataStatus(); renderTeamFilters(); renderLegend(); });
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
        auto: 'Zoom bestimmt den Detailgrad: weit → Vertriebsgruppen, mittel → Betriebsbezirke (Flächen mit Umsatz), nah → einzelne Kunden.',
        rep: 'Kunden als Punkte, eingefärbt nach Vertriebsbeauftragtem.',
        bezirk: 'Gebiete flächig nach Betriebsbezirk eingefärbt, mit Name und Umsatzsumme.',
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
            : `<span class="muted small">Keine Spalte „${mode === 'bezirk' ? 'Betriebsbezirk' : 'Vertriebsgruppe'}" in den Daten.</span>`;
    } else if (mode === 'rep') {
        el.innerHTML = legendFromMap([...state.reps.entries()].slice(0, 14));
    } else {
        // auto
        el.innerHTML = legendFromMap([...state.reps.entries()].slice(0, 14));
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
    for (const def of DIMENSIONS) {
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
    if (state.customers.length === 0) {
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
    el.innerHTML = `
        <div class="stat-grid">
            <div class="stat"><b>${total}</b><span>Kunden</span></div>
            <div class="stat"><b>${bezirkeCount}</b><span>Bezirke</span></div>
            <div class="stat"><b>${state.reps.size}</b><span>Vertriebler</span></div>
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
const filterUI = { expanded: {}, search: {}, wired: false };

/** Filter-Ebenen: Vertriebsbeauftragte + aktive Hierarchie-Ebenen */
function filterSections() {
    const sections = [{ id: 'vb', label: 'Vertriebsbeauftragte', field: 'vb', entries: [...state.reps.entries()] }];
    for (const dim of activeDims()) {
        const def = DIMENSIONS.find((d) => d.field === dim.field);
        sections.push({ id: def.id, label: dim.label, field: dim.field, entries: [...dim.values.entries()] });
    }
    return sections;
}

/** Wert-Eintrag ({visible,color}) einer Ebene holen */
function sectionEntry(sectionId, value) {
    return sectionId === 'vb' ? state.reps.get(value) : state.dims[sectionId]?.values.get(value);
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
        </button>
        ${body}
    </div>`;
}

function renderTeamFilters() {
    const host = document.getElementById('team-filters');
    if (!host) return;
    if (state.reps.size === 0) {
        host.innerHTML = '<p class="muted">Keine Daten geladen.</p>';
        return;
    }
    const sections = filterSections();
    for (const s of sections) {
        if (filterUI.expanded[s.id] === undefined) filterUI.expanded[s.id] = s.entries.length <= COLLAPSE_THRESHOLD;
    }
    let html = sections.map(renderSection).join('');
    if (sections.length === 1) {
        html += '<p class="muted small">Keine Hierarchie-Ebenen in den Daten. Ergänzen Sie in der Excel-Liste optional die Spalten Vertriebschannel, Vertriebsgruppe oder Betriebsbezirk.</p>';
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

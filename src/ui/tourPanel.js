/**
 * Besuchsplaner-Panel (Tab "Tour")
 *
 * Ablauf für den Außendienst:
 * 1. Startpunkt wählen: eigener Standort (GPS) oder ein Kunde
 * 2. Vorschläge: "Wen könnte ich in der Nähe noch besuchen?" (Umkreis)
 * 3. Tour zusammenstellen, Reihenfolge optimieren lassen
 * 4. An Google Maps zur Navigation übergeben
 */

import { CONFIG } from '../core/config.js';
import { state, on, emit, getCustomer, repColor, tourScopedCustomers, customerInTourScope, UNASSIGNED } from '../core/state.js';
import { suggestNearby, suggestAlongRoute, optimizeOrder, routeDistance, googleMapsLink } from '../features/tour.js';
import { printDayPlan, downloadIcs } from '../features/tourExport.js';
import { copyText, tourText } from '../features/handoff.js';
import { visitStatus, STATUS_COLORS, STATUS_LABELS } from '../features/visits.js';
import { loadTours, saveTours } from '../services/storage.js';
import { getRoadRoute, routingKey, hasRoutingConsent, requestRoutingConsent } from '../services/routing.js';
import { flyToCustomer, focusPoint, fitTourRoute } from '../features/map.js';
import { showMapView } from './sidebar.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let overdueFirst = false;
let savedTours = [];
let scopeExpanded = false; // Bezirk-Auswahl aufgeklappt?
let tourExpert = false;    // Experten-Modus (mehr Optionen)
let hiddenExpertSections = new Set();
let suggestionRoadKey = '';
let suggestionRoadPath = null;
let suggestionRoadLoading = false;
let suggestionRoadFailed = false;
let suggestionRoadSeq = 0;

const HIDDEN_EXPERT_KEY = 'gf_hidden_expert_sections';
const SWIPE_HIDE_PX = 72;

export function initTourPanel() {
    document.getElementById('btn-my-location').addEventListener('click', useMyLocation);
    document.getElementById('btn-nearby').addEventListener('click', findNearby);

    // Schritt 0: Bezirk wählen (Auswahl klappt danach auf eine schmale Zeile ein)
    const scopeEl = document.getElementById('tour-scope');
    scopeEl.addEventListener('change', (e) => {
        if (e.target.id !== 'tour-bezirk') return;
        state.tour.bezirk = e.target.value;
        pruneTourToScope();
        scopeExpanded = false;
        renderTourScope();
        updatePlannerVisibility();
        emit('tour:scope-changed');
        renderPanel();
    });
    scopeEl.addEventListener('click', (e) => {
        if (e.target.closest('#scope-toggle')) { scopeExpanded = true; renderTourScope(); }
    });

    // Basis-/Experten-Umschalter
    tourExpert = localStorage.getItem('gf_tour_expert') === '1';
    document.querySelectorAll('#tour-mode-toggle .seg').forEach((btn) => {
        btn.addEventListener('click', () => applyTourMode(btn.dataset.tourmode));
    });
    initExpertSwipeControls();

    const radius = document.getElementById('radius-slider');
    radius.value = state.tour.radiusKm;
    document.getElementById('radius-value').textContent = `${state.tour.radiusKm} km`;
    radius.addEventListener('input', () => {
        state.tour.radiusKm = parseInt(radius.value, 10);
        document.getElementById('radius-value').textContent = `${state.tour.radiusKm} km`;
        renderSuggestions();
        if (state.tour.mapFocus) emit('tour:changed');
    });

    // Vorschlagsmodus: Umkreis um Start vs. Korridor entlang der Tour
    document.querySelectorAll('#suggest-mode .seg').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.tour.suggestMode = btn.dataset.mode;
            // Korridor nutzt die Straßenroute (OSRM) – Zustimmung einmalig einholen;
            // ohne Zustimmung arbeitet der Korridor mit der direkten Verbindung.
            if (btn.dataset.mode === 'route') requestRoutingConsent();
            updateSuggestModeUi();
            renderSuggestions();
            if (state.tour.mapFocus) emit('tour:changed');
        });
    });

    document.getElementById('round-trip').checked = state.tour.roundTrip;
    document.getElementById('round-trip').addEventListener('change', (e) => {
        state.tour.roundTrip = e.target.checked;
        emit('tour:changed');
    });

    document.getElementById('overdue-first').addEventListener('change', (e) => {
        overdueFirst = e.target.checked;
        renderSuggestions();
    });

    updateSuggestModeUi();

    document.getElementById('btn-optimize').addEventListener('click', optimizeTour);
    document.getElementById('btn-route-focus').addEventListener('click', showRouteOnMap);
    document.getElementById('btn-gmaps').addEventListener('click', openInGoogleMaps);
    document.getElementById('btn-tour-print').addEventListener('click', () => {
        const eff = effStops();
        if (!state.tour.start || eff.length === 0) return;
        if (!printDayPlan(state.tour.start, eff, { tourName: currentTourName() })) {
            showToast('Bitte Pop-ups für den Druck erlauben.', 'error');
        }
    });
    document.getElementById('btn-tour-ics').addEventListener('click', () => {
        const eff = effStops();
        if (!state.tour.start || eff.length === 0) return;
        downloadIcs(state.tour.start, eff, { tourName: currentTourName() });
        showToast('Kalender-Datei (.ics) erstellt.', 'success');
    });
    document.getElementById('btn-tour-copy').addEventListener('click', async () => {
        const eff = effStops();
        if (!state.tour.start || eff.length === 0) return;
        const roadKm = routeDistance(state.tour.start, eff, state.tour.roundTrip).roadKmEstimate;
        const text = tourText(state.tour.start, tourStops(), destPoint(), {
            tourName: currentTourName(), roadKm, roundTrip: state.tour.roundTrip
        });
        const ok = await copyText(text);
        showToast(ok ? 'Tour als Text in die Zwischenablage kopiert.' : 'Kopieren nicht möglich.', ok ? 'success' : 'error');
    });
    document.getElementById('btn-tour-clear').addEventListener('click', () => {
        state.tour.stops = [];
        state.tour.start = null;
        state.tour.destination = null;
        state.tour.mapFocus = false;
        emit('tour:changed');
    });
    document.getElementById('btn-tour-save').addEventListener('click', saveCurrentTour);

    loadTours().then((tours) => { savedTours = tours; renderSavedTours(); });

    // Startpunkt per Suchfeld (Kunden)
    const startInput = document.getElementById('start-search');
    const startResults = document.getElementById('start-results');
    startInput.addEventListener('input', () => {
        const q = startInput.value.trim().toLowerCase();
        if (q.length < 2) { startResults.innerHTML = ''; return; }
        const hits = tourPool()
            .filter((c) => c.lat !== null && (
                c.name.toLowerCase().includes(q) ||
                c.ort.toLowerCase().includes(q) ||
                c.plz.startsWith(q)
            ))
            .slice(0, 6);
        startResults.innerHTML = hits.map((c) => `
            <button type="button" class="result-row" data-id="${escapeHtml(c.id)}">
                <b>${escapeHtml(c.name)}</b> <span class="muted">${escapeHtml(c.plz)} ${escapeHtml(c.ort)}</span>
            </button>
        `).join('');
        startResults.querySelectorAll('[data-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const c = getCustomer(btn.dataset.id);
                if (!c) return;
                state.tour.start = {
                    lat: c.lat, lng: c.lng, label: c.name, customerId: c.id,
                    strasse: c.strasse, plz: c.plz, ort: c.ort
                };
                startInput.value = '';
                startResults.innerHTML = '';
                emit('tour:changed');
            });
        });
    });

    // Zielpunkt per Suchfeld (Kunden)
    wireCustomerSearch('dest-search', 'dest-results', (c) => {
        const first = !state.tour.destination;
        state.tour.destination = {
            lat: c.lat, lng: c.lng, label: c.name, customerId: c.id,
            strasse: c.strasse, plz: c.plz, ort: c.ort
        };
        // Ein Ziel macht die „Entlang der Tour"-Vorschläge sinnvoll -> beim ersten Mal umschalten
        if (first && state.tour.suggestMode !== 'route') {
            state.tour.suggestMode = 'route';
            updateSuggestModeUi();
        }
        emit('tour:changed');
    });

    on('tour:changed', renderPanel);
    on('customers:changed', () => { pruneTourToScope(); renderTourScope(); renderPanel(); });
    on('filters:changed', renderSuggestions);
    applyTourMode(tourExpert ? 'expert' : 'basic', false);
    renderTourScope();
    renderPanel();
}

/** Bezirks-Auswahl aufbauen; nach Wahl auf eine schmale Zeile eingeklappt */
function renderTourScope() {
    const scope = document.getElementById('tour-scope');
    if (!scope) return;
    const dim = state.dims.bezirk;
    if (!dim?.active || state.customers.length === 0) {
        scope.hidden = true;
        state.tour.bezirk = state.customers.length ? '__all__' : null;
        updatePlannerVisibility();
        return;
    }
    scope.hidden = false;

    const bezirke = [...dim.values.keys()].sort((a, b) => a.localeCompare(b, 'de'));
    if (state.tour.bezirk && state.tour.bezirk !== '__all__' && !bezirke.includes(state.tour.bezirk)) state.tour.bezirk = null;
    const chosen = state.tour.bezirk && state.tour.bezirk !== '__none__';

    if (chosen && !scopeExpanded) {
        // Eingeklappt: schmale Zeile
        const label = state.tour.bezirk === '__all__' ? 'Alle Bezirke' : state.tour.bezirk;
        scope.innerHTML = `<button type="button" id="scope-toggle" class="scope-collapsed">🗺️ Bezirk: <b>${escapeHtml(label)}</b><span class="muted"> · ändern ▸</span></button>`;
        updatePlannerVisibility();
        return;
    }

    // Aufgeklappt: voller Picker + Erklärung
    const counts = new Map();
    for (const c of state.customers) {
        const b = String(c.bezirk ?? '').trim() || UNASSIGNED;
        counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    const opts = ['<option value="__none__">– Bezirk wählen –</option>',
        `<option value="__all__">Alle Bezirke (${state.customers.length})</option>`]
        .concat(bezirke.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)} (${counts.get(b) ?? 0})</option>`)).join('');
    scope.innerHTML = `<label class="field-label" for="tour-bezirk">Für welchen Bezirk planst du?</label>
        <select id="tour-bezirk">${opts}</select>
        <p class="muted small">Wähle deinen Vertriebsbezirk – TourFuchs schlägt dann nur Kunden aus <b>diesem</b> Gebiet für deine Tour vor. Start, Ziel und Route legst du danach fest. („Alle Bezirke" zeigt sämtliche Kunden.)</p>`;
    document.getElementById('tour-bezirk').value = chosen ? state.tour.bezirk : '__none__';
    updatePlannerVisibility();
}

function updatePlannerVisibility() {
    const planner = document.getElementById('tour-planner');
    if (planner) planner.hidden = !(state.tour.bezirk && state.tour.bezirk !== '__none__');
}

/**
 * Basis- vs. Experten-Modus. Basis zeigt nur das Essenzielle (Bezirk, „In meiner
 * Nähe", Start, Umkreis-Vorschläge, Tour + Google Maps). Experte blendet Ziel/
 * Korridor, Kartenansicht, Rundreise, Export und gespeicherte Touren ein.
 */
function applyTourMode(mode, doEmit = true) {
    tourExpert = mode === 'expert';
    try { localStorage.setItem('gf_tour_expert', tourExpert ? '1' : '0'); } catch (e) { /* egal */ }
    const planner = document.getElementById('tour-planner');
    if (planner) planner.classList.toggle('basic', !tourExpert);
    document.querySelectorAll('#tour-mode-toggle .seg').forEach((b) =>
        b.classList.toggle('active', b.dataset.tourmode === (tourExpert ? 'expert' : 'basic')));
    // Schritt-Nummerierung an den Modus anpassen
    const sh = document.getElementById('suggest-head');
    const mh = document.getElementById('mytour-head');
    if (sh) sh.textContent = tourExpert ? '3. Vorschläge' : '2. Vorschläge';
    if (mh) mh.textContent = tourExpert ? '4. Meine Tour' : '3. Meine Tour';
    if (!tourExpert) {
        // Basis: nur Umkreis-Vorschläge, kein Ziel
        state.tour.suggestMode = 'radius';
        state.tour.destination = null;
    }
    updateSuggestModeUi();
    applyHiddenExpertSections();
    if (doEmit) emit('tour:changed');
}

function initExpertSwipeControls() {
    try {
        hiddenExpertSections = new Set(JSON.parse(localStorage.getItem(HIDDEN_EXPERT_KEY) || '[]'));
    } catch (e) {
        hiddenExpertSections = new Set();
    }

    document.querySelectorAll('[data-expert-section]').forEach((el) => {
        if (el.dataset.swipeReady === '1') return;
        el.dataset.swipeReady = '1';
        let startX = 0;
        let startY = 0;
        let swiping = false;

        el.addEventListener('pointerdown', (ev) => {
            const nestedInteractive = ev.target.closest('input, select, textarea, a') ||
                (ev.target.closest('button') && ev.target.closest('[data-expert-section]') !== el);
            if (!canSwipeExpertSection() || nestedInteractive) return;
            startX = ev.clientX;
            startY = ev.clientY;
            swiping = true;
            el.classList.add('swiping');
            el.setPointerCapture?.(ev.pointerId);
        });
        el.addEventListener('pointermove', (ev) => {
            if (!swiping) return;
            const dx = Math.min(0, ev.clientX - startX);
            const dy = Math.abs(ev.clientY - startY);
            if (Math.abs(dx) < 8 || Math.abs(dx) < dy) return;
            ev.preventDefault();
            el.style.setProperty('--swipe-x', `${Math.max(dx, -110)}px`);
        });
        const finish = (ev) => {
            if (!swiping) return;
            const dx = ev.clientX - startX;
            const dy = Math.abs(ev.clientY - startY);
            swiping = false;
            el.classList.remove('swiping');
            el.style.removeProperty('--swipe-x');
            if (dx < -SWIPE_HIDE_PX && Math.abs(dx) > dy * 1.15) hideExpertSection(el.dataset.expertSection);
        };
        el.addEventListener('pointerup', finish);
        el.addEventListener('pointercancel', () => {
            swiping = false;
            el.classList.remove('swiping');
            el.style.removeProperty('--swipe-x');
        });
    });

    document.getElementById('btn-reset-hidden-expert')?.addEventListener('click', resetHiddenExpertSections);
    applyHiddenExpertSections();
}

function canSwipeExpertSection() {
    return tourExpert && window.matchMedia('(max-width: 768px)').matches;
}

function hideExpertSection(key) {
    if (!key) return;
    hiddenExpertSections.add(key);
    saveHiddenExpertSections();
    applyHiddenExpertSections();
    showToast('Element ausgeblendet. Unten kannst du es zurücksetzen.', 'success');
}

function resetHiddenExpertSections() {
    hiddenExpertSections.clear();
    saveHiddenExpertSections();
    applyHiddenExpertSections();
    showToast('Experten-Elemente wieder eingeblendet.', 'success');
}

function saveHiddenExpertSections() {
    try { localStorage.setItem(HIDDEN_EXPERT_KEY, JSON.stringify([...hiddenExpertSections])); } catch (e) { /* egal */ }
}

function applyHiddenExpertSections() {
    document.querySelectorAll('[data-expert-section]').forEach((el) => {
        el.classList.toggle('swipe-hidden', hiddenExpertSections.has(el.dataset.expertSection));
    });
    const reset = document.getElementById('btn-reset-hidden-expert');
    if (reset) reset.hidden = !tourExpert || hiddenExpertSections.size === 0;
}

/** Kundenauswahl der Tour: sichtbare Kunden, ggf. auf den gewählten Bezirk beschränkt */
function tourPool() {
    return tourScopedCustomers();
}

function scopedCustomerById(id) {
    const customer = getCustomer(id);
    return customer && customerInTourScope(customer) ? customer : null;
}

function pruneTourToScope() {
    if (!state.tour.bezirk || state.tour.bezirk === '__none__') {
        state.tour.start = null;
        state.tour.destination = null;
        state.tour.stops = [];
        state.tour.mapFocus = false;
        return;
    }
    state.tour.stops = state.tour.stops.filter((id) => !!scopedCustomerById(id));
    if (state.tour.start?.customerId && !scopedCustomerById(state.tour.start.customerId)) {
        state.tour.start = null;
    }
    if (state.tour.destination?.customerId && !scopedCustomerById(state.tour.destination.customerId)) {
        state.tour.destination = null;
    }
}

/** Kundensuche an ein Eingabefeld hängen (Treffer -> onPick(customer)) */
function wireCustomerSearch(inputId, resultsId, onPick) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) { results.innerHTML = ''; return; }
        const hits = tourPool()
            .filter((c) => c.lat !== null && (
                c.name.toLowerCase().includes(q) ||
                c.ort.toLowerCase().includes(q) ||
                c.plz.startsWith(q)
            ))
            .slice(0, 6);
        results.innerHTML = hits.map((c) => `
            <button type="button" class="result-row" data-id="${escapeHtml(c.id)}">
                <b>${escapeHtml(c.name)}</b> <span class="muted">${escapeHtml(c.plz)} ${escapeHtml(c.ort)}</span>
            </button>`).join('');
        results.querySelectorAll('[data-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const c = getCustomer(btn.dataset.id);
                if (!c) return;
                input.value = '';
                results.innerHTML = '';
                onPick(c);
            });
        });
    });
}

function useMyLocation() {
    if (!navigator.geolocation) {
        showToast('Standortbestimmung wird von diesem Browser nicht unterstützt.', 'error');
        return;
    }
    showToast('Standort wird ermittelt…', 'info', 2000);
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            state.tour.start = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                label: 'Mein Standort'
            };
            emit('tour:changed');
        },
        () => showToast('Standort konnte nicht ermittelt werden. Bitte Freigabe prüfen.', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/**
 * „Was ist in meiner Nähe?": GPS-Standort als Start, Umkreis-Modus, überfällige
 * zuerst – sofort ohne vorher eine Tour zu bauen. Zeigt die nächsten Kunden.
 */
function findNearby() {
    if (!navigator.geolocation) {
        showToast('Standortbestimmung wird von diesem Browser nicht unterstützt.', 'error');
        return;
    }
    if (state.customers.length === 0) {
        showToast('Bitte zuerst Kundendaten laden.', 'info');
        return;
    }
    showToast('Standort wird ermittelt…', 'info', 2000);
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const here = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Mein Standort' };
            state.tour.start = here;
            state.tour.suggestMode = 'radius';
            overdueFirst = true;
            const cb = document.getElementById('overdue-first');
            if (cb) cb.checked = true;
            updateSuggestModeUi();
            emit('tour:changed');
            focusPoint(here.lat, here.lng, 11);
            const near = suggestNearby(here, tourPool(), state.tour.radiusKm, new Set(), true);
            showToast(near.length
                ? `${near.length} Kunde(n) im Umkreis von ${state.tour.radiusKm} km – überfällige zuerst.`
                : `Keine sichtbaren Kunden im Umkreis von ${state.tour.radiusKm} km. Umkreis erhöhen?`,
                near.length ? 'success' : 'info', 5000);
        },
        () => showToast('Standort konnte nicht ermittelt werden. Bitte Freigabe prüfen.', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function tourStops() {
    return state.tour.stops.map(getCustomer).filter((c) => c && c.lat !== null);
}

/** Zielpunkt (falls gesetzt und verortet) – bevorzugt das echte Kundenobjekt */
function destPoint() {
    const d = state.tour.destination;
    if (!d) return null;
    if (d.customerId) {
        const c = getCustomer(d.customerId);
        if (c && c.lat !== null) return c; // volle Kundendaten für Druck/ICS/Maps
    }
    return d.lat !== null && d.lng !== null ? d : null;
}

/** Effektive Streckenpunkte nach dem Start: Zwischenstopps + optionales Ziel am Ende */
function effStops() {
    const dest = destPoint();
    return dest ? [...tourStops(), dest] : tourStops();
}

function suggestionRoutePoints() {
    if (!state.tour.start) return [];
    const points = [state.tour.start, ...effStops()];
    if (state.tour.roundTrip && points.length > 1) points.push(state.tour.start);
    return points.filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
}

function requestSuggestionRoadRoute(points) {
    const key = routingKey(points);
    if (key === suggestionRoadKey) return;
    const seq = ++suggestionRoadSeq;
    suggestionRoadKey = key;
    suggestionRoadPath = null;
    suggestionRoadLoading = true;
    suggestionRoadFailed = false;
    updateSuggestModeUi();

    getRoadRoute(points).then((route) => {
        if (seq !== suggestionRoadSeq || key !== suggestionRoadKey) return;
        suggestionRoadLoading = false;
        suggestionRoadFailed = !route?.latLngs?.length;
        suggestionRoadPath = route?.latLngs?.map(([lat, lng]) => ({ lat, lng })) || null;
        updateSuggestModeUi();
        renderSuggestions();
        if (state.tour.mapFocus) emit('tour:changed');
    });
}

function toggleRouteLineMode() {
    const wantRoad = state.tour.routeLineMode !== 'road';
    if (wantRoad && !requestRoutingConsent()) return state.tour.routeLineMode;
    state.tour.routeLineMode = wantRoad ? 'road' : 'air';
    emit('tour:changed');
    return state.tour.routeLineMode;
}

function currentTourName() {
    const input = document.getElementById('tour-name');
    return (input.value.trim()) || (state.tour.start ? `Tour ab ${state.tour.start.label}` : 'Tagestour');
}

function renderPanel() {
    const roundTrip = document.getElementById('round-trip');
    if (roundTrip) roundTrip.checked = state.tour.roundTrip;
    renderStart();
    renderDest();
    updateSuggestModeUi(); // Modus kann auch von der Karte („Als Ziel") gesetzt werden
    renderStops();
    renderSuggestions();
}

function renderDest() {
    const el = document.getElementById('tour-dest');
    const d = state.tour.destination;
    if (!d) {
        el.innerHTML = state.tour.roundTrip && state.tour.start
            ? '<p class="muted small">Rundreise aktiv: Das Ziel ist automatisch wieder der Startpunkt.</p>'
            : '<p class="muted small">Kein Ziel gewählt. Ohne Rundreise ist der letzte Stopp automatisch das Ziel.</p>';
        return;
    }
    el.innerHTML = `<div class="start-chip">🏁 <b>${escapeHtml(d.label)}</b>
        <button type="button" id="btn-dest-clear" class="chip-x" title="Ziel entfernen">✕</button></div>`;
    document.getElementById('btn-dest-clear').addEventListener('click', () => {
        state.tour.destination = null;
        emit('tour:changed');
    });
}

function renderStart() {
    const el = document.getElementById('tour-start');
    if (!state.tour.start) {
        el.innerHTML = '<p class="muted">Kein Startpunkt gewählt. Nutzen Sie Ihren Standort oder wählen Sie einen Kunden (Suche unten oder Karten-Popup „Als Start“).</p>';
        return;
    }
    el.innerHTML = `<div class="start-chip">🚩 <b>${escapeHtml(state.tour.start.label)}</b></div>`;
}

function renderStops() {
    const el = document.getElementById('tour-stops');
    const stops = state.tour.stops.map(getCustomer).filter(Boolean);
    const explicitDest = destPoint();
    const autoLastStopIsDestination = !state.tour.roundTrip && !explicitDest && stops.length > 0;

    if (stops.length === 0) {
        el.innerHTML = `<div class="tour-empty-guide">
            <b>Noch keine Stopps</b>
            <ol>
                <li>Startpunkt wählen</li>
                <li>Kunden aus Vorschlägen oder Karten-Popups hinzufügen</li>
                <li>Route auf der Karte anzeigen</li>
            </ol>
        </div>`;
    } else {
        el.innerHTML = stops.map((c, i) => `
            <div class="stop-row${autoLastStopIsDestination && i === stops.length - 1 ? ' final-row' : ''}">
                <span class="stop-num">${i + 1}</span>
                <span class="stop-name" title="${escapeHtml(c.name)}">
                    ${escapeHtml(c.name)}
                    ${autoLastStopIsDestination && i === stops.length - 1 ? '<span class="route-role">Ziel</span>' : ''}
                    <br><span class="muted small">${escapeHtml(c.plz)} ${escapeHtml(c.ort)}</span>
                </span>
                <span class="stop-actions">
                    <button type="button" data-up="${i}" title="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button>
                    <button type="button" data-down="${i}" title="Nach unten" ${i === stops.length - 1 ? 'disabled' : ''}>↓</button>
                    <button type="button" data-remove="${i}" title="Entfernen">✕</button>
                </span>
            </div>
        `).join('');

        el.querySelectorAll('[data-remove]').forEach((btn) => btn.addEventListener('click', () => {
            state.tour.stops.splice(parseInt(btn.dataset.remove, 10), 1);
            emit('tour:changed');
        }));
        el.querySelectorAll('[data-up]').forEach((btn) => btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.up, 10);
            [state.tour.stops[i - 1], state.tour.stops[i]] = [state.tour.stops[i], state.tour.stops[i - 1]];
            emit('tour:changed');
        }));
        el.querySelectorAll('[data-down]').forEach((btn) => btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.down, 10);
            [state.tour.stops[i + 1], state.tour.stops[i]] = [state.tour.stops[i], state.tour.stops[i + 1]];
            emit('tour:changed');
        }));
    }

    // Ziel als fester Streckenabschluss anzeigen
    if (explicitDest || state.tour.destination) {
        const d = state.tour.destination;
        const label = d?.label || explicitDest?.name || 'Ziel';
        el.insertAdjacentHTML('beforeend', `
            <div class="stop-row dest-row">
                <span class="stop-num">🏁</span>
                <span class="stop-name" title="${escapeHtml(label)}">Ziel: ${escapeHtml(label)}</span>
                <span class="stop-actions"><button type="button" id="dest-row-x" title="Ziel entfernen">✕</button></span>
            </div>`);
        const x = document.getElementById('dest-row-x');
        if (x) x.addEventListener('click', () => { state.tour.destination = null; emit('tour:changed'); });
    }

    if (state.tour.roundTrip && state.tour.start && effStops().length > 0) {
        el.insertAdjacentHTML('beforeend', `
            <div class="stop-row return-row">
                <span class="stop-num">↩</span>
                <span class="stop-name" title="${escapeHtml(state.tour.start.label)}">
                    Ziel: zurück zum Start<br><span class="muted small">${escapeHtml(state.tour.start.label)}</span>
                </span>
            </div>`);
    }

    // Distanz & Aktions-Buttons – Ziel zählt als letzter Streckenpunkt mit
    const summary = document.getElementById('tour-summary');
    const eff = effStops();
    if (state.tour.start && eff.length > 0) {
        const { airKm, roadKmEstimate } = routeDistance(state.tour.start, eff, state.tour.roundTrip);
        const rt = state.tour.roundTrip ? ' als Rundreise' : '';
        const endHint = state.tour.roundTrip
            ? 'Ziel ist wieder der Start.'
            : (explicitDest ? 'Ziel festgelegt.' : 'Letzter Stopp ist automatisch Ziel.');
        const exportHint = eff.length > CONFIG.tour.maxWaypoints + 1 ? `, Google-Maps-Export: max. ${CONFIG.tour.maxWaypoints + 1} Stopps` : "";
        summary.innerHTML = `Geschätzte Strecke${rt}: <b>~${Math.round(roadKmEstimate)} km</b> <span class="muted small">${endHint} ${Math.round(airKm)} km Luftlinie${exportHint}.</span>`;
    } else {
        summary.innerHTML = '';
    }
    const hasRoute = state.tour.start && eff.length >= 1;
    document.getElementById('btn-optimize').disabled = !(state.tour.start && tourStops().length >= 2);
    const routeFocus = document.getElementById('btn-route-focus');
    routeFocus.disabled = !hasRoute;
    routeFocus.textContent = !state.tour.mapFocus
        ? '🗺️ Route auf Karte anzeigen'
        : (state.tour.routeLineMode === 'road' ? '🗺️ Luftlinie anzeigen' : '🗺️ Straßenroute anzeigen');
    document.getElementById('btn-gmaps').disabled = !hasRoute;
    document.getElementById('btn-tour-print').disabled = !hasRoute;
    document.getElementById('btn-tour-ics').disabled = !hasRoute;
    document.getElementById('btn-tour-copy').disabled = !hasRoute;
    document.getElementById('btn-tour-save').disabled = !hasRoute;
    document.getElementById('btn-tour-clear').disabled = !(state.tour.start || state.tour.destination || stops.length > 0);
}

/** Segment-Umschalter + Slider-Beschriftung an den Modus anpassen */
function updateSuggestModeUi() {
    const route = state.tour.suggestMode === 'route';
    document.querySelectorAll('#suggest-mode .seg').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === state.tour.suggestMode);
    });
    document.getElementById('radius-label').textContent = route ? 'Korridor (Abstand zur Route)' : 'Umkreis';
    document.getElementById('suggest-hint').textContent = route
        ? (!hasRoutingConsent()
            ? 'Vorschläge entlang der direkten Verbindung. Für den tatsächlichen Straßenverlauf der Straßenroute (OSRM) zustimmen – siehe Datenschutz.'
            : suggestionRoadLoading
                ? 'Straßenroute wird berechnet. Danach erscheinen Kunden im Korridor entlang des tatsächlichen Straßenverlaufs.'
                : suggestionRoadFailed
                    ? 'Straßenroute derzeit nicht verfügbar. Vorschläge verwenden vorübergehend die direkte Verbindung.'
                    : suggestionRoadPath
                        ? 'Kunden entlang der berechneten Straßenroute, höchstens so weit neben dem tatsächlichen Straßenverlauf.'
                        : 'Kunden entlang der Tour. Sobald Start und Ziel feststehen, wird der Straßenverlauf berechnet.')
        : 'Kunden im Umkreis des Startpunkts.';
}

function renderSuggestions() {
    const el = document.getElementById('tour-suggestions');
    if (!state.tour.start) { el.innerHTML = ''; return; }

    const exclude = new Set(state.tour.stops);
    if (state.tour.start.customerId) exclude.add(state.tour.start.customerId);
    if (state.tour.destination?.customerId) exclude.add(state.tour.destination.customerId);

    const routeMode = state.tour.suggestMode === 'route';
    const pool = tourPool();
    const routePoints = routeMode ? suggestionRoutePoints() : [];
    if (routeMode && routePoints.length >= 2) {
        const key = routingKey(routePoints);
        if (key !== suggestionRoadKey) requestSuggestionRoadRoute(routePoints);
        if (suggestionRoadLoading) {
            el.innerHTML = '<p class="muted"><span class="spinner"></span> Straßenroute und passende Kunden werden berechnet…</p>';
            return;
        }
    }
    const suggestions = routeMode
        ? suggestAlongRoute(state.tour.start, effStops(), pool, state.tour.radiusKm, exclude, state.tour.roundTrip, overdueFirst, suggestionRoadPath)
        : suggestNearby(state.tour.start, pool, state.tour.radiusKm, exclude, overdueFirst);

    if (suggestions.length === 0) {
        const noRoute = routeMode && effStops().length === 0;
        el.innerHTML = routeMode
            ? (noRoute
                ? '<p class="muted">Für Vorschläge entlang der Strecke bitte ein <b>Ziel</b> wählen (oder einen Stopp hinzufügen). Dann werden Kunden entlang des Wegs vorgeschlagen.</p>'
                : '<p class="muted">Keine weiteren (sichtbaren) Kunden im Korridor entlang der Strecke. Tipp: Korridor vergrößern.</p>')
            : '<p class="muted">Keine weiteren (sichtbaren) Kunden im gewählten Umkreis.</p>';
        return;
    }
    el.innerHTML = suggestions.map(({ customer: c, km }) => {
        const status = visitStatus(c);
        const statusTag = c.rhythmusWochen
            ? `<span class="mini-badge" style="background:${STATUS_COLORS[status]}" title="${STATUS_LABELS[status]}"></span>`
            : '';
        return `
        <div class="suggestion-row">
            <span class="dot" style="background:${repColor(c.vb)}"></span>
            <button type="button" class="suggestion-name" data-fly="${escapeHtml(c.id)}" title="Auf Karte zeigen">
                ${escapeHtml(c.name)} ${statusTag}<br><span class="muted small">${escapeHtml(c.plz)} ${escapeHtml(c.ort)} · ${km.toFixed(1)} km</span>
            </button>
            <button type="button" class="suggestion-add" data-add="${escapeHtml(c.id)}" title="Zur Tour hinzufügen">＋</button>
        </div>`;
    }).join('');

    el.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
        if (!state.tour.stops.includes(btn.dataset.add)) {
            state.tour.stops.push(btn.dataset.add);
            emit('tour:changed');
        }
    }));
    el.querySelectorAll('[data-fly]').forEach((btn) => btn.addEventListener('click', () => {
        const c = getCustomer(btn.dataset.fly);
        if (c) flyToCustomer(c);
    }));
}

function optimizeTour() {
    const stops = tourStops();
    if (!state.tour.start || stops.length < 2) return;
    // Fester Streckenendpunkt: Zielkunde, sonst bei Rundreise der Start, sonst offen
    const endPoint = destPoint() || (state.tour.roundTrip ? state.tour.start : null);
    const before = routeDistance(state.tour.start, effStops(), state.tour.roundTrip).airKm;
    const optimized = optimizeOrder(state.tour.start, stops, endPoint);
    state.tour.stops = optimized.map((c) => c.id);
    const dest = destPoint();
    const after = routeDistance(state.tour.start, dest ? [...optimized, dest] : optimized, state.tour.roundTrip).airKm;
    emit('tour:changed');
    const savedKm = (before - after) * CONFIG.tour.roadFactor;
    showToast(savedKm > 0.5
        ? `Reihenfolge optimiert – spart ca. ${Math.round(savedKm)} km.`
        : 'Reihenfolge ist bereits optimal.', 'success');
}

function openInGoogleMaps() {
    const eff = effStops();
    if (!state.tour.start || eff.length === 0) return;
    if (eff.length > CONFIG.tour.maxWaypoints + 1) {
        showToast(`Google Maps unterstützt max. ${CONFIG.tour.maxWaypoints + 1} Stopps – es werden die ersten ${CONFIG.tour.maxWaypoints + 1} übergeben.`, 'info', 6000);
    }
    const link = googleMapsLink(state.tour.start, eff, state.tour.roundTrip);
    if (link) window.open(link, '_blank', 'noopener');
}

function showRouteOnMap() {
    const eff = effStops();
    if (!state.tour.start || eff.length === 0) {
        showToast('Bitte Startpunkt und mindestens einen Stopp wählen.', 'info');
        return;
    }
    if (state.tour.mapFocus) {
        const mode = toggleRouteLineMode();
        showMapView();
        showToast(mode === 'road'
            ? 'Straßenroute wird auf der Karte angezeigt.'
            : 'Luftlinienroute wird auf der Karte angezeigt.',
            'success', 2400);
        return;
    }
    state.tour.mapFocus = true;
    state.tour.routeLineMode = 'air';
    showMapView();
    window.setTimeout(() => {
        const ok = fitTourRoute();
        showToast(ok
            ? 'Route und passende Vorschlagskunden werden auf der Karte angezeigt.'
            : 'Route konnte noch nicht angezeigt werden.',
            ok ? 'success' : 'info', 3000);
        emit('tour:changed');
    }, window.innerWidth <= 768 ? 140 : 0);
}

// ---- Gespeicherte Touren ----

async function saveCurrentTour() {
    if (!state.tour.start || (state.tour.stops.length === 0 && !state.tour.destination)) return;
    const name = currentTourName();
    // Startpunkt vollständig sichern (auch GPS-Standorte ohne Kunden-Id)
    const tour = {
        id: `tour-${Date.now()}`,
        name,
        savedAt: new Date().toISOString(),
        start: { ...state.tour.start },
        destination: state.tour.destination ? { ...state.tour.destination } : null,
        roundTrip: !!state.tour.roundTrip,
        stopIds: [...state.tour.stops]
    };
    // gleicher Name -> ersetzen
    savedTours = savedTours.filter((t) => t.name !== name);
    savedTours.unshift(tour);
    await saveTours(savedTours);
    document.getElementById('tour-name').value = '';
    renderSavedTours();
    showToast(`Tour „${name}" gespeichert.`, 'success');
}

function loadSavedTour(id) {
    const tour = savedTours.find((t) => t.id === id);
    if (!tour) return;
    // nur noch existierende Kunden übernehmen
    const validIds = tour.stopIds.filter((sid) => getCustomer(sid));
    state.tour.start = { ...tour.start };
    // Ziel übernehmen, sofern der Kunde (falls verknüpft) noch existiert
    state.tour.destination = (tour.destination && (!tour.destination.customerId || getCustomer(tour.destination.customerId)))
        ? { ...tour.destination } : null;
    state.tour.roundTrip = !!tour.roundTrip;
    state.tour.stops = validIds;
    emit('tour:changed');
    const lost = tour.stopIds.length - validIds.length;
    showToast(lost > 0
        ? `Tour „${tour.name}" geladen (${lost} nicht mehr vorhandene Kunden ausgelassen).`
        : `Tour „${tour.name}" geladen.`, 'success');
}

async function deleteSavedTour(id) {
    savedTours = savedTours.filter((t) => t.id !== id);
    await saveTours(savedTours);
    renderSavedTours();
}

function renderSavedTours() {
    const el = document.getElementById('saved-tours');
    if (!el) return;
    if (savedTours.length === 0) {
        el.innerHTML = '<p class="muted small">Noch keine Touren gespeichert.</p>';
        return;
    }
    el.innerHTML = savedTours.map((t) => `
        <div class="saved-tour-row">
            <button type="button" class="saved-tour-load" data-load="${escapeHtml(t.id)}" title="Tour laden">
                <b>${escapeHtml(t.name)}</b><br>
                <span class="muted small">${t.stopIds.length} Stopp${t.stopIds.length === 1 ? '' : 's'} · ab ${escapeHtml(t.start.label)}</span>
            </button>
            <button type="button" class="saved-tour-del" data-del="${escapeHtml(t.id)}" title="Löschen">🗑</button>
        </div>
    `).join('');
    el.querySelectorAll('[data-load]').forEach((btn) =>
        btn.addEventListener('click', () => loadSavedTour(btn.dataset.load)));
    el.querySelectorAll('[data-del]').forEach((btn) =>
        btn.addEventListener('click', () => deleteSavedTour(btn.dataset.del)));
}

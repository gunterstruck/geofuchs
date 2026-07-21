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
import { state, on, emit, getCustomer, repColor, customerInTourScope, markDirty, clearServiceTourPlan, UNASSIGNED } from '../core/state.js';
import { suggestNearby, countNearby, suggestAlongRoute, optimizeOrder, routeDistance, googleMapsLink } from '../features/tour.js';
import { printDayPlan, downloadIcs, DEFAULT_VISIT_MINUTES } from '../features/tourExport.js';
import { combinePlanStart, todayInputValue } from '../features/dayPlanner.js';
import { encodeTourPayload, MAX_QR_STOPS } from '../features/tourShare.js';
import { initTourQr, openShareDialog } from './tourQr.js';
import { noteTourSharedToPhone } from './firstSteps.js';
import { zanoboMachineUrl } from '../services/zanobo.js';
import { copyText, tourText } from '../features/handoff.js';
import { visitStatus, STATUS_COLORS, STATUS_LABELS, markVisitedToday, lastVisit, agoText } from '../features/visits.js';
import { loadTours, saveTours } from '../services/storage.js';
import { getRoadRoute, routingKey, hasRoutingConsent, requestRoutingConsent } from '../services/routing.js';
import { flyToCustomer, focusPoint, fitTourRoute } from '../features/map.js';
import { modeVisibleCustomers, modeTourCustomers } from '../features/customerScope.js';
import { proposeServiceDay } from '../features/serviceDayPlanner.js';
import { serviceVisitWindow } from '../features/serviceVisits.js';
import { normalizeCustomerNumber } from '../features/serviceContracts.js';
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
let serviceDayPreview = null;
let serviceDayGroups = new Map();

const HIDDEN_EXPERT_KEY = 'gf_hidden_expert_sections';
const SWIPE_HIDE_PX = 72;

export function initTourPanel() {
    document.getElementById('btn-my-location').addEventListener('click', useMyLocation);
    document.getElementById('btn-nearby').addEventListener('click', findNearby);

    // Plan-Einstellungen (Datum/Startzeit/Besuchsdauer) + QR-Übergabe
    document.getElementById('plan-date').value = todayInputValue();
    document.getElementById('btn-service-day-preview')?.addEventListener('click', buildServiceDayPreview);
    document.getElementById('btn-tour-qr').addEventListener('click', shareTourAsQr);
    initTourQr();

    // Schritt 0: Bezirk wählen (Auswahl klappt danach auf eine schmale Zeile ein)
    const scopeEl = document.getElementById('tour-scope');
    scopeEl.addEventListener('change', (e) => {
        if (e.target.id !== 'tour-bezirk') return;
        invalidateAcceptedServicePlan();
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

    // Tour-Tiefe folgt der globalen Ansichtstiefe (Basis/Profi).
    on('depth:changed', () => applyTourMode(state.ui.depth === 'profi' ? 'expert' : 'basic'));
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
        invalidateAcceptedServicePlan(true);
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
    // Umschalter über der Karte nutzt denselben Ablauf (toggelt Luftlinie/Straße).
    document.getElementById('btn-route-mode')?.addEventListener('click', showRouteOnMap);
    document.getElementById('btn-gmaps').addEventListener('click', openInGoogleMaps);
    document.getElementById('btn-tour-print').addEventListener('click', () => {
        const eff = effStops();
        if (!state.tour.start || eff.length === 0) return;
        if (!printDayPlan(state.tour.start, eff, { tourName: currentTourName(), ...planOptions() })) {
            showToast('Bitte Pop-ups für den Druck erlauben.', 'error');
        }
    });
    document.getElementById('btn-tour-ics').addEventListener('click', () => {
        const eff = effStops();
        if (!state.tour.start || eff.length === 0) return;
        downloadIcs(state.tour.start, eff, { tourName: currentTourName(), ...planOptions() });
        showToast('Kalender-Datei (.ics) mit Terminen je Besuch erstellt.', 'success');
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
        clearAcceptedServicePlan();
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
                invalidateAcceptedServicePlan(true);
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
        invalidateAcceptedServicePlan(true);
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
    on('filters:changed', refreshPlanningScope);
    on('mode:changed', refreshPlanningScope);
    on('service-customer-scope:changed', refreshPlanningScope);
    on('service-contracts:changed', refreshPlanningScope);
    on('service-visits:changed', refreshPlanningScope);
    on('service-day:focus', focusServiceDayPlanner);
    syncModeSpecificTourControls();
    initTourAccordion();
    applyTourMode(state.ui.depth === 'profi' ? 'expert' : 'basic', false);
    renderTourScope();
    renderPanel();
}

/** Bezirks-Auswahl aufbauen; nach Wahl auf eine schmale Zeile eingeklappt */
function renderTourScope() {
    const scope = document.getElementById('tour-scope');
    if (!scope) return;
    const availableCustomers = modeVisibleCustomers();
    const contractScope = state.ui.mode === 'service' && state.ui.serviceCustomerScope !== 'all';
    const customerLabel = contractScope ? 'Vertragskunden' : 'Kunden';
    const dim = state.dims.bezirk;
    if (state.customers.length === 0) {
        scope.hidden = true;
        state.tour.bezirk = null;
        updatePlannerVisibility();
        return;
    }
    if (availableCustomers.length === 0) {
        scope.hidden = false;
        scope.innerHTML = `<div class="contract-empty compact" role="status">
            <b>Keine ${contractScope ? 'Vertragskunden' : 'Kunden'} für die Tour</b>
            <span>${contractScope
                ? 'Im aktuellen Kunden- und Vertragsstand ist kein eindeutig zugeordneter aktiver Servicevertrag planbar. Oben kannst du bewusst auf „Alle Kunden“ wechseln.'
                : 'Die aktuellen Kundenfilter liefern keine planbaren Treffer.'}</span>
        </div>`;
        const planner = document.getElementById('tour-planner');
        if (planner) planner.hidden = true;
        return;
    }
    if (!dim?.active) {
        scope.hidden = true;
        state.tour.bezirk = '__all__';
        updatePlannerVisibility();
        return;
    }
    scope.hidden = false;

    const allBezirke = [...dim.values.keys()];
    if (state.tour.bezirk && state.tour.bezirk !== '__all__' && !allBezirke.includes(state.tour.bezirk)) state.tour.bezirk = null;
    const chosen = state.tour.bezirk && state.tour.bezirk !== '__none__';

    const counts = new Map();
    for (const customer of availableCustomers) {
        const bezirk = String(customer.bezirk ?? '').trim() || UNASSIGNED;
        counts.set(bezirk, (counts.get(bezirk) ?? 0) + 1);
    }
    const bezirke = allBezirke
        .filter((bezirk) => (counts.get(bezirk) ?? 0) > 0 || bezirk === state.tour.bezirk)
        .sort((a, b) => a.localeCompare(b, 'de'));

    if (chosen && !scopeExpanded) {
        // Eingeklappt: schmale Zeile
        const label = state.tour.bezirk === '__all__' ? 'Alle Bezirke' : state.tour.bezirk;
        const count = state.tour.bezirk === '__all__'
            ? availableCustomers.length
            : (counts.get(state.tour.bezirk) ?? 0);
        scope.innerHTML = `<button type="button" id="scope-toggle" class="scope-collapsed">🗺️ Bezirk: <b>${escapeHtml(label)}</b><span class="muted"> · ${count} ${customerLabel} · ändern ▸</span></button>`;
        updatePlannerVisibility();
        return;
    }

    // Aufgeklappt: voller Picker + Erklärung
    const opts = ['<option value="__none__">– Bezirk wählen –</option>',
        `<option value="__all__">Alle Bezirke (${availableCustomers.length})</option>`]
        .concat(bezirke.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)} (${counts.get(b) ?? 0})</option>`)).join('');
    scope.innerHTML = `<label class="field-label" for="tour-bezirk">Für welchen Bezirk planst du?</label>
        <select id="tour-bezirk">${opts}</select>
        <p class="muted small">Wähle deinen Bezirk – TourFuchs schlägt dann nur ${contractScope ? '<b>Vertragskunden</b>' : 'Kunden'} aus diesem Gebiet für deine Tour vor. Start, Ziel und Route legst du danach fest. („Alle Bezirke" zeigt ${contractScope ? 'alle planbaren Vertragskunden' : 'sämtliche sichtbaren Kunden'}.)</p>`;
    document.getElementById('tour-bezirk').value = chosen ? state.tour.bezirk : '__none__';
    updatePlannerVisibility();
}

/** Planungspool wechseln, ohne eine bereits zusammengestellte Tour zu löschen. */
function refreshPlanningScope() {
    syncModeSpecificTourControls();
    document.getElementById('start-results')?.replaceChildren();
    document.getElementById('dest-results')?.replaceChildren();
    renderTourScope();
    renderPanel();
}

/** Vertriebs-Priorisierung im Service ausblenden und sicher deaktivieren. */
function syncModeSpecificTourControls() {
    const service = state.ui.mode === 'service';
    const mapView = document.getElementById('tour-sales-map-view');
    const priority = document.getElementById('tour-sales-priority');
    if (mapView) mapView.hidden = service;
    if (priority) priority.hidden = service;
    const servicePlanner = document.getElementById('service-day-planner');
    const endField = document.getElementById('service-plan-end-field');
    if (servicePlanner) servicePlanner.hidden = !service;
    if (endField) endField.hidden = !service;
    if (service) {
        overdueFirst = false;
        const checkbox = document.getElementById('overdue-first');
        if (checkbox) checkbox.checked = false;
    } else {
        serviceDayPreview = null;
        const preview = document.getElementById('service-day-preview');
        if (preview) preview.innerHTML = '';
    }
}

function clearAcceptedServicePlan() {
    clearServiceTourPlan();
}

function invalidateAcceptedServicePlan(notify = false) {
    if (!clearServiceTourPlan()) return;
    serviceDayPreview = null;
    renderServiceDayPreview();
    if (notify) showToast('Der bestätigte Service-Zeitplan wurde wegen der manuellen Touränderung verworfen.', 'info', 4500);
}

function exactCustomerIndex() {
    const index = new Map();
    for (const customer of state.customers || []) {
        const number = normalizeCustomerNumber(customer?.nummer);
        if (!number) continue;
        if (!index.has(number)) index.set(number, []);
        index.get(number).push(customer);
    }
    return index;
}

function windowTimeForDate(value, workDate) {
    const raw = String(value || '').trim();
    if (!raw) return { value: '', matchesDate: true };
    if (/^\d{1,2}:\d{2}$/.test(raw)) return { value: raw, matchesDate: true };
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})/);
    return match
        ? { value: match[2], matchesDate: match[1] === workDate }
        : { value: raw, matchesDate: true };
}

function priorityRank(value) {
    return ['KRITISCH', 'HOCH', 'MITTEL', 'NIEDRIG'].indexOf(String(value || '').toUpperCase());
}

function buildServiceJobGroups(workDate) {
    const index = exactCustomerIndex();
    const assignee = String(document.getElementById('service-plan-assignee')?.value || '').trim();
    const scope = state.ui.serviceCustomerScope === 'now' ? 'now' : 'week';
    const groups = new Map();
    const skipped = [];

    for (const visit of state.serviceVisits || []) {
        if (!serviceVisitWindow(visit, scope)) continue;
        if (assignee && visit.assignedTo !== assignee) continue;
        const customers = index.get(normalizeCustomerNumber(visit.customerNumber)) || [];
        if (customers.length !== 1) {
            skipped.push({ visit, reason: 'Kunde nicht eindeutig zugeordnet' });
            continue;
        }
        const customer = customers[0];
        if (!customerInTourScope(customer)) continue;
        const startWindow = windowTimeForDate(visit.timeWindowStart, workDate);
        const endWindow = windowTimeForDate(visit.timeWindowEnd, workDate);
        if (!startWindow.matchesDate || !endWindow.matchesDate) {
            skipped.push({ visit, customer, reason: 'Termin liegt an einem anderen Tag' });
            continue;
        }
        if (!groups.has(customer.id)) {
            groups.set(customer.id, {
                id: `service-stop:${customer.id}`,
                customer,
                visits: [],
                durationMin: 0,
                priority: 'NIEDRIG',
                dueDate: '',
                slaDueAt: '',
                timeWindowStart: '',
                timeWindowEnd: '',
                requiredSkills: []
            });
        }
        const group = groups.get(customer.id);
        group.visits.push(visit);
        group.durationMin += Number(visit.durationMin) || Number(document.getElementById('plan-visit-min')?.value) || DEFAULT_VISIT_MINUTES;
        if (priorityRank(visit.priority) >= 0 && (priorityRank(group.priority) < 0 || priorityRank(visit.priority) < priorityRank(group.priority))) {
            group.priority = visit.priority;
        }
        if (!group.dueDate || String(visit.dueDate) < group.dueDate) group.dueDate = visit.dueDate;
        if (visit.slaDueAt && (!group.slaDueAt || String(visit.slaDueAt) < group.slaDueAt)) group.slaDueAt = visit.slaDueAt;
        if (startWindow.value && (!group.timeWindowStart || startWindow.value > group.timeWindowStart)) group.timeWindowStart = startWindow.value;
        if (endWindow.value && (!group.timeWindowEnd || endWindow.value < group.timeWindowEnd)) group.timeWindowEnd = endWindow.value;
        group.requiredSkills = [...new Set([...group.requiredSkills, ...(visit.requiredSkills || [])])];
    }
    return { groups: [...groups.values()], skipped, scope };
}

function plannerReasonText(reason) {
    const labels = {
        'missing-skills': 'Qualifikation fehlt',
        'missing-or-invalid-customer-coordinates': 'keine Kartenposition',
        'time-window-missed': 'Zeitfenster nicht erreichbar',
        'shift-end-exceeded': 'Rückkehr nach Arbeitsende',
        'duration-exceeds-time-window': 'Einsatzdauer passt nicht ins Zeitfenster',
        'no-feasible-insertion': 'kein freier Platz im Tagesplan',
        'shift-capacity-kept-higher-urgency-jobs': 'dringendere Einsätze haben Vorrang',
        'invalid-time-window': 'Zeitfenster ungültig'
    };
    return labels[reason?.code] || String(reason?.code || 'nicht planbar').replace(/-/g, ' ');
}

function planReasonText(entry, group) {
    const reasons = entry.reasons || [];
    if (reasons.some((reason) => reason.code === 'sla-overdue-before-shift' || reason.code === 'sla-late')) return 'SLA zuerst';
    if (reasons.some((reason) => reason.code === 'due-overdue')) return 'überfällig';
    if (reasons.some((reason) => reason.code === 'due-today')) return 'heute fällig';
    return group?.priority === 'KRITISCH' ? 'kritischer Einsatz' : 'kurzer sinnvoller Fahrtweg';
}

function formatPlanTime(value) {
    const match = String(value || '').match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '—';
}

function renderServiceDayPreview() {
    const target = document.getElementById('service-day-preview');
    if (!target) return;
    if (!serviceDayPreview) { target.innerHTML = ''; return; }
    const { result, preSkipped } = serviceDayPreview;
    const entries = result.itinerary || [];
    const unscheduled = result.unscheduled || [];
    if (!entries.length) {
        const firstReason = unscheduled[0]?.reasons?.[0];
        target.innerHTML = `<div class="service-day-preview-card"><p class="service-day-unscheduled"><b>Kein machbarer Tagesvorschlag.</b><br>${escapeHtml(plannerReasonText(firstReason))}. Arbeitszeit, Qualifikationen oder Zeitfenster prüfen.</p></div>`;
        return;
    }
    const rows = entries.map((entry) => {
        const group = serviceDayGroups.get(entry.jobId);
        const reasons = group?.visits?.map((visit) => visit.reason).filter(Boolean).join(' + ') || 'Serviceeinsatz';
        return `<div class="service-day-preview-stop"><b>${escapeHtml(formatPlanTime(entry.start))}</b><div>
            <strong>${escapeHtml(entry.customer?.name || 'Servicekunde')}</strong>
            <small>${escapeHtml(reasons)} · ${entry.durationMin} Min. · ${Math.round(entry.km)} km Anfahrt</small>
            <small>${escapeHtml(planReasonText(entry, group))}</small>
        </div></div>`;
    }).join('');
    const omitted = unscheduled.length + preSkipped.length;
    const omittedRows = [
        ...unscheduled.map((item) => ({
            label: item.customer?.name || item.jobId || 'Einsatz',
            reason: plannerReasonText(item.reasons?.[0])
        })),
        ...preSkipped.map((item) => ({
            label: item.customer?.name || item.visit?.workOrderId || 'Einsatz',
            reason: item.reason
        }))
    ];
    target.innerHTML = `<div class="service-day-preview-card">
        <div class="service-day-preview-summary"><b>${entries.length} Stopps · ca. ${Math.round(result.metrics.totalKm)} km</b><span>Rückkehr ${escapeHtml(formatPlanTime(result.metrics.finishAt))} · ${Math.round(result.metrics.utilizationPct || 0)} % Auslastung</span></div>
        <div class="service-day-preview-list">${rows}</div>
        ${omitted ? `<details class="service-day-unscheduled"><summary>${omitted} Einsatz${omitted === 1 ? '' : 'sätze'} nicht eingeplant · Gründe anzeigen</summary><ul>${omittedRows.slice(0, 12).map((item) => `<li><b>${escapeHtml(item.label)}:</b> ${escapeHtml(item.reason)}</li>`).join('')}</ul></details>` : ''}
        <button type="button" id="btn-service-day-accept" class="primary">Vorschlag als Tour übernehmen</button>
    </div>`;
    document.getElementById('btn-service-day-accept')?.addEventListener('click', acceptServiceDayPreview);
}

function buildServiceDayPreview() {
    if (state.ui.mode !== 'service') return;
    if (!state.tour.start) {
        showToast('Bitte zuerst einen Startpunkt wählen.', 'info');
        document.getElementById('tour-start')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    const workDate = document.getElementById('plan-date')?.value;
    const shiftStart = document.getElementById('plan-time')?.value;
    const shiftEnd = document.getElementById('service-plan-end')?.value;
    const { groups, skipped, scope } = buildServiceJobGroups(workDate);
    if (!groups.length) {
        serviceDayPreview = { result: { itinerary: [], unscheduled: [], metrics: {} }, preSkipped: skipped };
        renderServiceDayPreview();
        showToast('In diesem Bezirk und Zeitraum gibt es keine eindeutig planbaren Einsätze.', 'info');
        return;
    }
    const skillsInput = document.getElementById('service-plan-skills');
    if (skillsInput && !skillsInput.value.trim() && groups.every((group) => group.visits.every((visit) => visit.sourceSystem === 'DEMO'))) {
        skillsInput.value = [...new Set(groups.flatMap((group) => group.requiredSkills))].join(', ');
    }
    const technicianSkills = String(skillsInput?.value || '').split(/[;,|]+/).map((value) => value.trim()).filter(Boolean);
    const result = proposeServiceDay({
        jobs: groups.map((group) => ({
            id: group.id,
            customer: group.customer,
            dueDate: group.dueDate,
            slaDueAt: group.slaDueAt,
            timeWindowStart: group.timeWindowStart,
            timeWindowEnd: group.timeWindowEnd,
            durationMin: group.durationMin,
            priority: group.priority,
            requiredSkills: group.requiredSkills,
            status: 'OFFEN'
        })),
        start: state.tour.start,
        end: destPoint() || state.tour.start,
        workDate,
        shiftStart,
        shiftEnd,
        technicianSkills,
        defaultDurationMin: Number(document.getElementById('plan-visit-min')?.value) || DEFAULT_VISIT_MINUTES
    });
    serviceDayGroups = new Map(groups.map((group) => [group.id, group]));
    serviceDayPreview = { result, preSkipped: skipped, scope, workDate, shiftStart, shiftEnd, technicianSkills };
    renderServiceDayPreview();
}

function acceptServiceDayPreview() {
    const result = serviceDayPreview?.result;
    if (!result?.itinerary?.length) return;
    if (state.tour.stops.length && !window.confirm('Die vorhandenen Tourstopps durch diesen Service-Tagesvorschlag ersetzen?')) return;
    const stopIds = result.itinerary.map((entry) => entry.customer?.id).filter(Boolean);
    state.tour.stops = [...new Set(stopIds)];
    state.tour.serviceVisitByCustomer = Object.fromEntries(result.itinerary.map((entry) => {
        const group = serviceDayGroups.get(entry.jobId);
        return [entry.customer?.id, group?.visits?.map((visit) => visit.id).filter(Boolean) || []];
    }).filter(([customerId]) => customerId));
    state.tour.servicePlan = {
        version: 1,
        generatedAt: new Date().toISOString(),
        workDate: serviceDayPreview.workDate,
        shiftStart: serviceDayPreview.shiftStart,
        shiftEnd: serviceDayPreview.shiftEnd,
        technicianSkills: serviceDayPreview.technicianSkills,
        itinerary: result.itinerary.map((entry) => ({
            jobId: entry.jobId, customerId: entry.customer?.id,
            arrival: entry.arrival, start: entry.start, end: entry.end,
            driveMin: entry.driveMin, km: entry.km, durationMin: entry.durationMin,
            visitIds: serviceDayGroups.get(entry.jobId)?.visits?.map((visit) => visit.id) || []
        })),
        assumptions: result.assumptions,
        metrics: result.metrics
    };
    if (!state.tour.destination) state.tour.roundTrip = true;
    document.getElementById('round-trip').checked = state.tour.roundTrip;
    emit('tour:changed');
    showToast(`${state.tour.stops.length} Service-Stopps übernommen. Zeiten und Gründe bleiben am Plan gespeichert.`, 'success', 5000);
}

function focusServiceDayPlanner() {
    if (state.ui.mode !== 'service') return;
    window.setTimeout(() => {
        const planner = document.getElementById('service-day-planner');
        planner?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!state.tour.start) showToast('Bezirk und Startpunkt wählen – danach erstellt TourFuchs den Tagesvorschlag.', 'info', 4500);
        else buildServiceDayPreview();
    }, 0);
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
    const planner = document.getElementById('tour-planner');
    if (planner) planner.classList.toggle('basic', !tourExpert);
    // Schritt-Nummerierung an den Modus anpassen
    const sh = document.getElementById('suggest-head');
    const mh = document.getElementById('mytour-head');
    if (sh) sh.textContent = tourExpert ? '3. Vorschläge' : '2. Vorschläge';
    if (mh) mh.textContent = tourExpert ? '4. Meine Tour' : '3. Meine Tour';
    if (!tourExpert) {
        // Basis: nur Umkreis-Vorschläge, kein Ziel
        state.tour.suggestMode = 'radius';
        if (state.tour.destination) invalidateAcceptedServicePlan();
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
    return modeTourCustomers();
}

function scopedCustomerById(id) {
    const customer = getCustomer(id);
    return customer && customerInTourScope(customer) ? customer : null;
}

function pruneTourToScope() {
    const previous = JSON.stringify({
        start: state.tour.start?.customerId || null,
        destination: state.tour.destination?.customerId || null,
        stops: state.tour.stops
    });
    if (!state.tour.bezirk || state.tour.bezirk === '__none__') {
        state.tour.start = null;
        state.tour.destination = null;
        state.tour.stops = [];
        state.tour.mapFocus = false;
        if (previous !== JSON.stringify({ start: null, destination: null, stops: [] })) invalidateAcceptedServicePlan();
        return;
    }
    state.tour.stops = state.tour.stops.filter((id) => !!scopedCustomerById(id));
    if (state.tour.start?.customerId && !scopedCustomerById(state.tour.start.customerId)) {
        state.tour.start = null;
    }
    if (state.tour.destination?.customerId && !scopedCustomerById(state.tour.destination.customerId)) {
        state.tour.destination = null;
    }
    const next = JSON.stringify({
        start: state.tour.start?.customerId || null,
        destination: state.tour.destination?.customerId || null,
        stops: state.tour.stops
    });
    if (previous !== next) invalidateAcceptedServicePlan();
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
            invalidateAcceptedServicePlan(true);
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
 * „Was ist in meiner Nähe?": GPS-Standort als Start und Umkreis-Modus – sofort
 * ohne vorher eine Tour zu bauen. Im Vertrieb werden überfällige Kunden priorisiert;
 * im Service bleibt die Auswahl frei von Vertriebsmerkmalen.
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
            invalidateAcceptedServicePlan(true);
            const here = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Mein Standort' };
            state.tour.start = here;
            state.tour.suggestMode = 'radius';
            // „Was ist in meiner Nähe?" meint ALLE Kunden um mich herum. Ohne
            // vorher gewählten Bezirk (z. B. vom schwebenden Fuchs auf der Karte)
            // filterte der Tour-Scope sonst alles weg – die Karte zeigte Stapel,
            // die Suche fand aber nichts. Fehlt der Bezirk, gilt „Alle Bezirke".
            if (!state.tour.bezirk || state.tour.bezirk === '__none__') {
                state.tour.bezirk = '__all__';
                emit('tour:scope-changed');
                renderTourScope();
            }
            const salesPriority = state.ui.mode !== 'service';
            overdueFirst = salesPriority;
            const cb = document.getElementById('overdue-first');
            if (cb) cb.checked = salesPriority;
            updateSuggestModeUi();
            emit('tour:changed');
            focusPoint(here.lat, here.lng, 11);
            const pool = tourPool();
            const near = suggestNearby(here, pool, state.tour.radiusKm, new Set(), salesPriority);
            if (near.length) {
                showToast(salesPriority
                    ? `${near.length} Kunde(n) im Umkreis von ${state.tour.radiusKm} km – überfällige zuerst.`
                    : `${near.length} Kunde(n) im Umkreis von ${state.tour.radiusKm} km.`,
                    'success', 5000);
            } else {
                // Nie in einer Sackgasse enden: Ist der nächste Kunde nur knapp
                // außerhalb, den Umkreis automatisch bis zu ihm weiten und zeigen.
                const nearest = suggestNearby(here, pool, Infinity, new Set(), false)[0];
                if (nearest) {
                    const widened = Math.min(CONFIG.tour.maxRadiusKm || 100, Math.ceil((nearest.km + 1) / 5) * 5);
                    state.tour.radiusKm = Math.max(state.tour.radiusKm, widened);
                    const slider = document.getElementById('radius-slider');
                    if (slider) slider.value = state.tour.radiusKm;
                    const rv = document.getElementById('radius-value');
                    if (rv) rv.textContent = `${state.tour.radiusKm} km`;
                    updateSuggestModeUi();
                    emit('tour:changed');
                    const count = suggestNearby(here, pool, state.tour.radiusKm, new Set(), salesPriority).length;
                    showToast(`Nichts ganz in der Nähe – Umkreis auf ${state.tour.radiusKm} km geweitet: ${count} Kunde(n).`, 'info', 5000);
                } else {
                    showToast('Keine verorteten Kunden gefunden.', 'info', 5000);
                }
            }
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
    updateTourAccordion();
}

// ---- Mobiles Tour-Akkordeon (Startpunkt · Vorschläge · Meine Tour) ----
// Auf dem Handy sind die drei Gruppen ein-/ausklappbare Karten; eingeklappt
// bleibt eine sprechende Zeile stehen. Genau eine Gruppe ist offen. Solange der
// Nutzer nicht selbst eine Karte antippt, folgt das Akkordeon dem Flow
// (Start → Vorschläge → Meine Tour). Ab dem ersten Tipp behält er die Kontrolle.
let tourAccPinned = false;

function isMobileTour() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function currentTourStep() {
    // „Vorschläge" ist die Arbeitsbühne: Solange der Nutzer Kunden hinzufügt,
    // bleibt sie offen (früher sprang das Akkordeon beim ersten Stopp sofort zu
    // „Meine Tour" – man konnte nicht weiter aussuchen). Zu „Meine Tour"
    // (Prüfen/Optimieren) wechselt man bewusst selbst; die Zusammenfassungszeile
    // „N Stopps · ~X km" lädt sichtbar dazu ein.
    if (!state.tour.start) return 'start';
    return 'suggest';
}

function openTourAcc(key) {
    document.querySelectorAll('.tour-acc').forEach((el) => {
        const open = el.dataset.acc === key;
        el.classList.toggle('open', open);
        el.querySelector('.acc-head')?.setAttribute('aria-expanded', String(open));
    });
    // Horizontale Schrittleiste (Fokus-Modus) mitführen.
    document.querySelectorAll('#tour-stepper .tour-step').forEach((b) => {
        const on = b.dataset.step === key;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
    });
}

/**
 * Fokus-Modus (nur Handy): Sobald der Nutzer in einem Schritt arbeitet, weicht
 * das obere Chrome (Kartenstil, Erste Schritte, Titel, Bezirk) und die drei
 * Akkordeon-Köpfe werden zur horizontalen Schrittleiste – mehr Platz fürs
 * aktive Element. „Übersicht" führt zurück.
 */
function setTourFocus(on) {
    const focus = on && isMobileTour();
    document.body.classList.toggle('tour-focus', focus);
    const stepper = document.getElementById('tour-stepper');
    if (stepper) stepper.hidden = !focus;
}

function tourAccSummaries() {
    const sumStart = document.getElementById('acc-sum-start');
    if (sumStart) sumStart.textContent = state.tour.start ? `🚩 ${state.tour.start.label}` : 'noch offen';

    const sumSuggest = document.getElementById('acc-sum-suggest');
    if (sumSuggest) {
        sumSuggest.textContent = state.tour.suggestMode === 'route'
            ? 'entlang der Tour'
            : `Umkreis ${state.tour.radiusKm} km`;
    }

    const sumMytour = document.getElementById('acc-sum-mytour');
    if (sumMytour) {
        const n = state.tour.stops.length;
        if (n === 0) {
            sumMytour.textContent = 'noch leer';
        } else if (state.tour.mapFocus) {
            sumMytour.textContent = `${n} Stopp${n === 1 ? '' : 's'} · auf Karte`;
        } else {
            const { roadKmEstimate } = routeDistance(state.tour.start, effStops(), state.tour.roundTrip);
            sumMytour.textContent = `${n} Stopp${n === 1 ? '' : 's'} · ~${Math.round(roadKmEstimate)} km`;
        }
    }
}

function updateTourAccordion() {
    tourAccSummaries();
    // Steht ein Start, ist „Was ist in meiner Nähe?" beim Planen redundant –
    // die Body-Klasse blendet den Knopf mobil aus und schafft Platz für die
    // Akkordeon-Köpfe.
    document.body.classList.toggle('tour-has-start', !!state.tour.start);
    if (!isMobileTour()) return;
    // Leere Tour = neuer Anlauf: Das Akkordeon folgt wieder von selbst dem Flow.
    if (!state.tour.start && state.tour.stops.length === 0) tourAccPinned = false;
    // Ohne manuelle Wahl der Bühne folgt das Akkordeon dem Arbeitsfluss.
    const anyOpen = document.querySelector('.tour-acc.open');
    if (!tourAccPinned || !anyOpen) openTourAcc(currentTourStep());
}

function initTourAccordion() {
    document.querySelectorAll('.tour-acc .acc-head').forEach((head) => {
        head.addEventListener('click', (ev) => {
            // Der Info-Punkt zeigt nur seinen Tooltip, klappt nicht.
            if (ev.target.closest('.help-dot')) return;
            if (!isMobileTour()) return;
            const acc = head.closest('.tour-acc');
            const alreadyOpen = acc.classList.contains('open');
            tourAccPinned = true;
            openTourAcc(alreadyOpen ? null : acc.dataset.acc);
            // In einen Schritt getippt = arbeiten: Chrome weicht, Schrittleiste an.
            if (!alreadyOpen) setTourFocus(true);
        });
        head.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); head.click(); }
        });
    });

    // Horizontale Schrittleiste: aktiven Schritt wechseln bzw. Übersicht zurück.
    document.querySelectorAll('#tour-stepper .tour-step').forEach((btn) => {
        btn.addEventListener('click', () => {
            tourAccPinned = true;
            openTourAcc(btn.dataset.step);
        });
    });
    document.querySelector('#tour-stepper .tour-focus-exit')
        ?.addEventListener('click', () => setTourFocus(false));

    // Verlässt der Nutzer den Tour-Tab oder wechselt den Modus, endet der Fokus.
    on('tab:changed', (tab) => { if (tab !== 'tour') setTourFocus(false); });
    on('mode:changed', () => setTourFocus(false));
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
        invalidateAcceptedServicePlan(true);
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

function serviceScopeExceptionIds(stops) {
    if (state.ui.mode !== 'service' || state.ui.serviceCustomerScope === 'all') return new Set();
    const serviceIds = new Set(modeVisibleCustomers().map((customer) => customer.id));
    const routeIds = new Set([
        state.tour.start?.customerId,
        ...stops.map((customer) => customer.id),
        state.tour.destination?.customerId
    ].filter(Boolean));
    return new Set([...routeIds].filter((id) => !serviceIds.has(id)));
}

function renderStops() {
    const el = document.getElementById('tour-stops');
    const stops = state.tour.stops.map(getCustomer).filter(Boolean);
    const plannedEntries = new Map((state.tour.servicePlan?.itinerary || []).map((entry) => [entry.customerId, entry]));
    const visitsById = new Map((state.serviceVisits || []).map((visit) => [visit.id, visit]));
    const serviceExceptions = serviceScopeExceptionIds(stops);
    const exceptionCount = serviceExceptions.size;
    const exceptionWarning = exceptionCount
        ? `<div class="tour-scope-warning" role="status">ℹ️ ${exceptionCount} bereits gewählte${exceptionCount === 1 ? 'r Kundenpunkt liegt' : ' Kundenpunkte liegen'} außerhalb des Servicefilters und ${exceptionCount === 1 ? 'bleibt' : 'bleiben'} bewusst in der Tour.</div>`
        : '';
    const explicitDest = destPoint();
    const autoLastStopIsDestination = !state.tour.roundTrip && !explicitDest && stops.length > 0;

    if (stops.length === 0) {
        el.innerHTML = `${exceptionWarning}<div class="tour-empty-guide">
            <b>Noch keine Stopps</b>
            <ol>
                <li>Startpunkt wählen</li>
                <li>Kunden aus Vorschlägen oder Karten-Popups hinzufügen</li>
                <li>Route auf der Karte anzeigen</li>
            </ol>
        </div>`;
    } else {
        const today = new Date().toISOString().slice(0, 10);
        // Mobiler Hinweis auf das Umsortieren (Desktop blendet ihn per CSS aus).
        const reorderHint = stops.length >= 2
            ? '<p class="stop-reorder-hint muted small">↕ Zum Umsortieren einen Stopp halten und ziehen</p>'
            : '';
        el.innerHTML = exceptionWarning + reorderHint + stops.map((c, i) => {
            const status = visitStatus(c);
            const done = lastVisit(c) === today;
            const outsideServiceScope = serviceExceptions.has(c.id);
            const dot = status !== 'none'
                ? `<span class="stop-status-dot" style="background:${STATUS_COLORS[status]}" title="${STATUS_LABELS[status]}"></span>`
                : '';
            const planned = plannedEntries.get(c.id);
            const linkedVisits = (state.tour.serviceVisitByCustomer?.[c.id] || []).map((id) => visitsById.get(id)).filter(Boolean);
            const serviceReason = linkedVisits.map((visit) => visit.reason).filter(Boolean).join(' + ');
            const zanoboUrl = zanoboMachineUrl(linkedVisits.find((visit) => String(visit.assetId ?? '').trim())?.assetId);
            const servicePlanLine = planned
                ? `<span class="service-stop-plan">🛠️ ${escapeHtml(formatPlanTime(planned.start))}–${escapeHtml(formatPlanTime(planned.end))}${serviceReason ? ` · ${escapeHtml(serviceReason)}` : ''}${zanoboUrl ? ` · <a class="zanobo-link" href="${escapeHtml(zanoboUrl)}" target="_blank" rel="noopener noreferrer" title="Zanobo vergleicht das Betriebsgeräusch mit der Referenz der Anlage – Orientierung, keine Diagnose.">🔊 Anhören</a>` : ''}</span>`
                : '';
            return `
            <div class="stop-row${autoLastStopIsDestination && i === stops.length - 1 ? ' final-row' : ''}${done ? ' stop-visited' : ''}">
                <span class="stop-num" data-visit-node="${i}" title="${done ? 'Heute besucht – am Handy zum erneuten Eintragen tippen' : 'Am Handy: auf den Punkt tippen = heute besucht'}">${i + 1}</span>
                <span class="stop-name" title="${escapeHtml(c.name)}">
                    <span class="stop-title">${dot}${escapeHtml(c.name)}${autoLastStopIsDestination && i === stops.length - 1 ? '<span class="route-role">Ziel</span>' : ''}${outsideServiceScope ? '<span class="route-role scope-exception">Außerhalb Servicefilter</span>' : ''}</span>
                    <span class="stop-sub muted small">${escapeHtml(c.plz)} ${escapeHtml(c.ort)}${done ? ' · heute besucht' : (lastVisit(c) ? ` · zuletzt ${agoText(lastVisit(c))}` : '')}</span>
                    ${servicePlanLine ? `<span class="stop-plan-line">${servicePlanLine}</span>` : ''}
                </span>
                <span class="stop-actions">
                    <button type="button" class="stop-visit${done ? ' is-done' : ''}" data-visit="${i}" title="${done ? 'Heute besucht' : 'Als heute besucht markieren'}">${done ? '✓' : '✓ Heute'}</button>
                    <button type="button" data-up="${i}" title="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button>
                    <button type="button" data-down="${i}" title="Nach unten" ${i === stops.length - 1 ? 'disabled' : ''}>↓</button>
                    <button type="button" class="stop-remove" data-remove="${i}" title="Entfernen">✕</button>
                </span>
            </div>`;
        }).join('');

        el.querySelectorAll('[data-visit]').forEach((btn) => btn.addEventListener('click', () => {
            const c = stops[parseInt(btn.dataset.visit, 10)];
            if (!c) return;
            markVisitedToday(c);
            markDirty(); // persistieren + Karte/Status neu zeichnen
            renderPanel();
            showToast(`Besuch bei ${c.name} für heute eingetragen.`, 'success');
        }));

        // Am Handy ist die Zeile einzeilig: Der grüne Tour-Punkt selbst dient als
        // „heute besucht"-Schalter. Auf dem Desktop bleibt der Punkt reine Anzeige.
        el.querySelectorAll('[data-visit-node]').forEach((node) => node.addEventListener('click', () => {
            if (!isMobileTour()) return;
            const c = stops[parseInt(node.dataset.visitNode, 10)];
            if (!c) return;
            markVisitedToday(c);
            markDirty();
            renderPanel();
            showToast(`Besuch bei ${c.name} für heute eingetragen.`, 'success');
        }));

        el.querySelectorAll('[data-remove]').forEach((btn) => btn.addEventListener('click', () => {
            invalidateAcceptedServicePlan(true);
            state.tour.stops.splice(parseInt(btn.dataset.remove, 10), 1);
            emit('tour:changed');
        }));
        el.querySelectorAll('[data-up]').forEach((btn) => btn.addEventListener('click', () => {
            invalidateAcceptedServicePlan(true);
            const i = parseInt(btn.dataset.up, 10);
            [state.tour.stops[i - 1], state.tour.stops[i]] = [state.tour.stops[i], state.tour.stops[i - 1]];
            emit('tour:changed');
        }));
        el.querySelectorAll('[data-down]').forEach((btn) => btn.addEventListener('click', () => {
            invalidateAcceptedServicePlan(true);
            const i = parseInt(btn.dataset.down, 10);
            [state.tour.stops[i + 1], state.tour.stops[i]] = [state.tour.stops[i], state.tour.stops[i + 1]];
            emit('tour:changed');
        }));

        // Am Handy ersetzt Halten & Ziehen die (mobil ausgeblendeten) ↑/↓-Pfeile.
        if (isMobileTour()) wireStopReorder(el);
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
        if (x) x.addEventListener('click', () => {
            invalidateAcceptedServicePlan(true);
            state.tour.destination = null;
            emit('tour:changed');
        });
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

    // Grüne Tourlinie (mobil): erster und letzter Streckenpunkt bekommen eine
    // Markierung, damit die durchgehende Linie oben/unten am Punkt endet statt
    // ins Leere zu laufen. Rein visuell – ohne CSS-Wirkung auf dem Desktop.
    const routeRows = el.querySelectorAll('.stop-row');
    if (routeRows.length) {
        routeRows[0].classList.add('stop-first');
        routeRows[routeRows.length - 1].classList.add('stop-last');
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
        summary.innerHTML = state.tour.servicePlan
            ? `🛠️ <b>Bestätigter Service-Tagesplan</b> · ${state.tour.servicePlan.itinerary.length} Stopps · ca. ${Math.round(state.tour.servicePlan.metrics?.totalKm || roadKmEstimate)} km <span class="muted small">Rückkehr ${escapeHtml(formatPlanTime(state.tour.servicePlan.metrics?.finishAt))}. Manuelle Änderungen verwerfen die fixierten Zeiten.</span>`
            : `Geschätzte Strecke${rt}: <b>~${Math.round(roadKmEstimate)} km</b> <span class="muted small">${endHint} ${Math.round(airKm)} km Luftlinie${exportHint}.</span>`;
    } else {
        summary.innerHTML = '';
    }
    const hasRoute = state.tour.start && eff.length >= 1;
    const optimizeButton = document.getElementById('btn-optimize');
    optimizeButton.disabled = Boolean(state.tour.servicePlan) || !(state.tour.start && tourStops().length >= 2);
    optimizeButton.title = state.tour.servicePlan
        ? 'Reihenfolge und Zeiten stammen aus dem bestätigten Service-Tagesplan.'
        : 'Reihenfolge optimieren';
    const routeFocus = document.getElementById('btn-route-focus');
    routeFocus.disabled = !hasRoute;
    routeFocus.textContent = !state.tour.mapFocus
        ? '🗺️ Route auf Karte anzeigen'
        : (state.tour.routeLineMode === 'road' ? '🗺️ Luftlinie anzeigen' : '🗺️ Straßenroute anzeigen');
    // Umschalter über der Karte spiegeln: nur sichtbar, wenn die Route liegt.
    const routeModeBar = document.getElementById('route-mode-bar');
    const routeModeBtn = document.getElementById('btn-route-mode');
    if (routeModeBar) routeModeBar.hidden = !(state.tour.mapFocus && hasRoute);
    if (routeModeBtn) routeModeBtn.textContent = state.tour.routeLineMode === 'road'
        ? '📏 Luftlinie anzeigen'
        : '🗺️ Straßenroute anzeigen';
    document.getElementById('btn-gmaps').disabled = !hasRoute;
    document.getElementById('btn-tour-print').disabled = !hasRoute;
    document.getElementById('btn-tour-ics').disabled = !hasRoute;
    document.getElementById('btn-tour-copy').disabled = !hasRoute;
    document.getElementById('btn-tour-qr').disabled = !hasRoute;
    document.getElementById('btn-tour-save').disabled = !hasRoute;
    document.getElementById('btn-tour-clear').disabled = !(state.tour.start || state.tour.destination || stops.length > 0);
}

/**
 * Halten & Ziehen zum Umsortieren der Tourstopps (nur Handy). Ersetzt die
 * mobil ausgeblendeten ↑/↓-Pfeile. Ein kurzer Halte-Moment (300 ms) hebt die
 * Zeile an; ein Tipp/Scroll bleibt unberührt (Bewegung vor dem Halten bricht
 * ab). Nur die Kundenstopps sind sortierbar – Ziel und Rückweg bleiben fest.
 *
 * Bewusst über Touch-Events: Nur so lässt sich der Blatt-Scroll während des
 * Ziehens per preventDefault() zuverlässig unterbinden. Mit Pointer-Events
 * (touch-action) kaperte der Browser die vertikale Bewegung als Scroll und
 * brach das Ziehen ab – die Zeile „wackelte", die Position blieb.
 */
function wireStopReorder(container) {
    const rows = [...container.querySelectorAll('.stop-row')].filter((r) => r.querySelector('[data-remove]'));
    if (rows.length < 2) return;

    rows.forEach((row) => {
        let holdTimer = null;
        let dragging = false;
        let startY = 0;
        let curY = 0;
        let slots = [];
        let rowH = 0;
        let fromIdx = 0;
        let scroller = null;

        const midY = (i) => slots[i].top + slots[i].height / 2;
        const targetIndex = () => {
            let idx = 0;
            for (let i = 0; i < slots.length; i++) {
                if (i !== fromIdx && midY(i) < curY) idx++;
            }
            return Math.max(0, Math.min(rows.length - 1, idx));
        };

        const startDrag = () => {
            dragging = true;
            fromIdx = rows.indexOf(row);
            slots = rows.map((r) => r.getBoundingClientRect());
            rowH = slots[fromIdx].height;
            scroller = row.closest('.acc-body') || row.closest('.tab-panel');
            if (scroller) scroller.style.overflow = 'hidden';
            row.classList.add('stop-dragging');
            document.body.classList.add('reordering');
            if (navigator.vibrate) navigator.vibrate(12);
        };

        const onTouchStart = (e) => {
            if (e.target.closest('button, a, .help-dot')) return; // Buttons/Punkt nicht kapern
            startY = e.touches[0].clientY;
            curY = startY;
            holdTimer = setTimeout(startDrag, 300);
        };
        const onTouchMove = (e) => {
            curY = e.touches[0].clientY;
            if (!dragging) {
                // Bewegt sich der Finger vor dem Halten, ist es ein Scroll – abbrechen.
                if (Math.abs(curY - startY) > 8) { clearTimeout(holdTimer); holdTimer = null; }
                return;
            }
            e.preventDefault(); // Blatt-Scroll während des Ziehens unterbinden
            row.style.transform = `translateY(${curY - startY}px)`;
            const toIdx = targetIndex();
            rows.forEach((r, i) => {
                if (r === row) return;
                let shift = 0;
                if (fromIdx < toIdx && i > fromIdx && i <= toIdx) shift = -rowH;
                else if (fromIdx > toIdx && i < fromIdx && i >= toIdx) shift = rowH;
                r.style.transform = shift ? `translateY(${shift}px)` : '';
            });
        };
        const onTouchEnd = () => {
            clearTimeout(holdTimer);
            holdTimer = null;
            if (!dragging) return;
            const toIdx = targetIndex();
            rows.forEach((r) => { r.style.transform = ''; });
            row.classList.remove('stop-dragging');
            document.body.classList.remove('reordering');
            if (scroller) scroller.style.overflow = '';
            dragging = false;
            if (toIdx !== fromIdx) {
                invalidateAcceptedServicePlan(true);
                const [moved] = state.tour.stops.splice(fromIdx, 1);
                state.tour.stops.splice(toIdx, 0, moved);
                emit('tour:changed');
            }
        };

        row.addEventListener('touchstart', onTouchStart, { passive: true });
        row.addEventListener('touchmove', onTouchMove, { passive: false });
        row.addEventListener('touchend', onTouchEnd);
        row.addEventListener('touchcancel', onTouchEnd);
    });
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
    // Anzahl im Umkreis sichtbar machen: Der Regler „lebt" auch dann, wenn die
    // Liste aus Übersichtsgründen nur die nächsten Kunden zeigt.
    const totalNear = routeMode ? suggestions.length : countNearby(state.tour.start, pool, state.tour.radiusKm, exclude);
    const countLine = routeMode
        ? ''
        : `<p class="suggestion-count muted small">${totalNear} Kunde${totalNear === 1 ? '' : 'n'} im Umkreis von ${state.tour.radiusKm} km${totalNear > suggestions.length ? ` · zeige die ${suggestions.length} nächsten` : ''}</p>`;
    el.innerHTML = countLine + suggestions.map(({ customer: c, km }) => {
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
            invalidateAcceptedServicePlan(true);
            state.tour.stops.push(btn.dataset.add);
            emit('tour:changed');
        }
    }));
    el.querySelectorAll('[data-fly]').forEach((btn) => btn.addEventListener('click', () => {
        const c = getCustomer(btn.dataset.fly);
        if (c) flyToCustomer(c);
    }));
}

/** Datum, Startzeit und Besuchsdauer aus den Plan-Eingaben lesen */
function planOptions() {
    const date = document.getElementById('plan-date')?.value;
    const time = document.getElementById('plan-time')?.value;
    const visit = Number(document.getElementById('plan-visit-min')?.value);
    return {
        startTime: combinePlanStart(date, time),
        visitMinutes: Number.isFinite(visit) && visit > 0 ? visit : DEFAULT_VISIT_MINUTES,
        servicePlan: state.tour.servicePlan,
        serviceVisits: state.serviceVisits
    };
}

/** Tour als QR-Code für die Übergabe ans Handy anzeigen */
function shareTourAsQr() {
    const eff = effStops();
    if (!state.tour.start || eff.length === 0) return;
    const date = document.getElementById('plan-date')?.value;
    const time = document.getElementById('plan-time')?.value;
    const payload = encodeTourPayload({
        start: state.tour.start,
        stops: eff,
        tourName: currentTourName(),
        date,
        startTime: time,
        visitMinutes: planOptions().visitMinutes,
        roundTrip: state.tour.roundTrip
    });
    if (!payload) {
        showToast('Keine verorteten Stopps in der Tour – QR-Übergabe nicht möglich.', 'info');
        return;
    }
    openShareDialog(payload, {
        stopCount: Math.min(eff.length, MAX_QR_STOPS),
        skipped: Math.max(0, eff.length - MAX_QR_STOPS)
    });
    noteTourSharedToPhone();
}

function optimizeTour() {
    const stops = tourStops();
    if (!state.tour.start || stops.length < 2) return;
    // Fester Streckenendpunkt: Zielkunde, sonst bei Rundreise der Start, sonst offen
    const endPoint = destPoint() || (state.tour.roundTrip ? state.tour.start : null);
    const before = routeDistance(state.tour.start, effStops(), state.tour.roundTrip).airKm;
    invalidateAcceptedServicePlan(true);
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
        stopIds: [...state.tour.stops],
        servicePlan: state.tour.servicePlan ? structuredClone(state.tour.servicePlan) : null,
        serviceVisitByCustomer: state.tour.servicePlan ? structuredClone(state.tour.serviceVisitByCustomer || {}) : {}
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
    const planCustomerIds = new Set((tour.servicePlan?.itinerary || []).map((entry) => entry.customerId));
    const servicePlanComplete = Boolean(tour.servicePlan)
        && validIds.length === tour.stopIds.length
        && validIds.every((customerId) => planCustomerIds.has(customerId));
    state.tour.servicePlan = servicePlanComplete ? structuredClone(tour.servicePlan) : null;
    state.tour.serviceVisitByCustomer = servicePlanComplete
        ? structuredClone(tour.serviceVisitByCustomer || {})
        : {};
    emit('tour:changed');
    const lost = tour.stopIds.length - validIds.length;
    showToast(lost > 0
        ? `Tour „${tour.name}" geladen (${lost} nicht mehr vorhandene Kunden ausgelassen).`
        : `Tour „${tour.name}" geladen${servicePlanComplete ? ' – inklusive Service-Zeitplan' : ''}.`, 'success');
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
                <span class="muted small">${t.stopIds.length} Stopp${t.stopIds.length === 1 ? '' : 's'} · ab ${escapeHtml(t.start.label)}${t.servicePlan ? ' · Service-Zeitplan' : ''}</span>
            </button>
            <button type="button" class="saved-tour-del" data-del="${escapeHtml(t.id)}" title="Löschen">🗑</button>
        </div>
    `).join('');
    el.querySelectorAll('[data-load]').forEach((btn) =>
        btn.addEventListener('click', () => loadSavedTour(btn.dataset.load)));
    el.querySelectorAll('[data-del]').forEach((btn) =>
        btn.addEventListener('click', () => deleteSavedTour(btn.dataset.del)));
}

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
import { state, on, emit, getCustomer, repColor, visibleCustomers } from '../core/state.js';
import { suggestNearby, optimizeOrder, routeDistance, googleMapsLink } from '../features/tour.js';
import { flyToCustomer } from '../features/map.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

export function initTourPanel() {
    document.getElementById('btn-my-location').addEventListener('click', useMyLocation);

    const radius = document.getElementById('radius-slider');
    radius.value = state.tour.radiusKm;
    document.getElementById('radius-value').textContent = `${state.tour.radiusKm} km`;
    radius.addEventListener('input', () => {
        state.tour.radiusKm = parseInt(radius.value, 10);
        document.getElementById('radius-value').textContent = `${state.tour.radiusKm} km`;
        renderSuggestions();
    });

    document.getElementById('btn-optimize').addEventListener('click', optimizeTour);
    document.getElementById('btn-gmaps').addEventListener('click', openInGoogleMaps);
    document.getElementById('btn-tour-clear').addEventListener('click', () => {
        state.tour.stops = [];
        state.tour.start = null;
        emit('tour:changed');
    });

    // Startpunkt per Suchfeld (Kunden)
    const startInput = document.getElementById('start-search');
    const startResults = document.getElementById('start-results');
    startInput.addEventListener('input', () => {
        const q = startInput.value.trim().toLowerCase();
        if (q.length < 2) { startResults.innerHTML = ''; return; }
        const hits = state.customers
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

    on('tour:changed', renderPanel);
    on('customers:changed', renderPanel);
    on('filters:changed', renderSuggestions);
    renderPanel();
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

function renderPanel() {
    renderStart();
    renderStops();
    renderSuggestions();
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

    if (stops.length === 0) {
        el.innerHTML = '<p class="muted">Noch keine Stopps. Fügen Sie Kunden über die Vorschläge oder das Karten-Popup hinzu.</p>';
    } else {
        el.innerHTML = stops.map((c, i) => `
            <div class="stop-row">
                <span class="stop-num">${i + 1}</span>
                <span class="stop-name" title="${escapeHtml(c.name)}">
                    ${escapeHtml(c.name)}<br><span class="muted small">${escapeHtml(c.plz)} ${escapeHtml(c.ort)}</span>
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

    // Distanz & Aktions-Buttons
    const summary = document.getElementById('tour-summary');
    const locatedStops = stops.filter((c) => c.lat !== null);
    if (state.tour.start && locatedStops.length > 0) {
        const { airKm, roadKmEstimate } = routeDistance(state.tour.start, locatedStops);
        summary.innerHTML = `Strecke: <b>~${Math.round(roadKmEstimate)} km</b> <span class="muted small">(${Math.round(airKm)} km Luftlinie${locatedStops.length > CONFIG.tour.maxWaypoints + 1 ? `, Google-Maps-Export: max. ${CONFIG.tour.maxWaypoints + 1} Stopps` : ''})</span>`;
    } else {
        summary.innerHTML = '';
    }
    document.getElementById('btn-optimize').disabled = !(state.tour.start && locatedStops.length >= 2);
    document.getElementById('btn-gmaps').disabled = !(state.tour.start && locatedStops.length >= 1);
    document.getElementById('btn-tour-clear').disabled = !(state.tour.start || stops.length > 0);
}

function renderSuggestions() {
    const el = document.getElementById('tour-suggestions');
    if (!state.tour.start) { el.innerHTML = ''; return; }

    const exclude = new Set(state.tour.stops);
    if (state.tour.start.customerId) exclude.add(state.tour.start.customerId);

    const suggestions = suggestNearby(state.tour.start, visibleCustomers(), state.tour.radiusKm, exclude);

    if (suggestions.length === 0) {
        el.innerHTML = '<p class="muted">Keine weiteren (sichtbaren) Kunden im gewählten Umkreis.</p>';
        return;
    }
    el.innerHTML = suggestions.map(({ customer: c, km }) => `
        <div class="suggestion-row">
            <span class="dot" style="background:${repColor(c.vb)}"></span>
            <button type="button" class="suggestion-name" data-fly="${escapeHtml(c.id)}" title="Auf Karte zeigen">
                ${escapeHtml(c.name)}<br><span class="muted small">${escapeHtml(c.plz)} ${escapeHtml(c.ort)} · ${km.toFixed(1)} km</span>
            </button>
            <button type="button" class="suggestion-add" data-add="${escapeHtml(c.id)}" title="Zur Tour hinzufügen">＋</button>
        </div>
    `).join('');

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
    const stops = state.tour.stops.map(getCustomer).filter((c) => c && c.lat !== null);
    if (!state.tour.start || stops.length < 2) return;
    const before = routeDistance(state.tour.start, stops).airKm;
    const optimized = optimizeOrder(state.tour.start, stops);
    state.tour.stops = optimized.map((c) => c.id);
    const after = routeDistance(state.tour.start, optimized).airKm;
    emit('tour:changed');
    const savedKm = (before - after) * CONFIG.tour.roadFactor;
    showToast(savedKm > 0.5
        ? `Reihenfolge optimiert – spart ca. ${Math.round(savedKm)} km.`
        : 'Reihenfolge ist bereits optimal.', 'success');
}

function openInGoogleMaps() {
    const stops = state.tour.stops.map(getCustomer).filter((c) => c && c.lat !== null);
    if (!state.tour.start || stops.length === 0) return;
    if (stops.length > CONFIG.tour.maxWaypoints + 1) {
        showToast(`Google Maps unterstützt max. ${CONFIG.tour.maxWaypoints + 1} Stopps – es werden die ersten ${CONFIG.tour.maxWaypoints + 1} übergeben.`, 'info', 6000);
    }
    const link = googleMapsLink(state.tour.start, stops);
    if (link) window.open(link, '_blank', 'noopener');
}

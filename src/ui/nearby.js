/**
 * „In der Nähe" – Besuchs-Begleiter unter dem Karte-Tab (mobil).
 *
 * Füllt die Freifläche des aufgezogenen Blatts mit den nächstgelegenen Kunden –
 * bezogen auf die Kartenmitte (was man gerade ansieht) oder den GPS-Standort.
 * Beantwortet direkt die Kernfrage „Wen besuche ich als Nächstes?".
 *
 * Basis:  Name · Ort · Entfernung · Umsatz (aufgeräumt).
 * Profi:  zusätzlich Status-Punkt (fällig/überfällig) und „davon X fällig".
 */
import { state, on, emit, visibleCustomers } from '../core/state.js';
import { getMap, flyToCustomer } from '../features/map.js';
import { visitStatus, isOpportunity, STATUS_COLORS } from '../features/visits.js';
import { formatRevenueShort } from '../core/format.js';
import { showMapView } from './sidebar.js';

const MAX_ROWS = 12;
let originMode = 'map';     // 'map' | 'gps'
let gpsPos = null;          // { lat, lng } zuletzt bekannter GPS-Standort
let gpsError = '';          // Hinweistext, falls GPS nicht verfügbar

function els() {
    return {
        panel: document.getElementById('tab-karte'),
        stats: document.querySelector('#tab-karte .near-stats'),
        list: document.querySelector('#tab-karte .near-list'),
        empty: document.querySelector('#tab-karte .near-empty')
    };
}

// Entfernung Luftlinie in km (Haversine)
function distanceKm(aLat, aLng, bLat, bLng) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

function fmtDist(km) {
    if (km === null || !Number.isFinite(km)) return '';
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
    return `${Math.round(km)} km`;
}

function originLatLng() {
    if (originMode === 'gps' && gpsPos) return gpsPos;
    const map = getMap();
    const c = map?.getCenter?.();
    return c ? { lat: c.lat, lng: c.lng } : null;
}

/** Nur berechnen/zeichnen, wenn der Karte-Tab aktiv ist (spart Arbeit). */
function isActive() {
    const { panel } = els();
    return !!panel && panel.classList.contains('active');
}

export function renderNearby() {
    const { panel, stats, list, empty } = els();
    if (!panel || !stats || !list || !empty) return;
    if (!isActive()) return;

    const profi = state.ui.depth === 'profi';
    const pool = visibleCustomers().filter((c) => c.lat !== null && c.lng !== null);
    const origin = originLatLng();

    // Kopf-Kennzahlen des aktuell sichtbaren Bestands.
    const revSum = pool.reduce((s, c) => s + (c.umsatz || 0), 0);
    const dueCount = pool.filter((c) => isOpportunity(c)).length;
    const statParts = [`<b>${pool.length}</b> sichtbar`];
    if (profi && dueCount > 0) statParts.push(`<b>${dueCount}</b> fällig`);
    if (revSum > 0) statParts.push(`${formatRevenueShort(revSum)} Umsatz`);
    stats.innerHTML = statParts.join(' · ')
        + (originMode === 'gps' && !gpsPos && gpsError ? ` · <span class="near-gps-hint">${gpsError}</span>` : '');

    // Nach Entfernung zum Bezugspunkt sortieren (ohne Bezug: unverändert).
    const rows = pool
        .map((c) => ({ c, km: origin ? distanceKm(origin.lat, origin.lng, c.lat, c.lng) : null }))
        .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
        .slice(0, MAX_ROWS);

    if (rows.length === 0) {
        list.innerHTML = '';
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    list.innerHTML = rows.map(({ c, km }) => {
        const inTour = state.tour.stops.includes(c.id);
        const dot = profi
            ? `<span class="near-dot" style="background:${STATUS_COLORS[visitStatus(c)]}"></span>`
            : '<span class="near-dot near-dot-plain"></span>';
        const dist = km !== null ? `<span class="near-dist">${fmtDist(km)}</span>` : '';
        const rev = c.umsatz ? `<span class="near-rev">${formatRevenueShort(c.umsatz)}</span>` : '';
        const ort = c.ort ? ` <span class="muted">${escapeHtml(c.ort)}</span>` : '';
        return `<li class="near-row" data-near-id="${escapeHtml(c.id)}">
            ${dot}
            <span class="near-name">${escapeHtml(c.name)}${ort}</span>
            ${rev}
            ${dist}
            <button type="button" class="near-add${inTour ? ' in-tour' : ''}" data-near-add="${escapeHtml(c.id)}" aria-label="${inTour ? 'In der Tour' : 'Zur Tour hinzufügen'}" title="${inTour ? 'In der Tour' : 'Zur Tour'}">${inTour ? '✓' : '➕'}</button>
        </li>`;
    }).join('');
}

// Mehrere schnelle Auslöser (Panning) zu einem Frame zusammenfassen.
let rafId = 0;
function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; renderNearby(); });
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function setOrigin(mode) {
    originMode = mode;
    document.querySelectorAll('#tab-karte .near-origin .seg').forEach((b) =>
        b.classList.toggle('active', b.dataset.nearOrigin === mode));
    if (mode === 'gps') requestGps();
    else renderNearby();
}

function requestGps() {
    if (!navigator.geolocation) { gpsError = 'GPS nicht verfügbar'; renderNearby(); return; }
    gpsError = 'Standort wird bestimmt …';
    renderNearby();
    navigator.geolocation.getCurrentPosition(
        (pos) => { gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; gpsError = ''; renderNearby(); },
        () => { gpsError = 'Standort nicht freigegeben'; renderNearby(); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
}

export function initNearby() {
    const panel = document.getElementById('tab-karte');
    if (!panel) return;

    panel.addEventListener('click', (ev) => {
        const originBtn = ev.target.closest('[data-near-origin]');
        if (originBtn) { setOrigin(originBtn.dataset.nearOrigin); return; }

        const addBtn = ev.target.closest('[data-near-add]');
        if (addBtn) {
            const id = addBtn.dataset.nearAdd;
            if (!state.tour.stops.includes(id)) {
                state.tour.stops.push(id);
                emit('tour:changed');
                emit('toast', { type: 'success', text: 'Zur Tour hinzugefügt.' });
            }
            renderNearby();
            return;
        }

        const row = ev.target.closest('[data-near-id]');
        if (row) {
            const customer = state.customers.find((c) => c.id === row.dataset.nearId);
            if (customer) { showMapView(); flyToCustomer(customer); }
        }
    });

    // Neu berechnen bei Kartenbewegung, Datenänderungen, Tab-/Tiefenwechsel.
    on('map:moved', scheduleRender);
    on('customers:changed', scheduleRender);
    on('filters:changed', scheduleRender);
    on('tour:changed', scheduleRender);
    on('depth:changed', scheduleRender);
    on('tab:changed', (tab) => { if (tab === 'karte') renderNearby(); });
}

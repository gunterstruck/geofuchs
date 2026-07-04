/**
 * Karten-Feature
 * Leaflet-Karte mit Gebietsebenen (Landkreise/PLZ), Kundenmarkern
 * (geclustert, nach Vertriebsbeauftragtem eingefärbt) und Tour-Anzeige.
 */

import L from 'leaflet';
import 'leaflet.markercluster';

import { CONFIG } from '../core/config.js';
import { state, on, emit, repColor, visibleCustomers, getCustomer, UNASSIGNED } from '../core/state.js';
import { loadLevel, regionName, regionKey } from '../services/geodata.js';
import { aggregateByRegion, dominantRep } from './territory.js';

let map = null;
let regionLayer = null;
let clusterGroup = null;
let tourLayer = null;
let regionStats = new Map();
let currentLevelData = null;

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

export function initMap(containerId) {
    map = L.map(containerId, {
        attributionControl: true,
        zoomControl: false,
        zoomSnap: CONFIG.map.zoomSnap,
        maxBoundsViscosity: 1.0
    }).setView(CONFIG.map.defaultCenter, CONFIG.map.defaultZoom);

    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.setMaxBounds(CONFIG.map.bounds);

    L.tileLayer(CONFIG.tileLayer.url, CONFIG.tileLayer).addTo(map);

    clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 44,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster) => L.divIcon({
            html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
            className: 'cluster-wrapper',
            iconSize: [36, 36]
        })
    });
    map.addLayer(clusterGroup);

    tourLayer = L.layerGroup().addTo(map);

    // Buttons in Popups (Event-Delegation)
    map.on('popupopen', (e) => {
        e.popup.getElement()?.querySelectorAll('[data-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                handlePopupAction(btn.dataset.action, btn.dataset.id);
                map.closePopup();
            });
        });
    });

    on('customers:changed', refreshAll);
    on('filters:changed', refreshAll);
    on('level:changed', () => { setLevel(state.level); });
    on('tour:changed', renderTour);

    setLevel(state.level);
    return map;
}

function handlePopupAction(action, customerId) {
    const customer = getCustomer(customerId);
    if (!customer) return;
    if (action === 'tour-add') {
        if (!state.tour.stops.includes(customer.id)) {
            state.tour.stops.push(customer.id);
            emit('tour:changed');
        }
    } else if (action === 'tour-start') {
        state.tour.start = {
            lat: customer.lat, lng: customer.lng,
            label: customer.name, customerId: customer.id,
            strasse: customer.strasse, plz: customer.plz, ort: customer.ort
        };
        emit('tour:changed');
    }
}

function refreshAll() {
    renderMarkers();
    restyleRegions();
    renderTour();
}

// ---- Gebietsebene ----

export async function setLevel(level) {
    state.level = level;
    if (regionLayer) { map.removeLayer(regionLayer); regionLayer = null; }
    currentLevelData = null;
    if (level === 'none' || !CONFIG.levels[level]?.file) return;

    emit('map:loading', true);
    try {
        currentLevelData = await loadLevel(level);
    } catch (error) {
        emit('map:loading', false);
        emit('toast', { type: 'error', text: error.message });
        return;
    }
    emit('map:loading', false);

    // Ebene könnte inzwischen erneut gewechselt worden sein
    if (state.level !== level) return;

    computeStats();
    regionLayer = L.geoJSON(currentLevelData, {
        style: (feature) => styleFor(feature),
        attribution: CONFIG.levels[level].attribution,
        onEachFeature: (feature, layer) => {
            layer.on('mouseover', function () {
                this.setStyle({ weight: 2.5, color: '#0d9488' });
                if (this.bringToFront) this.bringToFront();
            });
            layer.on('mouseout', function () {
                this.setStyle(styleFor(feature));
            });
            layer.bindPopup(() => regionPopupHtml(feature), { maxWidth: 320 });
            layer.bindTooltip(regionName(level, feature), { sticky: true, direction: 'top' });
        }
    }).addTo(map);
    regionLayer.bringToBack();
}

function computeStats() {
    regionStats = currentLevelData
        ? aggregateByRegion(state.level, currentLevelData, visibleCustomers())
        : new Map();
    emit('regions:stats', regionStats);
}

function styleFor(feature) {
    const entry = regionStats.get(regionKey(state.level, feature));
    if (!entry || entry.total === 0) return { ...CONFIG.regionStyle.default };
    const vb = dominantRep(entry);
    const maxTotal = 12;
    return {
        fillColor: repColor(vb),
        color: '#334155',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.18 + 0.4 * Math.min(entry.total / maxTotal, 1)
    };
}

function restyleRegions() {
    if (!regionLayer || !currentLevelData) return;
    computeStats();
    regionLayer.eachLayer((layer) => layer.setStyle(styleFor(layer.feature)));
}

function regionPopupHtml(feature) {
    const name = regionName(state.level, feature);
    const entry = regionStats.get(regionKey(state.level, feature));
    if (!entry || entry.total === 0) {
        return `<div class="popup"><h3>${escapeHtml(name)}</h3><p class="muted">Keine (sichtbaren) Kunden in diesem Gebiet.</p></div>`;
    }
    const reps = [...entry.byRep.entries()].sort((a, b) => b[1] - a[1]);
    const repRows = reps.map(([vb, count]) => `
        <li><span class="dot" style="background:${repColor(vb)}"></span>${escapeHtml(vb)}<b>${count}</b></li>
    `).join('');
    const list = entry.customers.slice(0, 8).map((c) => `<li class="mini">${escapeHtml(c.name)}${c.ort ? ` <span class="muted">(${escapeHtml(c.ort)})</span>` : ''}</li>`).join('');
    const more = entry.customers.length > 8 ? `<li class="mini muted">… und ${entry.customers.length - 8} weitere</li>` : '';
    return `<div class="popup">
        <h3>${escapeHtml(name)}</h3>
        <p><b>${entry.total}</b> Kunde${entry.total === 1 ? '' : 'n'}</p>
        <ul class="rep-list">${repRows}</ul>
        <ul class="cust-list">${list}${more}</ul>
    </div>`;
}

// ---- Kundenmarker ----

function customerIcon(customer) {
    const color = repColor(customer.vb);
    const inTour = state.tour.stops.includes(customer.id);
    return L.divIcon({
        className: 'customer-marker-wrapper',
        html: `<div class="customer-marker${customer.geo === 'plz' ? ' approx' : ''}${inTour ? ' in-tour' : ''}" style="background:${color}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
}

export function customerPopupHtml(customer) {
    const addr = [customer.strasse, `${customer.plz} ${customer.ort}`.trim()]
        .filter(Boolean).map(escapeHtml).join('<br>');
    const inTour = state.tour.stops.includes(customer.id);
    return `<div class="popup">
        <h3>${escapeHtml(customer.name)}</h3>
        ${customer.nummer ? `<p class="muted">Kd.-Nr. ${escapeHtml(customer.nummer)}</p>` : ''}
        ${addr ? `<p>${addr}</p>` : ''}
        <p>
            <span class="dot" style="background:${repColor(customer.vb)}"></span>${escapeHtml(customer.vb || UNASSIGNED)}
            ${customer.gruppe ? ` · ${escapeHtml(customer.gruppe)}` : ''}
        </p>
        ${customer.umsatz ? `<p class="muted">Umsatz: ${customer.umsatz.toLocaleString('de-DE')} €</p>` : ''}
        ${customer.geo === 'plz' ? '<p class="muted small">📍 Position: PLZ-Mittelpunkt (ungefähr)</p>' : ''}
        <div class="popup-actions">
            <button data-action="tour-start" data-id="${escapeHtml(customer.id)}">🚩 Als Start</button>
            <button data-action="tour-add" data-id="${escapeHtml(customer.id)}" ${inTour ? 'disabled' : ''}>${inTour ? '✓ In Tour' : '➕ Zur Tour'}</button>
        </div>
    </div>`;
}

function renderMarkers() {
    clusterGroup.clearLayers();
    const markers = [];
    for (const customer of visibleCustomers()) {
        if (customer.lat === null || customer.lng === null) continue;
        const marker = L.marker([customer.lat, customer.lng], {
            icon: customerIcon(customer),
            title: customer.name
        });
        marker.bindPopup(() => customerPopupHtml(customer), { maxWidth: 300 });
        markers.push(marker);
    }
    clusterGroup.addLayers(markers);
}

// ---- Tour-Anzeige ----

function renderTour() {
    tourLayer.clearLayers();
    renderMarkers(); // "in-tour"-Status der Marker aktualisieren

    const { start, stops } = state.tour;
    const stopCustomers = stops.map(getCustomer).filter((c) => c && c.lat !== null);

    if (start) {
        L.marker([start.lat, start.lng], {
            icon: L.divIcon({
                className: 'tour-marker-wrapper',
                html: '<div class="tour-marker start">S</div>',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }),
            zIndexOffset: 1000
        }).bindTooltip(`Start: ${start.label}`).addTo(tourLayer);
    }

    stopCustomers.forEach((c, i) => {
        L.marker([c.lat, c.lng], {
            icon: L.divIcon({
                className: 'tour-marker-wrapper',
                html: `<div class="tour-marker">${i + 1}</div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            }),
            zIndexOffset: 900
        }).bindTooltip(`${i + 1}. ${c.name}`).addTo(tourLayer);
    });

    if (start && stopCustomers.length > 0) {
        const points = [[start.lat, start.lng], ...stopCustomers.map((c) => [c.lat, c.lng])];
        L.polyline(points, { color: '#0d9488', weight: 3, dashArray: '8 6', opacity: 0.85 }).addTo(tourLayer);
    }
}

// ---- Hilfen für andere Module ----

export function flyToCustomer(customer, openPopup = true) {
    if (!map || customer.lat === null) return;
    map.flyTo([customer.lat, customer.lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
    if (openPopup) {
        setTimeout(() => {
            L.popup({ maxWidth: 300 })
                .setLatLng([customer.lat, customer.lng])
                .setContent(customerPopupHtml(customer))
                .openOn(map);
        }, 850);
    }
}

export function fitToCustomers() {
    const located = visibleCustomers().filter((c) => c.lat !== null);
    if (!map || located.length === 0) return;
    const bounds = L.latLngBounds(located.map((c) => [c.lat, c.lng]));
    map.fitBounds(bounds.pad(0.15));
}

export function getMap() {
    return map;
}

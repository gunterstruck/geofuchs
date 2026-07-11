/**
 * Karten-Feature
 * Leaflet-Karte mit Gebietsebenen (Landkreise/PLZ), Kundenmarkern
 * und Tour-Anzeige.
 */

import L from 'leaflet';
import 'leaflet.markercluster';

import { CONFIG } from '../core/config.js';
import { formatRevenueShort, formatRevenueFull } from '../core/format.js';
import { state, on, emit, repColor, attrColor, visibleCustomers, tourScopedCustomers, getCustomer, markDirty, getTerritory, setTerritory, UNASSIGNED } from '../core/state.js';
import { loadLevel, regionName, regionKey } from '../services/geodata.js';
import { getRoadRoute, peekRoadRoute } from '../services/routing.js';
import { aggregateByRegion, dominantRep } from './territory.js';
import { revenueWeightedCentroids } from './labelPlacement.js';
import { suggestNearby, suggestAlongRoute } from './tour.js';
import { visitStatus, isOpportunity, lastVisit, agoText, formatDateDe, markVisitedToday, STATUS_COLORS, STATUS_LABELS } from './visits.js';
import { copyText, customerText } from './handoff.js';
import { openRegionEditor } from '../ui/regionEditor.js';

let map = null;
let regionLayer = null;
let clusterGroup = null;
let tourLayer = null;
let labelLayer = null;
let baseLayer = null;
let regionStats = new Map();
let maxRegionTotal = 1;   // höchste Kundenzahl je Gebiet (für die Abdeckungs-Ansicht)
let currentLevelData = null;
let featureByKey = new Map();
let currentView = { paint: 'vb', markers: true, labels: false, markerBy: 'vb' };
let roadRouteSeq = 0;
let simulationPreview = null;
const ROUTE_HUE_START = 0;      // rot
const ROUTE_HUE_END = 276;      // lila

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

function isMobileMap() {
    return window.innerWidth <= 768;
}

function tileOptions(key = state.basemap) {
    return CONFIG.tileLayers?.[key] || CONFIG.tileLayers?.standard || CONFIG.tileLayer;
}

function applyBasemap() {
    if (!map) return;
    const opts = tileOptions();
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(opts.url, opts).addTo(map);
}

function popupOptions(extra = {}) {
    const mobile = isMobileMap();
    return {
        closeButton: false,
        maxWidth: mobile ? Math.min(330, window.innerWidth - 28) : 320,
        maxHeight: mobile ? Math.max(260, Math.floor(window.innerHeight * 0.56)) : 380,
        autoPan: true,
        keepInView: true,
        autoPanPaddingTopLeft: L.point(18, mobile ? 76 : 82),
        autoPanPaddingBottomRight: L.point(18, mobile ? 190 : 44),
        ...extra
    };
}

function decoratePopup(popupEl) {
    const popup = popupEl?.querySelector('.popup');
    if (!popup || popup.querySelector('.popup-toolbar')) return;
    popup.insertAdjacentHTML('afterbegin', `
        <div class="popup-toolbar">
            <button type="button" class="popup-drag-handle" aria-label="Popup verschieben" title="Popup verschieben">↔</button>
            <button type="button" class="popup-close-btn" data-popup-close>Schließen</button>
        </div>
    `);
}

function routeColor(index, total) {
    const t = total <= 1 ? 0 : index / (total - 1);
    const hue = ROUTE_HUE_START + (ROUTE_HUE_END - ROUTE_HUE_START) * t;
    return `hsl(${Math.round(hue)} 78% 48%)`;
}

function drawColoredRoute(latLngs, { dashed = false, tooltip = '' } = {}) {
    if (latLngs.length < 2) return;
    L.polyline(latLngs, {
        color: '#ffffff',
        weight: dashed ? 10 : 11,
        opacity: dashed ? 0.78 : 0.96,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
    }).addTo(tourLayer);

    for (let i = 0; i < latLngs.length - 1; i++) {
        L.polyline([latLngs[i], latLngs[i + 1]], {
            color: routeColor(i, latLngs.length - 1),
            weight: dashed ? 4 : 5,
            dashArray: dashed ? '10 7' : null,
            opacity: dashed ? 0.86 : 0.98,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false
        }).addTo(tourLayer);
    }
    if (tooltip) {
        L.polyline(latLngs, {
            color: 'transparent',
            weight: 14,
            opacity: 0,
            interactive: true
        }).addTo(tourLayer).bindTooltip(tooltip);
    }
}

function makePopupDraggable(popupEl) {
    if (!popupEl || !isMobileMap() || popupEl.dataset.draggablePopup === '1') return;
    popupEl.dataset.draggablePopup = '1';
    const wrapper = popupEl.querySelector('.leaflet-popup-content-wrapper');
    const handle = popupEl.querySelector('.popup-drag-handle');
    if (!wrapper || !handle) return;
    wrapper.classList.add('draggable-popup');

    let startX = 0, startY = 0, tx = 0, ty = 0, dragging = false;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    handle.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        dragging = true;
        startX = ev.clientX - tx;
        startY = ev.clientY - ty;
        handle.setPointerCapture?.(ev.pointerId);
        wrapper.classList.add('dragging');
    });
    handle.addEventListener('pointermove', (ev) => {
        if (!dragging) return;
        ev.preventDefault();
        ev.stopPropagation();
        tx = clamp(ev.clientX - startX, -window.innerWidth * 0.42, window.innerWidth * 0.42);
        ty = clamp(ev.clientY - startY, -window.innerHeight * 0.28, window.innerHeight * 0.28);
        wrapper.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    });
    const endDrag = () => {
        dragging = false;
        wrapper.classList.remove('dragging');
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
}

export function initMap(containerId) {
    map = L.map(containerId, {
        attributionControl: true,
        zoomControl: false,
        zoomSnap: CONFIG.map.zoomSnap,
        maxBoundsViscosity: 0.05
    }).setView(CONFIG.map.defaultCenter, CONFIG.map.defaultZoom);

    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.setMaxBounds(CONFIG.map.bounds);

    applyBasemap();

    clusterGroup = L.markerClusterGroup({
        maxClusterRadius: isMobileMap() ? 54 : 44,
        spiderfyOnMaxZoom: true,
        spiderfyDistanceMultiplier: isMobileMap() ? 1.85 : 1.2,
        showCoverageOnHover: false,
        spiderLegPolylineOptions: { weight: 2, color: '#0f766e', opacity: 0.65 },
        iconCreateFunction: (cluster) => L.divIcon({
            html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
            className: 'cluster-wrapper',
            iconSize: [36, 36]
        })
    });
    map.addLayer(clusterGroup);

    labelLayer = L.layerGroup().addTo(map);
    tourLayer = L.layerGroup().addTo(map);

    // Zoom-Automatik: bei „auto" den Detailgrad neu bestimmen
    map.on('zoomend', () => {
        if (state.colorMode === 'auto') applyView();
    });

    // Buttons in Popups (Event-Delegation)
    map.on('popupopen', (e) => {
        const el = e.popup.getElement();
        if (!el) return;
        decoratePopup(el);
        makePopupDraggable(el);
        el.querySelector('[data-popup-close]')?.addEventListener('click', () => map.closePopup());
        el.querySelectorAll('[data-action]:not([data-action="edit-region"])').forEach((btn) => {
            btn.addEventListener('click', () => {
                const keepOpen = handlePopupAction(btn.dataset.action, btn.dataset.id);
                if (!keepOpen) map.closePopup();
            });
        });
        // Rhythmus-Auswahl direkt im Popup
        el.querySelector('[data-rhythm]')?.addEventListener('change', (ev) => {
            const customer = getCustomer(ev.target.dataset.rhythm);
            if (!customer) return;
            const val = parseInt(ev.target.value, 10);
            customer.rhythmusWochen = Number.isFinite(val) && val > 0 ? val : null;
            markDirty();
        });
        // Gebietszuordnung direkt im Gebiets-Popup (Vertriebsbezirk)
        el.querySelectorAll('select[data-terr]').forEach((sel) => {
            sel.addEventListener('change', () => {
                setTerritory(sel.dataset.level, sel.dataset.key, sel.dataset.terr, sel.value, sel.dataset.name);
                markDirty();
            });
        });
        // „Ändern" -> Gebiets-Editor (Kunden umordnen)
        el.querySelector('[data-action="edit-region"]')?.addEventListener('click', (ev) => {
            const btn = ev.currentTarget;
            const feature = featureByKey.get(btn.dataset.key);
            map.closePopup();
            openRegionEditor({ level: btn.dataset.level, key: btn.dataset.key, name: btn.dataset.name, feature });
        });
    });
    map.on('popupclose', (e) => {
        const el = e.popup.getElement();
        if (!el) return;
        el.dataset.draggablePopup = '';
        const wrapper = el.querySelector('.leaflet-popup-content-wrapper');
        if (wrapper) {
            wrapper.style.transform = '';
            wrapper.classList.remove('dragging');
        }
    });

    on('customers:changed', refreshAll);
    on('filters:changed', refreshAll);
    on('colormode:changed', applyView);
    on('basemap:changed', applyBasemap);
    on('level:changed', () => { setLevel(state.level); });
    on('tour:scope-changed', refreshAll);
    on('tour:changed', renderTour);
    on('simulation:preview', (preview) => {
        simulationPreview = preview?.active ? preview : null;
        map.closePopup();
        applyView();
    });

    setLevel(state.level);
    return map;
}

/** @returns {boolean} true, wenn das Popup offen bleiben soll */
function handlePopupAction(action, customerId) {
    const customer = getCustomer(customerId);
    if (!customer) return false;
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
    } else if (action === 'tour-dest') {
        const first = !state.tour.destination;
        state.tour.destination = {
            lat: customer.lat, lng: customer.lng,
            label: customer.name, customerId: customer.id,
            strasse: customer.strasse, plz: customer.plz, ort: customer.ort
        };
        // Ziel gesetzt -> „Entlang der Tour"-Vorschläge werden sinnvoll
        if (first && state.tour.suggestMode !== 'route') state.tour.suggestMode = 'route';
        emit('tour:changed');
    } else if (action === 'mark-visited') {
        markVisitedToday(customer);
        markDirty();
        emit('toast', { type: 'success', text: `Besuch bei ${customer.name} für heute eingetragen.` });
    } else if (action === 'copy-customer') {
        copyText(customerText(customer)).then((ok) => emit('toast', ok
            ? { type: 'success', text: `${customer.name} in die Zwischenablage kopiert.` }
            : { type: 'error', text: 'Kopieren nicht möglich.' }));
    }
    return false;
}

function refreshAll() {
    applyView();
    renderTour();
}

// ---- Ansicht / Detailgrad (Level of Detail) ----

/** Ist die aktuelle Ebene flächenfähig (Gebiete geladen)? */
function aggregatable() {
    return state.level !== 'none' && !!CONFIG.levels[state.level]?.file && !!currentLevelData;
}

/** Erstes verfügbares Gebiet-Attribut aus der Wunschliste */
function firstActiveAttr(list) {
    for (const a of list) {
        if (state.dims[a]?.active) return a;
    }
    return null;
}

/**
 * Legt fest, was gezeigt wird: welches Attribut die Flächen einfärbt (paint),
 * ob Kundenmarker sichtbar sind (markers), ob Gebiets-Labels erscheinen (labels)
 * und wonach die Marker eingefärbt werden (markerBy).
 */
function resolveView() {
    const mode = state.colorMode;
    const z = map ? map.getZoom() : CONFIG.map.defaultZoom;

    if (mode === 'status') return { paint: null, markers: true, labels: false, markerBy: 'status' };
    if (mode === 'rep') return { paint: 'vb', markers: true, labels: false, markerBy: 'vb' };
    if (mode === 'luecken') {
        // Abdeckung braucht Flächen; ohne Gebietsebene auf Kundenpunkte zurückfallen
        if (!aggregatable()) return { paint: null, markers: true, labels: false, markerBy: 'bezirk' };
        return { paint: 'luecken', markers: false, labels: false, markerBy: 'bezirk' };
    }
    if (mode === 'bezirk') {
        const p = firstActiveAttr(['bezirk', 'gruppe']);
        return { paint: p, markers: false, labels: true, markerBy: 'bezirk' };
    }
    if (mode === 'gruppe') {
        const p = firstActiveAttr(['gruppe', 'bezirk']);
        return { paint: p, markers: false, labels: true, markerBy: 'bezirk' };
    }
    // auto: Detailgrad nach Zoomstufe
    if (!aggregatable()) return { paint: null, markers: true, labels: false, markerBy: 'bezirk' };
    if (z >= CONFIG.map.lodCustomerZoom) {
        const p = firstActiveAttr(['bezirk', 'gruppe']);
        return { paint: p, markers: true, labels: false, markerBy: p };
    }
    if (z >= CONFIG.map.lodBezirkZoom) {
        const p = firstActiveAttr(['bezirk', 'gruppe']);
        return { paint: p, markers: false, labels: true, markerBy: 'bezirk' };
    }
    const p = firstActiveAttr(['gruppe', 'bezirk']);
    return { paint: p, markers: false, labels: true, markerBy: 'bezirk' };
}

function applyView() {
    currentView = simulationPreview
        ? { paint: simulationPreview.attr, markers: false, labels: false, markerBy: simulationPreview.attr }
        : resolveView();
    restyleRegions();
    renderMarkers();
    renderLabels();
}

// ---- Gebietsebene ----

export async function setLevel(level) {
    state.level = level;
    if (regionLayer) { map.removeLayer(regionLayer); regionLayer = null; }
    if (labelLayer) labelLayer.clearLayers();
    currentLevelData = null;
    featureByKey = new Map();
    if (level === 'none' || !CONFIG.levels[level]?.file) { applyView(); return; }

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

    for (const feature of currentLevelData.features) {
        featureByKey.set(regionKey(level, feature), feature);
    }

    computeStats();
    currentView = resolveView();
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
            layer.bindPopup(() => regionPopupHtml(feature), popupOptions({ maxWidth: 320 }));
            layer.bindTooltip(() => regionTooltip(feature), { sticky: true, direction: 'top' });
        }
    }).addTo(map);
    regionLayer.bringToBack();
    applyView();
}

function computeStats() {
    regionStats = currentLevelData
        ? aggregateByRegion(state.level, currentLevelData, markerCustomers())
        : new Map();
    maxRegionTotal = Math.max(1, ...[...regionStats.values()].map((e) => e.total || 0));
    emit('regions:stats', regionStats);
}

/** Häufigster Attributwert in einem Gebiet (nach Kundenzahl) */
function dominantValue(entry, attr) {
    if (attr === 'vb') return dominantRep(entry);
    const counts = new Map();
    for (const c of entry.customers) {
        const v = String(c[attr] ?? '').trim() || UNASSIGNED;
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let best = UNASSIGNED, bestN = 0;
    for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
    return best;
}

/**
 * Wert eines Gebiets für ein Attribut: explizite Gebietszuordnung (auch ohne
 * Kunden) hat Vorrang, sonst der dominante Wert der Kunden im Gebiet.
 */
function regionValue(feature, attr) {
    const key = regionKey(state.level, feature);
    const terr = getTerritory(state.level, key);
    if (terr && terr[attr]) return terr[attr];
    const entry = regionStats.get(key);
    if (entry && entry.total > 0) return dominantValue(entry, attr);
    return null;
}

// ---- Proportionale Mehrfarb-Einfärbung ----

function hexToRgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex2(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); }

/**
 * Farben mehrerer Werte anteilig „übereinander" transparent mischen
 * (Alpha-Over-Composite). Dominanter Anteil liegt oben.
 * @param {Array<{color,share}>} shares
 */
function compositeFill(shares, maxOpacity) {
    const sorted = [...shares].sort((a, b) => a.share - b.share);
    let R = 0, G = 0, B = 0, A = 0;
    for (const { color, share } of sorted) {
        const a = Math.max(0, Math.min(1, share));
        const [r, g, b] = hexToRgb(color);
        const A2 = a + A * (1 - a);
        if (A2 > 0) {
            R = (r * a + R * A * (1 - a)) / A2;
            G = (g * a + G * A * (1 - a)) / A2;
            B = (b * a + B * A * (1 - a)) / A2;
        }
        A = A2;
    }
    return { fillColor: `#${toHex2(R)}${toHex2(G)}${toHex2(B)}`, fillOpacity: Math.min(maxOpacity, A) };
}

/** Anteile der Attributwerte in einem Gebiet (oder explizite Zuordnung = 100 %) */
function regionShares(feature, attr) {
    const key = regionKey(state.level, feature);
    const terr = getTerritory(state.level, key);
    if (terr && terr[attr]) return { shares: [{ color: attrColor(attr, terr[attr]), share: 1 }], assignedOnly: true, total: regionStats.get(key)?.total ?? 0 };
    const entry = regionStats.get(key);
    if (!entry || entry.total === 0) return null;
    const counts = new Map();
    for (const c of entry.customers) {
        const v = attr === 'vb' ? (c.vb || UNASSIGNED) : (String(c[attr] ?? '').trim() || UNASSIGNED);
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const shares = [...counts.entries()].map(([v, n]) => ({ color: attrColor(attr, v), share: n / entry.total }));
    return { shares, assignedOnly: false, total: entry.total };
}

/** Ist einem Gebiet (außer dem Namen) etwas zugeordnet? */
function isAssigned(terr) {
    return !!terr && Object.keys(terr).some((k) => k !== 'name');
}

/**
 * Abdeckungs-/„Weiße-Flecken"-Einfärbung:
 *  rot  = keine Kunden und keine Zuordnung (echter weißer Fleck)
 *  gelb = zugeordnet, aber (noch) keine Kunden
 *  grün = abgedeckt (Sättigung nach Kundenzahl)
 */
function styleLuecken(feature) {
    const key = regionKey(state.level, feature);
    const total = regionStats.get(key)?.total ?? 0;
    if (total === 0) {
        const assigned = isAssigned(getTerritory(state.level, key));
        return {
            fillColor: assigned ? '#f59e0b' : '#dc2626',
            color: '#ffffff', weight: 1, dashArray: assigned ? '4 3' : '',
            opacity: 1, fillOpacity: assigned ? 0.32 : 0.5
        };
    }
    const t = Math.min(1, total / maxRegionTotal);
    return { fillColor: '#16a34a', color: '#ffffff', weight: 1, dashArray: '', opacity: 1, fillOpacity: 0.18 + t * 0.4 };
}

function simulationRegionInfo(feature) {
    const key = regionKey(state.level, feature);
    const change = simulationPreview?.territories.get(`${state.level}:${key}`);
    const oldValue = regionValue(feature, simulationPreview?.attr);
    return {
        change,
        oldValue: oldValue || UNASSIGNED,
        newValue: change?.value || oldValue || UNASSIGNED
    };
}

function simulationStyle(feature) {
    const info = simulationRegionInfo(feature);
    const changed = Boolean(info.change);
    if (simulationPreview.mode === 'changes' && !changed) {
        return {
            fillColor: '#cbd5e1',
            fillOpacity: 0.08,
            color: '#94a3b8',
            opacity: 0.28,
            weight: 0.7
        };
    }

    const value = simulationPreview.mode === 'old' ? info.oldValue : info.newValue;
    const fillColor = attrColor(simulationPreview.attr, value);
    if (simulationPreview.mode === 'changes' && changed) {
        return {
            fillColor,
            fillOpacity: 0.72,
            color: attrColor(simulationPreview.attr, info.oldValue),
            opacity: 1,
            weight: 4,
            dashArray: '8 5'
        };
    }
    return {
        fillColor,
        fillOpacity: changed ? 0.7 : 0.48,
        color: changed ? '#f59e0b' : '#ffffff',
        opacity: 1,
        weight: changed ? 3 : 1
    };
}

function styleFor(feature) {
    if (simulationPreview) return simulationStyle(feature);
    if (currentView.paint === 'luecken') return styleLuecken(feature);
    if (state.ui.mode === 'aussendienst' && currentView.markers) {
        return {
            ...CONFIG.regionStyle.default,
            color: '#94a3b8',
            weight: 0.8,
            opacity: 0.45,
            fillOpacity: 0.025
        };
    }
    const attr = currentView.paint;
    const info = attr ? regionShares(feature, attr) : null;
    if (!info) return { ...CONFIG.regionStyle.default };

    const territory = !currentView.markers; // Flächenansicht: kräftiger füllen
    const maxOpacity = territory ? (info.assignedOnly ? 0.45 : 0.8) : 0.4;
    const { fillColor, fillOpacity } = compositeFill(info.shares, maxOpacity);
    return {
        fillColor,
        color: territory ? '#ffffff' : '#334155',
        weight: territory ? 1.2 : 1,
        dashArray: info.assignedOnly ? '4 3' : '',
        opacity: 1,
        fillOpacity
    };
}

function regionTooltip(feature) {
    const name = regionName(state.level, feature);
    const key = regionKey(state.level, feature);
    const entry = regionStats.get(key);
    const total = entry?.total ?? 0;

    if (simulationPreview) {
        const info = simulationRegionInfo(feature);
        if (!info.change) return `${name} · unverändert · ${total} Kunden`;
        const customers = (info.change.customerIds || []).map((id) => getCustomer(id)).filter(Boolean);
        const revenue = customers.reduce((sum, customer) => sum + (customer.umsatz || 0), 0);
        return `${name} · ${info.oldValue} → ${info.newValue} · ${customers.length} Kd. · ${formatRevenueShort(revenue)}`;
    }

    if (currentView.paint === 'luecken') {
        if (total === 0) {
            return isAssigned(getTerritory(state.level, key))
                ? `${name} · zugeordnet, aber 0 Kunden`
                : `${name} · weißer Fleck – keine Kunden`;
        }
        return `${name} · ${total} Kd. abgedeckt`;
    }

    const attr = currentView.paint || 'bezirk';
    const terr = getTerritory(state.level, key);

    if (terr && terr[attr] && total === 0) return `${name} · ${terr[attr]} (zugeordnet, 0 Kunden)`;
    if (!entry || total === 0) return terr ? `${name} · zugeordnet` : name;

    // Zusammensetzung (Top-Anteile) anzeigen
    const counts = new Map();
    for (const c of entry.customers) {
        const v = attr === 'vb' ? (c.vb || UNASSIGNED) : (String(c[attr] ?? '').trim() || UNASSIGNED);
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([v, n]) => `${v} ${Math.round((n / total) * 100)}%`);
    const more = counts.size > 3 ? ' …' : '';
    return `${name} · ${total} Kd. · ${parts.join(', ')}${more}`;
}

function restyleRegions() {
    if (!regionLayer || !currentLevelData) return;
    computeStats();
    regionLayer.eachLayer((layer) => layer.setStyle(styleFor(layer.feature)));
}

/**
 * Gebiets-Labels (Name + Umsatzsumme) je Attributwert der Flächenansicht.
 * Anker ist das Gebiet mit den meisten Kunden dieses Werts.
 */
function renderLabels() {
    if (!labelLayer) return;
    labelLayer.clearLayers();
    if (simulationPreview || !currentView.labels || !currentLevelData) return;

    const attr = currentView.paint;
    const valueOf = (c) => attr === 'vb' ? (c.vb || UNASSIGNED) : (String(c[attr] ?? '').trim() || UNASSIGNED);
    const revByVal = new Map();
    const revenueValues = new Set();
    // Filter steuern die sichtbaren Flächen, nicht die fachliche Gesamtsumme
    // eines Vertriebsbezirks oder einer Vertriebsgruppe.
    for (const c of state.customers) {
        const v = valueOf(c);
        if (c.umsatz === null || c.umsatz === undefined || c.umsatz === '') continue;
        const revenue = Number(c.umsatz);
        if (!Number.isFinite(revenue)) continue;
        revByVal.set(v, (revByVal.get(v) ?? 0) + revenue);
        revenueValues.add(v);
    }

    // Polygone je Wert sammeln – über ALLE Kunden (filterunabhängig, damit die
    // Label-Position stabil bleibt und der fachlichen Gesamtsicht entspricht).
    // Je Polygon Mittelpunkt, Kundenzahl und Umsatz dieses Werts erfassen.
    const polygonsByValue = new Map(); // val -> [{ lat, lng, count, revenue }]
    const addPolygon = (val, feature, count, revenue) => {
        const bbox = feature?._bbox;
        if (!bbox) return;
        const [minX, minY, maxX, maxY] = bbox;
        const list = polygonsByValue.get(val) ?? [];
        list.push({ lat: (minY + maxY) / 2, lng: (minX + maxX) / 2, count, revenue });
        polygonsByValue.set(val, list);
    };

    const allStats = aggregateByRegion(state.level, currentLevelData, state.customers);
    for (const [key, entry] of allStats) {
        const feature = featureByKey.get(key);
        if (!feature) continue;
        const perVal = new Map(); // val -> { count, revenue }
        for (const c of entry.customers) {
            const v = valueOf(c);
            const cur = perVal.get(v) ?? { count: 0, revenue: 0 };
            cur.count++;
            const rev = Number(c.umsatz);
            if (Number.isFinite(rev)) cur.revenue += rev;
            perVal.set(v, cur);
        }
        for (const [v, { count, revenue }] of perVal) addPolygon(v, feature, count, revenue);
    }

    // Gebietszuordnungen ohne Kunden beschriften, wenn der Wert sonst kein Label hätte
    for (const [id, terr] of Object.entries(state.territories)) {
        if (!id.startsWith(`${state.level}:`)) continue;
        const v = terr[attr];
        if (!v || polygonsByValue.has(v)) continue;
        const feature = featureByKey.get(id.slice(state.level.length + 1));
        if (feature) addPolygon(v, feature, 0, 0);
    }

    const positions = revenueWeightedCentroids(polygonsByValue);

    for (const [val, center] of positions) {
        if (val === UNASSIGNED) continue;
        const col = attrColor(attr, val);
        const hasRevenue = revenueValues.has(val);
        const revenue = revByVal.get(val) || 0;
        const rev = hasRevenue ? formatRevenueShort(revenue) : '';
        const dimension = state.dims[attr]?.label || 'Gebiet';
        const revenueTitle = hasRevenue
            ? `Gesamtumsatz ${dimension} ${val}: ${formatRevenueFull(revenue)}`
            : '';
        L.marker(center, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
                className: 'territory-label-wrapper',
                html: `<div class="territory-label" style="border-color:${col}"${revenueTitle ? ` title="${escapeHtml(revenueTitle)}"` : ''}>
                    <span class="tl-dot" style="background:${col}"></span>${escapeHtml(val)}
                    ${rev ? `<span class="tl-rev">Σ ${rev}</span>` : ''}
                </div>`,
                iconSize: null
            })
        }).addTo(labelLayer);
    }
}

/** Zuweisung für die ganze Fläche eines Gebiets */
function territoryAssignHtml(feature) {
    if (simulationPreview) return '';
    if (isMobileMap()) return '';
    const name = regionName(state.level, feature);
    const key = regionKey(state.level, feature);
    const terr = getTerritory(state.level, key) || {};
    const opts = (values, current) => ['<option value="">— nicht zugeordnet —</option>']
        .concat(values.map((v) => `<option value="${escapeHtml(v)}"${v === current ? ' selected' : ''}>${escapeHtml(v)}</option>`)).join('');

    const bezirke = state.dims.bezirk?.active ? [...state.dims.bezirk.values.keys()].filter((v) => v !== UNASSIGNED) : [];

    const base = `data-level="${escapeHtml(state.level)}" data-key="${escapeHtml(key)}" data-name="${escapeHtml(name)}"`;
    return `<div class="terr-assign">
        <button class="popup-edit-btn" data-action="edit-region" ${base}>✏️ Kunden dieses Gebiets umordnen …</button>
        <p class="terr-assign-title">Ganze Fläche zuweisen:</p>
        <label class="terr-row"><span>Vertriebsbezirk</span>
            <select data-terr="bezirk" ${base}>${opts(bezirke, terr.bezirk)}</select></label>
    </div>`;
}

function regionPopupHtml(feature) {
    const name = regionName(state.level, feature);
    const entry = regionStats.get(regionKey(state.level, feature));
    if (simulationPreview) {
        const info = simulationRegionInfo(feature);
        const customers = (info.change?.customerIds || []).map((id) => getCustomer(id)).filter(Boolean);
        const revenue = customers.reduce((sum, customer) => sum + (customer.umsatz || 0), 0);
        const changed = Boolean(info.change);
        return `<div class="popup simulation-region-popup">
            <h3>${escapeHtml(name)}</h3>
            <p class="simulation-popup-state">${changed ? 'Simulierte Änderung' : 'Unverändert'}</p>
            <div class="simulation-compare">
                <div><span>Alt</span><b><i class="dot" style="background:${attrColor(simulationPreview.attr, info.oldValue)}"></i>${escapeHtml(info.oldValue)}</b></div>
                <span class="simulation-arrow">→</span>
                <div><span>Neu</span><b><i class="dot" style="background:${attrColor(simulationPreview.attr, info.newValue)}"></i>${escapeHtml(info.newValue)}</b></div>
            </div>
            ${changed ? `<p><b>${customers.length}</b> Kunden · <b title="${formatRevenueFull(revenue)}">${formatRevenueShort(revenue)}</b> Umsatz</p>` : '<p class="muted small">Für dieses Gebiet ist keine Änderung vorgesehen.</p>'}
        </div>`;
    }
    const assign = territoryAssignHtml(feature);
    const revenue = entry?.customers?.reduce((sum, c) => sum + (c.umsatz || 0), 0) || 0;
    const revenueLine = revenue ? `<p class="region-revenue">Umsatz gesamt: <b title="${formatRevenueFull(revenue)}">${formatRevenueShort(revenue)}</b></p>` : '';
    const readonly = isMobileMap() ? '<p class="muted small">Mobile Ansicht: Gebiete sind hier nur lesbar. Änderungen bitte am Desktop vornehmen.</p>' : '';

    if (!entry || entry.total === 0) {
        return `<div class="popup">
            <h3>${escapeHtml(name)}</h3>
            <p class="muted">Keine (sichtbaren) Kunden in diesem Gebiet.</p>
            ${readonly}
            ${assign}
        </div>`;
    }
    const bezirke = new Map();
    for (const c of entry.customers) {
        const value = String(c.bezirk ?? '').trim() || UNASSIGNED;
        bezirke.set(value, (bezirke.get(value) ?? 0) + 1);
    }
    const districtRows = [...bezirke.entries()].sort((a, b) => b[1] - a[1]).map(([bezirk, count]) => `
        <li><span class="dot" style="background:${attrColor('bezirk', bezirk)}"></span>${escapeHtml(bezirk)}<b>${count}</b></li>
    `).join('');
    const list = entry.customers.slice(0, 8).map((c) => `<li class="mini">${escapeHtml(c.name)}${c.ort ? ` <span class="muted">(${escapeHtml(c.ort)})</span>` : ''}</li>`).join('');
    const more = entry.customers.length > 8 ? `<li class="mini muted">… und ${entry.customers.length - 8} weitere</li>` : '';
    return `<div class="popup">
        <h3>${escapeHtml(name)}</h3>
        <p><b>${entry.total}</b> Kunde${entry.total === 1 ? '' : 'n'}</p>
        ${revenueLine}
        ${readonly}
        <ul class="rep-list">${districtRows}</ul>
        <ul class="cust-list">${list}${more}</ul>
        ${assign}
    </div>`;
}

// ---- Kundenmarker ----

function markerColor(customer) {
    const by = currentView.markerBy;
    if (by === 'status') return STATUS_COLORS[visitStatus(customer)];
    if (by && by !== 'vb') return attrColor(by, customer[by] || UNASSIGNED);
    return repColor(customer.vb);
}

function customerIcon(customer) {
    const color = markerColor(customer);
    const inTour = state.tour.stops.includes(customer.id);
    const overdue = currentView.markerBy !== 'status' && visitStatus(customer) === 'ueberfaellig';
    return L.divIcon({
        className: 'customer-marker-wrapper',
        html: `<div class="customer-marker${customer.geo === 'plz' ? ' approx' : ''}${inTour ? ' in-tour' : ''}${overdue ? ' overdue' : ''}" style="background:${color}"></div>`,
        iconSize: isMobileMap() ? [36, 36] : [24, 24],
        iconAnchor: isMobileMap() ? [18, 18] : [12, 12]
    });
}

const RHYTHM_OPTIONS = [
    ['', 'kein Rhythmus'], ['2', 'alle 2 Wochen'], ['4', 'alle 4 Wochen'],
    ['6', 'alle 6 Wochen'], ['8', 'alle 8 Wochen'], ['12', 'alle 12 Wochen'], ['26', 'alle 26 Wochen']
];

function visitBlockHtml(customer) {
    const status = visitStatus(customer);
    const last = lastVisit(customer);
    const statusBadge = customer.rhythmusWochen
        ? `<span class="status-badge" style="background:${STATUS_COLORS[status]}">${STATUS_LABELS[status]}</span>`
        : '';
    const rhythmSelect = `<select class="rhythm-select" data-rhythm="${escapeHtml(customer.id)}">
        ${RHYTHM_OPTIONS.map(([v, l]) => `<option value="${v}"${String(customer.rhythmusWochen ?? '') === v ? ' selected' : ''}>${l}</option>`).join('')}
    </select>`;
    return `<div class="visit-block">
        <p class="visit-line">🗓️ Zuletzt: <b>${last ? formatDateDe(last) : '—'}</b> <span class="muted small">(${agoText(last)})</span> ${statusBadge}</p>
        <div class="visit-controls">
            <button data-action="mark-visited" data-id="${escapeHtml(customer.id)}">✓ Heute besucht</button>
            ${rhythmSelect}
        </div>
    </div>`;
}

function contactBlockHtml(customer) {
    const parts = [];
    const contactName = String(customer.ansprechpartner ?? '').trim();
    if (contactName) {
        parts.push(`<p class="muted small">👤 Hauptansprechpartner: <b>${escapeHtml(contactName)}</b></p>`);
    }
    const links = [];
    if (customer.telefon) {
        const tel = String(customer.telefon).replace(/[^\d+]/g, '');
        links.push(`<a class="contact-link" href="tel:${escapeHtml(tel)}">📞 Anrufen</a>`);
    }
    if (customer.email) {
        links.push(`<a class="contact-link" href="mailto:${escapeHtml(customer.email)}">✉️ E-Mail</a>`);
    }
    if (links.length) parts.push(`<div class="contact-links">${links.join('')}</div>`);
    return parts.join('');
}

export function customerPopupHtml(customer) {
    const inTour = state.tour.stops.includes(customer.id);
    const isDest = state.tour.destination?.customerId === customer.id;
    // Kompakter Kopf: Adresse einzeilig, Hierarchie und Umsatz in einer Zeile,
    // Kundennummer neben den Namen – damit ohne Scrollen mehr sichtbar ist.
    const addr = [customer.strasse, `${customer.plz} ${customer.ort}`.trim()]
        .filter(Boolean).map(escapeHtml).join(' · ');
    const hierarchy = [customer.channel, customer.gruppe, customer.bezirk]
        .filter(Boolean).map(escapeHtml).join(' › ');
    const umsatz = customer.umsatz
        ? `<b class="popup-umsatz" title="${formatRevenueFull(customer.umsatz)}">${formatRevenueShort(customer.umsatz)}</b>`
        : '';
    const metaLine = [hierarchy, umsatz].filter(Boolean).join(' · ');
    return `<div class="popup popup-customer">
        <h3>${escapeHtml(customer.name)}${customer.nummer ? `<span class="popup-nr">Nr. ${escapeHtml(customer.nummer)}</span>` : ''}</h3>
        ${addr ? `<p class="popup-addr">${addr}${customer.geo === 'plz' ? ' <span class="muted small">· 📍 ca. (PLZ-Mitte)</span>' : ''}</p>` : ''}
        ${metaLine ? `<p class="muted small popup-meta">${metaLine}</p>` : ''}
        ${contactBlockHtml(customer)}
        ${visitBlockHtml(customer)}
        <div class="popup-actions">
            <button data-action="tour-start" data-id="${escapeHtml(customer.id)}">🚩 Als Start</button>
            <button data-action="tour-dest" data-id="${escapeHtml(customer.id)}" ${isDest ? 'disabled' : ''}>${isDest ? '✓ Ziel' : '🏁 Als Ziel'}</button>
            <button data-action="tour-add" data-id="${escapeHtml(customer.id)}" ${inTour ? 'disabled' : ''}>${inTour ? '✓ In Tour' : '➕ Zur Tour'}</button>
            <button data-action="copy-customer" data-id="${escapeHtml(customer.id)}" title="Als Text für Outlook/Copilot kopieren">📋 Kopieren</button>
        </div>
    </div>`;
}

function markerCustomers() {
    if (state.ui.mode === 'aussendienst' && state.tour.mapFocus && state.tour.start) {
        return tourFocusCustomers();
    }
    const tourScoped = state.ui.mode === 'aussendienst'
        && state.tour.bezirk
        && state.tour.bezirk !== '__none__';
    return tourScoped ? tourScopedCustomers() : visibleCustomers();
}

function tourFocusCustomers() {
    const { start, stopCustomers, dest, routePts } = currentTourRoutePoints();
    const ids = new Set();
    if (start?.customerId) ids.add(start.customerId);
    for (const c of stopCustomers) ids.add(c.id);
    if (dest?.id) ids.add(dest.id);
    if (dest?.customerId) ids.add(dest.customerId);

    const pool = tourScopedCustomers();
    const exclude = new Set(ids);
    const road = state.tour.suggestMode === 'route' ? peekRoadRoute(routePts) : null;
    const roadPath = road?.latLngs?.map(([lat, lng]) => ({ lat, lng })) || null;
    const suggestions = state.tour.suggestMode === 'route'
        ? suggestAlongRoute(start, [...stopCustomers, dest].filter(Boolean), pool, state.tour.radiusKm, exclude, state.tour.roundTrip, false, roadPath)
        : suggestNearby(start, pool, state.tour.radiusKm, exclude, false);

    for (const { customer } of suggestions) ids.add(customer.id);
    return [...ids].map(getCustomer).filter((c) => c && c.lat !== null);
}

function renderMarkers() {
    clusterGroup.clearLayers();
    // In der Flächenansicht (Bezirke/Gruppen) werden Kunden ausgeblendet.
    if (!currentView.markers) return;
    const markers = [];
    for (const customer of markerCustomers()) {
        if (customer.lat === null || customer.lng === null) continue;
        // Chancen-Fokus: nur fällige/überfällige Kunden zeigen
        if (state.ui.opportunityOnly && !isOpportunity(customer)) continue;
        const marker = L.marker([customer.lat, customer.lng], {
            icon: customerIcon(customer),
            title: customer.name
        });
        marker.bindPopup(() => customerPopupHtml(customer), popupOptions({ maxWidth: 300 }));
        markers.push(marker);
    }
    clusterGroup.addLayers(markers);
}

// ---- Tour-Anzeige ----

function resolvedTourDestination(destination) {
    if (!destination) return null;
    const c = destination.customerId ? getCustomer(destination.customerId) : null;
    return (c && c.lat !== null) ? c : (destination.lat !== null ? destination : null);
}

function currentTourRoutePoints() {
    const { start, stops, destination, roundTrip } = state.tour;
    const stopCustomers = stops.map(getCustomer).filter((c) => c && c.lat !== null);
    const dest = resolvedTourDestination(destination);
    const routePts = [];
    if (start) routePts.push([start.lat, start.lng]);
    stopCustomers.forEach((c) => routePts.push([c.lat, c.lng]));
    if (dest) routePts.push([dest.lat, dest.lng]);
    if (start && roundTrip && routePts.length > 1) routePts.push([start.lat, start.lng]);
    return { start, stopCustomers, dest, routePts };
}

function attachTourCustomerPopup(marker, point, tooltipText) {
    marker.bindTooltip(tooltipText);
    if (point?.customerId) {
        const customer = getCustomer(point.customerId);
        if (customer) {
            marker.bindPopup(() => customerPopupHtml(customer), popupOptions({ maxWidth: 300 }));
        }
    } else if (point?.id) {
        marker.bindPopup(() => customerPopupHtml(point), popupOptions({ maxWidth: 300 }));
    }
    return marker;
}

function drawAirRoute(routePts) {
    drawColoredRoute(routePts, { dashed: true, tooltip: 'Luftlinie: Rot = Start, Lila = Ziel' });
}

async function drawRoadRoute(routePts) {
    const seq = roadRouteSeq;
    const road = await getRoadRoute(routePts);
    if (seq !== roadRouteSeq || state.tour.routeLineMode !== 'road') return null;
    if (!road?.latLngs?.length) return false;

    drawColoredRoute(road.latLngs, {
        tooltip: `Straßenroute (${road.provider}): ${Math.round(road.distanceKm)} km, ca. ${Math.round(road.durationMin)} min · Rot = Start, Lila = Ziel`
    });
    return true;
}

function renderTour() {
    roadRouteSeq += 1;
    tourLayer.clearLayers();
    renderMarkers(); // "in-tour"-Status der Marker aktualisieren

    const { start, stopCustomers, dest, routePts } = currentTourRoutePoints();
    const hasRoute = start && routePts.length > 1;

    if (hasRoute) {
        if (state.tour.routeLineMode === 'road') {
            drawRoadRoute(routePts).then((ok) => {
                if (ok === false && state.tour.routeLineMode === 'road') drawAirRoute(routePts);
            });
        } else {
            drawAirRoute(routePts);
        }
    }

    if (start) {
        const startIsEnd = state.tour.roundTrip && hasRoute;
        const marker = L.marker([start.lat, start.lng], {
            icon: L.divIcon({
                className: 'tour-marker-wrapper',
                html: `<div class="tour-marker start" style="--route-step:${routeColor(0, Math.max(2, routePts.length))}">${startIsEnd ? 'S/Z' : 'S'}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }),
            zIndexOffset: 1000
        });
        attachTourCustomerPopup(marker, start, `${startIsEnd ? 'Start/Ziel' : 'Start'}: ${start.label}`).addTo(tourLayer);
    }

    stopCustomers.forEach((c, i) => {
        const autoDestination = !dest && !state.tour.roundTrip && i === stopCustomers.length - 1;
        const marker = L.marker([c.lat, c.lng], {
            icon: L.divIcon({
                className: 'tour-marker-wrapper',
                html: `<div class="tour-marker${autoDestination ? ' dest auto-dest' : ''}" style="--route-step:${routeColor(i + 1, Math.max(2, routePts.length))}">${i + 1}</div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            }),
            zIndexOffset: 900
        });
        attachTourCustomerPopup(marker, c, `${autoDestination ? 'Ziel' : `${i + 1}.`} ${c.name}`).addTo(tourLayer);
    });

    if (dest) {
        const marker = L.marker([dest.lat, dest.lng], {
            icon: L.divIcon({
                className: 'tour-marker-wrapper',
                html: `<div class="tour-marker dest" style="--route-step:${routeColor(routePts.length - 1, Math.max(2, routePts.length))}">🏁</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }),
            zIndexOffset: 1000
        });
        attachTourCustomerPopup(marker, dest, `Ziel: ${dest.name || state.tour.destination.label}`).addTo(tourLayer);
    }

}

// ---- Hilfen für andere Module ----

export function flyToCustomer(customer, openPopup = true) {
    if (!map || customer.lat === null) return;
    map.flyTo([customer.lat, customer.lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
    if (openPopup) {
        setTimeout(() => {
            L.popup(popupOptions({ maxWidth: 300 }))
                .setLatLng([customer.lat, customer.lng])
                .setContent(customerPopupHtml(customer))
                .openOn(map);
        }, 850);
    }
}

export function closeMapPopups() {
    if (map) map.closePopup();
}

export function fitToCustomers() {
    const located = markerCustomers().filter((c) => c.lat !== null);
    if (!map || located.length === 0) return;
    const bounds = L.latLngBounds(located.map((c) => [c.lat, c.lng]));
    map.fitBounds(bounds.pad(0.15), {
        paddingTopLeft: isMobileMap() ? [18, 72] : [24, 80],
        paddingBottomRight: isMobileMap() ? [18, 174] : [24, 72]
    });
}

export function getMap() {
    return map;
}

/** Karte auf die aktuell geplante Tour zoomen. */
export function fitTourRoute() {
    const { routePts } = currentTourRoutePoints();
    if (!map || routePts.length < 2) return false;
    map.closePopup();
    map.invalidateSize();
    const bounds = L.latLngBounds(routePts);
    const mobile = isMobileMap();
    map.fitBounds(bounds.pad(0.18), {
        animate: true,
        duration: 0.7,
        maxZoom: 12,
        paddingTopLeft: mobile ? [18, 76] : [24, 80],
        paddingBottomRight: mobile ? [18, 190] : [24, 72]
    });
    return true;
}

/** Karte auf einen Punkt (z. B. GPS-Standort) zentrieren */
export function focusPoint(lat, lng, zoom) {
    if (!map || lat === null || lng === null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), zoom ?? 11), { duration: 0.8 });
}

/**
 * Karten-Feature
 * Leaflet-Karte mit Gebietsebenen (Landkreise/PLZ), Kundenmarkern
 * (geclustert, nach Vertriebsbeauftragtem eingefärbt) und Tour-Anzeige.
 */

import L from 'leaflet';
import 'leaflet.markercluster';

import { CONFIG } from '../core/config.js';
import { state, on, emit, repColor, attrColor, visibleCustomers, getCustomer, markDirty, getTerritory, setTerritory, UNASSIGNED } from '../core/state.js';
import { loadLevel, regionName, regionKey } from '../services/geodata.js';
import { aggregateByRegion, dominantRep } from './territory.js';
import { visitStatus, isOpportunity, lastVisit, agoText, formatDateDe, markVisitedToday, STATUS_COLORS, STATUS_LABELS } from './visits.js';
import { copyText, customerText } from './handoff.js';
import { openRegionEditor } from '../ui/regionEditor.js';

let map = null;
let regionLayer = null;
let clusterGroup = null;
let tourLayer = null;
let labelLayer = null;
let regionStats = new Map();
let maxRegionTotal = 1;   // höchste Kundenzahl je Gebiet (für die Abdeckungs-Ansicht)
let currentLevelData = null;
let featureByKey = new Map();
let currentView = { paint: 'vb', markers: true, labels: false, markerBy: 'vb' };

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
        // Gebietszuordnung direkt im Gebiets-Popup (VB / Betriebsbezirk)
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

    on('customers:changed', refreshAll);
    on('filters:changed', refreshAll);
    on('colormode:changed', applyView);
    on('level:changed', () => { setLevel(state.level); });
    on('tour:changed', renderTour);

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

/** Erstes verfügbares Attribut aus der Wunschliste (Ebene aktiv bzw. 'vb') */
function firstActiveAttr(list) {
    for (const a of list) {
        if (a === 'vb') return 'vb';
        if (state.dims[a]?.active) return a;
    }
    return 'vb';
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
        if (!aggregatable()) return { paint: 'vb', markers: true, labels: false, markerBy: 'vb' };
        return { paint: 'luecken', markers: false, labels: false, markerBy: 'vb' };
    }
    if (mode === 'bezirk') {
        const p = firstActiveAttr(['bezirk', 'gruppe', 'vb']);
        return { paint: p, markers: false, labels: true, markerBy: 'vb' };
    }
    if (mode === 'gruppe') {
        const p = firstActiveAttr(['gruppe', 'bezirk', 'vb']);
        return { paint: p, markers: false, labels: true, markerBy: 'vb' };
    }
    // auto: Detailgrad nach Zoomstufe
    if (!aggregatable()) return { paint: 'vb', markers: true, labels: false, markerBy: 'vb' };
    if (z >= CONFIG.map.lodCustomerZoom) {
        const p = firstActiveAttr(['bezirk', 'gruppe', 'vb']);
        return { paint: p, markers: true, labels: false, markerBy: p };
    }
    if (z >= CONFIG.map.lodBezirkZoom) {
        const p = firstActiveAttr(['bezirk', 'gruppe', 'vb']);
        return { paint: p, markers: false, labels: true, markerBy: 'vb' };
    }
    const p = firstActiveAttr(['gruppe', 'bezirk', 'vb']);
    return { paint: p, markers: false, labels: true, markerBy: 'vb' };
}

function applyView() {
    currentView = resolveView();
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
            layer.bindPopup(() => regionPopupHtml(feature), { maxWidth: 320 });
            layer.bindTooltip(() => regionTooltip(feature), { sticky: true, direction: 'top' });
        }
    }).addTo(map);
    regionLayer.bringToBack();
    applyView();
}

function computeStats() {
    regionStats = currentLevelData
        ? aggregateByRegion(state.level, currentLevelData, visibleCustomers())
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

function styleFor(feature) {
    if (currentView.paint === 'luecken') return styleLuecken(feature);
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

    if (currentView.paint === 'luecken') {
        if (total === 0) {
            return isAssigned(getTerritory(state.level, key))
                ? `${name} · zugeordnet, aber 0 Kunden`
                : `${name} · weißer Fleck – keine Kunden`;
        }
        return `${name} · ${total} Kd. abgedeckt`;
    }

    const attr = currentView.paint && currentView.paint !== 'vb' ? currentView.paint : 'vb';
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

/** Kompakte Euro-Angabe für Labels */
function fmtEuroShort(n) {
    if (!n) return '';
    if (n >= 1e6) return `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio €`;
    if (n >= 1e3) return `${Math.round(n / 1e3).toLocaleString('de-DE')} T€`;
    return `${Math.round(n).toLocaleString('de-DE')} €`;
}

/**
 * Gebiets-Labels (Name + Umsatzsumme) je Attributwert der Flächenansicht.
 * Anker ist das Gebiet mit den meisten Kunden dieses Werts.
 */
function renderLabels() {
    if (!labelLayer) return;
    labelLayer.clearLayers();
    if (!currentView.labels || !currentLevelData) return;

    const attr = currentView.paint;
    const revByVal = new Map();
    for (const c of visibleCustomers()) {
        const v = attr === 'vb' ? (c.vb || UNASSIGNED) : (String(c[attr] ?? '').trim() || UNASSIGNED);
        revByVal.set(v, (revByVal.get(v) ?? 0) + (c.umsatz || 0));
    }

    // Anker-Gebiet je Wert (meiste Kunden dieses Werts)
    const anchor = new Map(); // val -> { feature, count }
    for (const [key, entry] of regionStats) {
        const feature = featureByKey.get(key);
        if (!feature) continue;
        const counts = new Map();
        for (const c of entry.customers) {
            const v = attr === 'vb' ? (c.vb || UNASSIGNED) : (String(c[attr] ?? '').trim() || UNASSIGNED);
            counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        for (const [v, n] of counts) {
            if (!anchor.has(v) || n > anchor.get(v).count) anchor.set(v, { feature, count: n });
        }
    }
    // Gebietszuordnungen ohne Kunden ebenfalls beschriften (Anker: das zugeordnete Gebiet)
    for (const [id, terr] of Object.entries(state.territories)) {
        if (!id.startsWith(`${state.level}:`)) continue;
        const v = terr[attr];
        if (!v || anchor.has(v)) continue;
        const feature = featureByKey.get(id.slice(state.level.length + 1));
        if (feature) anchor.set(v, { feature, count: 0 });
    }

    for (const [val, a] of anchor) {
        if (val === UNASSIGNED) continue;
        const [minX, minY, maxX, maxY] = a.feature._bbox;
        const center = [(minY + maxY) / 2, (minX + maxX) / 2];
        const col = attrColor(attr, val);
        const rev = fmtEuroShort(revByVal.get(val) || 0);
        L.marker(center, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
                className: 'territory-label-wrapper',
                html: `<div class="territory-label" style="border-color:${col}">
                    <span class="tl-dot" style="background:${col}"></span>${escapeHtml(val)}
                    ${rev ? `<span class="tl-rev">${rev}</span>` : ''}
                </div>`,
                iconSize: null
            })
        }).addTo(labelLayer);
    }
}

/** Zuweisungs-Selects (VB & Betriebsbezirk) für ein Gebiet */
function territoryAssignHtml(feature) {
    const name = regionName(state.level, feature);
    const key = regionKey(state.level, feature);
    const terr = getTerritory(state.level, key) || {};
    const opts = (values, current) => ['<option value="">— nicht zugeordnet —</option>']
        .concat(values.map((v) => `<option value="${escapeHtml(v)}"${v === current ? ' selected' : ''}>${escapeHtml(v)}</option>`)).join('');

    const reps = [...state.reps.keys()].filter((v) => v !== UNASSIGNED);
    const bezirke = state.dims.bezirk?.active ? [...state.dims.bezirk.values.keys()].filter((v) => v !== UNASSIGNED) : [];

    const base = `data-level="${escapeHtml(state.level)}" data-key="${escapeHtml(key)}" data-name="${escapeHtml(name)}"`;
    return `<div class="terr-assign">
        <button class="popup-edit-btn" data-action="edit-region" ${base}>✏️ Kunden dieses Gebiets umordnen …</button>
        <p class="terr-assign-title">Ganze Fläche zuweisen:</p>
        <label class="terr-row"><span>Vertriebsbeauftragter</span>
            <select data-terr="vb" ${base}>${opts(reps, terr.vb)}</select></label>
        <label class="terr-row"><span>Betriebsbezirk</span>
            <select data-terr="bezirk" ${base}>${opts(bezirke, terr.bezirk)}</select></label>
    </div>`;
}

function regionPopupHtml(feature) {
    const name = regionName(state.level, feature);
    const entry = regionStats.get(regionKey(state.level, feature));
    const assign = territoryAssignHtml(feature);

    if (!entry || entry.total === 0) {
        return `<div class="popup">
            <h3>${escapeHtml(name)}</h3>
            <p class="muted">Keine (sichtbaren) Kunden in diesem Gebiet.</p>
            ${assign}
        </div>`;
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
        iconSize: [16, 16],
        iconAnchor: [8, 8]
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
        <p class="visit-line">🗓️ Letzter Besuch: <b>${last ? formatDateDe(last) : '—'}</b> <span class="muted small">(${agoText(last)})</span> ${statusBadge}</p>
        <div class="visit-controls">
            <button data-action="mark-visited" data-id="${escapeHtml(customer.id)}">✓ Heute besucht</button>
            ${rhythmSelect}
        </div>
    </div>`;
}

function contactBlockHtml(customer) {
    const parts = [];
    if (customer.ansprechpartner) parts.push(`<p class="muted small">👤 ${escapeHtml(customer.ansprechpartner)}</p>`);
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
    const addr = [customer.strasse, `${customer.plz} ${customer.ort}`.trim()]
        .filter(Boolean).map(escapeHtml).join('<br>');
    const inTour = state.tour.stops.includes(customer.id);
    const isDest = state.tour.destination?.customerId === customer.id;
    return `<div class="popup">
        <h3>${escapeHtml(customer.name)}</h3>
        ${customer.nummer ? `<p class="muted">Kd.-Nr. ${escapeHtml(customer.nummer)}</p>` : ''}
        ${addr ? `<p>${addr}</p>` : ''}
        <p>
            <span class="dot" style="background:${repColor(customer.vb)}"></span>${escapeHtml(customer.vb || UNASSIGNED)}
        </p>
        ${[customer.channel, customer.gruppe, customer.bezirk].some(Boolean)
            ? `<p class="muted small">${[customer.channel, customer.gruppe, customer.bezirk].filter(Boolean).map(escapeHtml).join(' › ')}</p>`
            : ''}
        ${customer.umsatz ? `<p class="muted">Umsatz: ${customer.umsatz.toLocaleString('de-DE')} €</p>` : ''}
        ${contactBlockHtml(customer)}
        ${visitBlockHtml(customer)}
        ${customer.geo === 'plz' ? '<p class="muted small">📍 Position: PLZ-Mittelpunkt (ungefähr)</p>' : ''}
        <div class="popup-actions">
            <button data-action="tour-start" data-id="${escapeHtml(customer.id)}">🚩 Als Start</button>
            <button data-action="tour-dest" data-id="${escapeHtml(customer.id)}" ${isDest ? 'disabled' : ''}>${isDest ? '✓ Ziel' : '🏁 Als Ziel'}</button>
            <button data-action="tour-add" data-id="${escapeHtml(customer.id)}" ${inTour ? 'disabled' : ''}>${inTour ? '✓ In Tour' : '➕ Zur Tour'}</button>
            <button data-action="copy-customer" data-id="${escapeHtml(customer.id)}" title="Als Text für Outlook/Copilot kopieren">📋 Kopieren</button>
        </div>
    </div>`;
}

function renderMarkers() {
    clusterGroup.clearLayers();
    // In der Flächenansicht (Bezirke/Gruppen) werden Kunden ausgeblendet.
    if (!currentView.markers) return;
    const markers = [];
    for (const customer of visibleCustomers()) {
        if (customer.lat === null || customer.lng === null) continue;
        // Chancen-Fokus: nur fällige/überfällige Kunden zeigen
        if (state.ui.opportunityOnly && !isOpportunity(customer)) continue;
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

    const { start, stops, destination } = state.tour;
    const stopCustomers = stops.map(getCustomer).filter((c) => c && c.lat !== null);
    // Ziel als Punkt (echtes Kundenobjekt bevorzugt, sonst der gespeicherte Punkt)
    let dest = null;
    if (destination) {
        const c = destination.customerId ? getCustomer(destination.customerId) : null;
        dest = (c && c.lat !== null) ? c : (destination.lat !== null ? destination : null);
    }

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

    if (dest) {
        L.marker([dest.lat, dest.lng], {
            icon: L.divIcon({
                className: 'tour-marker-wrapper',
                html: '<div class="tour-marker dest">🏁</div>',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }),
            zIndexOffset: 1000
        }).bindTooltip(`Ziel: ${dest.name || destination.label}`).addTo(tourLayer);
    }

    // Streckenlinie: Start -> Zwischenstopps -> Ziel (-> Start bei Rundreise)
    const routePts = [];
    if (start) routePts.push([start.lat, start.lng]);
    stopCustomers.forEach((c) => routePts.push([c.lat, c.lng]));
    if (dest) routePts.push([dest.lat, dest.lng]);
    if (start && routePts.length > 1) {
        if (state.tour.roundTrip) routePts.push([start.lat, start.lng]); // Rundreise: zurück zum Start
        L.polyline(routePts, { color: '#0d9488', weight: 3, dashArray: '8 6', opacity: 0.85 }).addTo(tourLayer);
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

/** Karte auf einen Punkt (z. B. GPS-Standort) zentrieren */
export function focusPoint(lat, lng, zoom) {
    if (!map || lat === null || lng === null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), zoom ?? 11), { duration: 0.8 });
}

/**
 * Karten-Feature
 * Leaflet-Karte mit Gebietsebenen (Landkreise/PLZ), Kundenmarkern
 * und Tour-Anzeige.
 */

import L from 'leaflet';
import 'leaflet.markercluster';

import { CONFIG } from '../core/config.js';
import { isDemoCustomer } from '../core/demoSafety.js';
import { formatRevenueShort, formatRevenueFull } from '../core/format.js';
import { state, on, emit, repColor, attrColor, getCustomer, markDirty, clearServiceTourPlan, getTerritory, setTerritory, UNASSIGNED } from '../core/state.js';
import { loadLevel, regionName, regionKey } from '../services/geodata.js';
import { getRoadRoute, peekRoadRoute } from '../services/routing.js';
import { aggregateByRegion, dominantRep } from './territory.js';
import {
    compactTerritoryLabel,
    revenueWeightedCentroids,
    selectNonOverlappingLabels,
    territoryLabelBudget,
    territoryLabelMode
} from './labelPlacement.js';
import { suggestNearby, suggestAlongRoute } from './tour.js';
import { popupSafeRect, popupPanOffset, popupContentHeightLimit } from './popupViewport.js';
import { visitStatus, isOpportunity, lastVisit, agoText, formatDateDe, markVisitedToday, STATUS_COLORS, STATUS_LABELS } from './visits.js';
import { automaticLevelActive, automaticLevelForZoom } from './mapLevel.js';
import { isPlanningRelevantServiceContract, normalizeCustomerNumber } from './serviceContracts.js';
import { serviceVisitsForCustomer, isOpenServiceVisit, serviceVisitWindow } from './serviceVisits.js';
import { modeTourCustomers, modeVisibleCustomers } from './customerScope.js';
import {
    CUSTOMER_MARKER_MODES,
    DEFAULT_CUSTOMER_COLOR,
    canOfferCustomerMarkerHint,
    customerClusterRadius,
    customerClusterSummary,
    customerMarkerLabel,
    customerMarkerMode,
    customerMarkerModeClass
} from './customerMarkers.js';
import { openRegionEditor } from '../ui/regionEditor.js';
import { openCustomerBriefing } from '../ui/customerBriefing.js';

let map = null;
let regionLayer = null;
let clusterGroup = null;
let tourLayer = null;

// Stapel mit ≤ dieser Anzahl fächern beim Antippen sofort alle Kunden auf,
// statt sich Zoom für Zoom (12 → 6 → 3) herunterzuklicken.
const CUSTOMER_CLUSTER_EXPLODE_MAX = 5;
let labelLayer = null;
let baseLayer = null;
let regionStats = new Map();
let maxRegionTotal = 1;   // höchste Kundenzahl je Gebiet (für die Abdeckungs-Ansicht)
let currentLevelData = null;
let featureByKey = new Map();
let currentView = { paint: 'vb', markers: true, labels: false, markerBy: 'vb' };
let roadRouteSeq = 0;
let simulationPreview = null;
let activeRegionTooltipLayer = null;
let activePopup = null;
let customerMarkers = [];
let markerHintOfferTimer = 0;
let markerHintDismissTimer = 0;
let markerHintTarget = null;
let clusterHintTimer = 0;
let clusterHintTarget = null;
let popupFitFrame = 0;
let levelLoadSequence = 0;
let loadingLevel = null;
const ROUTE_HUE_START = 0;      // rot
const ROUTE_HUE_END = 276;      // lila
// Entdeck-Reise: Die „Tippe …"-Hinweise begleiten den Nutzer über mehrere
// Zoomstufen (Stapel → kleinerer Stapel → Kundenkachel), bis er zum ersten
// Mal eine Kundenkarte geöffnet hat. Erst dieser Belohnungsmoment beendet
// die Reise dauerhaft; je Sitzung sind die Hinweise gedeckelt, damit sie
// führen, ohne zu nerven.
const CUSTOMER_DISCOVERY_DONE_KEY = 'tf_customer_discovery_done';
const DISCOVERY_HINT_MAX_OFFERS = 3;
let clusterHintOffers = 0;
let markerHintOffers = 0;
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

function isMobileMap() {
    return window.innerWidth <= 768;
}

function discoveryJourneyDone() {
    try { return localStorage.getItem(CUSTOMER_DISCOVERY_DONE_KEY) === '1'; } catch { return false; }
}

/** Erste geöffnete Kundenkarte = Ziel erreicht, keine Hinweise mehr. */
function completeDiscoveryJourney() {
    try { localStorage.setItem(CUSTOMER_DISCOVERY_DONE_KEY, '1'); } catch { /* Speicherung ist optional */ }
    dismissCustomerMarkerHint();
    dismissCustomerClusterHint();
}

function resetCustomerDiscoveryHints() {
    dismissCustomerMarkerHint();
    dismissCustomerClusterHint();
    clusterHintOffers = 0;
    markerHintOffers = 0;
    try {
        localStorage.removeItem(CUSTOMER_DISCOVERY_DONE_KEY);
    } catch { /* Speicherung ist optional */ }
}

function dismissCustomerClusterHint() {
    clearTimeout(clusterHintTimer);
    clusterHintTimer = 0;
    clusterHintTarget?.classList.remove('is-discovery');
    clusterHintTarget = null;
}

function maybeOfferCustomerClusterHint() {
    if (!map || discoveryJourneyDone() || clusterHintOffers >= DISCOVERY_HINT_MAX_OFFERS
        || document.querySelector('.sc-shield') || insideMobilePreview) return;
    const mapRect = map.getContainer().getBoundingClientRect();
    const centerX = mapRect.left + mapRect.width / 2;
    const centerY = mapRect.top + mapRect.height / 2;
    const target = [...map.getContainer().querySelectorAll('.customer-stack-card')]
        .sort((left, right) => {
            const a = left.getBoundingClientRect();
            const b = right.getBoundingClientRect();
            return Math.hypot(a.left + a.width / 2 - centerX, a.top + a.height / 2 - centerY)
                - Math.hypot(b.left + b.width / 2 - centerX, b.top + b.height / 2 - centerY);
        })[0];
    if (!target) return;
    clusterHintOffers += 1;
    clusterHintTarget = target;
    target.classList.add('is-discovery');
    clusterHintTimer = window.setTimeout(dismissCustomerClusterHint, 4600);
}

function scheduleCustomerClusterHint() {
    clearTimeout(clusterHintTimer);
    clusterHintTimer = window.setTimeout(maybeOfferCustomerClusterHint, 320);
}

function dismissCustomerMarkerHint() {
    clearTimeout(markerHintOfferTimer);
    clearTimeout(markerHintDismissTimer);
    markerHintOfferTimer = 0;
    markerHintDismissTimer = 0;
    if (!markerHintTarget) return;
    markerHintTarget.getElement()?.querySelector('.customer-marker-card')?.classList.remove('is-discovery');
    markerHintTarget.closeTooltip();
    markerHintTarget.unbindTooltip();
    markerHintTarget = null;
}

function syncCustomerMarkerMode() {
    if (!map) return;
    const mode = customerMarkerMode(map.getZoom(), { mobile: isMobileMap() });
    const container = map.getContainer();
    CUSTOMER_MARKER_MODES.forEach((item) => container.classList.remove(customerMarkerModeClass(item)));
    container.classList.add(customerMarkerModeClass(mode));
}

function maybeOfferCustomerMarkerHint() {
    if (!map || !clusterGroup || !canOfferCustomerMarkerHint({
        zoom: map.getZoom(),
        mobile: isMobileMap(),
        hasCustomers: customerMarkers.length > 0,
        alreadyShown: discoveryJourneyDone() || markerHintOffers >= DISCOVERY_HINT_MAX_OFFERS,
        showcaseRunning: Boolean(document.querySelector('.sc-shield')),
        insidePreview: insideMobilePreview
    })) return;

    const bounds = map.getBounds();
    const center = map.getCenter();
    const visible = customerMarkers
        .filter(({ marker }) => bounds.contains(marker.getLatLng()) && clusterGroup.getVisibleParent(marker) === marker)
        .sort((a, b) => center.distanceTo(a.marker.getLatLng()) - center.distanceTo(b.marker.getLatLng()));
    const target = visible[0]?.marker;
    if (!target?.getElement()) return;

    markerHintOffers += 1;
    markerHintTarget = target;
    target.getElement().querySelector('.customer-marker-card')?.classList.add('is-discovery');
    target.bindTooltip('Kundenkarte antippen und Details entdecken', {
        permanent: true,
        direction: 'top',
        offset: [0, -18],
        opacity: 1,
        className: 'customer-marker-discovery'
    }).openTooltip();
    markerHintDismissTimer = window.setTimeout(dismissCustomerMarkerHint, 6500);
}

function scheduleCustomerMarkerHint() {
    clearTimeout(markerHintOfferTimer);
    markerHintOfferTimer = window.setTimeout(maybeOfferCustomerMarkerHint, 260);
}

function visibleElementRect(element) {
    if (!element) return null;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
}

function mobilePopupSafeArea() {
    const mapRect = map?.getContainer()?.getBoundingClientRect();
    if (!mapRect) return null;
    return popupSafeRect(mapRect, {
        topObstruction: visibleElementRect(document.getElementById('mobile-topnav')),
        bottomObstruction: visibleElementRect(document.getElementById('sidebar')),
        margin: 12
    });
}

function currentPopupPadding() {
    if (!isMobileMap()) {
        return { topLeft: L.point(18, 82), bottomRight: L.point(18, 44) };
    }
    const mapRect = map?.getContainer()?.getBoundingClientRect();
    const safe = mobilePopupSafeArea();
    if (!mapRect || !safe || safe.bottom <= safe.top) {
        return { topLeft: L.point(18, 96), bottomRight: L.point(18, 58) };
    }
    return {
        topLeft: L.point(
            Math.max(12, Math.round(safe.left - mapRect.left)),
            Math.max(12, Math.round(safe.top - mapRect.top))
        ),
        bottomRight: L.point(
            Math.max(12, Math.round(mapRect.right - safe.right)),
            Math.max(12, Math.round(mapRect.bottom - safe.bottom))
        )
    };
}

function fitMobilePopup(popup, animate = true) {
    if (!map || !popup || popup !== activePopup || !isMobileMap()) return;
    const popupEl = popup.getElement();
    const content = popupEl?.querySelector('.leaflet-popup-content');
    const safe = mobilePopupSafeArea();
    if (!popupEl || !content || !safe || safe.bottom <= safe.top) return;

    // Erst die Inhaltshöhe an den aktuell freien Kartenbereich anpassen. Dadurch
    // bleibt der komplette Popup-Rahmen sichtbar; lange Inhalte scrollen innen.
    content.style.maxHeight = '';
    const cssMaximum = Number.parseFloat(window.getComputedStyle(content).maxHeight);
    const maximum = Number.isFinite(cssMaximum) ? cssMaximum : Infinity;
    const limit = popupContentHeightLimit(
        popupEl.getBoundingClientRect(),
        content.getBoundingClientRect(),
        safe,
        maximum
    );
    content.style.maxHeight = `${limit}px`;
    content.style.overflowY = 'auto';

    requestAnimationFrame(() => {
        if (popup !== activePopup || !popup.getElement()) return;
        const nextSafe = mobilePopupSafeArea();
        if (!nextSafe || nextSafe.bottom <= nextSafe.top) return;
        const [x, y] = popupPanOffset(popup.getElement().getBoundingClientRect(), nextSafe);
        if (x || y) map.panBy([x, y], { animate, duration: animate ? 0.22 : 0 });
    });
}

function scheduleMobilePopupFit(popup, animate = true) {
    cancelAnimationFrame(popupFitFrame);
    popupFitFrame = requestAnimationFrame(() => {
        popupFitFrame = requestAnimationFrame(() => fitMobilePopup(popup, animate));
    });
}

function closeActiveRegionTooltip() {
    const layer = activeRegionTooltipLayer;
    activeRegionTooltipLayer = null;
    layer?.closeTooltip?.();
}

function trackRegionTooltip(layer) {
    layer.on('tooltipopen', function () {
        if (activeRegionTooltipLayer && activeRegionTooltipLayer !== this) {
            activeRegionTooltipLayer.closeTooltip();
        }
        activeRegionTooltipLayer = this;
    });
    layer.on('tooltipclose', function () {
        if (activeRegionTooltipLayer === this) activeRegionTooltipLayer = null;
    });
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
    const padding = currentPopupPadding();
    return {
        closeButton: false,
        maxWidth: mobile ? Math.min(330, window.innerWidth - 28) : 320,
        maxHeight: mobile ? Math.max(260, Math.floor(window.innerHeight * 0.56)) : 380,
        autoPan: true,
        // false: das Popup darf beim Karten-Schwenk aus dem Bild wandern, damit man
        // die Umgebung sehen kann (Ziehen im Modal schwenkt die Karte).
        keepInView: false,
        autoPanPaddingTopLeft: padding.topLeft,
        autoPanPaddingBottomRight: padding.bottomRight,
        ...extra
    };
}

function decoratePopup(popupEl) {
    const popup = popupEl?.querySelector('.popup');
    if (!popup || popup.querySelector('.popup-toolbar')) return;
    popup.insertAdjacentHTML('afterbegin', `
        <div class="popup-toolbar">
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

// Handy: Ziehen im Modal schwenkt die ganze Karte – genau wie das Ziehen auf der
// Karte selbst. Das Popup ist an seinen Geo-Punkt gebunden und wandert dabei mit.
// Bedienelemente (Buttons, Selects, scrollbare Kundenliste) starten keinen Schwenk.
function makePopupPanMap(popupEl) {
    if (!popupEl || !isMobileMap() || popupEl.dataset.panMap === '1') return;
    popupEl.dataset.panMap = '1';
    const wrapper = popupEl.querySelector('.leaflet-popup-content-wrapper');
    if (!wrapper) return;
    wrapper.classList.add('pan-map-popup');

    let lastX = 0, lastY = 0, startX = 0, startY = 0, armed = false, panning = false;
    wrapper.addEventListener('pointerdown', (ev) => {
        if (ev.target.closest('button, select, a, input, textarea, label, .cust-list')) return;
        armed = true; panning = false;
        startX = lastX = ev.clientX; startY = lastY = ev.clientY;
    });
    wrapper.addEventListener('pointermove', (ev) => {
        if (!armed) return;
        if (!panning) {
            if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
            panning = true;
            wrapper.setPointerCapture?.(ev.pointerId);
            document.body.classList.add('popup-panning');
        }
        ev.preventDefault();
        map.panBy([lastX - ev.clientX, lastY - ev.clientY], { animate: false });
        lastX = ev.clientX; lastY = ev.clientY;
    });
    const end = () => { armed = false; panning = false; document.body.classList.remove('popup-panning'); };
    wrapper.addEventListener('pointerup', end);
    wrapper.addEventListener('pointercancel', end);
}

function customerClusterIcon(cluster) {
    const customers = cluster.getAllChildMarkers()
        .map((marker) => getCustomer(marker.options.customerId))
        .filter(Boolean);
    const planning = state.ui.mode === 'gebietsplanung';
    const attr = planning && currentView.paint && currentView.paint !== 'luecken'
        ? currentView.paint
        : firstActiveAttr(['bezirk', 'gruppe', 'channel']);
    const summary = customerClusterSummary(customers, {
        planning,
        attr,
        dimensionLabel: state.dims[attr]?.label || 'Vertriebsgebiete',
        unassigned: UNASSIGNED,
        colorFor: (value) => attrColor(attr, value)
    });
    const title = `${summary.context} – antippen zum Hineinzoomen`;
    return L.divIcon({
        html: `<div class="customer-stack-card ${summary.kind}" style="--stack-color:${summary.color};--stack-accent:${summary.accent}" role="button" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}">
            <span class="customer-stack-accent"></span>
            <strong>${summary.count}</strong><small>Kunden</small>
            <span class="customer-stack-discovery-label" aria-hidden="true">Tippe einen Kundenstapel an</span>
        </div>`,
        className: 'cluster-wrapper',
        iconSize: [48, 46],
        iconAnchor: [24, 23]
    });
}

export function initMap(containerId) {
    map = L.map(containerId, {
        attributionControl: true,
        zoomControl: false,
        zoomSnap: CONFIG.map.zoomSnap,
        zoomDelta: CONFIG.map.zoomDelta,
        wheelPxPerZoomLevel: CONFIG.map.wheelPxPerZoomLevel,
        wheelDebounceTime: CONFIG.map.wheelDebounceTime,
        maxBoundsViscosity: 0.05
    }).setView(CONFIG.map.defaultCenter, CONFIG.map.defaultZoom);

    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.setMaxBounds(CONFIG.map.bounds);

    applyBasemap();

    clusterGroup = L.markerClusterGroup({
        maxClusterRadius: (zoom) => customerClusterRadius(zoom, { mobile: isMobileMap() }),
        spiderfyOnMaxZoom: true,
        spiderfyDistanceMultiplier: isMobileMap() ? 1.85 : 1.2,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false, // Klick selbst steuern (kleine Stapel auffächern)
        spiderLegPolylineOptions: { weight: 2, color: '#0f766e', opacity: 0.65 },
        iconCreateFunction: customerClusterIcon
    });
    // Kleine Stapel (≤5) beim Tippen sofort auffächern – man sieht alle Kunden
    // auf einmal und tippt direkt den gewünschten an, statt sich durchzuzoomen.
    // Größere Stapel zoomen wie gewohnt auf ihren Bereich.
    clusterGroup.on('clusterclick', (a) => {
        if (a.layer.getChildCount() <= CUSTOMER_CLUSTER_EXPLODE_MAX) a.layer.spiderfy();
        else a.layer.zoomToBounds({ padding: [40, 40] });
    });
    map.addLayer(clusterGroup);
    syncCustomerMarkerMode();

    labelLayer = L.layerGroup().addTo(map);
    tourLayer = L.layerGroup().addTo(map);

    // Zoom-Automatik: bei „auto" den Detailgrad neu bestimmen
    map.on('zoomend', () => {
        syncCustomerMarkerMode();
        const levelChanged = syncEffectiveLevel();
        if (!levelChanged && state.colorMode === 'auto') applyView();
        else if (!levelChanged && currentView.labels) renderLabels();
        scheduleCustomerMarkerHint();
        scheduleCustomerClusterHint();
    });
    map.on('movestart zoomstart', () => {
        closeActiveRegionTooltip();
        dismissCustomerMarkerHint();
        dismissCustomerClusterHint();
    });
    map.getContainer().addEventListener('pointerleave', closeActiveRegionTooltip);
    // Für den „In der Nähe"-Begleiter: nach jeder Karten-Bewegung neu berechnen.
    map.on('moveend', () => {
        emit('map:moved');
        if (currentView.labels) renderLabels();
    });

    // Buttons in Popups (Event-Delegation)
    map.on('popupopen', (e) => {
        const el = e.popup.getElement();
        if (!el) return;
        activePopup = e.popup;
        map.getContainer().classList.add('popup-visible');
        decoratePopup(el);
        makePopupPanMap(el);
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
                if (isMobileMap() || state.ui.depth !== 'profi') {
                    map.closePopup();
                    emit('toast', { type: 'info', text: 'Gebiete lassen sich am Desktop im Profi-Modus bearbeiten.' });
                    return;
                }
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
        if (isMobileMap()) {
            const padding = currentPopupPadding();
            e.popup.options.autoPanPaddingTopLeft = padding.topLeft;
            e.popup.options.autoPanPaddingBottomRight = padding.bottomRight;
            // Leaflet hat vor popupopen bereits geschwenkt. Die Toolbar wird aber
            // erst oben eingefügt; deshalb danach mit realer Höhe nachkorrigieren.
            scheduleMobilePopupFit(e.popup);
        }
    });
    map.on('popupclose', (e) => {
        if (activePopup === e.popup) {
            activePopup = null;
            map.getContainer().classList.remove('popup-visible');
        }
        cancelAnimationFrame(popupFitFrame);
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
    on('dataset:cleared', resetCustomerDiscoveryHints);
    on('customer:detail-opened', completeDiscoveryJourney);
    on('filters:changed', refreshAll);
    on('mode:changed', refreshAll);
    on('tab:changed', refreshAll);
    on('service-customer-scope:changed', refreshAll);
    on('service-contracts:changed', refreshAll);
    on('service-visits:changed', refreshAll);
    on('colormode:changed', applyView);
    on('basemap:changed', applyBasemap);
    on('level:changed', () => { setLevel(state.level); });
    on('level:control-changed', syncEffectiveLevel);
    on('depth:changed', () => {
        if (state.ui.depth !== 'profi') map.closePopup();
        syncEffectiveLevel();
    });
    on('tour:scope-changed', refreshAll);
    on('tour:changed', renderTour);
    on('simulation:preview', (preview) => {
        simulationPreview = preview?.active ? preview : null;
        map.closePopup();
        if (!simulationPreview && syncEffectiveLevel()) return;
        if (simulationPreview && (
            state.level !== simulationPreview.level
            || (!currentLevelData && loadingLevel !== simulationPreview.level)
        )) {
            void setLevel(simulationPreview.level);
            return;
        }
        if (simulationPreview && !currentLevelData) return;
        applyView();
    });

    const refitOpenPopup = () => {
        if (!activePopup) return;
        if (isMobileMap() && activePopup.getElement()?.querySelector('select[data-terr]')) {
            map.closePopup();
            return;
        }
        if (!isMobileMap()) {
            const content = activePopup.getElement()?.querySelector('.leaflet-popup-content');
            if (content) {
                content.style.maxHeight = '';
                content.style.overflowY = '';
            }
            return;
        }
        scheduleMobilePopupFit(activePopup, false);
    };
    window.addEventListener('resize', refitOpenPopup, { passive: true });
    window.visualViewport?.addEventListener('resize', refitOpenPopup, { passive: true });
    document.getElementById('sidebar')?.addEventListener('transitionend', (event) => {
        if (event.propertyName === 'transform' || event.propertyName === 'height') refitOpenPopup();
    });

    syncEffectiveLevel();
    return map;
}

/** @returns {boolean} true, wenn das Popup offen bleiben soll */
function handlePopupAction(action, customerId) {
    const customer = getCustomer(customerId);
    if (!customer) return false;
    if (action === 'demo-call' || action === 'demo-email') {
        emit('toast', {
            type: 'info',
            text: action === 'demo-call'
                ? 'Demo-Modus: Bei echten Kundendaten würde sich jetzt die Telefon-App öffnen. Es wird kein Anruf gestartet.'
                : 'Demo-Modus: Bei echten Kundendaten würde sich jetzt das E-Mail-Programm öffnen. Es wird keine Nachricht erstellt.'
        });
        return true;
    }
    if (action === 'tour-add') {
        if (!state.tour.stops.includes(customer.id)) {
            clearServiceTourPlan();
            state.tour.stops.push(customer.id);
            emit('tour:changed');
        }
    } else if (action === 'tour-start') {
        clearServiceTourPlan();
        state.tour.start = {
            lat: customer.lat, lng: customer.lng,
            label: customer.name, customerId: customer.id,
            strasse: customer.strasse, plz: customer.plz, ort: customer.ort,
            dataOrigin: customer.dataOrigin, demo: customer.demo
        };
        emit('tour:changed');
    } else if (action === 'tour-dest') {
        clearServiceTourPlan();
        const first = !state.tour.destination;
        state.tour.destination = {
            lat: customer.lat, lng: customer.lng,
            label: customer.name, customerId: customer.id,
            strasse: customer.strasse, plz: customer.plz, ort: customer.ort,
            dataOrigin: customer.dataOrigin, demo: customer.demo
        };
        // Ziel gesetzt -> „Entlang der Tour"-Vorschläge werden sinnvoll
        if (first && state.tour.suggestMode !== 'route') state.tour.suggestMode = 'route';
        emit('tour:changed');
    } else if (action === 'mark-visited') {
        markVisitedToday(customer);
        markDirty();
        emit('toast', { type: 'success', text: `Besuch bei ${customer.name} für heute eingetragen.` });
    } else if (action === 'customer-briefing') {
        openCustomerBriefing(customer);
    } else if (action === 'service-contracts') {
        emit('service-contracts:open', { customerNumber: customer.nummer });
    } else if (action === 'service-visits') {
        emit('service-visits:open', { customerNumber: customer.nummer });
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
    if (mode === 'channel') {
        const p = firstActiveAttr(['channel', 'gruppe', 'bezirk']);
        return { paint: p, markers: false, labels: true, markerBy: 'bezirk' };
    }
    // auto: Detailgrad nach Zoomstufe
    if (!aggregatable()) return { paint: null, markers: true, labels: false, markerBy: 'bezirk' };
    if (z >= CONFIG.map.lodCustomerZoom) {
        const p = firstActiveAttr(['bezirk', 'gruppe']);
        // Sobald die Kunden-Klemmbretter erscheinen, gehört die Bühne den
        // Kunden – auch beim Gebiete-Managen. Die farbigen Bezirksflächen
        // bleiben als Orientierung, nur die Bezirks-Kacheln räumen das Feld
        // (beides zusammen war zu voll und durcheinander).
        return { paint: p, markers: true, labels: false, markerBy: p };
    }
    if (z >= CONFIG.map.lodBezirkZoom) {
        const p = firstActiveAttr(['bezirk', 'gruppe']);
        return { paint: p, markers: false, labels: true, markerBy: 'bezirk' };
    }
    if (z >= CONFIG.map.lodGroupZoom) {
        const p = firstActiveAttr(['gruppe', 'channel', 'bezirk']);
        return { paint: p, markers: false, labels: true, markerBy: 'bezirk' };
    }
    const p = firstActiveAttr(['channel', 'gruppe', 'bezirk']);
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

function usesAutomaticLevel() {
    return automaticLevelActive(state.ui.depth, state.levelMode, isMobileMap());
}

/** Wirksame Ebene aus Basis/Profi-Modus, Viewport und Zoom ableiten. */
function syncEffectiveLevel() {
    if (!map || simulationPreview) return false;
    const target = usesAutomaticLevel()
        ? automaticLevelForZoom(map.getZoom(), state.level)
        : state.fixedLevel;
    if (target === state.level && (target === 'none' || currentLevelData || loadingLevel === target)) {
        emit('level:resolved', { level: state.level, automatic: usesAutomaticLevel() });
        return false;
    }
    void setLevel(target);
    return true;
}

export async function setLevel(level) {
    const sequence = ++levelLoadSequence;
    state.level = level;
    emit('level:resolved', { level, automatic: usesAutomaticLevel() });
    closeActiveRegionTooltip();
    if (regionLayer) { map.removeLayer(regionLayer); regionLayer = null; }
    if (labelLayer) labelLayer.clearLayers();
    currentLevelData = null;
    featureByKey = new Map();
    if (level === 'none' || !CONFIG.levels[level]?.file) {
        loadingLevel = null;
        emit('map:loading', false);
        applyView();
        return;
    }

    emit('map:loading', true);
    loadingLevel = level;
    let loadedLevel;
    try {
        loadedLevel = await loadLevel(level);
    } catch (error) {
        if (sequence !== levelLoadSequence) return;
        loadingLevel = null;
        emit('map:loading', false);
        emit('toast', { type: 'error', text: error.message });
        return;
    }

    // Ebene könnte während des Ladens erneut gewechselt worden sein.
    if (sequence !== levelLoadSequence || state.level !== level) return;
    currentLevelData = loadedLevel;
    loadingLevel = null;
    emit('map:loading', false);

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
            // minWidth: sichert genug Breite für die Bezirks-/Umsatz-Tabelle, damit
            // die Namen trotz kompaktem Kopf nicht abgeschnitten werden.
            layer.bindPopup(() => regionPopupHtml(feature), popupOptions({ maxWidth: 320, minWidth: isMobileMap() ? 264 : 250 }));
            layer.bindTooltip(() => regionTooltip(feature), { sticky: true, direction: 'top' });
            trackRegionTooltip(layer);
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
    const maxOpacity = territory ? (info.assignedOnly ? 0.4 : 0.62) : 0.2;
    const { fillColor, fillOpacity } = compositeFill(info.shares, maxOpacity);
    return {
        fillColor,
        color: territory ? '#ffffff' : '#64748b',
        weight: territory ? 1.2 : 0.75,
        dashArray: info.assignedOnly ? '4 3' : '',
        opacity: territory ? 1 : 0.42,
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
    const countByVal = new Map();
    const revenueValues = new Set();
    // Filter steuern die sichtbaren Flächen, nicht die fachliche Gesamtsumme
    // eines Vertriebsbezirks oder einer Vertriebsgruppe.
    for (const c of state.customers) {
        const v = valueOf(c);
        countByVal.set(v, (countByVal.get(v) ?? 0) + 1);
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
        list.push({ lat: (minY + maxY) / 2, lng: (minX + maxX) / 2, count, revenue, bbox });
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
    const labelMode = territoryLabelMode(map.getZoom(), { mobile: isMobileMap() });
    const labelSize = labelMode === 'chip'
        ? { width: 80, height: 64 }
        : labelMode === 'compact'
            ? { width: 94, height: 84 }
            : { width: 108, height: 100 };
    const mapSize = map.getSize();
    const candidates = [...positions].map(([val, center]) => {
        const point = map.latLngToContainerPoint(center);
        const count = countByVal.get(val) || 0;
        const revenue = revByVal.get(val) || 0;
        return {
            val,
            center,
            count,
            revenue,
            x: point.x,
            y: point.y,
            width: labelSize.width,
            height: labelSize.height,
            // Kundenzahl ist für die Orientierung wichtiger; Umsatz löst
            // nur Gleichstände zwischen ähnlich großen Gebieten auf.
            priority: count * 100 + Math.log10(Math.max(1, revenue))
        };
    });
    const gap = labelMode === 'chip' ? 7 : 10;
    // Beim Gebiete-Managen (Gebietsplanung) zählt Vollständigkeit: jeder Bezirk
    // muss sichtbar sein, sonst ist er ein Management-Blindfleck. Dafür wird nur
    // so weit verkleinert wie nötig; wer dann immer noch kollidiert, erscheint
    // als kompakter Code-Chip, statt ganz zu verschwinden. Im Alltag bleibt die
    // ruhige, kuratierte Ansicht mit Budget-Deckel erhalten.
    const managing = state.ui.mode === 'gebietsplanung';
    // Nur Gebiete, deren Schwerpunkt tatsächlich im Sichtfeld liegt, brauchen ein
    // Label – für die anderen gibt es auf dieser Karte ohnehin keinen Platz.
    const inView = (c) => c.x >= 0 && c.x <= mapSize.x && c.y >= 0 && c.y <= mapSize.y;
    let labelScale = 1;
    let visibleLabels = [];
    let overflowLabels = [];
    if (managing) {
        // Nah herangezoomt liegt der Schwerpunkt eines Bezirks oft außerhalb
        // des Bildes, obwohl man mitten in seiner Fläche steht. Solche Kacheln
        // werden an den Kartenrand geholt statt zu verschwinden – man sieht
        // immer, in wessen Gebiet man gerade arbeitet.
        const viewBounds = map.getBounds();
        const west = viewBounds.getWest();
        const east = viewBounds.getEast();
        const south = viewBounds.getSouth();
        const north = viewBounds.getNorth();
        // Sichtbar ist ein Bezirk, sobald eine seiner Teilflächen das Bild
        // schneidet – der Mittelpunkt allein liegt nah dran oft daneben.
        const intersectsView = (b) => Array.isArray(b) && !(b[2] < west || b[0] > east || b[3] < south || b[1] > north);
        const edge = 14;
        for (const c of candidates) {
            if (inView(c)) continue;
            const parts = polygonsByValue.get(c.val) || [];
            if (!parts.some((p) => intersectsView(p.bbox))) continue;
            c.x = Math.min(Math.max(c.x, edge + c.width / 2), mapSize.x - edge - c.width / 2);
            c.y = Math.min(Math.max(c.y, edge + c.height / 2), mapSize.y - edge - c.height / 2);
            c.center = map.containerPointToLatLng([c.x, c.y]);
        }
        for (const scale of [1, 0.9, 0.8, 0.7]) {
            const scaled = candidates.map((c) => ({ ...c, width: c.width * scale, height: c.height * scale }));
            visibleLabels = selectNonOverlappingLabels(scaled, {
                viewportWidth: mapSize.x,
                viewportHeight: mapSize.y,
                maxItems: Infinity,
                gap: gap * scale
            });
            labelScale = scale;
            const shown = new Set(visibleLabels.map((c) => c.val));
            overflowLabels = candidates.filter((c) => !shown.has(c.val) && inView(c));
            if (overflowLabels.length === 0) break;
        }
        // Mini-Chips nicht mehr blind auf den Schwerpunkt setzen: Sie weichen
        // in kleinen Schritten aus, statt volle Kacheln oder einander zu
        // überlappen – und bleiben dabei immer im Bild (nie unsichtbar).
        const collidesWith = (a, b, pad) => a.left < b.right + pad && a.right + pad > b.left
            && a.top < b.bottom + pad && a.bottom + pad > b.top;
        const placedRects = visibleLabels.map((c) => ({
            left: c.x - c.width / 2, right: c.x + c.width / 2,
            top: c.y - c.height / 2, bottom: c.y + c.height / 2
        }));
        for (const c of overflowLabels) {
            const chipText = compactTerritoryLabel(c.val);
            const w = Math.min(150, chipText.length * 6.5 + 22);
            const h = 24;
            const step = h + 12;
            const side = w / 2 + 40;
            const nudges = [[0, 0], [0, -step], [0, step], [-side, 0], [side, 0],
                [-side, -step], [side, -step], [-side, step], [side, step],
                [0, -2 * step], [0, 2 * step]];
            let rect = null;
            for (const [dx, dy] of nudges) {
                const x = Math.min(Math.max(c.x + dx, edge + w / 2), mapSize.x - edge - w / 2);
                const y = Math.min(Math.max(c.y + dy, edge + h / 2), mapSize.y - edge - h / 2);
                const candidateRect = { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
                if (!placedRects.some((other) => collidesWith(candidateRect, other, 6))) {
                    c.x = x;
                    c.y = y;
                    rect = candidateRect;
                    break;
                }
            }
            if (!rect) rect = { left: c.x - w / 2, right: c.x + w / 2, top: c.y - h / 2, bottom: c.y + h / 2 };
            placedRects.push(rect);
            c.center = map.containerPointToLatLng([c.x, c.y]);
        }
    } else {
        visibleLabels = selectNonOverlappingLabels(candidates, {
            viewportWidth: mapSize.x,
            viewportHeight: mapSize.y,
            maxItems: territoryLabelBudget(labelMode, { mobile: isMobileMap() }),
            gap
        });
    }

    const dimension = attr === 'channel' ? 'Vertriebshauptgruppe' : (state.dims[attr]?.label || 'Gebiet');
    const compactDimension = attr === 'bezirk'
        ? 'Bezirk'
        : attr === 'gruppe'
            ? 'Gruppe'
            : attr === 'channel'
                ? 'Hauptgruppe'
                : dimension;
    const labelTitle = (val, count, hasRevenue, revenue) =>
        `${dimension} ${val}: ${count} Kunden${hasRevenue ? ` · ${formatRevenueFull(revenue)} Volumen` : ''}`;
    const addLabel = (center, html) => L.marker(center, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: 'territory-label-wrapper', html, iconSize: null })
    }).addTo(labelLayer);

    // Beim Verkleinern skaliert die ganze Kachel mittig auf ihrem Gebiet.
    const scaleStyle = labelScale === 1 ? '' : `transform:translate(-50%,-50%) scale(${labelScale});`;
    for (const { val, center, count, revenue } of visibleLabels) {
        const col = attrColor(attr, val);
        const hasRevenue = revenueValues.has(val);
        const rev = hasRevenue ? formatRevenueShort(revenue) : '';
        const title = labelTitle(val, count, hasRevenue, revenue);
        const displayValue = labelMode === 'detail' ? val : compactTerritoryLabel(val);
        // Umsatz ab Vertriebsbezirk aufwärts in jeder Stufe zeigen (kompakt in
        // T€/€), Kundenzahl bleibt die primäre Orientierung darüber.
        const countLabel = labelMode === 'chip' ? `${count} Kd.` : `${count} Kunden`;
        const metrics = `<span class="tl-metrics">
                    <span class="tl-count">${countLabel}</span>
                    ${rev ? `<span class="tl-rev">${escapeHtml(rev)}</span>` : ''}
                </span>`;
        addLabel(center, `<div class="territory-stack-card territory-stack-card--${labelMode}${val === UNASSIGNED ? ' unassigned' : ''}" style="--territory-color:${col};${scaleStyle}" title="${escapeHtml(title)}">
                    <span class="tl-accent"></span>
                    <span class="tl-dimension">${escapeHtml(compactDimension)}</span>
                    <strong>${escapeHtml(displayValue)}</strong>
                    ${metrics}
                </div>`);
    }

    // Vollständigkeits-Fallback: übrige Bezirke als kompakter Code-Chip – nie unsichtbar.
    for (const { val, center, count, revenue } of overflowLabels) {
        const col = attrColor(attr, val);
        const hasRevenue = revenueValues.has(val);
        const title = labelTitle(val, count, hasRevenue, revenue);
        addLabel(center, `<div class="territory-stack-card territory-stack-card--mini${val === UNASSIGNED ? ' unassigned' : ''}" style="--territory-color:${col}" title="${escapeHtml(title)}">
                    <span class="tl-accent"></span>
                    <strong>${escapeHtml(compactTerritoryLabel(val))}</strong>
                </div>`);
    }
}

/** Zuweisung für die ganze Fläche eines Gebiets */
function territoryAssignHtml(feature) {
    if (simulationPreview) return '';
    if (isMobileMap() || state.ui.depth !== 'profi') return '';
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
    const readonly = isMobileMap()
        ? '<p class="muted small region-readonly">Nur lesbar – Änderungen am Desktop.</p>'
        : state.ui.depth !== 'profi'
            ? '<p class="muted small region-readonly">Nur lesbar – Bearbeitung im Profi-Modus.</p>'
            : '';

    if (!entry || entry.total === 0) {
        return `<div class="popup popup-region">
            <h3>${escapeHtml(name)}</h3>
            <p class="muted">Keine (sichtbaren) Kunden in diesem Gebiet.</p>
            ${readonly}
            ${assign}
        </div>`;
    }
    const profi = state.ui.depth === 'profi';
    // Je Vertriebsbezirk Kundenzahl UND Umsatz in diesem Gebiet erfassen.
    const bezirke = new Map();
    for (const c of entry.customers) {
        const value = String(c.bezirk ?? '').trim() || UNASSIGNED;
        const d = bezirke.get(value) ?? { count: 0, revenue: 0 };
        d.count += 1;
        d.revenue += (c.umsatz || 0);
        bezirke.set(value, d);
    }
    // Überschriftenzeile: macht klar, dass die Zahlen Kundenanzahl und Umsatz sind.
    const districtHead = `
        <li class="rep-head"><span class="dot" style="visibility:hidden"></span><span class="rl-name">Vertriebsbezirk</span><span class="rl-count">Kunden</span><span class="rl-rev">Umsatz</span></li>`;
    const districtRows = [...bezirke.entries()].sort((a, b) => b[1].count - a[1].count).map(([bezirk, d]) => `
        <li><span class="dot" style="background:${attrColor('bezirk', bezirk)}"></span><span class="rl-name">${escapeHtml(bezirk)}</span><b class="rl-count">${d.count}</b><b class="rl-rev" title="${formatRevenueFull(d.revenue)}">${formatRevenueShort(d.revenue)}</b></li>
    `).join('');
    // Kundennamen sind Profi-Detail; in Basis bleibt das Gebiets-Modal aufgeräumt.
    let custList = '';
    if (profi) {
        const list = entry.customers.slice(0, 8).map((c) => `<li class="mini">${escapeHtml(c.name)}${c.ort ? ` <span class="muted">(${escapeHtml(c.ort)})</span>` : ''}</li>`).join('');
        const more = entry.customers.length > 8 ? `<li class="mini muted">… und ${entry.customers.length - 8} weitere</li>` : '';
        custList = `<ul class="cust-list">${list}${more}</ul>`;
    }
    // Kundenzahl + Gesamtumsatz kompakt in EINER Zeile (wie beim Kunden-Popup).
    const revShort = revenue ? ` · <b class="popup-umsatz" title="${formatRevenueFull(revenue)}">${formatRevenueShort(revenue)}</b> gesamt` : '';
    return `<div class="popup popup-region">
        <h3>${escapeHtml(name)}</h3>
        <p class="region-summary"><b>${entry.total}</b> Kunde${entry.total === 1 ? '' : 'n'}${revShort}</p>
        ${readonly}
        <ul class="rep-list">${districtHead}${districtRows}</ul>
        ${custList}
        ${assign}
    </div>`;
}

// ---- Kundenmarker ----

function markerColor(customer) {
    const by = currentView.markerBy;
    if (by === 'status') return STATUS_COLORS[visitStatus(customer)];
    if (state.ui.mode === 'aussendienst' && state.colorMode === 'rep') return DEFAULT_CUSTOMER_COLOR;
    if (by && by !== 'vb') return attrColor(by, customer[by] || UNASSIGNED);
    return repColor(customer.vb);
}

function customerIcon(customer) {
    const color = markerColor(customer);
    const inTour = state.tour.stops.includes(customer.id);
    const status = visitStatus(customer);
    const visitAccent = state.ui.mode !== 'service' && currentView.markerBy !== 'status'
        ? (status === 'faellig' ? ' visit-due' : status === 'ueberfaellig' ? ' visit-overdue' : '')
        : '';
    const place = [customer.plz, customer.ort].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');
    const openVisits = state.ui.mode === 'service'
        ? serviceVisitsForCustomer(state.serviceVisits, customer, { scope: 'open' }).length
        : 0;
    const context = openVisits
        ? `${openVisits} offene${openVisits === 1 ? 'r Einsatz' : ' Einsätze'}`
        : (customer.rhythmusWochen ? STATUS_LABELS[status] : '');
    const detail = [place, context].filter(Boolean).join(' · ');
    const label = customerMarkerLabel(customer.name, { demo: isDemoCustomer(customer) });
    return L.divIcon({
        className: 'customer-marker-wrapper',
        html: `<div class="customer-marker-card${customer.geo === 'plz' ? ' approx' : ''}${inTour ? ' in-tour' : ''}${visitAccent}" style="--marker-color:${color}" aria-hidden="true">
            <span class="customer-marker-accent"></span>
            <span class="customer-marker-symbol"></span>
            <span class="customer-marker-copy">
                <b>${escapeHtml(label)}</b>
                <small>${escapeHtml(detail || 'Details öffnen')}</small>
            </span>
        </div>`,
        iconSize: isMobileMap() ? [44, 44] : [28, 28],
        iconAnchor: isMobileMap() ? [22, 22] : [14, 14]
    });
}

function customerPopupOptions() {
    return popupOptions({ maxWidth: 300, className: 'customer-detail-popup' });
}

function animateCustomerMarkerOpen(marker) {
    dismissCustomerMarkerHint();
    const card = marker.getElement()?.querySelector('.customer-marker-card');
    if (!card) return;
    card.classList.remove('is-opening');
    requestAnimationFrame(() => card.classList.add('is-opening'));
    window.setTimeout(() => card.classList.remove('is-opening'), 320);
}

const RHYTHM_OPTIONS = [
    ['', 'kein Rhythmus'], ['2', 'alle 2 Wochen'], ['4', 'alle 4 Wochen'],
    ['6', 'alle 6 Wochen'], ['8', 'alle 8 Wochen'], ['12', 'alle 12 Wochen'], ['26', 'alle 26 Wochen']
];

function visitBlockHtml(customer) {
    // Basis: nur „Heute besucht" – Rhythmus/Zuletzt/Status sind Profi-Komfort.
    if (state.ui.depth !== 'profi') {
        return `<div class="visit-block">
            <div class="visit-controls">
                <button data-action="mark-visited" data-id="${escapeHtml(customer.id)}">✓ Heute besucht</button>
            </div>
        </div>`;
    }
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
    const demo = isDemoCustomer(customer);
    if (customer.telefon && demo) {
        links.push(`<button type="button" class="contact-link" data-action="demo-call" data-id="${escapeHtml(customer.id)}">📞 Anrufen</button>`);
    } else if (customer.telefon) {
        const tel = String(customer.telefon).replace(/[^\d+]/g, '');
        links.push(`<a class="contact-link" href="tel:${escapeHtml(tel)}">📞 Anrufen</a>`);
    }
    if (customer.email && demo) {
        links.push(`<button type="button" class="contact-link" data-action="demo-email" data-id="${escapeHtml(customer.id)}">✉️ E-Mail</button>`);
    } else if (customer.email) {
        links.push(`<a class="contact-link" href="mailto:${escapeHtml(customer.email)}">✉️ E-Mail</a>`);
    }
    if (links.length) parts.push(`<div class="contact-links">${links.join('')}</div>`);
    return parts.join('');
}

function serviceContractsBlockHtml(customer) {
    if (state.ui.depth !== 'profi' || isMobileMap() || !customer.nummer) return '';
    const customerNumber = normalizeCustomerNumber(customer.nummer);
    const matchingCustomers = (state.customers || []).filter((candidate) => (
        normalizeCustomerNumber(candidate?.nummer) === customerNumber
    ));
    // Bei doppelten Kundennummern nie willkürlich denselben Vertrag an mehreren
    // Markern zeigen. Das Radar weist solche Fälle als nicht eindeutig aus.
    if (matchingCustomers.length !== 1) return '';
    const linked = (state.serviceContracts || []).filter((contract) => (
        normalizeCustomerNumber(contract.customerNumber) === customerNumber
        && isPlanningRelevantServiceContract(contract)
    ));
    if (!linked.length) return '';

    const actionDates = linked.map((contract) => contract.actionBy).filter(Boolean).sort();
    const earliestAction = actionDates[0] || '';
    const valuesByCurrency = new Map();
    linked.forEach((contract) => {
        const value = Number(contract.annualValue);
        if (!Number.isFinite(value) || value <= 0) return;
        const currency = String(contract.currency || 'EUR').trim().toUpperCase();
        valuesByCurrency.set(currency, (valuesByCurrency.get(currency) || 0) + value);
    });
    const currencies = [...valuesByCurrency.keys()];
    let valueText = '';
    if (currencies.length === 1) {
        const currency = currencies[0];
        const value = valuesByCurrency.get(currency);
        if (currency === 'EUR') valueText = `${formatRevenueShort(value)} p. a.`;
        else {
            try {
                valueText = `${new Intl.NumberFormat('de-DE', {
                    style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1
                }).format(value)} p. a.`;
            } catch {
                valueText = `${Math.round(value).toLocaleString('de-DE')} ${currency} p. a.`;
            }
        }
    } else if (currencies.length > 1) {
        valueText = 'Werte in mehreren Währungen';
    }
    const detail = [
        earliestAction ? `Handeln bis ${formatDateDe(earliestAction)}` : 'Frist prüfen',
        valueText
    ].filter(Boolean).join(' · ');
    return `<button type="button" class="popup-contract-summary" data-action="service-contracts" data-id="${escapeHtml(customer.id)}">
        <span><b>🛡️ ${linked.length} Service${linked.length === 1 ? 'vertrag' : 'verträge'}</b><small>${escapeHtml(detail)}</small></span>
        <span aria-hidden="true">›</span>
    </button>`;
}

function serviceVisitsBlockHtml(customer) {
    if (state.ui.mode !== 'service' || state.ui.depth !== 'profi' || isMobileMap() || !customer.nummer) return '';
    const customerNumber = normalizeCustomerNumber(customer.nummer);
    const matchingCustomers = (state.customers || []).filter((candidate) => (
        normalizeCustomerNumber(candidate?.nummer) === customerNumber
    ));
    if (matchingCustomers.length !== 1) return '';
    const linked = serviceVisitsForCustomer(state.serviceVisits, customer, { scope: 'open' })
        .filter(isOpenServiceVisit)
        .sort((a, b) => Number(serviceVisitWindow(b, 'now')) - Number(serviceVisitWindow(a, 'now'))
            || String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
            || String(a.id || '').localeCompare(String(b.id || '')));
    if (!linked.length) return '';
    const first = linked[0];
    const detail = [
        first.reason || 'Serviceeinsatz',
        first.dueDate ? `fällig ${formatDateDe(first.dueDate)}` : '',
        first.durationMin ? `${first.durationMin} Min.` : ''
    ].filter(Boolean).join(' · ');
    const urgent = linked.filter((visit) => serviceVisitWindow(visit, 'now')).length;
    return `<button type="button" class="popup-service-visits" data-action="service-visits" data-id="${escapeHtml(customer.id)}">
        <span><b>🧰 ${linked.length} offene${linked.length === 1 ? 'r Einsatz' : ' Einsätze'}${urgent ? ` · ${urgent} dringend` : ''}</b><small>${escapeHtml(detail)}</small></span>
        <span aria-hidden="true">›</span>
    </button>`;
}

export function customerPopupHtml(customer) {
    const inTour = state.tour.stops.includes(customer.id);
    const isDest = state.tour.destination?.customerId === customer.id;
    // Kompakter Kopf: Adresse einzeilig, Hierarchie und Umsatz in einer Zeile,
    // Kundennummer neben den Namen – damit ohne Scrollen mehr sichtbar ist.
    const place = [customer.plz, customer.ort].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');
    const addr = [customer.strasse, place]
        .filter(Boolean).map(escapeHtml).join(' · ');
    const hierarchy = [customer.channel, customer.gruppe, customer.bezirk]
        .filter(Boolean).map(escapeHtml).join(' › ');
    const umsatz = customer.umsatz
        ? `<b class="popup-umsatz" title="${formatRevenueFull(customer.umsatz)}">${formatRevenueShort(customer.umsatz)}</b>`
        : '';
    const profi = state.ui.depth === 'profi';
    // Basis: nur Umsatz (Priorisierung), Hierarchie/Kd.-Nr. sind Profi-Detail.
    const metaLine = (profi ? [hierarchy, umsatz] : [umsatz]).filter(Boolean).join(' · ');
    const nr = profi && customer.nummer ? `<span class="popup-nr">Nr. ${escapeHtml(customer.nummer)}</span>` : '';
    const demoBadge = isDemoCustomer(customer) ? '<span class="popup-demo-badge">Demo</span>' : '';
    return `<div class="popup popup-customer">
        <h3>${escapeHtml(customer.name)}${demoBadge}${nr}</h3>
        ${addr ? `<p class="popup-addr">${addr}${customer.geo === 'plz' ? ' <span class="muted small">· 📍 ca. (PLZ-Mitte)</span>' : ''}</p>` : ''}
        ${metaLine ? `<p class="muted small popup-meta">${metaLine}</p>` : ''}
        ${contactBlockHtml(customer)}
        ${serviceVisitsBlockHtml(customer)}
        ${serviceContractsBlockHtml(customer)}
        ${visitBlockHtml(customer)}
        <div class="popup-actions">
            <button data-action="tour-start" data-id="${escapeHtml(customer.id)}">🚩 Als Start</button>
            ${profi ? `<button data-action="tour-dest" data-id="${escapeHtml(customer.id)}" ${isDest ? 'disabled' : ''}>${isDest ? '✓ Ziel' : '🏁 Als Ziel'}</button>` : ''}
            <button data-action="tour-add" data-id="${escapeHtml(customer.id)}" ${inTour ? 'disabled' : ''}>${inTour ? '✓ In Tour' : '➕ Zur Tour'}</button>
            <button data-action="customer-briefing" data-id="${escapeHtml(customer.id)}" title="Aktuelles Kundenbriefing mit Microsoft 365 Copilot erstellen">📋 Briefing</button>
        </div>
    </div>`;
}

function markerCustomers() {
    const planningMode = state.ui.mode === 'aussendienst' || state.ui.mode === 'service';
    const tourContextActive = state.ui.mode !== 'service' || state.ui.activeTab === 'tour';
    if (planningMode && tourContextActive && state.tour.mapFocus && state.tour.start) {
        return tourFocusCustomers();
    }
    const tourScoped = planningMode
        && tourContextActive
        && state.tour.bezirk
        && state.tour.bezirk !== '__none__';
    return tourScoped ? modeTourCustomers() : modeVisibleCustomers();
}

function tourFocusCustomers() {
    const { start, stopCustomers, dest, routePts } = currentTourRoutePoints();
    const ids = new Set();
    if (start?.customerId) ids.add(start.customerId);
    for (const c of stopCustomers) ids.add(c.id);
    if (dest?.id) ids.add(dest.id);
    if (dest?.customerId) ids.add(dest.customerId);

    const pool = modeTourCustomers();
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
    customerMarkers = [];
    // In der Flächenansicht (Bezirke/Gruppen) werden Kunden ausgeblendet.
    if (!currentView.markers) return;
    const markers = [];
    for (const customer of markerCustomers()) {
        if (customer.lat === null || customer.lng === null) continue;
        // Chancen-Fokus: nur fällige/überfällige Kunden zeigen
        if (state.ui.opportunityOnly && !isOpportunity(customer)) continue;
        const marker = L.marker([customer.lat, customer.lng], {
            icon: customerIcon(customer),
            customerId: customer.id,
            title: `${customer.name} – Details öffnen`,
            alt: `${customer.name} – Details öffnen`
        });
        marker.bindPopup(() => customerPopupHtml(customer), customerPopupOptions());
        marker.on('click', () => {
            animateCustomerMarkerOpen(marker);
            emit('customer:detail-opened', customer.id);
        });
        customerMarkers.push({ marker, customer });
        markers.push(marker);
    }
    clusterGroup.addLayers(markers);
    scheduleCustomerMarkerHint();
    scheduleCustomerClusterHint();
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
            marker.bindPopup(() => customerPopupHtml(customer), customerPopupOptions());
        }
    } else if (point?.id) {
        marker.bindPopup(() => customerPopupHtml(point), customerPopupOptions());
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
            L.popup(customerPopupOptions())
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
    const padding = fitPadding(174);
    map.fitBounds(bounds.pad(0.15), {
        paddingTopLeft: padding.topLeft,
        paddingBottomRight: padding.bottomRight
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
    const padding = fitPadding(190);
    map.fitBounds(bounds.pad(0.18), {
        animate: true,
        duration: 0.7,
        maxZoom: 12,
        paddingTopLeft: padding.topLeft,
        paddingBottomRight: padding.bottomRight
    });
    return true;
}

function fitPadding(mobileBottom) {
    if (isMobileMap()) return { topLeft: [18, 76], bottomRight: [18, mobileBottom] };
    const mapRect = map?.getContainer()?.getBoundingClientRect();
    const sidebar = document.getElementById('sidebar');
    let left = 24;
    if (mapRect && sidebar?.classList.contains('open')) {
        const sidebarRect = sidebar.getBoundingClientRect();
        const overlapsLeftSide = sidebarRect.right > mapRect.left
            && sidebarRect.left < mapRect.left + mapRect.width * 0.55;
        if (overlapsLeftSide) {
            left = Math.min(
                Math.round(mapRect.width * 0.48),
                Math.max(left, Math.round(sidebarRect.right - mapRect.left + 24))
            );
        }
    }
    return { topLeft: [left, 80], bottomRight: [24, 72] };
}

/** Karte für eine geführte Demo auf einen definierten Ausschnitt setzen. */
export function focusMapArea(lat, lng, zoom = 10) {
    if (!map || lat === null || lng === null) return;
    map.closePopup();
    map.invalidateSize();
    map.flyTo([lat, lng], zoom, { duration: 0.9 });
}

/** Karte auf einen Punkt (z. B. GPS-Standort) zentrieren */
export function focusPoint(lat, lng, zoom) {
    if (!map || lat === null || lng === null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), zoom ?? 11), { duration: 0.8 });
}

export const CUSTOMER_MARKER_MODES = Object.freeze(['dot', 'card', 'label', 'detail']);

/**
 * Progressive Offenlegung auf der Karte: Erst Orientierung, dann ein klar
 * anklickbares Objekt, danach Identität und schließlich ein kompakter Kontext.
 */
export function customerMarkerMode(zoom, { mobile = false } = {}) {
    const value = Number(zoom) || 0;
    const labelZoom = mobile ? 13 : 12;
    const detailZoom = mobile ? 15.5 : 14.5;
    if (value >= detailZoom) return 'detail';
    if (value >= labelZoom) return 'label';
    if (value >= 8) return 'card';
    return 'dot';
}

export function customerMarkerModeClass(mode) {
    const safe = CUSTOMER_MARKER_MODES.includes(mode) ? mode : 'dot';
    return `customer-marker-mode-${safe}`;
}

export function customerMarkerLabel(name, { demo = false } = {}) {
    const value = String(name ?? '').trim();
    if (!demo) return value;
    return value.replace(/^TourFuchs Demo\s*·\s*/i, '') || value;
}

export function canOfferCustomerMarkerHint({
    zoom = 0,
    mobile = false,
    hasCustomers = false,
    alreadyShown = false,
    showcaseRunning = false,
    insidePreview = false
} = {}) {
    return hasCustomers
        && !alreadyShown
        && !showcaseRunning
        && !insidePreview
        && customerMarkerMode(zoom, { mobile }) !== 'dot';
}

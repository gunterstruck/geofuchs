export const CUSTOMER_MARKER_MODES = Object.freeze(['dot', 'card', 'label', 'detail']);
export const DEFAULT_CUSTOMER_COLOR = '#0d9488';

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

/**
 * Pixelradius für die Kundenverdichtung. In dichten Stadtansichten bleiben
 * Stapel bewusst länger zusammen; erst im Nahbereich entstehen Einzelkarten.
 */
export function customerClusterRadius(zoom, { mobile = false } = {}) {
    const value = Number(zoom) || 0;
    if (value <= 6) return mobile ? 112 : 104;
    if (value <= 8) return mobile ? 124 : 116;
    if (value <= 10) return mobile ? 120 : 112;
    if (value <= 12) return mobile ? 104 : 92;
    // Im Nahbereich enger clustern, damit verteilte Kleingruppen (≤5) beim
    // Reinzoomen von selbst zu Einzelmarkern werden – man sieht, wo sie sitzen.
    if (value <= 14) return mobile ? 58 : 48;
    return mobile ? 34 : 28;
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

/**
 * Fasst die fachliche Aussage eines Karten-Clusters zusammen. Im operativen
 * Außendienst bleibt der Stapel bewusst grün. Nur in der Gebietsplanung trägt
 * er die Farbe der sichtbaren Organisationsebene.
 */
export function customerClusterSummary(customers, {
    planning = false,
    attr = 'bezirk',
    dimensionLabel = 'Vertriebsbezirk',
    unassigned = 'Ohne Zuordnung',
    colorFor = () => DEFAULT_CUSTOMER_COLOR
} = {}) {
    const list = Array.isArray(customers) ? customers : [];
    const count = list.length;
    if (!planning || !attr) {
        return {
            count,
            color: DEFAULT_CUSTOMER_COLOR,
            accent: DEFAULT_CUSTOMER_COLOR,
            kind: 'neutral',
            context: `${count} Kunden in diesem Bereich`
        };
    }

    const values = new Map();
    list.forEach((customer) => {
        const value = String(customer?.[attr] ?? '').trim() || unassigned;
        values.set(value, (values.get(value) ?? 0) + 1);
    });
    const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 1) {
        const value = sorted[0][0];
        const color = colorFor(value);
        return {
            count,
            color,
            accent: color,
            kind: value === unassigned ? 'unassigned' : 'assigned',
            context: `${count} Kunden · ${value}`
        };
    }

    let offset = 0;
    const stops = sorted.map(([value, amount]) => {
        const start = offset;
        offset += count ? (amount / count) * 100 : 0;
        return `${colorFor(value)} ${start.toFixed(1)}% ${offset.toFixed(1)}%`;
    });
    return {
        count,
        color: DEFAULT_CUSTOMER_COLOR,
        accent: `linear-gradient(90deg, ${stops.join(', ')})`,
        kind: 'mixed',
        context: `${count} Kunden · mehrere ${dimensionLabel}`
    };
}

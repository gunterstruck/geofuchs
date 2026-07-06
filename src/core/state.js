/**
 * Zentraler App-State mit einfachem Pub/Sub.
 *
 * Kunde: {
 *   id, nummer, name, strasse, plz, ort, vb,
 *   channel, gruppe, bezirk,   // Vertriebshierarchie (oben -> unten), je optional
 *   ansprechpartner, telefon, email, umsatz,
 *   rhythmusWochen, besuche: [ISO-Datum, ...],
 *   lat, lng, geo: 'exakt' | 'plz' | 'none'
 * }
 */

import { CONFIG } from './config.js';

/**
 * Planungsrelevante Gebietsebenen. Der Vertriebsbezirk ist die führende Ebene,
 * Gruppe ist die Standard-Ergänzung, Channel bleibt eine optionale Zusatzebene.
 */
export const DIMENSIONS = [
    { id: 'bezirk',  field: 'bezirk',  label: 'Vertriebsbezirk' },
    { id: 'gruppe',  field: 'gruppe',  label: 'Vertriebsgruppe' },
    { id: 'channel', field: 'channel', label: 'Vertriebschannel' }
];

export const state = {
    customers: [],
    fileName: null,
    importedAt: null,

    // Vertriebsbeauftragte: name -> { color, visible }
    reps: new Map(),
    // Vertriebshierarchie: id -> { label, field, active, values: Map<name,{visible}> }
    dims: {},

    level: 'kreise',
    // 'auto' = nach Zoom | 'rep' = Außendienst/Kundenpunkte | 'bezirk' | 'gruppe' | 'status'
    colorMode: 'auto',

    // Gebietszuordnungen (unabhängig von Kunden): 'level:regionKey' -> { bezirk, gruppe, channel, name }
    territories: {},

    tour: {
        start: null,        // { lat, lng, label, customerId? }
        destination: null,  // optionaler Zielpunkt { lat, lng, label, customerId? } – bleibt am Streckenende
        stops: [],          // Array von Kunden-IDs (Zwischenstopps in Besuchsreihenfolge)
        radiusKm: CONFIG.tour.defaultRadiusKm,
        roundTrip: false,   // Rundreise: am Ende zurück zum Start
        suggestMode: 'radius' // 'radius' = Umkreis um Start | 'route' = Korridor entlang der Tour
    },

    ui: {
        // Fokus-Modus: 'aussendienst' (Alltag: Karte, Tour, Kunden) |
        //              'gebietsplanung' (Experten: Gebiete schneiden, Cockpit, Simulation)
        mode: 'aussendienst',
        activeTab: 'tour',
        // Chancen-Fokus: nur fällige/überfällige Kunden auf der Karte zeigen
        opportunityOnly: false,
        sidebarOpen: window.innerWidth > 900
    }
};

const listeners = new Map();

export function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
}

export function emit(event, payload) {
    const fns = listeners.get(event);
    if (fns) fns.forEach((fn) => fn(payload));
}

export const UNASSIGNED = 'Ohne Zuordnung';

// ---- Gebietszuordnungen (Territorien) ----

export function territoryId(level, regionKey) {
    return `${level}:${regionKey}`;
}
export function getTerritory(level, regionKey) {
    return state.territories[territoryId(level, regionKey)] ?? null;
}
/** Setzt eine Zuordnung (attr: 'vb' | 'bezirk' | …). Leerer Wert entfernt sie. */
export function setTerritory(level, regionKey, attr, value, name) {
    const id = territoryId(level, regionKey);
    const t = { ...(state.territories[id] || {}) };
    if (value) t[attr] = value; else delete t[attr];
    if (name) t.name = name;
    if (Object.keys(t).filter((k) => k !== 'name').length === 0) delete state.territories[id];
    else state.territories[id] = t;
}

/** Kompletter Datensatz-Schnappschuss für die Persistenz */
export function datasetSnapshot() {
    return {
        customers: state.customers,
        fileName: state.fileName,
        importedAt: state.importedAt,
        territories: state.territories
    };
}

/**
 * Kundenliste setzen und Vertriebsbeauftragte/Gruppen ableiten.
 * Bestehende Farb-/Sichtbarkeits-Einstellungen bleiben erhalten.
 */
export function setCustomers(customers, meta = {}) {
    state.customers = customers;
    state.fileName = meta.fileName ?? state.fileName;
    state.importedAt = meta.importedAt ?? new Date().toISOString();

    const oldReps = state.reps;
    const oldDims = state.dims || {};
    state.reps = new Map();
    state.dims = {};

    const repNames = [...new Set(customers.map((c) => c.vb || UNASSIGNED))]
        .sort((a, b) => a.localeCompare(b, 'de'));
    repNames.forEach((name, i) => {
        state.reps.set(name, {
            color: name === UNASSIGNED
                ? CONFIG.unassignedColor
                : (oldReps.get(name)?.color ?? CONFIG.repPalette[i % CONFIG.repPalette.length]),
            visible: oldReps.get(name)?.visible ?? true
        });
    });

    // Vertriebshierarchie-Ebenen ableiten (inkl. stabiler Farbe je Wert)
    for (const def of DIMENSIONS) {
        const active = customers.some((c) => String(c[def.field] ?? '').trim() !== '');
        const names = [...new Set(customers.map((c) => String(c[def.field] ?? '').trim() || UNASSIGNED))]
            .sort((a, b) => a.localeCompare(b, 'de'));
        const oldValues = oldDims[def.id]?.values;
        const values = new Map();
        names.forEach((name, i) => values.set(name, {
            visible: oldValues?.get(name)?.visible ?? true,
            color: name === UNASSIGNED
                ? CONFIG.unassignedColor
                : (oldValues?.get(name)?.color ?? CONFIG.repPalette[i % CONFIG.repPalette.length])
        }));
        state.dims[def.id] = { label: def.label, field: def.field, active, values };
    }

    // Tour bereinigen: nur noch existierende Kunden behalten
    const ids = new Set(customers.map((c) => c.id));
    state.tour.stops = state.tour.stops.filter((id) => ids.has(id));
    if (state.tour.start?.customerId && !ids.has(state.tour.start.customerId)) {
        state.tour.start = null;
    }
    if (state.tour.destination?.customerId && !ids.has(state.tour.destination.customerId)) {
        state.tour.destination = null;
    }

    emit('customers:changed');
}

export function getCustomer(id) {
    return state.customers.find((c) => c.id === id);
}

/**
 * Signalisiert, dass sich Kundendaten inhaltlich geändert haben (z. B. Besuch
 * eingetragen). Löst Persistenz ('dataset:dirty') und Neuzeichnen aus.
 */
export function markDirty() {
    emit('dataset:dirty');
    emit('customers:changed');
}

export function repColor(vb) {
    return state.reps.get(vb || UNASSIGNED)?.color ?? CONFIG.unassignedColor;
}

/**
 * Farbe für einen Attributwert (zum Einfärben von Gebieten/Markern).
 * attr: 'vb' | 'channel' | 'gruppe' | 'bezirk'
 */
export function attrColor(attr, value) {
    if (attr === 'vb') return repColor(value);
    return state.dims[attr]?.values.get(value || UNASSIGNED)?.color ?? CONFIG.unassignedColor;
}

/** Aktive Hierarchie-Ebenen (haben tatsächlich Werte in den Daten) */
export function activeDims() {
    return DIMENSIONS.map((def) => state.dims[def.id]).filter((d) => d?.active);
}

/** Ist der Kunde nach aktuellen Filtern sichtbar? */
export function isVisible(customer) {
    for (const def of DIMENSIONS) {
        const dim = state.dims[def.id];
        if (!dim?.active) continue;
        const value = dim.values.get(String(customer[def.field] ?? '').trim() || UNASSIGNED);
        if (!(value?.visible ?? true)) return false;
    }
    return true;
}

export function visibleCustomers() {
    return state.customers.filter(isVisible);
}

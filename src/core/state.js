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
 * Vertriebshierarchie in Reihenfolge von oben (grob) nach unten (fein).
 * Jede Ebene ist optional – fehlt eine Spalte in der Excel-Liste, wird die
 * Ebene ausgeblendet und nicht gefiltert.
 */
export const DIMENSIONS = [
    { id: 'channel', field: 'channel', label: 'Vertriebschannel' },
    { id: 'gruppe',  field: 'gruppe',  label: 'Vertriebsgruppe' },
    { id: 'bezirk',  field: 'bezirk',  label: 'Betriebsbezirk' }
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
    colorMode: 'rep',   // 'rep' = nach Vertriebsbeauftragtem | 'status' = nach Besuchsstatus

    tour: {
        start: null,        // { lat, lng, label, customerId? }
        stops: [],          // Array von Kunden-IDs (in Besuchsreihenfolge)
        radiusKm: CONFIG.tour.defaultRadiusKm
    },

    ui: {
        activeTab: 'daten',
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

    // Vertriebshierarchie-Ebenen ableiten
    for (const def of DIMENSIONS) {
        const active = customers.some((c) => String(c[def.field] ?? '').trim() !== '');
        const names = [...new Set(customers.map((c) => String(c[def.field] ?? '').trim() || UNASSIGNED))]
            .sort((a, b) => a.localeCompare(b, 'de'));
        const oldValues = oldDims[def.id]?.values;
        const values = new Map();
        names.forEach((name) => values.set(name, { visible: oldValues?.get(name)?.visible ?? true }));
        state.dims[def.id] = { label: def.label, field: def.field, active, values };
    }

    // Tour bereinigen: nur noch existierende Kunden behalten
    const ids = new Set(customers.map((c) => c.id));
    state.tour.stops = state.tour.stops.filter((id) => ids.has(id));
    if (state.tour.start?.customerId && !ids.has(state.tour.start.customerId)) {
        state.tour.start = null;
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

/** Aktive Hierarchie-Ebenen (haben tatsächlich Werte in den Daten) */
export function activeDims() {
    return DIMENSIONS.map((def) => state.dims[def.id]).filter((d) => d?.active);
}

/** Ist der Kunde nach aktuellen Filtern sichtbar? */
export function isVisible(customer) {
    const rep = state.reps.get(customer.vb || UNASSIGNED);
    if (!(rep?.visible ?? true)) return false;
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

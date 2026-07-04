/**
 * Zentraler App-State mit einfachem Pub/Sub.
 *
 * Kunde: {
 *   id, nummer, name, strasse, plz, ort, vb, gruppe,
 *   ansprechpartner, telefon, email, umsatz,
 *   rhythmusWochen, besuche: [ISO-Datum, ...],
 *   lat, lng, geo: 'exakt' | 'plz' | 'none'
 * }
 */

import { CONFIG } from './config.js';

export const state = {
    customers: [],
    fileName: null,
    importedAt: null,

    // Vertriebsbeauftragte: name -> { color, visible }
    reps: new Map(),
    // Vertriebsgruppen: name -> { visible }
    groups: new Map(),

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
    const oldGroups = state.groups;
    state.reps = new Map();
    state.groups = new Map();

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

    const groupNames = [...new Set(customers.map((c) => c.gruppe || UNASSIGNED))]
        .sort((a, b) => a.localeCompare(b, 'de'));
    groupNames.forEach((name) => {
        state.groups.set(name, { visible: oldGroups.get(name)?.visible ?? true });
    });

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

/** Ist der Kunde nach aktuellen Filtern sichtbar? */
export function isVisible(customer) {
    const rep = state.reps.get(customer.vb || UNASSIGNED);
    const grp = state.groups.get(customer.gruppe || UNASSIGNED);
    return (rep?.visible ?? true) && (grp?.visible ?? true);
}

export function visibleCustomers() {
    return state.customers.filter(isVisible);
}

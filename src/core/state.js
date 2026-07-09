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

const EXTRA_DIM_PREFIX = 'extra:';
const EXTRA_DIM_MAX_VALUES = 80;

export const state = {
    customers: [],
    fileName: null,
    importedAt: null,

    // Vertriebsbeauftragte: name -> { color, visible }
    reps: new Map(),
    // Vertriebshierarchie: id -> { label, field, active, values: Map<name,{visible}> }
    dims: {},
    extraDimensions: [],

    level: 'kreise',
    // 'auto' = nach Zoom | 'rep' = Außendienst/Kundenpunkte | 'bezirk' | 'gruppe' | 'status'
    colorMode: 'auto',
    basemap: 'standard',

    // Gebietszuordnungen (unabhängig von Kunden): 'level:regionKey' -> { bezirk, gruppe, channel, name }
    territories: {},

    tour: {
        bezirk: null,       // '__all__' | Bezirksname | null/'__none__' = noch nicht gewaehlt
        start: null,        // { lat, lng, label, customerId? }
        destination: null,  // optionaler Zielpunkt { lat, lng, label, customerId? } – bleibt am Streckenende
        stops: [],          // Array von Kunden-IDs (Zwischenstopps in Besuchsreihenfolge)
        radiusKm: CONFIG.tour.defaultRadiusKm,
        roundTrip: false,   // Rundreise: am Ende zurück zum Start
        suggestMode: 'radius', // 'radius' = Umkreis um Start | 'route' = Korridor entlang der Tour
        mapFocus: false,    // Karte zeigt nur Tour + passende Vorschlagskunden
        routeLineMode: 'air' // 'air' = Luftlinie | 'road' = Straßenroute
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

function slugId(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'feld';
}

function customerStableKey(customer) {
    const nummer = String(customer?.nummer ?? '').trim();
    if (nummer) return `nr:${nummer}`;
    return `np:${String(customer?.name ?? '').trim().toLowerCase()}|${String(customer?.plz ?? '').trim()}`;
}

function mergeVisits(oldCustomer, freshCustomer) {
    return [...new Set([...(oldCustomer?.besuche || []), ...(freshCustomer?.besuche || [])])].filter(Boolean).sort();
}

function contactKey(contact) {
    return [
        String(contact?.name ?? '').trim().toLowerCase(),
        String(contact?.telefon ?? '').trim(),
        String(contact?.email ?? '').trim().toLowerCase()
    ].join('|');
}

function mergeContacts(oldCustomer, freshCustomer) {
    const all = [...(oldCustomer?.contacts || []), ...(freshCustomer?.contacts || [])];
    if (all.length === 0) return null;
    const byKey = new Map();
    for (const contact of all) {
        const key = contactKey(contact);
        if (!key.replace(/\|/g, '')) continue;
        byKey.set(key, { ...(byKey.get(key) || {}), ...contact });
    }
    const contacts = [...byKey.values()];
    const preferred = contacts.find((c) => freshCustomer?.primaryContactId && c.id === freshCustomer.primaryContactId)
        || contacts.find((c) => c.primary)
        || contacts.find((c) => c.name)
        || contacts[0];
    return contacts.map((c) => ({ ...c, primary: c === preferred || c.id === preferred.id }));
}

function primaryFromContacts(contacts) {
    if (!contacts?.length) return null;
    return contacts.find((c) => c.primary) || contacts.find((c) => c.name) || contacts[0];
}

function dimensionValue(customer, def) {
    const raw = def.custom ? customer.extra?.[def.field] : customer[def.field];
    return String(raw ?? '').trim();
}

function inferExtraDimensions(customers) {
    const valuesByHeader = new Map();
    for (const customer of customers) {
        for (const [header, raw] of Object.entries(customer.extra || {})) {
            const value = String(raw ?? '').trim();
            if (!value) continue;
            if (!valuesByHeader.has(header)) valuesByHeader.set(header, new Set());
            valuesByHeader.get(header).add(value);
        }
    }

    const usedIds = new Set(DIMENSIONS.map((d) => d.id));
    const defs = [];
    for (const [header, values] of valuesByHeader.entries()) {
        const list = [...values];
        const hasText = list.some((value) => /[A-Za-zÄÖÜäöüß]/.test(value));
        if (!hasText || list.length < 2 || list.length > EXTRA_DIM_MAX_VALUES) continue;

        const baseId = `${EXTRA_DIM_PREFIX}${slugId(header)}`;
        let id = baseId;
        let i = 2;
        while (usedIds.has(id)) id = `${baseId}-${i++}`;
        usedIds.add(id);
        defs.push({ id, field: header, label: header, custom: true });
    }
    return defs.sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

export function filterDimensionDefs() {
    return [...DIMENSIONS, ...(state.extraDimensions || [])];
}

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
    state.extraDimensions = inferExtraDimensions(customers);

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
    for (const def of filterDimensionDefs()) {
        const active = customers.some((c) => dimensionValue(c, def) !== '');
        const names = [...new Set(customers.map((c) => dimensionValue(c, def) || UNASSIGNED))]
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

export function mergeCustomersDelta(importedCustomers) {
    const oldByKey = new Map(state.customers.map((c) => [customerStableKey(c), c]));
    const seenKeys = new Set();
    const merged = importedCustomers.map((fresh) => {
        const key = customerStableKey(fresh);
        seenKeys.add(key);
        const old = oldByKey.get(key);
        if (!old) return fresh;
        const contacts = mergeContacts(old, fresh);
        const primary = primaryFromContacts(contacts);
        return {
            ...old,
            ...fresh,
            id: old.id,
            besuche: mergeVisits(old, fresh),
            contacts: contacts || undefined,
            primaryContactId: primary?.id || fresh.primaryContactId || old.primaryContactId,
            ansprechpartner: primary?.name || fresh.ansprechpartner || old.ansprechpartner || '',
            telefon: primary?.telefon || fresh.telefon || old.telefon || '',
            email: primary?.email || fresh.email || old.email || ''
        };
    });
    for (const old of state.customers) {
        if (!seenKeys.has(customerStableKey(old))) merged.push(old);
    }
    return merged;
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
    return filterDimensionDefs().map((def) => state.dims[def.id]).filter((d) => d?.active);
}

/** Ist der Kunde nach aktuellen Filtern sichtbar? */
export function isVisible(customer) {
    for (const def of filterDimensionDefs()) {
        const dim = state.dims[def.id];
        if (!dim?.active) continue;
        const value = dim.values.get(dimensionValue(customer, def) || UNASSIGNED);
        if (!(value?.visible ?? true)) return false;
    }
    return true;
}

export function visibleCustomers() {
    return state.customers.filter(isVisible);
}

export function customerInTourScope(customer) {
    const bezirk = state.tour.bezirk;
    if (!bezirk || bezirk === '__none__') return false;
    if (bezirk === '__all__') return true;
    return (String(customer?.bezirk ?? '').trim() || UNASSIGNED) === bezirk;
}

export function tourScopedCustomers() {
    const bezirk = state.tour.bezirk;
    if (!bezirk || bezirk === '__none__') return [];
    if (bezirk === '__all__') return visibleCustomers();
    return visibleCustomers().filter(customerInTourScope);
}

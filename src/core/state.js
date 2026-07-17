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
import { normalizeDemoCustomers } from './demoSafety.js';

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

    // Eigenständiger Bestand: mehrere Vertragsquellen werden über
    // Quellsystem + Vertrags-ID gepflegt und nur per Kundennummer verknüpft.
    serviceContracts: [],
    serviceContractSources: {},
    // Operative Serviceeinsätze/Work Orders bleiben fachlich von Verträgen
    // getrennt. Auch sie werden ausschließlich über die Kundennummer verknüpft.
    serviceVisits: [],
    serviceVisitSources: {},

    // Vertriebsbeauftragte: name -> { color, visible }
    reps: new Map(),
    // Vertriebshierarchie: id -> { label, field, active, values: Map<name,{visible}> }
    dims: {},
    extraDimensions: [],

    // `level` ist die aktuell wirksame Ebene. In Basis wird sie aus dem Zoom
    // abgeleitet; Profis können mit `levelMode = fixed` eine Ebene festsetzen.
    level: 'kreise',
    levelMode: 'auto',
    fixedLevel: 'kreise',
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
        routeLineMode: 'air', // 'air' = Luftlinie | 'road' = Straßenroute
        servicePlan: null,  // bestätigter, erklärbarer Tagesvorschlag
        serviceVisitByCustomer: {}
    },

    ui: {
        // Fokus-Modus: 'aussendienst' (Alltag: Karte, Tour, Kunden) |
        //              'gebietsplanung' (Experten: Gebiete schneiden, Cockpit, Simulation) |
        //              'service' (Experten: Vertragsradar und Service-Vorplanung)
        mode: 'aussendienst',
        activeTab: 'tour',
        // Ansichtstiefe: 'basis' (nur Kernnutzen, wenig Ablenkung) |
        //               'profi' (alle Komfort-/Feinsteuer-Funktionen)
        depth: 'basis',
        // Chancen-Fokus: nur fällige/überfällige Kunden auf der Karte zeigen
        opportunityOnly: false,
        // Im Service-Fokus standardmäßig nur Kunden mit planungsrelevantem Vertrag.
        serviceCustomerScope: 'contracts',
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
        schemaVersion: 3,
        customers: state.customers,
        fileName: state.fileName,
        importedAt: state.importedAt,
        territories: state.territories,
        serviceContracts: state.serviceContracts,
        serviceContractSources: state.serviceContractSources,
        serviceVisits: state.serviceVisits,
        serviceVisitSources: state.serviceVisitSources
    };
}

/** Verwirft einen bestätigten Service-Tagesplan nach manueller Touränderung. */
export function clearServiceTourPlan() {
    const hadPlan = Boolean(state.tour.servicePlan);
    state.tour.servicePlan = null;
    state.tour.serviceVisitByCustomer = {};
    return hadPlan;
}

/** Vertragsbestand aus Persistenz oder sicherem Umzug wiederherstellen. */
export function setServiceContracts(contracts = [], sources = {}) {
    state.serviceContracts = (Array.isArray(contracts) ? contracts : []).filter(Boolean).map((contract) => {
        const sourceSystem = normalizeServiceContractSource(contract?.sourceSystem);
        return sourceSystem ? { ...contract, sourceSystem, sourceKey: sourceSystem } : contract;
    });
    state.serviceContractSources = Object.entries(sources && typeof sources === 'object' ? sources : {})
        .reduce((result, [source, meta]) => {
            const key = normalizeServiceContractSource(source);
            if (key) result[key] = { ...(result[key] || {}), ...(meta || {}) };
            return result;
        }, {});
    emit('service-contracts:changed');
}

function normalizeServiceContractSource(value) {
    return String(value ?? '').normalize('NFKC').trim().toLocaleUpperCase('de-DE');
}

/**
 * Importierte Quellsysteme atomar ersetzen, alle anderen Vertragsquellen erhalten.
 * So kann z. B. ein SAP-Abzug aktualisiert werden, ohne SieSales zu verwerfen.
 */
export function replaceServiceContractSources(contracts, metaBySource = {}) {
    const incoming = (Array.isArray(contracts) ? contracts : []).filter(Boolean).map((contract) => {
        const sourceSystem = normalizeServiceContractSource(contract?.sourceSystem);
        return sourceSystem ? { ...contract, sourceSystem, sourceKey: sourceSystem } : contract;
    });
    const sourceKeys = new Set(incoming.map((contract) => normalizeServiceContractSource(contract.sourceSystem)).filter(Boolean));
    if (sourceKeys.size === 0) return false;

    state.serviceContracts = [
        ...state.serviceContracts.filter((contract) => !sourceKeys.has(normalizeServiceContractSource(contract.sourceSystem))),
        ...incoming
    ];
    const nextSources = { ...(state.serviceContractSources || {}) };
    for (const existingSource of Object.keys(nextSources)) {
        if (sourceKeys.has(normalizeServiceContractSource(existingSource))) delete nextSources[existingSource];
    }
    const normalizedMeta = Object.entries(metaBySource || {}).reduce((result, [source, meta]) => {
        const key = normalizeServiceContractSource(source);
        if (key) result[key] = { ...(result[key] || {}), ...(meta || {}) };
        return result;
    }, {});
    for (const source of sourceKeys) {
        nextSources[source] = {
            ...(normalizedMeta[source] || {}),
            count: incoming.filter((contract) => normalizeServiceContractSource(contract.sourceSystem) === source).length
        };
    }
    state.serviceContractSources = nextSources;
    emit('service-contracts:changed');
    emit('dataset:dirty');
    return true;
}

export function clearServiceContracts({ dirty = true } = {}) {
    state.serviceContracts = [];
    state.serviceContractSources = {};
    emit('service-contracts:changed');
    if (dirty) emit('dataset:dirty');
}

function normalizeServiceVisitSource(value) {
    return String(value ?? '').normalize('NFKC').trim().toLocaleUpperCase('de-DE');
}

/** Operative Serviceeinsätze aus Persistenz oder sicherem Umzug wiederherstellen. */
export function setServiceVisits(visits = [], sources = {}) {
    state.serviceVisits = (Array.isArray(visits) ? visits : []).filter(Boolean).map((visit) => {
        const sourceSystem = normalizeServiceVisitSource(visit?.sourceSystem);
        return sourceSystem ? { ...visit, sourceSystem, sourceKey: sourceSystem } : visit;
    });
    state.serviceVisitSources = Object.entries(sources && typeof sources === 'object' ? sources : {})
        .reduce((result, [source, meta]) => {
            const key = normalizeServiceVisitSource(source);
            if (key) result[key] = { ...(result[key] || {}), ...(meta || {}) };
            return result;
        }, {});
    clearServiceTourPlan();
    emit('service-visits:changed');
}

/**
 * Importierte Einsatzquellen atomar ersetzen; Kunden, Verträge und alle nicht
 * enthaltenen Einsatzquellen bleiben erhalten.
 */
export function replaceServiceVisitSources(visits, metaBySource = {}) {
    const incoming = (Array.isArray(visits) ? visits : []).filter(Boolean).map((visit) => {
        const sourceSystem = normalizeServiceVisitSource(visit?.sourceSystem);
        return sourceSystem ? { ...visit, sourceSystem, sourceKey: sourceSystem } : visit;
    });
    const sourceKeys = new Set(incoming.map((visit) => normalizeServiceVisitSource(visit.sourceSystem)).filter(Boolean));
    if (sourceKeys.size === 0) return false;

    state.serviceVisits = [
        ...state.serviceVisits.filter((visit) => !sourceKeys.has(normalizeServiceVisitSource(visit.sourceSystem))),
        ...incoming
    ];
    const nextSources = { ...(state.serviceVisitSources || {}) };
    for (const existingSource of Object.keys(nextSources)) {
        if (sourceKeys.has(normalizeServiceVisitSource(existingSource))) delete nextSources[existingSource];
    }
    const normalizedMeta = Object.entries(metaBySource || {}).reduce((result, [source, meta]) => {
        const key = normalizeServiceVisitSource(source);
        if (key) result[key] = { ...(result[key] || {}), ...(meta || {}) };
        return result;
    }, {});
    for (const source of sourceKeys) {
        nextSources[source] = {
            ...(normalizedMeta[source] || {}),
            count: incoming.filter((visit) => normalizeServiceVisitSource(visit.sourceSystem) === source).length
        };
    }
    state.serviceVisitSources = nextSources;
    clearServiceTourPlan();
    emit('service-visits:changed');
    emit('dataset:dirty');
    return true;
}

export function clearServiceVisits({ dirty = true } = {}) {
    state.serviceVisits = [];
    state.serviceVisitSources = {};
    state.tour.servicePlan = null;
    state.tour.serviceVisitByCustomer = {};
    emit('service-visits:changed');
    if (dirty) emit('dataset:dirty');
}

/**
 * Kundenliste setzen und Vertriebsbeauftragte/Gruppen ableiten.
 * Bestehende Farb-/Sichtbarkeits-Einstellungen bleiben erhalten.
 */
export function setCustomers(customers, meta = {}) {
    state.customers = normalizeDemoCustomers(customers);
    reindexCustomers();
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
    // Zuordnungsstatus im Vertragsradar folgt der Kundennummer dynamisch.
    if (state.serviceContracts.length) emit('service-contracts:changed');
    if (state.serviceVisits.length) emit('service-visits:changed');
}

/**
 * Ersetzt einen vollständigen Kundendatensatz. Datenbezogene Planung aus dem
 * vorherigen Bestand darf nicht auf Kunden einer neuen Datei übergehen.
 */
export function replaceCustomers(customers, meta = {}) {
    state.territories = { ...(meta.territories || {}) };
    Object.assign(state.tour, {
        bezirk: null,
        start: null,
        destination: null,
        stops: [],
        roundTrip: false,
        suggestMode: 'radius',
        mapFocus: false,
        routeLineMode: 'air',
        servicePlan: null,
        serviceVisitByCustomer: {}
    });
    setCustomers(customers, meta);
    emit('tour:changed');
}

// Index für O(1)-Zugriff – wichtig für Cockpit/Simulation mit vielen Kunden
let customersById = new Map();

function reindexCustomers() {
    customersById = new Map(state.customers.map((c) => [c.id, c]));
}

export function getCustomer(id) {
    if (customersById.size !== state.customers.length) reindexCustomers();
    return customersById.get(id) ?? state.customers.find((c) => c.id === id);
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

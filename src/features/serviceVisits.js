/**
 * DOM-freie Fachlogik für operative Serviceeinsätze (Work Orders).
 *
 * Einsätze und Verträge bleiben getrennte Bestände. Der Kundenbezug entsteht
 * ausschließlich über die exakte Kundennummer; führende Nullen bleiben erhalten.
 */

import { normalizeCustomerNumber } from './serviceContracts.js';

export const SERVICE_VISIT_FIELDS = [
    { key: 'sourceSystem', label: 'Quellsystem', required: true, synonyms: ['quellsystem', 'source system', 'source'] },
    { key: 'workOrderId', label: 'Einsatz-ID', required: true, synonyms: ['einsatz id', 'einsatz nummer', 'auftragsnummer', 'serviceauftrag', 'work order id', 'work order'] },
    { key: 'operationId', label: 'Vorgang-ID', required: false, synonyms: ['vorgang id', 'position', 'auftragsposition', 'operation id'] },
    { key: 'customerNumber', label: 'Kundennummer', required: true, synonyms: ['kundennummer', 'kunden nr', 'debitor', 'customer number', 'account id'] },
    { key: 'contractSourceSystem', label: 'Vertrags-Quellsystem', required: false, synonyms: ['vertrags quellsystem', 'contract source system'] },
    { key: 'contractId', label: 'Vertragsnummer', required: false, synonyms: ['vertragsnummer', 'servicevertragsnummer', 'contract id', 'contract number'] },
    { key: 'reason', label: 'Einsatzart / Kurztext', required: true, synonyms: ['einsatzart', 'anlass', 'kurztext', 'beschreibung', 'reason', 'work type'] },
    { key: 'dueDate', label: 'Fällig am', required: true, synonyms: ['faellig am', 'fällig am', 'faelligkeit', 'fälligkeit', 'due date', 'due'] },
    { key: 'slaDueAt', label: 'SLA-Frist', required: false, synonyms: ['sla frist', 'sla faellig', 'sla fällig', 'sla due', 'sla deadline'] },
    { key: 'timeWindowStart', label: 'Termin von', required: false, synonyms: ['termin von', 'zeitfenster von', 'fenster von', 'window start', 'appointment start'] },
    { key: 'timeWindowEnd', label: 'Termin bis', required: false, synonyms: ['termin bis', 'zeitfenster bis', 'fenster bis', 'window end', 'appointment end'] },
    { key: 'durationMin', label: 'Dauer (Min.)', required: true, synonyms: ['dauer min', 'dauer minuten', 'einsatzdauer', 'duration minutes', 'duration'] },
    { key: 'priority', label: 'Priorität', required: true, synonyms: ['prioritaet', 'priorität', 'priority', 'prio'] },
    { key: 'requiredSkills', label: 'Benötigte Qualifikation', required: false, synonyms: ['benoetigte qualifikation', 'benötigte qualifikation', 'qualifikation', 'skills', 'required skills'] },
    { key: 'assignedTo', label: 'Techniker / Team', required: false, synonyms: ['techniker', 'team', 'verantwortlich', 'assigned to', 'assignee'] },
    { key: 'status', label: 'Status', required: true, synonyms: ['einsatzstatus', 'auftragsstatus', 'status', 'work order status'] },
    { key: 'dataAsOf', label: 'Datenstand', required: true, synonyms: ['datenstand', 'stand datum', 'snapshot datum', 'data as of', 'last updated'] },
    { key: 'siteId', label: 'Standort-ID', required: false, synonyms: ['standort id', 'werk id', 'site id', 'location id'] },
    { key: 'assetId', label: 'Anlagen-ID', required: false, synonyms: ['anlagen id', 'equipment id', 'asset id'] },
    { key: 'sourceUrl', label: 'Quell-Link', required: false, synonyms: ['quell link', 'sap link', 'salesforce link', 'source url', 'url', 'link'] },
    { key: 'note', label: 'Notiz', required: false, synonyms: ['notiz', 'bemerkung', 'kommentar', 'note', 'comment'] }
];

function textValue(value) {
    return value === null || value === undefined
        ? ''
        : String(value).normalize('NFKC').replace(/\u00a0/g, ' ').trim();
}

function normalizeHeader(value) {
    return textValue(value).toLowerCase()
        .replace(/ß/g, 'ss')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[._\-/()]/g, ' ')
        .replace(/\s+/g, ' ');
}

function canonical(value) {
    return textValue(value).toLocaleUpperCase('de-DE');
}

function visitId(source, order, operation = '') {
    return `sv:${encodeURIComponent(canonical(source))}:${encodeURIComponent(canonical(order))}:${encodeURIComponent(canonical(operation))}`;
}

export function autoDetectServiceVisitMapping(headers) {
    const list = Array.isArray(headers) ? headers : [];
    const mapping = {};
    const used = new Set();
    const matchers = [
        (header, synonym) => header === synonym,
        (header, synonym) => synonym.length > 3 && header.startsWith(synonym),
        (header, synonym) => synonym.length > 3 && header.includes(synonym)
    ];
    for (const field of SERVICE_VISIT_FIELDS) {
        mapping[field.key] = null;
        const synonyms = field.synonyms.map(normalizeHeader);
        for (const matches of matchers) {
            if (mapping[field.key]) break;
            for (const header of list) {
                if (used.has(header)) continue;
                const normalized = normalizeHeader(header);
                if (synonyms.some((synonym) => matches(normalized, synonym))) {
                    mapping[field.key] = header;
                    used.add(header);
                    break;
                }
            }
        }
    }
    return mapping;
}

function isValidDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseDate(value) {
    const raw = textValue(value);
    if (!raw) return { value: '', valid: true };
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let year; let month; let day;
    if (match) {
        [, year, month, day] = match.map((part, index) => index ? Number(part) : part);
    } else {
        match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!match) return { value: '', valid: false };
        day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
    }
    if (!isValidDate(year, month, day)) return { value: '', valid: false };
    return { value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, valid: true };
}

function parseClock(value) {
    const raw = textValue(value);
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return { value: '', valid: false, kind: '' };
    const hour = Number(match[1]); const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return { value: '', valid: false, kind: '' };
    return { value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, valid: true, kind: 'time' };
}

function parseLocalDateTime(value, { allowDate = false, allowTime = false } = {}) {
    const raw = textValue(value);
    if (!raw) return { value: '', valid: true, kind: '' };
    if (allowDate) {
        const date = parseDate(raw);
        if (date.valid && date.value) return { ...date, kind: 'date' };
    }
    if (allowTime && /^\d{1,2}:\d{2}$/.test(raw)) return parseClock(raw);
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})(?::\d{2})?$/);
    if (!match) return { value: '', valid: false, kind: '' };
    const date = parseDate(match[1]);
    const time = parseClock(match[2]);
    if (!date.valid || !time.valid) return { value: '', valid: false, kind: '' };
    return { value: `${date.value}T${time.value}`, valid: true, kind: 'datetime' };
}

const PRIORITIES = new Map([
    ['kritisch', 'KRITISCH'], ['p1', 'KRITISCH'], ['1', 'KRITISCH'],
    ['hoch', 'HOCH'], ['high', 'HOCH'], ['p2', 'HOCH'], ['2', 'HOCH'],
    ['mittel', 'MITTEL'], ['normal', 'MITTEL'], ['medium', 'MITTEL'], ['p3', 'MITTEL'], ['3', 'MITTEL'],
    ['niedrig', 'NIEDRIG'], ['low', 'NIEDRIG'], ['p4', 'NIEDRIG'], ['4', 'NIEDRIG']
]);

const STATUSES = new Map([
    ['offen', 'OFFEN'], ['open', 'OFFEN'],
    ['eingeplant', 'EINGEPLANT'], ['geplant', 'EINGEPLANT'], ['planned', 'EINGEPLANT'],
    ['in arbeit', 'IN_ARBEIT'], ['in bearbeitung', 'IN_ARBEIT'], ['in progress', 'IN_ARBEIT'],
    ['blockiert', 'BLOCKIERT'], ['blocked', 'BLOCKIERT'],
    ['erledigt', 'ERLEDIGT'], ['abgeschlossen', 'ERLEDIGT'], ['done', 'ERLEDIGT'], ['completed', 'ERLEDIGT'],
    ['storniert', 'STORNIERT'], ['cancelled', 'STORNIERT'], ['canceled', 'STORNIERT']
]);

function parseAlias(value, aliases) {
    const raw = normalizeHeader(value).replace(/_/g, ' ');
    return aliases.has(raw) ? { value: aliases.get(raw), valid: true } : { value: '', valid: false };
}

function parseDuration(value) {
    const raw = textValue(value);
    if (!/^\d+$/.test(raw)) return { value: null, valid: false };
    const number = Number(raw);
    return Number.isSafeInteger(number) && number >= 10 && number <= 720
        ? { value: number, valid: true }
        : { value: null, valid: false };
}

function parseSkills(value) {
    return [...new Set(textValue(value).split(/[;,|\n]+/)
        .map((skill) => skill.normalize('NFKC').trim())
        .filter(Boolean))];
}

function safeHttpUrl(value) {
    const raw = textValue(value);
    if (!raw) return { value: '', valid: true };
    try {
        const url = new URL(raw);
        return ['http:', 'https:'].includes(url.protocol) && url.hostname
            ? { value: url.href, valid: true }
            : { value: '', valid: false };
    } catch {
        return { value: '', valid: false };
    }
}

function mapped(row, mapping, key) {
    const header = mapping?.[key];
    return header ? row?.[header] : '';
}

function blankRow(row) {
    return !row || Object.values(row).every((value) => textValue(value) === '');
}

function issue(row, sheetRow, type, code, field, message) {
    return { ...(row || {}), Zeile: sheetRow, Typ: type, Grund: message, type, code, field, message };
}

function windowComparable(parsed) {
    if (parsed.kind === 'time') return Number(parsed.value.slice(0, 2)) * 60 + Number(parsed.value.slice(3, 5));
    return parsed.value;
}

/** Excel-/CSV-Zeilen streng normalisieren. Fehlerhafte Zeilen werden nie übernommen. */
export function parseServiceVisitRows(rows, mapping, options = {}) {
    const list = Array.isArray(rows) ? rows : [];
    const errors = [];
    const warnings = [];
    const visits = [];
    const seen = new Set();
    const missingFields = SERVICE_VISIT_FIELDS.filter((field) => field.required && !mapping?.[field.key]);
    if (missingFields.length) {
        errors.push(issue({}, 1, 'Fehler', 'missing-column', missingFields[0].key,
            `Pflichtspalte fehlt: ${missingFields.map((field) => field.label).join(', ')}`));
        return { visits, errors, warnings, skipped: list.length };
    }

    list.forEach((row, index) => {
        const sheetRow = index + 2;
        if (blankRow(row)) return;
        const rowErrors = [];
        const sourceSystem = canonical(mapped(row, mapping, 'sourceSystem'));
        const workOrderId = textValue(mapped(row, mapping, 'workOrderId'));
        const operationId = textValue(mapped(row, mapping, 'operationId'));
        const customerNumber = normalizeCustomerNumber(mapped(row, mapping, 'customerNumber'));
        const reason = textValue(mapped(row, mapping, 'reason'));
        const contractSourceSystem = canonical(mapped(row, mapping, 'contractSourceSystem'));
        const contractId = textValue(mapped(row, mapping, 'contractId'));
        for (const [field, value, label] of [
            ['sourceSystem', sourceSystem, 'Quellsystem'], ['workOrderId', workOrderId, 'Einsatz-ID'],
            ['customerNumber', customerNumber, 'Kundennummer'], ['reason', reason, 'Einsatzart / Kurztext']
        ]) {
            if (!value) rowErrors.push(issue(row, sheetRow, 'Fehler', 'required', field, `${label} fehlt.`));
        }
        if (Boolean(contractSourceSystem) !== Boolean(contractId)) {
            rowErrors.push(issue(row, sheetRow, 'Fehler', 'contract-pair', 'contractId', 'Vertrags-Quellsystem und Vertragsnummer müssen gemeinsam befüllt sein.'));
        }

        const dueDate = parseDate(mapped(row, mapping, 'dueDate'));
        const dataAsOf = parseDate(mapped(row, mapping, 'dataAsOf'));
        const slaDueAt = parseLocalDateTime(mapped(row, mapping, 'slaDueAt'), { allowDate: true });
        const windowStart = parseLocalDateTime(mapped(row, mapping, 'timeWindowStart'), { allowTime: true });
        const windowEnd = parseLocalDateTime(mapped(row, mapping, 'timeWindowEnd'), { allowTime: true });
        const duration = parseDuration(mapped(row, mapping, 'durationMin'));
        const priority = parseAlias(mapped(row, mapping, 'priority'), PRIORITIES);
        const status = parseAlias(mapped(row, mapping, 'status'), STATUSES);
        if (!dueDate.valid || !dueDate.value) rowErrors.push(issue(row, sheetRow, 'Fehler', 'invalid-date', 'dueDate', 'Fällig am muss YYYY-MM-DD oder TT.MM.JJJJ sein.'));
        if (!dataAsOf.valid || !dataAsOf.value) rowErrors.push(issue(row, sheetRow, 'Fehler', 'invalid-date', 'dataAsOf', 'Datenstand muss YYYY-MM-DD oder TT.MM.JJJJ sein.'));
        if (!slaDueAt.valid) rowErrors.push(issue(row, sheetRow, 'Fehler', 'invalid-datetime', 'slaDueAt', 'SLA-Frist ist kein gültiges Datum beziehungsweise lokaler Zeitpunkt.'));
        if (!duration.valid) rowErrors.push(issue(row, sheetRow, 'Fehler', 'invalid-duration', 'durationMin', 'Dauer muss eine ganze Zahl zwischen 10 und 720 Minuten sein.'));
        if (!priority.valid) rowErrors.push(issue(row, sheetRow, 'Fehler', 'invalid-priority', 'priority', 'Priorität muss KRITISCH, HOCH, MITTEL oder NIEDRIG sein.'));
        if (!status.valid) rowErrors.push(issue(row, sheetRow, 'Fehler', 'invalid-status', 'status', 'Status ist nicht bekannt.'));

        const hasStart = Boolean(textValue(mapped(row, mapping, 'timeWindowStart')));
        const hasEnd = Boolean(textValue(mapped(row, mapping, 'timeWindowEnd')));
        if (hasStart !== hasEnd) {
            rowErrors.push(issue(row, sheetRow, 'Fehler', 'window-pair', 'timeWindowStart', 'Termin von und Termin bis müssen gemeinsam befüllt sein.'));
        } else if (hasStart && (!windowStart.valid || !windowEnd.valid || windowStart.kind !== windowEnd.kind)) {
            rowErrors.push(issue(row, sheetRow, 'Fehler', 'invalid-window', 'timeWindowStart', 'Das Zeitfenster muss aus zwei Uhrzeiten oder zwei lokalen Zeitpunkten bestehen.'));
        } else if (hasStart && windowComparable(windowEnd) <= windowComparable(windowStart)) {
            rowErrors.push(issue(row, sheetRow, 'Fehler', 'window-order', 'timeWindowEnd', 'Termin bis muss nach Termin von liegen.'));
        }

        const sourceUrl = safeHttpUrl(mapped(row, mapping, 'sourceUrl'));
        if (!sourceUrl.valid) warnings.push(issue(row, sheetRow, 'Hinweis', 'invalid-url', 'sourceUrl', 'Der Quell-Link wurde verworfen; nur vollständige http(s)-Links sind erlaubt.'));
        const id = visitId(sourceSystem, workOrderId, operationId);
        if (seen.has(id)) rowErrors.push(issue(row, sheetRow, 'Fehler', 'duplicate', 'workOrderId', 'Quellsystem, Einsatz-ID und Vorgang-ID sind doppelt.'));
        if (rowErrors.length) {
            errors.push(...rowErrors);
            return;
        }
        seen.add(id);
        visits.push({
            id, sourceSystem, sourceKey: sourceSystem, workOrderId, operationId,
            customerNumber, contractSourceSystem, contractId, reason,
            dueDate: dueDate.value, slaDueAt: slaDueAt.value,
            timeWindowStart: windowStart.value, timeWindowEnd: windowEnd.value,
            durationMin: duration.value, priority: priority.value,
            requiredSkills: parseSkills(mapped(row, mapping, 'requiredSkills')),
            assignedTo: textValue(mapped(row, mapping, 'assignedTo')),
            status: status.value, dataAsOf: dataAsOf.value,
            siteId: textValue(mapped(row, mapping, 'siteId')),
            assetId: textValue(mapped(row, mapping, 'assetId')),
            sourceUrl: sourceUrl.value,
            note: textValue(mapped(row, mapping, 'note')),
            importedFrom: textValue(options.fileName)
        });
    });
    return { visits, errors, warnings, skipped: list.length - visits.length };
}

export function isOpenServiceVisit(visit) {
    return ['OFFEN', 'EINGEPLANT', 'IN_ARBEIT', 'BLOCKIERT'].includes(canonical(visit?.status));
}

export function isSchedulableServiceVisit(visit) {
    return ['OFFEN', 'EINGEPLANT', 'IN_ARBEIT'].includes(canonical(visit?.status));
}

function todayIso(today = new Date()) {
    const date = today instanceof Date ? today : new Date(today);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sundayIso(today = new Date()) {
    const date = today instanceof Date ? new Date(today) : new Date(today);
    if (Number.isNaN(date.getTime())) return '';
    const days = (7 - date.getDay()) % 7;
    date.setDate(date.getDate() + days);
    return todayIso(date);
}

/** Gehört ein planbarer Einsatz in den operativen Handlungszeitraum? */
export function serviceVisitWindow(visit, scope = 'week', today = new Date()) {
    if (!isSchedulableServiceVisit(visit)) return false;
    if (scope === 'all') return true;
    const due = parseDate(visit?.dueDate).value;
    const current = todayIso(today);
    if (!due || !current) return false;
    const now = due <= current || canonical(visit?.priority) === 'KRITISCH';
    if (scope === 'now') return now;
    return now || due <= sundayIso(today);
}

/** Exakt und eindeutig verknüpfte Kunden-IDs für Jetzt/Diese Woche. */
export function serviceVisitCustomerIds(visits, customers, scope = 'week', today = new Date()) {
    const byNumber = new Map();
    for (const customer of Array.isArray(customers) ? customers : []) {
        const number = normalizeCustomerNumber(customer?.nummer ?? customer?.customerNumber);
        if (!number) continue;
        if (!byNumber.has(number)) byNumber.set(number, []);
        byNumber.get(number).push(customer);
    }
    const ids = new Set();
    for (const visit of Array.isArray(visits) ? visits : []) {
        if (!serviceVisitWindow(visit, scope, today)) continue;
        const matches = byNumber.get(normalizeCustomerNumber(visit?.customerNumber)) || [];
        if (matches.length === 1 && matches[0]?.id) ids.add(matches[0].id);
    }
    return ids;
}

export function serviceVisitsForCustomer(visits, customer, { scope = 'all', today = new Date() } = {}) {
    const number = normalizeCustomerNumber(customer?.nummer ?? customer?.customerNumber);
    if (!number) return [];
    return (Array.isArray(visits) ? visits : [])
        .filter((visit) => normalizeCustomerNumber(visit?.customerNumber) === number)
        .filter((visit) => scope === 'open' ? isOpenServiceVisit(visit) : serviceVisitWindow(visit, scope, today));
}

function sourceKey(visit) {
    return canonical(visit?.sourceKey || visit?.sourceSystem);
}

function sourceMetaFor(metaBySource, source) {
    return Object.entries(metaBySource || {}).find(([key]) => canonical(key) === source)?.[1] || {};
}

export function serviceVisitReplacementRisks(existing, incoming, existingSources = {}, incomingSources = {}) {
    const oldList = Array.isArray(existing) ? existing : [];
    const groups = new Map();
    for (const visit of Array.isArray(incoming) ? incoming : []) {
        const source = sourceKey(visit);
        if (!source) continue;
        if (!groups.has(source)) groups.set(source, []);
        groups.get(source).push(visit);
    }
    const risks = [];
    for (const [source, items] of groups) {
        const existingCount = oldList.filter((visit) => sourceKey(visit) === source).length;
        if (existingCount > 0 && items.length < existingCount) {
            risks.push({ type: 'count-drop', sourceSystem: source, existingCount, incomingCount: items.length });
        }
        const existingDate = textValue(sourceMetaFor(existingSources, source)?.dataAsOf);
        const incomingDate = textValue(sourceMetaFor(incomingSources, source)?.dataAsOf)
            || items.map((visit) => textValue(visit?.dataAsOf)).filter(Boolean).sort()[0] || '';
        if (parseDate(existingDate).valid && parseDate(existingDate).value
            && parseDate(incomingDate).valid && parseDate(incomingDate).value
            && incomingDate < existingDate) {
            risks.push({ type: 'older-snapshot', sourceSystem: source, existingDate, incomingDate });
        }
    }
    return risks;
}


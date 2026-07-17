/**
 * Deterministische operative Serviceeinsätze für die integrierte TourFuchs-Demo.
 *
 * Vertragsfristen und echte Einsatzbedarfe bleiben bewusst getrennt: Ein
 * Demo-Einsatz wird ausschließlich aus einem planungsrelevanten Vertrag und
 * einer über die Kundennummer eindeutig verknüpften Kundenakte erzeugt.
 */

import { isDemoDataset } from '../core/demoSafety.js';
import {
    isPlanningRelevantServiceContract,
    normalizeCustomerNumber
} from './serviceContracts.js';

export const DEMO_SERVICE_VISIT_VERSION = 1;

const MAX_DEMO_VISITS = 20;
const FOCUS_DISTRICT_VISITS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

const IMMEDIATE_OFFSETS = [-3, -2, -1, 0, -1, 0];
const LATER_OFFSETS = [1, 4, 8, 15];

const VISIT_PROFILES = [
    { reason: 'Anlagenstillstand prüfen', durationMin: 60, priority: 'HOCH', skills: [], window: ['08:00', '18:00'] },
    { reason: 'Vorbeugende Wartung', durationMin: 60, priority: 'HOCH', skills: [], window: ['08:00', '18:00'] },
    { reason: 'Sicherheitsprüfung am Antrieb', durationMin: 60, priority: 'MITTEL', skills: [], window: ['08:00', '18:00'] },
    { reason: 'Störungsanalyse vor Ort', durationMin: 60, priority: 'HOCH', skills: [], window: ['08:00', '18:00'] },
    { reason: 'Firmware- und Diagnosecheck', durationMin: 60, priority: 'MITTEL', skills: [], window: ['08:00', '18:00'] },
    { reason: 'Verschleißkontrolle', durationMin: 60, priority: 'NIEDRIG', skills: [], window: ['08:00', '18:00'] },
    { reason: 'SLA-Störung priorisiert prüfen', durationMin: 75, priority: 'KRITISCH', skills: ['Automatisierung'], window: ['08:00', '17:00'] },
    { reason: 'Produktionskritische Diagnose', durationMin: 90, priority: 'KRITISCH', skills: ['Antriebstechnik'], window: ['09:00', '18:00'] },
    { reason: 'Wartungsintervall durchführen', durationMin: 60, priority: 'HOCH', skills: ['Mechanik'], window: ['08:00', '14:00'] },
    { reason: 'Schaltschrank-Thermografie', durationMin: 75, priority: 'MITTEL', skills: ['Elektrotechnik'], window: ['09:00', '16:00'] },
    { reason: 'Ersatzteilaufnahme', durationMin: 45, priority: 'MITTEL', skills: ['Mechanik'], window: ['08:00', '17:00'] },
    { reason: 'Remote-Befund vor Ort verifizieren', durationMin: 60, priority: 'HOCH', skills: ['Automatisierung'], window: ['10:00', '18:00'] },
    { reason: 'Sicherheitskreis validieren', durationMin: 90, priority: 'MITTEL', skills: ['Sicherheitstechnik'], window: ['08:00', '15:00'] },
    { reason: 'Condition-Monitoring-Sensorik prüfen', durationMin: 60, priority: 'NIEDRIG', skills: ['Antriebstechnik'], window: ['09:00', '17:00'] },
    { reason: 'Wartungsbericht nacharbeiten', durationMin: 45, priority: 'MITTEL', skills: ['Dokumentation'], window: ['08:00', '18:00'] },
    { reason: 'Backup und Wiederanlauf testen', durationMin: 75, priority: 'HOCH', skills: ['Automatisierung'], window: ['08:00', '16:00'] },
    { reason: 'Jahresinspektion vorbereiten', durationMin: 60, priority: 'NIEDRIG', skills: ['Mechanik'], window: ['08:00', '17:00'] },
    { reason: 'Energieeffizienz-Check', durationMin: 90, priority: 'MITTEL', skills: ['Antriebstechnik'], window: ['09:00', '18:00'] },
    { reason: 'Ersatzteilpaket abstimmen', durationMin: 45, priority: 'NIEDRIG', skills: ['Dokumentation'], window: ['08:00', '18:00'] },
    { reason: 'Regelmäßige Anlageninspektion', durationMin: 60, priority: 'MITTEL', skills: ['Elektrotechnik'], window: ['08:00', '17:00'] }
];

function text(value) {
    return String(value ?? '').normalize('NFKC').trim();
}

function comparable(value) {
    return text(value).toLocaleLowerCase('de-DE');
}

function compareParts(partsA, partsB) {
    for (let index = 0; index < Math.max(partsA.length, partsB.length); index++) {
        const comparison = comparable(partsA[index]).localeCompare(
            comparable(partsB[index]),
            'de',
            { numeric: true }
        );
        if (comparison) return comparison;
    }
    return 0;
}

function compareCustomers(a, b) {
    return compareParts(
        [normalizeCustomerNumber(a?.nummer ?? a?.customerNumber), a?.id, a?.bezirk, a?.plz, a?.name],
        [normalizeCustomerNumber(b?.nummer ?? b?.customerNumber), b?.id, b?.bezirk, b?.plz, b?.name]
    );
}

function compareContracts(a, b) {
    return compareParts(
        [
            normalizeCustomerNumber(a?.customerNumber),
            a?.sourceSystem ?? a?.sourceKey,
            a?.contractId ?? a?.contractKey,
            a?.id,
            a?.siteId,
            Array.isArray(a?.assetIds) ? a.assetIds.join('|') : a?.assetId
        ],
        [
            normalizeCustomerNumber(b?.customerNumber),
            b?.sourceSystem ?? b?.sourceKey,
            b?.contractId ?? b?.contractKey,
            b?.id,
            b?.siteId,
            Array.isArray(b?.assetIds) ? b.assetIds.join('|') : b?.assetId
        ]
    );
}

function isoDay(value = new Date()) {
    if (typeof value === 'string') {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const date = value instanceof Date ? value : new Date(value);
    const safe = Number.isNaN(date.getTime()) ? new Date() : date;
    const year = safe.getFullYear();
    const month = String(safe.getMonth() + 1).padStart(2, '0');
    const day = String(safe.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isoTimestamp(value = new Date()) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    return `${isoDay(value)}T12:00:00.000Z`;
}

function offsetDay(baseDay, days) {
    const [year, month, day] = baseDay.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day) + Number(days) * DAY_MS)
        .toISOString().slice(0, 10);
}

function daysUntilSunday(baseDay) {
    const [year, month, day] = baseDay.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return (7 - weekday) % 7;
}

function districtName(customer) {
    return text(customer?.bezirk) || text(customer?.gruppe) || 'Ohne Bezirk';
}

function eligibleContractCustomers(customers, contracts) {
    const customerGroups = new Map();
    for (const customer of (Array.isArray(customers) ? customers : []).slice().sort(compareCustomers)) {
        const number = normalizeCustomerNumber(customer?.nummer ?? customer?.customerNumber);
        if (!number) continue;
        if (!customerGroups.has(number)) customerGroups.set(number, []);
        customerGroups.get(number).push(customer);
    }

    const uniqueCustomers = new Map(
        [...customerGroups.entries()]
            .filter(([, matches]) => matches.length === 1)
            .map(([number, matches]) => [number, matches[0]])
    );
    const usedCustomerNumbers = new Set();
    const pairs = [];
    const relevantContracts = (Array.isArray(contracts) ? contracts : [])
        .filter(isPlanningRelevantServiceContract)
        .slice()
        .sort(compareContracts);

    for (const contract of relevantContracts) {
        const number = normalizeCustomerNumber(contract?.customerNumber);
        const contractId = text(contract?.contractId ?? contract?.contractKey);
        const customer = uniqueCustomers.get(number);
        if (!number || !contractId || !customer || usedCustomerNumbers.has(number)) continue;
        usedCustomerNumbers.add(number);
        pairs.push({ contract, customer, customerNumber: number, district: districtName(customer) });
    }
    return pairs;
}

function comparePairs(a, b) {
    return compareContracts(a.contract, b.contract) || compareCustomers(a.customer, b.customer);
}

/**
 * Sechs Einsätze werden in den am stärksten vertretenen Bezirk gelegt. Die
 * übrigen Plätze gehen im Round-Robin an andere Bezirke, bevor derselbe Bezirk
 * erneut gewählt wird. So entsteht ein guter Tages-Cluster und zugleich eine
 * deutschlandweit sichtbare Service-Demo.
 */
function selectVisitPairs(pairs) {
    const targetCount = Math.min(MAX_DEMO_VISITS, pairs.length);
    if (!targetCount) return [];

    const groups = new Map();
    for (const pair of pairs) {
        if (!groups.has(pair.district)) groups.set(pair.district, []);
        groups.get(pair.district).push(pair);
    }
    for (const members of groups.values()) members.sort(comparePairs);

    const rankedGroups = [...groups.entries()].sort(([districtA, membersA], [districtB, membersB]) => (
        membersB.length - membersA.length || districtA.localeCompare(districtB, 'de')
    ));
    const [focusDistrict, focusMembers] = rankedGroups[0];
    const selected = focusMembers.slice(0, Math.min(FOCUS_DISTRICT_VISITS, targetCount));
    const selectedNumbers = new Set(selected.map((pair) => pair.customerNumber));

    const otherGroups = [...groups.entries()]
        .filter(([district]) => district !== focusDistrict)
        .sort(([districtA], [districtB]) => districtA.localeCompare(districtB, 'de'));
    const queues = [...otherGroups, [focusDistrict, focusMembers]].map(([district, members]) => ({
        district,
        members: members.filter((pair) => !selectedNumbers.has(pair.customerNumber)),
        index: 0
    }));

    while (selected.length < targetCount) {
        let progressed = false;
        for (const queue of queues) {
            if (selected.length >= targetCount) break;
            while (queue.index < queue.members.length) {
                const pair = queue.members[queue.index++];
                if (selectedNumbers.has(pair.customerNumber)) continue;
                selected.push(pair);
                selectedNumbers.add(pair.customerNumber);
                progressed = true;
                break;
            }
        }
        if (!progressed) break;
    }
    return selected;
}

function visitDueOffset(index, remainingWeekDays) {
    if (index < IMMEDIATE_OFFSETS.length) return IMMEDIATE_OFFSETS[index];
    if (index < 16) {
        const availableDays = Math.max(1, remainingWeekDays);
        return 1 + ((index - IMMEDIATE_OFFSETS.length) % availableDays);
    }
    return remainingWeekDays + LATER_OFFSETS[index - 16];
}

function firstAssetId(contract, customerNumber) {
    if (text(contract?.assetId)) return text(contract.assetId);
    const assets = Array.isArray(contract?.assetIds) ? contract.assetIds.map(text).filter(Boolean) : [];
    return assets[0] || `DEMO-ASSET-${customerNumber}-01`;
}

/**
 * Erzeugt höchstens 20 getrennte Demo-Einsatzaufträge. Beim echten integrierten
 * Demo-Bestand sind es exakt 20: 8 für "Jetzt", 8 weitere bis Sonntag und
 * 4 spätere Einsätze.
 */
export function createDemoServiceVisits(customers, contracts, now = new Date()) {
    const baseDay = isoDay(now);
    const remainingWeekDays = daysUntilSunday(baseDay);
    const selected = selectVisitPairs(eligibleContractCustomers(customers, contracts));

    return selected.map(({ contract, customerNumber }, index) => {
        const profile = VISIT_PROFILES[index % VISIT_PROFILES.length];
        const workOrderId = `DEMO-WO-${String(index + 1).padStart(4, '0')}`;
        const dueDate = offsetDay(baseDay, visitDueOffset(index, remainingWeekDays));
        const slaDueAt = index < 8 ? `${dueDate}T16:00:00.000Z` : '';
        return {
            id: `sv:DEMO:${encodeURIComponent(workOrderId)}:`,
            sourceSystem: 'DEMO',
            sourceKey: 'DEMO',
            workOrderId,
            operationId: '',
            customerNumber,
            contractSourceSystem: text(contract?.sourceSystem ?? contract?.sourceKey).toLocaleUpperCase('de-DE'),
            contractId: text(contract?.contractId ?? contract?.contractKey),
            reason: profile.reason,
            dueDate,
            slaDueAt,
            timeWindowStart: profile.window[0],
            timeWindowEnd: profile.window[1],
            durationMin: profile.durationMin,
            priority: profile.priority,
            requiredSkills: [...profile.skills],
            assignedTo: index < FOCUS_DISTRICT_VISITS ? 'Demo Service-Team Tagesroute' : `Demo Service-Team ${1 + (index % 4)}`,
            status: 'OFFEN',
            siteId: text(contract?.siteId) || `DEMO-SITE-${customerNumber}`,
            assetId: firstAssetId(contract, customerNumber),
            sourceUrl: `https://example.com/tourfuchs/serviceeinsatz/${encodeURIComponent(workOrderId)}`,
            note: 'Fiktiver Demo-Einsatz · keine Echtdaten',
            dataAsOf: baseDay
        };
    });
}

/** Metadaten für den integrierten, operativ bewusst frischen Demo-Abzug. */
export function createDemoServiceVisitSourceMeta(visits, referenceDate = new Date()) {
    return {
        fileName: 'Demo-Serviceeinsätze · 20 Einsatzaufträge',
        importedAt: isoTimestamp(referenceDate),
        dataAsOf: isoDay(referenceDate),
        count: Array.isArray(visits) ? visits.length : 0,
        warnings: 0,
        unmatched: 0,
        demoVersion: DEMO_SERVICE_VISIT_VERSION
    };
}

function sourceName(value) {
    return text(value).toLocaleUpperCase('de-DE');
}

function demoSourceMeta(sources) {
    return Object.entries(sources || {}).find(([source]) => sourceName(source) === 'DEMO')?.[1] || null;
}

/**
 * Einmalige, idempotente Migration alter integrierter Demo-Snapshots.
 * Ausschließlich die Quelle DEMO wird ersetzt; reale Einsatzquellen bleiben
 * mit ihren Objektidentitäten und Metadaten erhalten.
 */
export function upgradeDemoServiceVisits(dataset, referenceDate = new Date()) {
    const existingVisits = Array.isArray(dataset?.serviceVisits) ? dataset.serviceVisits : [];
    const existingSources = dataset?.serviceVisitSources && typeof dataset.serviceVisitSources === 'object'
        ? dataset.serviceVisitSources
        : {};
    const unchanged = {
        changed: false,
        serviceVisits: existingVisits,
        serviceVisitSources: existingSources
    };

    if (dataset?.fileName !== 'Demo-Daten' || !isDemoDataset(dataset?.customers)) return unchanged;
    const currentMeta = demoSourceMeta(existingSources);
    if (Number(currentMeta?.demoVersion || 0) >= DEMO_SERVICE_VISIT_VERSION) return unchanged;

    const generated = createDemoServiceVisits(dataset.customers, dataset?.serviceContracts, referenceDate);
    const preservedVisits = existingVisits.filter((visit) => (
        sourceName(visit?.sourceSystem || visit?.sourceKey) !== 'DEMO'
    ));
    const preservedSources = Object.fromEntries(
        Object.entries(existingSources).filter(([source]) => sourceName(source) !== 'DEMO')
    );

    return {
        changed: true,
        serviceVisits: [...preservedVisits, ...generated],
        serviceVisitSources: {
            ...preservedSources,
            DEMO: createDemoServiceVisitSourceMeta(generated, referenceDate)
        }
    };
}

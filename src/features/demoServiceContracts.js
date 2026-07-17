/**
 * Deterministische Servicevertrags-Daten fuer die integrierte TourFuchs-Demo.
 *
 * Die Auswahl ist bewusst nach Vertriebsbezirk geschichtet. Dadurch liegen die
 * Vertragskunden nicht nur am Anfang der Kundenliste, sondern bilden auch in
 * der Service-Kartenansicht ein deutschlandweit nutzbares Tourplanungsbild.
 */

import { isDemoDataset } from '../core/demoSafety.js';

export const DEMO_SERVICE_CONTRACT_VERSION = 2;

const DEMO_SERVICE_SHARE = 0.05;
const DAY_MS = 24 * 60 * 60 * 1000;

// Pro 20 Vertraegen: 1 ueberfaellig, 3 bis 30 Tage, 6 bis 90 Tage,
// 6 bis 180 Tage und 4 spaeter. Bei 113 Vertraegen entstehen damit die
// stabilen Radar-Buckets 6 / 18 / 36 / 33 / 20.
const ACTION_OFFSETS = [
    -14,
    7, 18, 28,
    38, 48, 58, 68, 78, 88,
    105, 115, 125, 135, 145, 155,
    210, 240, 270, 330
];

const CONTRACT_PROFILES = [
    {
        type: 'Full Service',
        baseValue: 185000,
        scope: '24/7-Bereitschaft, vorbeugende Wartung und Ersatzteile',
        response: 2,
        resolution: 8,
        timeBasis: '24/7',
        maintenance: 3,
        criticality: 'HOCH'
    },
    {
        type: 'Vorbeugende Wartung',
        baseValue: 42000,
        scope: 'Regelmäßige Inspektion und vorbeugende Wartung',
        response: 8,
        resolution: 40,
        timeBasis: 'Werktage 8-17 Uhr',
        maintenance: 6,
        criticality: 'MITTEL'
    },
    {
        type: 'Remote Support',
        baseValue: 28000,
        scope: 'Remote Diagnose, Hotline und Software-Unterstützung',
        response: 4,
        resolution: 16,
        timeBasis: 'Werktage 7-19 Uhr',
        maintenance: 12,
        criticality: 'NIEDRIG'
    },
    {
        type: 'Bereitschaft',
        baseValue: 76000,
        scope: 'Technische Rufbereitschaft und priorisierte Entstörung',
        response: 2,
        resolution: 12,
        timeBasis: '24/7',
        maintenance: 6,
        criticality: 'HOCH'
    },
    {
        type: 'Ersatzteil-Service',
        baseValue: 64000,
        scope: 'Definierte Ersatzteilpakete und Expressbereitstellung',
        response: 8,
        resolution: 24,
        timeBasis: 'Werktage 8-17 Uhr',
        maintenance: 12,
        criticality: 'MITTEL'
    },
    {
        type: 'Premium Service',
        baseValue: 128000,
        scope: 'Inspektion, Ersatzteile, Remote Support und Vor-Ort-Service',
        response: 4,
        resolution: 12,
        timeBasis: '24/7',
        maintenance: 3,
        criticality: 'MITTEL'
    }
];

const MANAGERS_BY_GROUP = {
    Nord: [
        { id: 'DEMO-CM-N-01', name: 'Anna Beispiel', email: 'anna.beispiel@example.com' },
        { id: 'DEMO-CM-N-02', name: 'Ben Beispiel', email: 'ben.beispiel@example.com' }
    ],
    Ost: [
        { id: 'DEMO-CM-O-01', name: 'Carla Beispiel', email: 'carla.beispiel@example.com' },
        { id: 'DEMO-CM-O-02', name: 'David Beispiel', email: 'david.beispiel@example.com' }
    ],
    'Süd': [
        { id: 'DEMO-CM-S-01', name: 'Eva Beispiel', email: 'eva.beispiel@example.com' },
        { id: 'DEMO-CM-S-02', name: 'Felix Beispiel', email: 'felix.beispiel@example.com' }
    ]
};

const ALL_MANAGERS = Object.values(MANAGERS_BY_GROUP).flat();

function text(value) {
    return String(value ?? '').normalize('NFKC').trim();
}

function comparable(value) {
    return text(value).toLocaleLowerCase('de-DE');
}

function customerNumber(customer) {
    return text(customer?.nummer ?? customer?.customerNumber);
}

function compareCustomers(a, b) {
    const partsA = [customerNumber(a), a?.id, a?.bezirk, a?.plz, a?.name].map(comparable);
    const partsB = [customerNumber(b), b?.id, b?.bezirk, b?.plz, b?.name].map(comparable);
    for (let index = 0; index < partsA.length; index++) {
        const comparison = partsA[index].localeCompare(partsB[index], 'de', { numeric: true });
        if (comparison) return comparison;
    }
    return 0;
}

function uniqueEligibleCustomers(customers) {
    const sorted = (Array.isArray(customers) ? customers : [])
        .filter((customer) => customerNumber(customer))
        .slice()
        .sort(compareCustomers);
    const seen = new Set();
    return sorted.filter((customer) => {
        const number = comparable(customerNumber(customer));
        if (seen.has(number)) return false;
        seen.add(number);
        return true;
    });
}

function districtName(customer) {
    return text(customer?.bezirk) || text(customer?.gruppe) || 'Ohne Bezirk';
}

/** Exakte, proportional geschichtete Zielmenge mit Largest-Remainder-Quoten. */
function selectContractCustomers(customers) {
    const eligible = uniqueEligibleCustomers(customers);
    if (!eligible.length) return [];

    const targetCount = Math.min(
        eligible.length,
        Math.max(1, Math.round(eligible.length * DEMO_SERVICE_SHARE))
    );
    const grouped = new Map();
    for (const customer of eligible) {
        const district = districtName(customer);
        if (!grouped.has(district)) grouped.set(district, []);
        grouped.get(district).push(customer);
    }

    const allocations = [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'de'))
        .map(([district, members]) => {
            const ideal = targetCount * members.length / eligible.length;
            return {
                district,
                members: members.slice().sort(compareCustomers),
                count: Math.floor(ideal),
                remainder: ideal - Math.floor(ideal)
            };
        });

    let remaining = targetCount - allocations.reduce((sum, entry) => sum + entry.count, 0);
    const priority = allocations.slice().sort((a, b) => (
        b.remainder - a.remainder || a.district.localeCompare(b.district, 'de')
    ));
    while (remaining > 0) {
        let distributed = false;
        for (const entry of priority) {
            if (remaining === 0) break;
            if (entry.count >= entry.members.length) continue;
            entry.count++;
            remaining--;
            distributed = true;
        }
        if (!distributed) break;
    }

    const selected = allocations.flatMap(({ members, count }) => {
        if (!count) return [];
        return Array.from({ length: count }, (_, index) => {
            const position = Math.min(
                members.length - 1,
                Math.floor((index + 0.5) * members.length / count)
            );
            return members[position];
        });
    });
    return selected.sort(compareCustomers);
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
    const day = isoDay(value);
    return `${day}T12:00:00.000Z`;
}

function offsetDay(baseDay, days) {
    const [year, month, day] = baseDay.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day) + Number(days) * DAY_MS)
        .toISOString().slice(0, 10);
}

function managerFor(customer, index) {
    const group = comparable(customer?.gruppe);
    const pool = group === 'nord'
        ? MANAGERS_BY_GROUP.Nord
        : group === 'ost'
            ? MANAGERS_BY_GROUP.Ost
            : group === 'süd' || group === 'sued' || group === 'sud'
                ? MANAGERS_BY_GROUP['Süd']
                : ALL_MANAGERS;
    return pool[index % pool.length];
}

/**
 * Erzeugt fuer exakt rund fuenf Prozent der Demo-Kunden je einen Vertrag.
 * `today` ist injizierbar, damit Fristen und Tests reproduzierbar bleiben.
 */
export function createDemoServiceContracts(customers, today = new Date()) {
    const baseDay = isoDay(today);
    return selectContractCustomers(customers).map((customer, index) => {
        const profile = CONTRACT_PROFILES[index % CONTRACT_PROFILES.length];
        const manager = managerFor(customer, index);
        const actionOffset = ACTION_OFFSETS[index % ACTION_OFFSETS.length];
        const noticeDays = [30, 60, 90][index % 3];
        const autoRenewal = index % 5 !== 4;
        const number = customerNumber(customer);
        const contractId = `DEMO-SC-${String(index + 1).padStart(4, '0')}`;
        const actionBy = offsetDay(baseDay, actionOffset);
        const annualValue = profile.baseValue + (index % 5) * 2500;
        const status = actionOffset <= 90 && index % 4 === 0
            ? 'IN_VERLAENGERUNG'
            : 'AKTIV';

        return {
            id: `sc:DEMO:${contractId}`,
            key: `DEMO::${contractId}`,
            sourceSystem: 'DEMO',
            sourceKey: 'DEMO',
            contractId,
            contractKey: contractId,
            sourceCustomerId: number,
            customerNumber: number,
            status,
            dataAsOf: baseDay,
            unlimited: false,
            autoRenewal,
            startDate: offsetDay(baseDay, -365 * (1 + index % 3)),
            endDate: offsetDay(baseDay, actionOffset + noticeDays),
            cancellationDeadline: actionBy,
            actionBy,
            renewalMonths: autoRenewal ? [12, 12, 24][index % 3] : null,
            noticeDays,
            title: `${profile.type} · ${customer?.name || 'Demokunde'}`,
            type: profile.type,
            annualValue,
            currency: 'EUR',
            owner: `Service Region ${text(customer?.gruppe) || 'Deutschland'}`,
            managerId: manager.id,
            manager: manager.name,
            managerEmail: manager.email,
            scope: profile.scope,
            sla: `${profile.response} Std. Reaktion / ${profile.resolution} Std. Lösung`,
            slaResponseHours: profile.response,
            slaResolutionHours: profile.resolution,
            slaTimeBasis: profile.timeBasis,
            maintenanceIntervalMonths: profile.maintenance,
            criticality: profile.criticality,
            siteId: `DEMO-SITE-${number}`,
            assetIds: [`DEMO-ASSET-${number}-01`],
            sourceUrl: '',
            note: 'Fiktiver Demo-Vertrag · keine Echtdaten'
        };
    });
}

/** Metadaten fuer einen frisch erzeugten oder einmalig migrierten Demo-Abzug. */
export function createDemoServiceContractSourceMeta(contracts, referenceDate = new Date()) {
    return {
        fileName: 'Demo-Serviceverträge · 5-Prozent-Stichprobe',
        importedAt: isoTimestamp(referenceDate),
        dataAsOf: isoDay(referenceDate),
        count: Array.isArray(contracts) ? contracts.length : 0,
        warnings: 0,
        unmatched: 0,
        demoVersion: DEMO_SERVICE_CONTRACT_VERSION
    };
}

function sourceName(value) {
    return text(value).toLocaleUpperCase('de-DE');
}

function demoSourceMeta(sources) {
    return Object.entries(sources || {}).find(([source]) => sourceName(source) === 'DEMO')?.[1] || null;
}

/**
 * Sichere, reine Upgrade-Hilfe fuer lokal persistierte integrierte Demodaten.
 *
 * - arbeitet nur bei dem internen Datensatznamen und ausschliesslich mit echten
 *   TourFuchs-Demokunden,
 * - ersetzt nur die Quelle DEMO und bewahrt alle anderen Vertragsquellen,
 * - bleibt ab Version 2 idempotent; Fristen wandern daher nicht bei jedem Start.
 */
export function upgradeDemoServiceContracts(dataset, referenceDate = new Date()) {
    const existingContracts = Array.isArray(dataset?.serviceContracts) ? dataset.serviceContracts : [];
    const existingSources = dataset?.serviceContractSources && typeof dataset.serviceContractSources === 'object'
        ? dataset.serviceContractSources
        : {};
    const unchanged = {
        changed: false,
        serviceContracts: existingContracts,
        serviceContractSources: existingSources
    };

    if (dataset?.fileName !== 'Demo-Daten' || !isDemoDataset(dataset?.customers)) return unchanged;
    const currentMeta = demoSourceMeta(existingSources);
    if (Number(currentMeta?.demoVersion || 0) >= DEMO_SERVICE_CONTRACT_VERSION) return unchanged;

    const generated = createDemoServiceContracts(dataset.customers, referenceDate);
    const preservedContracts = existingContracts.filter((contract) => (
        sourceName(contract?.sourceSystem || contract?.sourceKey) !== 'DEMO'
    ));
    const preservedSources = Object.fromEntries(
        Object.entries(existingSources).filter(([source]) => sourceName(source) !== 'DEMO')
    );

    return {
        changed: true,
        serviceContracts: [...preservedContracts, ...generated],
        serviceContractSources: {
            ...preservedSources,
            DEMO: createDemoServiceContractSourceMeta(generated, referenceDate)
        }
    };
}

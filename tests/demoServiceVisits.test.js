import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDemoCustomers } from '../src/services/excel.js';
import { createDemoServiceContracts } from '../src/features/demoServiceContracts.js';
import {
    DEMO_SERVICE_VISIT_VERSION,
    createDemoServiceVisits,
    createDemoServiceVisitSourceMeta,
    upgradeDemoServiceVisits
} from '../src/features/demoServiceVisits.js';
import {
    isPlanningRelevantServiceContract,
    normalizeCustomerNumber
} from '../src/features/serviceContracts.js';
import { serviceVisitCustomerIds, serviceVisitWindow } from '../src/features/serviceVisits.js';

const placeData = JSON.parse(readFileSync(resolve(process.cwd(), 'public/geodata/plz-places.json'), 'utf8'));
const centroids = JSON.parse(readFileSync(resolve(process.cwd(), 'public/geodata/plz-centroids.json'), 'utf8'));
const customers = createDemoCustomers(centroids, placeData.places);
const referenceDay = '2026-07-17';
const contracts = createDemoServiceContracts(customers, referenceDay);

function customerMatches(customerNumber, source = customers) {
    const normalized = normalizeCustomerNumber(customerNumber);
    return source.filter((customer) => (
        normalizeCustomerNumber(customer?.nummer ?? customer?.customerNumber) === normalized
    ));
}

function contractMatches(visit, source = contracts) {
    return source.filter((contract) => (
        isPlanningRelevantServiceContract(contract)
        && normalizeCustomerNumber(contract?.customerNumber) === normalizeCustomerNumber(visit?.customerNumber)
        && String(contract?.contractId ?? contract?.contractKey ?? '').trim() === visit?.contractId
    ));
}

describe('Demo-Serviceeinsätze', () => {
    it('erzeugt exakt 20 getrennte, vollständig nutzbare Aufträge mit eindeutigen Vertrags- und Kundenlinks', () => {
        const visits = createDemoServiceVisits(customers, contracts, referenceDay);

        expect(visits).toHaveLength(20);
        expect(new Set(visits.map((visit) => visit.id)).size).toBe(20);
        expect(new Set(visits.map((visit) => visit.workOrderId)).size).toBe(20);
        expect(new Set(visits.map((visit) => visit.customerNumber)).size).toBe(20);
        expect(serviceVisitCustomerIds(visits, customers, 'all', referenceDay).size).toBe(20);

        for (const visit of visits) {
            expect(visit).toMatchObject({
                sourceSystem: 'DEMO',
                sourceKey: 'DEMO',
                status: 'OFFEN',
                dataAsOf: referenceDay,
                note: 'Fiktiver Demo-Einsatz · keine Echtdaten'
            });
            expect(visit.id).toBe(`sv:DEMO:${encodeURIComponent(visit.workOrderId)}:`);
            expect(visit.reason).not.toBe('');
            expect(visit.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(visit.timeWindowStart).toMatch(/^\d{2}:\d{2}$/);
            expect(visit.timeWindowEnd).toMatch(/^\d{2}:\d{2}$/);
            expect(visit.durationMin).toBeGreaterThanOrEqual(10);
            expect(['KRITISCH', 'HOCH', 'MITTEL', 'NIEDRIG']).toContain(visit.priority);
            expect(Array.isArray(visit.requiredSkills)).toBe(true);
            expect(visit.assignedTo).not.toBe('');
            expect(visit.siteId).not.toBe('');
            expect(visit.assetId).not.toBe('');
            expect(new URL(visit.sourceUrl).hostname).toBe('example.com');
            expect(customerMatches(visit.customerNumber)).toHaveLength(1);
            expect(contractMatches(visit)).toHaveLength(1);
        }
    });

    it('liefert am Referenz-Freitag stabil 8 Jetzt-, 8 weitere Wochen- und 4 spätere Aufträge', () => {
        const visits = createDemoServiceVisits(customers, contracts, referenceDay);
        const nowVisits = visits.filter((visit) => serviceVisitWindow(visit, 'now', referenceDay));
        const weekVisits = visits.filter((visit) => serviceVisitWindow(visit, 'week', referenceDay));

        expect(nowVisits).toHaveLength(8);
        expect(weekVisits).toHaveLength(16);
        expect(weekVisits.filter((visit) => !nowVisits.includes(visit))).toHaveLength(8);
        expect(visits.filter((visit) => !weekVisits.includes(visit))).toHaveLength(4);
        expect(nowVisits.filter((visit) => visit.priority === 'KRITISCH')).toHaveLength(2);
        expect(nowVisits.filter((visit) => visit.dueDate <= referenceDay)).toHaveLength(6);
    });

    it('baut einen sofort planbaren 6er-Cluster im stärksten Bezirk und deckt zugleich alle Bezirke ab', () => {
        const visits = createDemoServiceVisits(customers, contracts, referenceDay);
        const customerByNumber = new Map(customers.map((customer) => [
            normalizeCustomerNumber(customer.nummer),
            customer
        ]));
        const byDistrict = new Map();
        for (const visit of visits) {
            const district = customerByNumber.get(visit.customerNumber)?.bezirk;
            if (!byDistrict.has(district)) byDistrict.set(district, []);
            byDistrict.get(district).push(visit);
        }
        const districtGroups = [...byDistrict.values()].sort((a, b) => b.length - a.length);
        const focus = districtGroups[0];

        expect(byDistrict.size).toBe(15);
        expect(focus).toHaveLength(6);
        expect(districtGroups.slice(1).every((group) => group.length === 1)).toBe(true);
        expect(focus.every((visit) => serviceVisitWindow(visit, 'now', referenceDay))).toBe(true);
        expect(focus.every((visit) => visit.requiredSkills.length === 0)).toBe(true);
        expect(focus.reduce((sum, visit) => sum + visit.durationMin, 0)).toBe(360);
    });

    it('ist von Kunden- und Vertragsreihenfolge unabhängig', () => {
        const normal = createDemoServiceVisits(customers, contracts, referenceDay);
        const reversed = createDemoServiceVisits(
            [...customers].reverse(),
            [...contracts].reverse(),
            referenceDay
        );

        expect(reversed).toEqual(normal);
    });

    it('ignoriert nicht planungsrelevante Verträge und mehrdeutige Kundennummern vollständig', () => {
        const baseline = createDemoServiceVisits(customers, contracts, referenceDay);
        const excluded = baseline[0];
        const inactiveContracts = contracts.map((contract) => (
            contract.contractId === excluded.contractId
                ? { ...contract, status: 'ABGELAUFEN' }
                : contract
        ));
        const inactiveResult = createDemoServiceVisits(customers, inactiveContracts, referenceDay);
        expect(inactiveResult.some((visit) => visit.contractId === excluded.contractId)).toBe(false);

        const originalCustomer = customerMatches(excluded.customerNumber)[0];
        const ambiguousCustomers = [
            ...customers,
            { ...originalCustomer, id: `${originalCustomer.id}-doppelt` }
        ];
        const ambiguousResult = createDemoServiceVisits(ambiguousCustomers, contracts, referenceDay);
        expect(ambiguousResult.some((visit) => visit.customerNumber === excluded.customerNumber)).toBe(false);
    });

    it('erstellt nachvollziehbare Quellenmetadaten', () => {
        const visits = createDemoServiceVisits(customers, contracts, referenceDay);
        expect(createDemoServiceVisitSourceMeta(visits, referenceDay)).toEqual({
            fileName: 'Demo-Serviceeinsätze · 20 Einsatzaufträge',
            importedAt: '2026-07-17T12:00:00.000Z',
            dataAsOf: referenceDay,
            count: 20,
            warnings: 0,
            unmatched: 0,
            demoVersion: DEMO_SERVICE_VISIT_VERSION
        });
    });

    it('migriert alte Demo-Einsätze genau einmal und bewahrt jede Nicht-DEMO-Quelle', () => {
        const oldDemo = { id: 'sv:demo:ALT:', sourceKey: 'demo', workOrderId: 'ALT' };
        const sap = { id: 'sv:SAP:4711:', sourceSystem: 'SAP', workOrderId: '4711' };
        const sapMeta = { fileName: 'sap-einsaetze.xlsx', count: 1, dataAsOf: '2026-07-16' };
        const upgraded = upgradeDemoServiceVisits({
            fileName: 'Demo-Daten',
            customers,
            serviceContracts: contracts,
            serviceVisits: [sap, oldDemo],
            serviceVisitSources: {
                SAP: sapMeta,
                demo: { fileName: 'alte-demo.csv', count: 1 }
            }
        }, referenceDay);

        expect(upgraded.changed).toBe(true);
        expect(upgraded.serviceVisits.filter((visit) => visit.sourceSystem === 'DEMO')).toHaveLength(20);
        expect(upgraded.serviceVisits).toContain(sap);
        expect(upgraded.serviceVisits).not.toContain(oldDemo);
        expect(upgraded.serviceVisitSources.SAP).toBe(sapMeta);
        expect(upgraded.serviceVisitSources.DEMO).toMatchObject({
            count: 20,
            dataAsOf: referenceDay,
            unmatched: 0,
            demoVersion: DEMO_SERVICE_VISIT_VERSION
        });

        const secondRun = upgradeDemoServiceVisits({
            fileName: 'Demo-Daten',
            customers,
            serviceContracts: contracts,
            serviceVisits: upgraded.serviceVisits,
            serviceVisitSources: upgraded.serviceVisitSources
        }, '2027-01-01');
        expect(secondRun.changed).toBe(false);
        expect(secondRun.serviceVisits).toBe(upgraded.serviceVisits);
        expect(secondRun.serviceVisitSources).toBe(upgraded.serviceVisitSources);
        expect(secondRun.serviceVisits.find((visit) => visit.sourceSystem === 'DEMO')?.dataAsOf)
            .toBe(referenceDay);
    });

    it('fasst reale Datensätze und bereits aktuelle Demo-Metadaten niemals an', () => {
        const visits = createDemoServiceVisits(customers, contracts, referenceDay);
        const sources = { demo: createDemoServiceVisitSourceMeta(visits, referenceDay) };
        const current = upgradeDemoServiceVisits({
            fileName: 'Demo-Daten',
            customers,
            serviceContracts: contracts,
            serviceVisits: visits,
            serviceVisitSources: sources
        }, '2027-01-01');
        const real = upgradeDemoServiceVisits({
            fileName: 'service-export.xlsx',
            customers,
            serviceContracts: contracts,
            serviceVisits: visits,
            serviceVisitSources: sources
        }, '2027-01-01');

        expect(current.changed).toBe(false);
        expect(current.serviceVisits).toBe(visits);
        expect(current.serviceVisitSources).toBe(sources);
        expect(real.changed).toBe(false);
        expect(real.serviceVisits).toBe(visits);
        expect(real.serviceVisitSources).toBe(sources);
    });
});

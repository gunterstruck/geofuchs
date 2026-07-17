import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDemoCustomers } from '../src/services/excel.js';
import {
    DEMO_SERVICE_CONTRACT_VERSION,
    createDemoServiceContracts,
    createDemoServiceContractSourceMeta,
    upgradeDemoServiceContracts
} from '../src/features/demoServiceContracts.js';
import { linkServiceContracts, summarizeServiceContracts } from '../src/features/serviceContracts.js';

const placeData = JSON.parse(readFileSync(resolve(process.cwd(), 'public/geodata/plz-places.json'), 'utf8'));
const centroids = JSON.parse(readFileSync(resolve(process.cwd(), 'public/geodata/plz-centroids.json'), 'utf8'));
const customers = createDemoCustomers(centroids, placeData.places);
const referenceDay = '2026-07-17';

describe('Demo-Servicevertraege', () => {
    it('ordnet exakt rund fuenf Prozent der 2.250 Kunden eindeutig einem Vertrag zu', () => {
        const contracts = createDemoServiceContracts(customers, referenceDay);
        const links = linkServiceContracts(contracts, customers);

        expect(contracts).toHaveLength(113);
        expect(new Set(contracts.map((contract) => contract.customerNumber)).size).toBe(113);
        expect(new Set(contracts.map((contract) => contract.id)).size).toBe(113);
        expect(links.matched).toHaveLength(113);
        expect(links.unmatched).toEqual([]);
        expect(links.ambiguous).toEqual([]);
    });

    it('verteilt die Vertragskunden ueber alle 15 Bezirke mit je sieben bis acht Kunden', () => {
        const contracts = createDemoServiceContracts(customers, referenceDay);
        const customerByNumber = new Map(customers.map((customer) => [customer.nummer, customer]));
        const counts = new Map();
        for (const contract of contracts) {
            const district = customerByNumber.get(contract.customerNumber)?.bezirk;
            counts.set(district, (counts.get(district) || 0) + 1);
        }

        expect(counts.size).toBe(15);
        expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBe(113);
        expect(Math.min(...counts.values())).toBe(7);
        expect(Math.max(...counts.values())).toBe(8);
    });

    it('bleibt bei anderer Eingabereihenfolge und festem Referenzdatum identisch', () => {
        const normal = createDemoServiceContracts(customers, referenceDay);
        const reversed = createDemoServiceContracts([...customers].reverse(), referenceDay);

        expect(reversed).toEqual(normal);
    });

    it('liefert stabile, praxisnahe Frist-Buckets und vielfaeltige Vertragsmerkmale', () => {
        const contracts = createDemoServiceContracts(customers, referenceDay);
        const summary = summarizeServiceContracts(contracts, customers, referenceDay);

        expect(summary.urgency).toEqual({
            0: 6,
            30: 18,
            90: 36,
            180: 33,
            later: 20,
            missing: 0
        });
        expect(new Set(contracts.map((contract) => contract.status))).toEqual(
            new Set(['AKTIV', 'IN_VERLAENGERUNG'])
        );
        expect(new Set(contracts.map((contract) => contract.type)).size).toBe(6);
        expect(new Set(contracts.map((contract) => contract.manager)).size).toBe(6);
        expect(new Set(contracts.map((contract) => contract.criticality))).toEqual(
            new Set(['HOCH', 'MITTEL', 'NIEDRIG'])
        );
        expect(contracts.every((contract) => contract.annualValue > 0)).toBe(true);
        expect(contracts.every((contract) => contract.slaResponseHours > 0)).toBe(true);
        expect(contracts.every((contract) => contract.slaResolutionHours > contract.slaResponseHours)).toBe(true);
        expect(contracts.every((contract) => contract.dataAsOf === referenceDay)).toBe(true);
    });

    it('migriert alte integrierte Demodaten einmalig und bewahrt fremde Quellen', () => {
        // Auch sehr alte Snapshots konnten nur `sourceKey` statt `sourceSystem`
        // enthalten; sie duerfen nicht neben den neuen Demo-Vertraegen bleiben.
        const oldDemo = [{ sourceKey: 'demo', contractId: 'ALT', customerNumber: customers[0].nummer }];
        const sap = { sourceSystem: 'SAP', contractId: 'SAP-1', customerNumber: customers[10].nummer };
        const upgraded = upgradeDemoServiceContracts({
            fileName: 'Demo-Daten',
            customers,
            serviceContracts: [sap, ...oldDemo],
            serviceContractSources: {
                SAP: { fileName: 'sap.xlsx', count: 1 },
                DEMO: { fileName: 'alte-demo.xlsx', count: 1 }
            }
        }, referenceDay);

        expect(upgraded.changed).toBe(true);
        expect(upgraded.serviceContracts.filter((contract) => contract.sourceSystem === 'DEMO')).toHaveLength(113);
        expect(upgraded.serviceContracts).toContain(sap);
        expect(upgraded.serviceContractSources.SAP).toEqual({ fileName: 'sap.xlsx', count: 1 });
        expect(upgraded.serviceContractSources.DEMO).toMatchObject({
            count: 113,
            demoVersion: DEMO_SERVICE_CONTRACT_VERSION,
            dataAsOf: referenceDay,
            unmatched: 0
        });

        const secondRun = upgradeDemoServiceContracts({
            fileName: 'Demo-Daten',
            customers,
            serviceContracts: upgraded.serviceContracts,
            serviceContractSources: upgraded.serviceContractSources
        }, '2027-01-01');
        expect(secondRun.changed).toBe(false);
        expect(secondRun.serviceContracts).toBe(upgraded.serviceContracts);
        expect(secondRun.serviceContractSources).toBe(upgraded.serviceContractSources);
        expect(secondRun.serviceContracts.find((contract) => contract.sourceSystem === 'DEMO')?.dataAsOf)
            .toBe(referenceDay);
    });

    it('fasst Nicht-Demo-Datensaetze und aktuelle Demo-Metadaten niemals an', () => {
        const contracts = createDemoServiceContracts(customers, referenceDay);
        const sources = { DEMO: createDemoServiceContractSourceMeta(contracts, referenceDay) };
        const current = upgradeDemoServiceContracts({
            fileName: 'Demo-Daten', customers, serviceContracts: contracts, serviceContractSources: sources
        }, '2027-01-01');
        const real = upgradeDemoServiceContracts({
            fileName: 'kunden.xlsx', customers, serviceContracts: contracts, serviceContractSources: {}
        }, '2027-01-01');
        const mislabeled = upgradeDemoServiceContracts({
            fileName: 'Demo-Daten',
            customers: [{ id: 'real-1', nummer: '1000', name: 'Echter Kunde' }],
            serviceContracts: contracts,
            serviceContractSources: {}
        }, '2027-01-01');

        expect(current.changed).toBe(false);
        expect(current.serviceContracts).toBe(contracts);
        expect(real.changed).toBe(false);
        expect(real.serviceContracts).toBe(contracts);
        expect(mislabeled.changed).toBe(false);
        expect(mislabeled.serviceContracts).toBe(contracts);
    });
});

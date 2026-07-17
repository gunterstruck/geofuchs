import { describe, it, expect } from 'vitest';
import {
    state,
    setCustomers,
    replaceCustomers,
    getCustomer,
    setServiceContracts,
    replaceServiceContractSources,
    datasetSnapshot
} from '../src/core/state.js';

function reset(customers) {
    setCustomers(customers, { fileName: 'test.xlsx' });
}

describe('getCustomer (Index)', () => {
    it('findet Kunden nach dem Setzen der Liste', () => {
        reset([{ id: 'x1', name: 'Alpha', vb: 'Meier' }, { id: 'x2', name: 'Beta', vb: 'Kunz' }]);
        expect(getCustomer('x2')?.name).toBe('Beta');
        expect(getCustomer('fehlt')).toBeUndefined();
    });
});

describe('replaceCustomers', () => {
    it('entfernt Altbestand, Tour und alte Gebietszuordnungen gemeinsam', () => {
        reset([{ id: 'alt-1', nummer: 'A1', name: 'Alt', vb: 'West' }]);
        state.territories = { 'plz2:45': { bezirk: 'Altbezirk' } };
        Object.assign(state.tour, {
            bezirk: 'Altbezirk',
            start: { customerId: 'alt-1', lat: 51, lng: 7 },
            destination: { customerId: 'alt-1', lat: 51, lng: 7 },
            stops: ['alt-1'],
            roundTrip: true,
            suggestMode: 'route',
            mapFocus: true,
            routeLineMode: 'road'
        });

        replaceCustomers(
            [{ id: 'neu-1', nummer: 'N1', name: 'Neu', vb: 'Nord' }],
            { fileName: 'neu.xlsx', territories: { 'plz2:20': { bezirk: 'Nord' } } }
        );

        expect(state.customers.map((customer) => customer.id)).toEqual(['neu-1']);
        expect(state.fileName).toBe('neu.xlsx');
        expect(state.territories).toEqual({ 'plz2:20': { bezirk: 'Nord' } });
        expect(state.tour).toMatchObject({
            bezirk: null,
            start: null,
            destination: null,
            stops: [],
            roundTrip: false,
            suggestMode: 'radius',
            mapFocus: false,
            routeLineMode: 'air'
        });
    });
});

describe('Servicevertrags-Datenhaltung', () => {
    it('ersetzt nur importierte Quellen und persistiert Verträge im Datensatz', () => {
        setServiceContracts(
            [
                { id: 'sap-alt', sourceSystem: 'Sap', contractId: 'S-1' },
                { id: 'crm-alt', sourceSystem: 'SIESALES', contractId: 'C-1' }
            ],
            {
                Sap: { fileName: 'sap-alt.xlsx' },
                SIESALES: { fileName: 'crm.xlsx' }
            }
        );

        expect(replaceServiceContractSources(
            [{ id: 'sap-neu', sourceSystem: 'SAP', contractId: 'S-2' }],
            { SAP: { fileName: 'sap-neu.xlsx', dataAsOf: '2026-07-17' } }
        )).toBe(true);

        expect(state.serviceContracts.map((contract) => contract.id).sort()).toEqual(['crm-alt', 'sap-neu']);
        expect(state.serviceContractSources.SAP).toMatchObject({ fileName: 'sap-neu.xlsx', count: 1 });
        expect(state.serviceContractSources.Sap).toBeUndefined();
        expect(state.serviceContractSources.SIESALES.fileName).toBe('crm.xlsx');
        expect(datasetSnapshot()).toMatchObject({
            schemaVersion: 2,
            serviceContracts: state.serviceContracts,
            serviceContractSources: state.serviceContractSources
        });
    });
});

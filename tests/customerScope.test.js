import { beforeEach, describe, expect, it } from 'vitest';
import { state, setCustomers, setServiceContracts } from '../src/core/state.js';
import {
    applyServiceCustomerScope,
    modeTourCustomers,
    modeVisibleCustomers,
    servicePlanningCustomerCount,
    serviceScopeActive
} from '../src/features/customerScope.js';

const CUSTOMERS = [
    { id: 'service-west', nummer: '0001', name: 'Service West', bezirk: 'West' },
    { id: 'service-ost', nummer: '0002', name: 'Service Ost', bezirk: 'Ost' },
    { id: 'ohne-vertrag', nummer: '0003', name: 'Ohne Vertrag', bezirk: 'West' }
];

const CONTRACTS = [
    { id: 'v1', sourceSystem: 'SAP', contractId: 'V1', customerNumber: '0001', status: 'AKTIV' },
    { id: 'v2', sourceSystem: 'SAP', contractId: 'V2', customerNumber: '0002', status: 'IN_VERLAENGERUNG' },
    { id: 'v3', sourceSystem: 'SAP', contractId: 'V3', customerNumber: '0003', status: 'ABGELAUFEN' }
];

beforeEach(() => {
    setCustomers(CUSTOMERS.map((customer) => ({ ...customer })), { fileName: 'test.xlsx' });
    setServiceContracts(CONTRACTS.map((contract) => ({ ...contract })), { SAP: { count: 3 } });
    state.ui.mode = 'aussendienst';
    state.ui.serviceCustomerScope = 'contracts';
    state.tour.bezirk = '__all__';
});

describe('Servicekunden-Scope', () => {
    it('lässt andere Fokus-Modi unverändert', () => {
        expect(serviceScopeActive()).toBe(false);
        expect(applyServiceCustomerScope(state.customers).map((customer) => customer.id))
            .toEqual(['service-west', 'service-ost', 'ohne-vertrag']);
        expect(modeVisibleCustomers()).toHaveLength(3);
    });

    it('zeigt im Service-Fokus standardmäßig nur planungsrelevante Servicekunden', () => {
        state.ui.mode = 'service';

        expect(serviceScopeActive()).toBe(true);
        expect(modeVisibleCustomers().map((customer) => customer.id))
            .toEqual(['service-west', 'service-ost']);
        expect(servicePlanningCustomerCount()).toBe(2);
    });

    it('gibt mit dem Profi-Schalter bewusst alle Kunden frei', () => {
        state.ui.mode = 'service';
        state.ui.serviceCustomerScope = 'all';

        expect(serviceScopeActive()).toBe(false);
        expect(modeVisibleCustomers().map((customer) => customer.id))
            .toEqual(['service-west', 'service-ost', 'ohne-vertrag']);
        expect(servicePlanningCustomerCount()).toBe(2);
    });

    it('übernimmt im Service keine unsichtbaren alten Vertriebsfilter', () => {
        state.dims.bezirk.values.get('West').visible = false;
        expect(modeVisibleCustomers().map((customer) => customer.id)).toEqual(['service-ost']);

        state.ui.mode = 'service';
        expect(modeVisibleCustomers().map((customer) => customer.id))
            .toEqual(['service-west', 'service-ost']);

        state.ui.serviceCustomerScope = 'all';
        expect(modeVisibleCustomers().map((customer) => customer.id))
            .toEqual(['service-west', 'service-ost', 'ohne-vertrag']);
    });

    it('kombiniert Service- und Bezirks-Scope für die Tour', () => {
        state.ui.mode = 'service';
        state.tour.bezirk = 'West';

        expect(modeTourCustomers().map((customer) => customer.id)).toEqual(['service-west']);
    });
});

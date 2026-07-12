import { describe, it, expect, beforeEach } from 'vitest';
import { state, setCustomers, mergeCustomersDelta, getCustomer } from '../src/core/state.js';

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

describe('mergeCustomersDelta', () => {
    beforeEach(() => {
        reset([{
            id: 'alt-1', nummer: 'K100', name: 'Autohaus Schmidt', plz: '45136',
            vb: 'Meier', umsatz: 1000, besuche: ['2026-05-01']
        }]);
    });

    it('erhält die bestehende ID und vereinigt Besuche', () => {
        const merged = mergeCustomersDelta([{
            id: 'neu-99', nummer: 'K100', name: 'Autohaus Schmidt GmbH', plz: '45136',
            vb: 'Meier', umsatz: 2000, besuche: ['2026-07-01']
        }]);
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe('alt-1');
        expect(merged[0].umsatz).toBe(2000);
        expect(merged[0].besuche).toEqual(['2026-05-01', '2026-07-01']);
    });

    it('behält Bestandskunden, die im Delta fehlen', () => {
        const merged = mergeCustomersDelta([{
            id: 'neu-2', nummer: 'K200', name: 'Neukunde', plz: '46045', vb: 'Kunz', besuche: []
        }]);
        expect(merged.map((c) => c.nummer).sort()).toEqual(['K100', 'K200']);
    });

    it('matcht ohne Kundennummer über Name + PLZ', () => {
        reset([{ id: 'alt-2', nummer: '', name: 'Bäckerei Ruhr', plz: '45127', vb: 'Meier', besuche: [] }]);
        const merged = mergeCustomersDelta([{
            id: 'neu-3', nummer: '', name: 'bäckerei ruhr', plz: '45127', vb: 'Kunz', besuche: []
        }]);
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe('alt-2');
        expect(merged[0].vb).toBe('Kunz');
    });
});

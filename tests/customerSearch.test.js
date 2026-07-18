import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDemoCustomers } from '../src/services/excel.js';
import { visitStatus } from '../src/features/visits.js';
import { enrichPlacesByPlz } from '../src/services/geocode.js';
import { normalizeSearchText, searchCustomers } from '../src/ui/search.js';

const placeData = JSON.parse(readFileSync(resolve(process.cwd(), 'public/geodata/plz-places.json'), 'utf8'));
const centroids = JSON.parse(readFileSync(resolve(process.cwd(), 'public/geodata/plz-centroids.json'), 'utf8'));

describe('Kunden- und Ortssuche', () => {
    it('enthält Essen im lokalen PLZ-Ortsverzeichnis', () => {
        expect(placeData.places['45127']).toBe('Essen');
        expect(Object.keys(placeData.places).length).toBeGreaterThan(8_000);
    });

    it('ergänzt die Beispieldaten um den Ort der verwendeten PLZ', () => {
        const customers = createDemoCustomers(centroids, placeData.places);

        expect(customers).toHaveLength(2_250);
        expect(customers.every((customer) => customer.ort)).toBe(true);
        expect(customers.filter((customer) => customer.ort === 'Essen')).toHaveLength(4);
        expect(customers.every((customer) => customer.name.startsWith('TourFuchs Demo ·'))).toBe(true);
        expect(customers.every((customer) => customer.strasse === '')).toBe(true);
        expect(customers.every((customer) => customer.email.endsWith('@example.com'))).toBe(true);
        expect(customers.every((customer) => customer.demo === true)).toBe(true);
        const exceptions = customers.filter((customer) => ['faellig', 'ueberfaellig'].includes(visitStatus(customer)));
        expect(exceptions).toHaveLength(112);
        expect(exceptions.length / customers.length).toBeLessThanOrEqual(0.05);
    });

    it('ergänzt ältere Demodaten, ohne vorhandene Ortsnamen zu überschreiben', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => ({ ok: true, json: async () => placeData });
        const customers = [
            { id: '1', plz: '45127', ort: '' },
            { id: '2', plz: '45127', ort: 'Eigener Ort' }
        ];

        try {
            expect(await enrichPlacesByPlz(customers)).toBe(1);
            expect(customers.map((customer) => customer.ort)).toEqual(['Essen', 'Eigener Ort']);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('findet Kunden über Stadt, Name, PLZ und Kundennummer', () => {
        const customers = [
            { id: '1', name: 'Ruhrtechnik GmbH', ort: 'Essen', plz: '45127', nummer: 'K-100' },
            { id: '2', name: 'Kölner Handel', ort: 'Köln', plz: '50667', nummer: 'K-200' }
        ];

        expect(searchCustomers(customers, 'Essen').map((customer) => customer.id)).toEqual(['1']);
        expect(searchCustomers(customers, 'Koln').map((customer) => customer.id)).toEqual(['2']);
        expect(searchCustomers(customers, '45127').map((customer) => customer.id)).toEqual(['1']);
        expect(searchCustomers(customers, 'K-200').map((customer) => customer.id)).toEqual(['2']);
    });

    it('bleibt bei unvollständigen Kundendaten stabil', () => {
        expect(() => searchCustomers([{ id: '1', name: 'Ohne Ort' }], 'Essen')).not.toThrow();
        expect(normalizeSearchText(null)).toBe('');
    });
});

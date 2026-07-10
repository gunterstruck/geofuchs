import { describe, it, expect } from 'vitest';
import { parseNumber, detectRevenueScale, parseRows } from '../src/services/excel.js';

describe('detectRevenueScale (Spaltenüberschrift)', () => {
    it('erkennt Tausend-Euro-Überschriften', () => {
        for (const h of ['Umsatz T€', 'Umsatz TEUR', 'Umsatz in T€', 'Umsatz (Tsd €)', 'Umsatz k€', 'Umsatz kEUR', 'Umsatz in Tausend']) {
            expect(detectRevenueScale(h)).toBe(1000);
        }
    });
    it('erkennt Millionen-Überschriften', () => {
        expect(detectRevenueScale('Umsatz Mio €')).toBe(1_000_000);
        expect(detectRevenueScale('Umsatz in Millionen')).toBe(1_000_000);
    });
    it('normale Umsatzspalten bleiben unskaliert', () => {
        for (const h of ['Umsatz', 'Umsatz €', 'Jahresumsatz', 'Revenue', 'Betreuer']) {
            expect(detectRevenueScale(h)).toBe(1);
        }
    });
});

describe('parseRows: Umsatz-Skalierung und Summe', () => {
    const base = { name: 'Kunde', plz: 'PLZ', bezirk: 'Bezirk' };

    it('skaliert T€-Werte in volle Euro und rechnet korrekt', () => {
        const mapping = { ...base, umsatz: 'Umsatz T€' };
        const rows = [
            { Kunde: 'A GmbH', PLZ: '45136', Bezirk: 'Nord', 'Umsatz T€': '45' },        // 45.000 €
            { Kunde: 'B GmbH', PLZ: '45127', Bezirk: 'Nord', 'Umsatz T€': '1.234,5' },   // 1.234,5 T€ = 1.234.500 €
            { Kunde: 'C GmbH', PLZ: '50667', Bezirk: 'Süd', 'Umsatz T€': '104' }
        ];
        const { customers, errors } = parseRows(rows, mapping);
        expect(customers.map((c) => c.umsatz)).toEqual([45000, 1234500, 104000]);
        const sum = customers.reduce((s, c) => s + c.umsatz, 0);
        expect(sum).toBe(45000 + 1234500 + 104000);
        expect(errors.some((e) => e.Typ === 'Hinweis' && /Tausend Euro/.test(e.Grund))).toBe(true);
    });

    it('deutsche Schreibweise ohne T€-Header bleibt unverändert', () => {
        const mapping = { ...base, umsatz: 'Umsatz' };
        const rows = [
            { Kunde: 'A', PLZ: '45136', Bezirk: 'Nord', Umsatz: '1.234.567,89' },
            { Kunde: 'B', PLZ: '45127', Bezirk: 'Nord', Umsatz: '48.000' }
        ];
        const { customers, errors } = parseRows(rows, mapping);
        expect(customers[0].umsatz).toBeCloseTo(1234567.89, 2);
        expect(customers[1].umsatz).toBe(48000);
        expect(errors.some((e) => e.Typ === 'Hinweis')).toBe(false);
    });
});

describe('parseNumber deutsche vs. englische Schreibweise', () => {
    it('bevorzugt die deutsche Lesart bei mehrdeutigem Trennzeichen', () => {
        expect(parseNumber('1.234')).toBe(1234);   // deutsche Tausendertrennung
        expect(parseNumber('1,234')).toBe(1.234);  // deutsches Dezimalkomma
        expect(parseNumber('45.500')).toBe(45500); // deutsche Tausendertrennung
    });
});

import { describe, it, expect } from 'vitest';
import { parseNumber, detectRevenueScale, parseAmountColumn, parseRows } from '../src/services/excel.js';

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
    it('skaliert nicht bei t/k mitten im Wort vor €', () => {
        // „t€"/„k€" nur als eigenständige Einheit, nicht als Wortende.
        for (const h of ['Umsatz gesamt€', 'Rabatt€', 'Gesamt€', 'Netto Punkt€']) {
            expect(detectRevenueScale(h)).toBe(1);
        }
    });
    it('erkennt t€/k€ direkt nach einer Ziffer (z. B. 45t€)', () => {
        expect(detectRevenueScale('Umsatz 45t€')).toBe(1000);
        expect(detectRevenueScale('Umsatz 45k€')).toBe(1000);
    });
});

describe('parseAmountColumn (spaltenweite deutsche Tausendertrennung)', () => {
    it('interpretiert eine deutsch formatierte Spalte einheitlich (echtes Nutzer-Szenario)', () => {
        // „350.070" würde einzeln als 350,07 fehlgelesen – spaltenweit korrekt als 350070
        const raw = ['350.070', '189.245', '278.415', '1.822', '25.588', '562', '0', '984', '2.100'];
        const { values, format } = parseAmountColumn(raw);
        expect(format).toBe('de');
        expect(values).toEqual([350070, 189245, 278415, 1822, 25588, 562, 0, 984, 2100]);
        expect(values.reduce((a, b) => a + b, 0)).toBe(848786);
    });

    it('lässt englisch/gemischt formatierte Spalten unangetastet (kein Falsch-Zwang)', () => {
        const { values, format } = parseAmountColumn(['1,234.56', '2,000.00', '999.50']);
        expect(format).toBe('auto');
        expect(values[0]).toBeCloseTo(1234.56, 2);
        expect(values[1]).toBeCloseTo(2000, 2);
    });

    it('reine Zahlen ohne Tausenderpunkte bleiben unverändert', () => {
        const { values } = parseAmountColumn([45000, '48000', '1234.5']);
        expect(values).toEqual([45000, 48000, 1234.5]);
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

    it('deutsche Tausenderpunkt-Spalte wird korrekt summiert (Bug: zu niedrige Karten-Summe)', () => {
        const mapping = { ...base, umsatz: 'AE - GJ25' };
        const rows = [
            { Kunde: 'A', PLZ: '45136', Bezirk: 'Nord', 'AE - GJ25': '350.070' },
            { Kunde: 'B', PLZ: '45127', Bezirk: 'Nord', 'AE - GJ25': '1.822' },
            { Kunde: 'C', PLZ: '50667', Bezirk: 'Süd', 'AE - GJ25': '984' }
        ];
        const { customers, errors } = parseRows(rows, mapping);
        expect(customers.map((c) => c.umsatz)).toEqual([350070, 1822, 984]);
        expect(errors.some((e) => e.Typ === 'Hinweis' && /Tausendertrennung/.test(e.Grund))).toBe(true);
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
        // kein Tausendertrennungs-/Skalierungs-Vermerk, aber der Summen-Hinweis erscheint immer
        const hint = errors.find((e) => e.Typ === 'Hinweis');
        expect(hint.Grund).toContain('erkannte Gesamtsumme');
        expect(hint.Grund).not.toContain('Tausendertrennung');
    });
});

describe('parseNumber deutsche vs. englische Schreibweise', () => {
    it('bevorzugt die deutsche Lesart bei mehrdeutigem Trennzeichen', () => {
        expect(parseNumber('1.234')).toBe(1234);   // deutsche Tausendertrennung
        expect(parseNumber('1,234')).toBe(1.234);  // deutsches Dezimalkomma
        expect(parseNumber('45.500')).toBe(45500); // deutsche Tausendertrennung
    });
});

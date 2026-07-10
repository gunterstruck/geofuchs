import { describe, it, expect } from 'vitest';
import { formatRevenueShort, formatRevenueFull } from '../src/core/format.js';

describe('Umsatz-Darstellung (Regel R1.5)', () => {
    it('ab 10.000 € kompakt in T€', () => {
        expect(formatRevenueShort(10000)).toBe('10 T€');
        expect(formatRevenueShort(45499)).toBe('45 T€');
        expect(formatRevenueShort(45500)).toBe('46 T€');
        expect(formatRevenueShort(1234567)).toBe('1.235 T€');
    });

    it('unter 10.000 € in vollen Euro', () => {
        expect(formatRevenueShort(9999)).toBe('9.999 €');
        expect(formatRevenueShort(0)).toBe('0 €');
        expect(formatRevenueShort(null)).toBe('0 €');
    });

    it('negative Werte (Deltas) bleiben kompakt', () => {
        expect(formatRevenueShort(-45000)).toBe('-45 T€');
        expect(formatRevenueShort(-500)).toBe('-500 €');
    });

    it('voller Betrag für Tooltips', () => {
        expect(formatRevenueFull(1234567.4)).toBe('1.234.567 €');
    });
});

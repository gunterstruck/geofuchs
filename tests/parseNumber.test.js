import { describe, it, expect } from 'vitest';
import { parseNumber } from '../src/services/excel.js';

describe('parseNumber (Umsatz-Import)', () => {
    it('übernimmt numerische Excel-Zellen unverändert (Faktor-100-Bug)', () => {
        expect(parseNumber(1234.56)).toBe(1234.56);
        expect(parseNumber(45000)).toBe(45000);
        expect(parseNumber(0)).toBe(0);
    });

    it('liest deutsches Format', () => {
        expect(parseNumber('1.234,56')).toBe(1234.56);
        expect(parseNumber('1.234.567,89')).toBe(1234567.89);
        expect(parseNumber('45,5')).toBe(45.5);
        expect(parseNumber('1.234')).toBe(1234);
        expect(parseNumber('12.345 €')).toBe(12345);
    });

    it('liest englisches Format', () => {
        expect(parseNumber('1,234.56')).toBe(1234.56);
        expect(parseNumber('1,234,567.89')).toBe(1234567.89);
        expect(parseNumber('45.5')).toBe(45.5);
    });

    it('liest schlichte Zahlen und Währungszeichen', () => {
        expect(parseNumber('45000')).toBe(45000);
        expect(parseNumber('45000 €')).toBe(45000);
        expect(parseNumber('EUR 45000')).toBe(45000);
        expect(parseNumber('-1.234,50')).toBe(-1234.5);
    });

    it('gibt null für Leeres und Unlesbares zurück', () => {
        expect(parseNumber(null)).toBeNull();
        expect(parseNumber(undefined)).toBeNull();
        expect(parseNumber('')).toBeNull();
        expect(parseNumber('n/a')).toBeNull();
        expect(parseNumber(NaN)).toBeNull();
    });
});

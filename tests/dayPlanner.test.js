import { describe, it, expect } from 'vitest';
import { combinePlanStart, todayInputValue } from '../src/features/dayPlanner.js';

describe('combinePlanStart', () => {
    it('kombiniert Datum und Uhrzeit lokal', () => {
        const d = combinePlanStart('2026-07-15', '09:30');
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(6);
        expect(d.getDate()).toBe(15);
        expect(d.getHours()).toBe(9);
        expect(d.getMinutes()).toBe(30);
    });

    it('fällt bei fehlenden Angaben auf heute 08:00 zurück', () => {
        const d = combinePlanStart('', '');
        expect(d.getHours()).toBe(8);
    });
});

describe('todayInputValue', () => {
    it('liefert yyyy-mm-dd', () => {
        expect(todayInputValue(new Date('2026-07-10T09:00:00'))).toBe('2026-07-10');
    });
});

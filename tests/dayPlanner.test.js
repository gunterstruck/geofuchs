import { describe, it, expect } from 'vitest';
import { planMyDay, combinePlanStart, todayInputValue } from '../src/features/dayPlanner.js';

const NOW = new Date('2026-07-10T07:30:00');
const START = { lat: 51.45, lng: 7.01, label: 'Essen' };

// Hilfsbau: Kunde mit Status über Rhythmus/letzten Besuch
const overdue = (id, lat, lng) => ({ id, name: id, lat, lng, rhythmusWochen: 4, besuche: [] });
const due = (id, lat, lng) => ({ id, name: id, lat, lng, rhythmusWochen: 4, besuche: ['2026-06-14'] });
const ok = (id, lat, lng) => ({ id, name: id, lat, lng, rhythmusWochen: 4, besuche: ['2026-07-08'] });

describe('planMyDay', () => {
    it('wählt nur fällige und überfällige Kunden', () => {
        const pool = [overdue('u1', 51.5, 7.0), due('f1', 51.4, 7.1), ok('o1', 51.45, 7.05)];
        const { stops, totalOpportunities } = planMyDay(START, pool, { now: NOW });
        expect(totalOpportunities).toBe(2);
        expect(stops.map((c) => c.id).sort()).toEqual(['f1', 'u1']);
    });

    it('überfällige haben Vorrang vor näheren fälligen', () => {
        const pool = [
            due('nah-faellig', 51.451, 7.011),        // praktisch am Start
            overdue('fern-ueberfaellig', 52.5, 13.4)  // Berlin, weit weg
        ];
        const { stops } = planMyDay(START, pool, { maxStops: 1, now: NOW });
        expect(stops.map((c) => c.id)).toEqual(['fern-ueberfaellig']);
    });

    it('begrenzt auf maxStops und meldet die Gesamtzahl', () => {
        const pool = Array.from({ length: 20 }, (_, i) => overdue(`k${i}`, 51.3 + i * 0.01, 7.0));
        const { stops, totalOpportunities } = planMyDay(START, pool, { maxStops: 8, now: NOW });
        expect(stops).toHaveLength(8);
        expect(totalOpportunities).toBe(20);
    });

    it('ignoriert Kunden ohne Koordinaten', () => {
        const pool = [{ id: 'x', name: 'x', lat: null, lng: null, rhythmusWochen: 4, besuche: [] }];
        expect(planMyDay(START, pool, { now: NOW }).stops).toHaveLength(0);
    });

    it('leeres Ergebnis ohne Start oder ohne Kandidaten', () => {
        expect(planMyDay(null, [overdue('a', 51, 7)], { now: NOW }).stops).toHaveLength(0);
        expect(planMyDay(START, [], { now: NOW }).stops).toHaveLength(0);
    });
});

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

import { describe, it, expect } from 'vitest';
import { visitStatus, isOpportunity, lastVisit } from '../src/features/visits.js';

const NOW = new Date('2026-07-10T12:00:00');

describe('visitStatus (Besuchsrhythmus)', () => {
    it('ohne Rhythmus: none', () => {
        expect(visitStatus({ rhythmusWochen: null, besuche: [] }, NOW)).toBe('none');
    });

    it('mit Rhythmus, nie besucht: überfällig', () => {
        expect(visitStatus({ rhythmusWochen: 4, besuche: [] }, NOW)).toBe('ueberfaellig');
    });

    it('frisch besucht: ok', () => {
        expect(visitStatus({ rhythmusWochen: 4, besuche: ['2026-07-01'] }, NOW)).toBe('ok');
    });

    it('kurz vor Fälligkeit: faellig', () => {
        // Rhythmus 4 Wochen, Besuch vor 26 Tagen -> in 2 Tagen fällig (Fenster max 7 Tage)
        expect(visitStatus({ rhythmusWochen: 4, besuche: ['2026-06-14'] }, NOW)).toBe('faellig');
    });

    it('Rhythmus überschritten: überfällig', () => {
        expect(visitStatus({ rhythmusWochen: 4, besuche: ['2026-05-01'] }, NOW)).toBe('ueberfaellig');
    });

    it('nutzt den letzten Besuch bei mehreren', () => {
        expect(lastVisit({ besuche: ['2026-01-01', '2026-07-01'] })).toBe('2026-07-01');
        expect(visitStatus({ rhythmusWochen: 4, besuche: ['2026-01-01', '2026-07-01'] }, NOW)).toBe('ok');
    });

    it('isOpportunity: fällig oder überfällig', () => {
        expect(isOpportunity({ rhythmusWochen: 4, besuche: [] }, NOW)).toBe(true);
        expect(isOpportunity({ rhythmusWochen: 4, besuche: ['2026-07-01'] }, NOW)).toBe(false);
    });
});

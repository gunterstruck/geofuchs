import { describe, expect, it } from 'vitest';
import { demoVisitSchedule } from '../src/services/excel.js';
import { visitStatus } from '../src/features/visits.js';

describe('ruhige Besuchslage der Beispieldaten', () => {
    it('begrenzt fällige und überfällige Kunden auf höchstens fünf Prozent', () => {
        const now = new Date('2026-07-18T12:00:00');
        const counts = { ok: 0, faellig: 0, ueberfaellig: 0 };
        for (let index = 0; index < 2250; index++) {
            const rhythmusWochen = [4, 6, 6, 8, 12][index % 5];
            const schedule = demoVisitSchedule(index, rhythmusWochen, now);
            const status = visitStatus({ rhythmusWochen, besuche: schedule.besuche }, now);
            expect(status).toBe(schedule.status);
            counts[status]++;
        }

        expect(counts.faellig).toBe(56);
        expect(counts.ueberfaellig).toBe(56);
        expect((counts.faellig + counts.ueberfaellig) / 2250).toBeLessThanOrEqual(0.05);
        expect(counts.ok).toBe(2138);
    });
});

import { describe, expect, it } from 'vitest';
import { isDesktopPlanningWidth, mobilePlanningMediaQuery } from '../src/ui/planningViewport.js';

describe('Viewport-Grenze der Gebietsplanung', () => {
    it('beginnt erst oberhalb der mobilen Breite', () => {
        expect(isDesktopPlanningWidth(768)).toBe(false);
        expect(isDesktopPlanningWidth(769)).toBe(true);
    });

    it('weist ungültige Breiten defensiv zurück', () => {
        expect(isDesktopPlanningWidth(Number.NaN)).toBe(false);
        expect(isDesktopPlanningWidth(undefined)).toBe(false);
        expect(isDesktopPlanningWidth('769')).toBe(true);
    });

    it('liefert auch ohne matchMedia eine sichere Abfrage', () => {
        const query = mobilePlanningMediaQuery();
        expect(query.matches).toBe(false);
        expect(() => query.addEventListener('change', () => {})).not.toThrow();
    });
});

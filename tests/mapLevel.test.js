import { describe, expect, it } from 'vitest';
import { automaticLevelActive, automaticLevelForZoom } from '../src/features/mapLevel.js';

describe('Automatische Gebietsebene', () => {
    it('folgt den stabilen Zoomstufen und lädt PLZ 5 nie automatisch', () => {
        expect(automaticLevelForZoom(5)).toBe('plz1');
        expect(automaticLevelForZoom(6)).toBe('plz2');
        expect(automaticLevelForZoom(7)).toBe('kreise');
        expect(automaticLevelForZoom(9)).toBe('plz3');
        expect(automaticLevelForZoom(19)).toBe('plz3');
    });

    it('verhindert Flattern an einer Zoomgrenze', () => {
        expect(automaticLevelForZoom(7.24, 'plz2')).toBe('plz2');
        expect(automaticLevelForZoom(7.25, 'plz2')).toBe('kreise');
        expect(automaticLevelForZoom(6.75, 'kreise')).toBe('kreise');
        expect(automaticLevelForZoom(6.74, 'kreise')).toBe('plz2');
    });

    it('erzwingt Automatik in Basis und mobil, erlaubt Fixierung nur im Desktop-Profi-Modus', () => {
        expect(automaticLevelActive('basis', 'fixed')).toBe(true);
        expect(automaticLevelActive('profi', 'auto')).toBe(true);
        expect(automaticLevelActive('profi', 'fixed')).toBe(false);
        expect(automaticLevelActive('profi', 'fixed', true)).toBe(true);
    });
});

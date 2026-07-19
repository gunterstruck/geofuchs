import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countNearby } from '../src/features/tour.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('countNearby – Anzahl im Umkreis (macht den Regler sichtbar)', () => {
    const origin = { lat: 51.45, lng: 7.01 }; // Essen
    const customers = [
        { id: 'a', lat: 51.45, lng: 7.02 },  // ~0,7 km
        { id: 'b', lat: 51.50, lng: 7.05 },  // ~6 km
        { id: 'c', lat: 51.51, lng: 7.47 },  // ~32 km (Dortmund)
        { id: 'd', lat: null, lng: null }    // nicht verortet
    ];

    it('zählt nur verortete Kunden innerhalb des Radius', () => {
        expect(countNearby(origin, customers, 5)).toBe(1);
        expect(countNearby(origin, customers, 10)).toBe(2);
        expect(countNearby(origin, customers, 50)).toBe(3);
    });

    it('lässt bereits eingeplante Kunden aus', () => {
        expect(countNearby(origin, customers, 50, new Set(['a']))).toBe(2);
    });

    it('ohne Startpunkt null', () => {
        expect(countNearby(null, customers, 50)).toBe(0);
    });
});

describe('Umkreis-Zähler und Route-Umschalter über der Karte', () => {
    it('zeigt die Gesamtzahl im Umkreis, auch wenn die Liste gedeckelt ist', () => {
        const tourPanel = read('src/ui/tourPanel.js');
        expect(tourPanel).toContain('countNearby(');
        expect(tourPanel).toContain('suggestion-count');
    });

    it('blendet einen kleinen Umschalter über der Karte ein, wenn die Route liegt', () => {
        const html = read('index.html');
        const tourPanel = read('src/ui/tourPanel.js');
        const css = read('src/styles/components.css');
        expect(html).toContain('id="route-mode-bar"');
        expect(html).toContain('id="btn-route-mode"');
        expect(tourPanel).toContain("getElementById('btn-route-mode')");
        expect(tourPanel).toContain('routeModeBar.hidden = !(state.tour.mapFocus && hasRoute)');
        expect(css).toContain('.route-mode-toggle');
    });
});

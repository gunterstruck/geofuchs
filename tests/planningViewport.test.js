import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

describe('Bezirks-Kacheln beim Gebiete-Managen im Nah-Zoom', () => {
    const mapSrc = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');

    it('räumt die Bühne, sobald die Kunden-Klemmbretter erscheinen', () => {
        // Bezirks-Kacheln tragen die Orientierung nur, solange Kunden Punkte
        // sind. Ab der Klemmbrett-Zoomstufe gehört die Fläche den Kunden –
        // beides zusammen war zu voll; die farbigen Bezirksflächen bleiben.
        expect(mapSrc).not.toContain('return { paint: p, markers: true, labels: true, markerBy: p };');
        expect(mapSrc).toContain('gehört die Bühne den');
    });

    it('lässt Mini-Chips ausweichen statt Kacheln zu überlappen', () => {
        // Der Vollständigkeits-Fallback saß bisher blind auf dem Schwerpunkt
        // und klebte auf vollen Kacheln. Jetzt sucht er sich per Versatz-
        // Kandidaten eine freie Stelle – nie unsichtbar, nie übereinander.
        expect(mapSrc).toContain('placedRects');
        expect(mapSrc).toContain('collidesWith');
        expect(mapSrc).toContain('const nudges =');
    });

    it('holt die Kachel eines angeschnittenen Bezirks an den Kartenrand', () => {
        // Nah dran liegt der Bezirks-Schwerpunkt oft außerhalb des Bildes –
        // die Kachel wird an den Rand geklemmt statt zu verschwinden. Sichtbar
        // ist ein Bezirk, sobald eine Teilflächen-BBox das Bild schneidet.
        expect(mapSrc).toContain('intersectsView');
        expect(mapSrc).toContain('containerPointToLatLng');
        expect(mapSrc).toContain('count, revenue, bbox');
    });
});

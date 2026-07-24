import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Mobile „Meine Tour": kompakte Ein-Zeilen-Stopps mit grüner Tourlinie', () => {
    const panel = read('src/ui/tourPanel.js');
    const responsive = read('src/styles/responsive.css');
    const components = read('src/styles/components.css');

    it('rendert Titel und Sekundärzeile als eigene Blöcke (statt <br>)', () => {
        // Ermöglicht es, mobil die Sekundärzeile auszublenden und den Titel
        // einzeilig zu kürzen, ohne den Desktop-Look zu ändern.
        expect(panel).toContain('class="stop-title"');
        expect(panel).toContain('class="stop-sub muted small"');
        expect(components).toContain('.stop-title, .stop-sub, .stop-plan-line { display: block; }');
    });

    it('macht den Tour-Punkt zum „heute besucht"-Schalter – nur am Handy', () => {
        expect(panel).toContain('data-visit-node="${i}"');
        // Der Handler markiert den Besuch, ist aber auf mobile Breite begrenzt.
        const from = panel.indexOf("querySelectorAll('[data-visit-node]')");
        expect(from).toBeGreaterThan(-1);
        const block = panel.slice(from, from + 400);
        expect(block).toContain('if (!isMobileTour()) return;');
        expect(block).toContain('markVisitedToday(c);');
    });

    it('markiert ersten und letzten Streckenpunkt für die durchgehende Linie', () => {
        expect(panel).toContain("routeRows[0].classList.add('stop-first')");
        expect(panel).toContain("classList.add('stop-last')");
    });

    it('zeichnet mobil eine grüne Tourlinie hinter den Punkten', () => {
        expect(responsive).toContain('#tour-stops .stop-row::before');
        expect(responsive).toContain('#tour-stops .stop-row.stop-first::before { top: 50%; }');
        expect(responsive).toContain('#tour-stops .stop-row.stop-last::before { bottom: 50%; }');
        // Punkt liegt über der Linie und ist tippbar.
        expect(responsive).toMatch(/#tour-stops \.stop-num \{[\s\S]*cursor: pointer;/);
    });

    it('blendet mobil Pfeile und den breiten „✓ Heute"-Knopf aus, „−" bleibt', () => {
        expect(responsive).toContain('#tour-stops .stop-actions [data-up]');
        expect(responsive).toContain('#tour-stops .stop-actions [data-down]');
        expect(responsive).toContain('#tour-stops .stop-actions .stop-visit { display: none; }');
        // „✕" wird zum runden „−".
        expect(panel).toContain('class="stop-remove"');
        expect(responsive).toContain('#tour-stops .stop-remove::before { content: "−"');
    });

    it('einzeiliger Titel, Sekundärzeile weicht (nur mobil)', () => {
        expect(responsive).toMatch(/#tour-stops \.stop-title \{[\s\S]*text-overflow: ellipsis;/);
        expect(responsive).toContain('#tour-stops .stop-sub { display: none; }');
    });

    it('erlaubt Umsortieren per Ziehen (Handy: Halten, Desktop: Maus)', () => {
        expect(panel).toContain('function wireStopReorder');
        expect(panel).toContain('wireStopReorder(el);');
        // Handy: Halte-Moment über Touch-Events (Scroll per preventDefault stoppen).
        expect(panel).toContain('setTimeout(startDrag, 300)');
        expect(panel).toContain("addEventListener('touchmove', onTouchMove, { passive: false })");
        // Desktop: Maus-Ziehen über Pointer-Events mit Pointer-Capture.
        expect(panel).toContain("row.addEventListener('pointerdown'");
        expect(panel).toContain("e.pointerType === 'touch'"); // Touch nutzt den Touch-Pfad
        expect(panel).toContain('row.setPointerCapture(e.pointerId)');
        // Reihenfolge wird per Splice umgesetzt.
        expect(panel).toContain('state.tour.stops.splice(fromIdx, 1)');
        expect(panel).toContain('state.tour.stops.splice(toIdx, 0, moved)');
        // Nur Kundenstopps sind sortierbar (Ziel/Rückweg haben kein data-remove).
        expect(panel).toContain("filter((r) => r.querySelector('[data-remove]'))");
    });

    it('hebt die gezogene Zeile hervor und blendet einen Handy-Hinweis ein', () => {
        expect(responsive).toContain('#tour-stops .stop-row.stop-dragging');
        expect(responsive).toContain('body.reordering');
        expect(panel).toContain('class="stop-reorder-hint muted small"');
        expect(components).toContain('.stop-reorder-hint { display: none; }'); // Desktop: aus
    });
});

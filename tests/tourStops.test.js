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
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Mobiles Tour-Akkordeon (Startpunkt · Vorschläge · Meine Tour)', () => {
    const html = read('index.html');
    const css = read('src/styles/responsive.css');
    const panel = read('src/ui/tourPanel.js');

    it('umschließt die drei Gruppen mit ein-/ausklappbaren Karten', () => {
        expect(html).toContain('data-acc="start"');
        expect(html).toContain('data-acc="suggest"');
        expect(html).toContain('data-acc="mytour"');
        // Kopf, Zusammenfassungszeile und Pfeil je Gruppe.
        expect(html).toContain('id="acc-sum-start"');
        expect(html).toContain('id="acc-sum-suggest"');
        expect(html).toContain('id="acc-sum-mytour"');
        expect((html.match(/class="acc-head"/g) || []).length).toBe(3);
        expect((html.match(/class="acc-body"/g) || []).length).toBe(3);
    });

    it('lässt die drei Schritt-Anker (Start, Vorschläge, Stopps) unangetastet', () => {
        // Die Render-Logik referenziert diese IDs weiterhin – Wrapping darf sie
        // nicht verlieren.
        expect(html).toContain('id="tour-start"');
        expect(html).toContain('id="suggest-head"');
        expect(html).toContain('id="mytour-head"');
        expect(html).toContain('id="tour-suggestions"');
        expect(html).toContain('id="tour-stops"');
    });

    it('bleibt auf dem Desktop layout-transparent, wird erst mobil zur Karte', () => {
        // Desktop: display:contents + Zusammenfassung/Pfeil unsichtbar.
        expect(css).toContain('.tour-acc { display: contents; }');
        expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*\.tour-acc \{\s*display: block;/);
    });

    it('öffnet genau eine Gruppe und folgt sonst dem Arbeitsfluss', () => {
        // Akkordeon-Regel: öffnen schließt die anderen.
        expect(panel).toContain('function openTourAcc');
        expect(panel).toContain("el.classList.toggle('open', open)");
        // Aktueller Schritt aus dem Zustand (Start → Vorschläge → Meine Tour).
        expect(panel).toContain('function currentTourStep');
        // Manueller Tipp pinnt; leere Tour löst den Pin wieder.
        expect(panel).toContain('tourAccPinned = true');
        expect(panel).toContain('tourAccPinned = false');
        // Nur auf dem Handy aktiv.
        expect(panel).toContain("matchMedia('(max-width: 768px)')");
    });

    it('füllt sprechende Zusammenfassungen (Start, Umkreis, Stopps)', () => {
        expect(panel).toContain('acc-sum-start');
        expect(panel).toContain('acc-sum-suggest');
        expect(panel).toContain('acc-sum-mytour');
        expect(panel).toContain('Umkreis ${state.tour.radiusKm} km');
    });

    it('zieht das Tour-Blatt ganz auf und hält alle drei Köpfe sichtbar', () => {
        const sidebar = read('src/ui/sidebar.js');
        const css = read('src/styles/responsive.css');
        // Volle Planungsfläche bis knapp unter die schwebende Navi.
        expect(sidebar).toContain('function tourSheetHeight');
        expect(sidebar).toContain('setSheetHeight(tourSheetHeight()');
        // Offene Gruppe scrollt intern (gedeckelt), damit die Köpfe stehenbleiben.
        expect(css).toContain('.tour-acc.open .acc-body {\n        max-height: 34vh;');
        expect(css).toContain('.tour-acc.open .scroll-list { max-height: none; overflow: visible; }');
        // „Was ist in meiner Nähe?" beim Planen (Start steht) ausgeblendet.
        expect(panel).toContain("classList.toggle('tour-has-start', !!state.tour.start)");
        expect(css).toContain('body.tour-has-start #tab-tour.active #btn-nearby');
    });

    it('bleibt beim Aussuchen in „Vorschläge" – springt nicht beim ersten Stopp zu „Meine Tour"', () => {
        // currentTourStep darf ab gesetztem Start nur „suggest" liefern; zu
        // „mytour" wechselt der Nutzer bewusst selbst (sonst konnte man keine
        // weiteren Kunden mehr aussuchen).
        const from = panel.indexOf('function currentTourStep');
        const step = panel.slice(from, panel.indexOf('\nfunction ', from + 10));
        expect(step).not.toContain("return 'mytour'");
        expect(step).toContain("return 'suggest'");
    });
});

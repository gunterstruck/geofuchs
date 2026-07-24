import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Fokus-Modus: mehr Übersicht im Tourplaner (Handy und Desktop)', () => {
    const html = read('index.html');
    const panel = read('src/ui/tourPanel.js');
    const components = read('src/styles/components.css');

    it('bringt eine horizontale Schrittleiste mit den drei Schritten + Übersicht', () => {
        expect(html).toContain('id="tour-stepper"');
        expect(html).toContain('data-step="start"');
        expect(html).toContain('data-step="suggest"');
        expect(html).toContain('data-step="mytour"');
        expect(html).toContain('class="tour-focus-exit"');
        // Standardmäßig ausgeblendet (Desktop + Übersicht).
        expect(html).toMatch(/id="tour-stepper"[^>]*hidden/);
    });

    it('schaltet den Fokus beim Tippen in einen Schritt und wieder zurück', () => {
        expect(panel).toContain('function setTourFocus');
        expect(panel).toContain("classList.toggle('tour-focus', on)");
        // Gilt jetzt auf Handy UND Desktop (keine Mobile-Beschränkung mehr).
        expect(panel).not.toContain('const focus = on && isMobileTour();');
        // In einen Schritt getippt -> Fokus an.
        expect(panel).toContain('if (!alreadyOpen) setTourFocus(true);');
        // Übersicht-Knopf führt zurück.
        expect(panel).toContain("setTourFocus(false)");
        // Tab-/Moduswechsel beenden den Fokus.
        expect(panel).toContain("on('tab:changed', (tab) => { if (tab !== 'tour') setTourFocus(false); });");
        expect(panel).toContain("on('mode:changed', () => setTourFocus(false));");
    });

    it('führt die Schrittleiste synchron zum offenen Akkordeon', () => {
        // openTourAcc markiert den aktiven Schritt-Button.
        const from = panel.indexOf('function openTourAcc');
        const block = panel.slice(from, from + 600);
        expect(block).toContain("#tour-stepper .tour-step");
        expect(block).toContain("b.classList.toggle('active', on)");
    });

    it('blendet im Fokus das obere Chrome aus und zeigt die Schrittleiste (alle Breiten)', () => {
        // Bewusst NICHT medienabhängig – gilt auch am Desktop.
        expect(components).toContain('body.tour-focus .basemap-control');
        expect(components).toContain('body.tour-focus #first-steps');
        expect(components).toContain('body.tour-focus .tour-panel-title');
        expect(components).toContain('body.tour-focus #tab-tour #tour-scope');
        // Die einzelnen Köpfe weichen der Leiste; nur die aktive Gruppe bleibt.
        expect(components).toContain('body.tour-focus #tab-tour .tour-acc .acc-head { display: none; }');
        expect(components).toContain('body.tour-focus #tab-tour .tour-acc:not(.open) { display: none; }');
        expect(components).toContain('body.tour-focus #tour-stepper');
    });

    it('zeigt aktiven Schritt mit Text, die anderen nur als Ziffer', () => {
        expect(components).toContain('.tour-step .ts-label { display: none; }');
        expect(components).toContain('.tour-step.active .ts-label { display: inline; }');
    });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Schwebender „nächster Schritt"-Fuchs (mobil)', () => {
    const html = read('index.html');
    const css = read('src/styles/responsive.css');
    const sidebar = read('src/ui/sidebar.js');

    it('ist ein eigenes Element, getrennt vom Blatt', () => {
        expect(html).toContain('id="mobile-next-step"');
        expect(html).toContain('class="mns-label"');
        // Der Knopf liegt außerhalb der <aside id="sidebar"> – bewusst getrennt.
        const asideEnd = html.indexOf('</aside>');
        expect(html.indexOf('id="mobile-next-step"')).toBeGreaterThan(asideEnd);
    });

    it('schwebt schmal über der Griff-Leiste und ist auf dem Desktop unsichtbar', () => {
        expect(css).toContain('.mobile-next-step {');
        expect(css).toContain('bottom: calc(var(--mobile-sheet-peek, 46px) + 12px)');
        expect(css).toMatch(/max-width: 82vw/); // nicht die volle Breite
        expect(css).toContain('.mobile-next-step { display: none !important; }');
    });

    it('zeigt kontextabhängig den nächsten Schritt und nur bei zugeklapptem Blatt', () => {
        expect(sidebar).toContain('function updateMobileNextStep');
        expect(sidebar).toContain('!state.ui.sidebarOpen');
        expect(sidebar).toContain("state.ui.mode === 'aussendienst'");
        // Zwei Kontext-Vorschläge: Route zeigen bzw. Kunden in der Nähe.
        expect(sidebar).toContain('Kunden in meiner Nähe');
        expect(sidebar).toContain('Route auf die Karte');
        // Wird bei den relevanten Ereignissen aktualisiert.
        expect(sidebar).toContain('function initMobileNextStep');
    });
});

describe('Blatt wieder vollständig einklappbar (mobil)', () => {
    const sidebar = read('src/ui/sidebar.js');

    it('klappt beim Ziehen bis zum Boden ganz zu, statt bei der Mindesthöhe zu hängen', () => {
        expect(sidebar).toContain('function collapseSheetFully');
        // Beim Ziehen wird die ungeklammerte Wunschhöhe verfolgt.
        expect(sidebar).toContain('rawHeight = startH - dy');
        // Unter der Mindesthöhe = ganz einklappen.
        expect(sidebar).toContain('rawHeight <= SHEET_MIN_HEIGHT');
        expect(sidebar).toContain("sidebar?.classList.remove('sheet-sized')");
    });
});

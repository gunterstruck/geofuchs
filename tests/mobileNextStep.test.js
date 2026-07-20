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

    it('führt als Kette durch den Flow und nur bei zugeklapptem Blatt', () => {
        expect(sidebar).toContain('function updateMobileNextStep');
        expect(sidebar).toContain('!state.ui.sidebarOpen');
        expect(sidebar).toContain("state.ui.mode === 'aussendienst'");
        // Drei Kettenschritte: Nähe → Tour ab hier planen → Route auf die Karte.
        expect(sidebar).toContain('Kunden in meiner Nähe');
        expect(sidebar).toContain('Tour ab hier planen');
        expect(sidebar).toContain('Route auf die Karte');
        // „Planen" führt mit gesetztem Start ins Tour-Blatt.
        expect(sidebar).toContain('function goToTourPlanning');
        expect(sidebar).toContain("activateTab('tour')");
        // Funktionsspezifische Icons statt Fuchs als Haupt-Icon.
        expect(html).toContain('class="mns-icon"');
        expect(sidebar).toContain('function initMobileNextStep');
    });

    it('weicht der Straßenroute-Leiste, sobald die Route auf der Karte liegt', () => {
        // Bug: Bei liegender Route fiel der Nudge auf den Default „Nähe" zurück
        // und überdeckte die Route-Leiste. Jetzt aus dem State gelesen und weg.
        expect(sidebar).toContain('const routeShown = state.tour.mapFocus && !!state.tour.start');
        expect(sidebar).toContain('&& !routeShown');
        // Kein DOM-Wettrennen mehr über den versteckten Route-Balken.
        expect(sidebar).not.toContain("const routeVisible = !document.getElementById('route-mode-bar')");
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

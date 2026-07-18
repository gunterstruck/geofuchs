import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Mobile Außendienst & Tour am Desktop', () => {
    it('bietet den Teaser nur einmal, nach App-Start und mit Kundendaten an', async () => {
        window.matchMedia = vi.fn((query) => ({
            matches: query.includes('min-width'),
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));
        const { canOfferMobilePreviewTeaser } = await import('../src/ui/mobilePreview.js');

        expect(canOfferMobilePreviewTeaser({
            desktop: true,
            appReady: true,
            hasCustomers: true
        })).toBe(true);
        for (const blocker of [
            { desktop: false, appReady: true, hasCustomers: true },
            { desktop: true, appReady: false, hasCustomers: true },
            { desktop: true, appReady: true, hasCustomers: false },
            { desktop: true, appReady: true, hasCustomers: true, seen: true },
            { desktop: true, appReady: true, hasCustomers: true, blocked: true }
        ]) {
            expect(canOfferMobilePreviewTeaser(blocker)).toBe(false);
        }
    });

    it('öffnet die vorbereitete Tour-Vorschau ruhig und kehrt zum Einstieg zurück', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/ui/mobilePreview.js'), 'utf8');
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');

        expect(source).toContain("[FOCUS_PARAM]: 'tour'");
        expect(source).toContain('AUTO_TEASER_PREVIEW_MS = 2600');
        expect(source).toContain("PREVIEW_READY_MESSAGE = 'tourfuchs:mobile-preview-ready'");
        expect(source).toContain("on('customers:changed'");
        expect(source).toContain("on('app:ready'");
        expect(source).toContain('showLocationHint()');
        expect(sidebar).toContain('export function showTourView(persist = false)');
        expect(sidebar).toContain('window.innerHeight * (2 / 3)');
    });

    it('macht Beispieldaten mobil über ein weit geöffnetes, scrollbares Datenblatt erreichbar', () => {
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');
        const responsiveCss = readFileSync(resolve(process.cwd(), 'src/styles/responsive.css'), 'utf8');

        expect(sidebar).toContain("const MOBILE_DATA_TABS = new Set(['karte', 'daten', 'tour'])");
        expect(sidebar).toContain("else if (isMobileUi() && btn.dataset.tab === 'daten')");
        expect(sidebar).toContain('setSheetHeight(Math.round(sheetMaxHeight() * 0.88), true)');
        expect(responsiveCss).toContain('.mobile-topnav .depth-switch { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
        expect(responsiveCss).toContain('.mobile-topnav .tabs { grid-template-columns: repeat(3, minmax(0, 1fr)); }');
        expect(responsiveCss).toContain('touch-action: pan-y;');
        expect(responsiveCss).toContain('-webkit-overflow-scrolling: touch;');
    });

    it('benennt den mobilen Nutzen und blendet den Einstieg mobil aus', () => {
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/components.css'), 'utf8');
        const showcase = readFileSync(resolve(process.cwd(), 'src/ui/showcase.js'), 'utf8');

        expect(html).toContain('Mobile Außendienst &amp; Tour');
        expect(html).toContain('Kunden, Briefing &amp; Tour');
        expect(css).toContain('@media (max-width: 900px) { .mobile-preview-entry { display: none; } }');
        expect(css).toContain('inset: var(--topbar-height) 0 0;');
        expect(css).toContain('calc(100dvh - var(--topbar-height) - 16px)');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(showcase).toContain('if (insideMobilePreview) return;');
    });
});

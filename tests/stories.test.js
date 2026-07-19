import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORIES, CRITICAL_SELECTORS, visibleStories, visibleStorySteps, prepareShowcaseTour, selectShowcaseTour } from '../src/features/stories.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const showcaseSource = readFileSync(resolve(process.cwd(), 'src/ui/showcase.js'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

describe('Showcase-Stories: Guardrail', () => {
    it('alle kritischen Selektoren existieren in index.html', () => {
        const missing = CRITICAL_SELECTORS.filter((sel) => !doc.querySelector(sel));
        expect(missing).toEqual([]);
    });

    it('Showcase-Dialog ist im Markup vorhanden', () => {
        expect(doc.querySelector('#showcase-dialog')).not.toBeNull();
        expect(doc.querySelector('#btn-showcase')).not.toBeNull();
    });

    it('jede Story hat Id, Titel und Schritte; run-Schritte referenzieren einen Key', () => {
        const ids = new Set();
        for (const s of STORIES) {
            expect(s.id).toBeTruthy();
            expect(ids.has(s.id)).toBe(false);
            ids.add(s.id);
            expect(s.title).toBeTruthy();
            expect(s.duration).toBeGreaterThanOrEqual(15);
            expect(Array.isArray(s.steps) && s.steps.length > 0).toBe(true);
            for (const step of s.steps) {
                expect(typeof step.t).toBe('string');
                if (step.t === 'run') expect(step.key).toBeTruthy();
                if (step.t === 'say') expect(step.text).toBeTruthy();
            }
        }
    });

    it('führt die Karten-Demo sichtbar vom Kundenstapel bis zum Popup', () => {
        const mapStory = STORIES.find((story) => story.id === 'excel-karte');
        expect(mapStory.steps.some((step) => step.sel === '.customer-stack-card')).toBe(true);
        // Zoom-Beat und Popup-Öffnung sind getrennte Phasen mit eigener
        // Erzählung: erst die Kundenkacheln würdigen, dann die Kundenkarte.
        expect(mapStory.steps.some((step) => step.key === 'zoomToCustomerCards')).toBe(true);
        expect(mapStory.steps.some((step) => step.key === 'openCustomerCard')).toBe(true);
        expect(mapStory.steps.some((step) => step.sel === '.customer-marker-card')).toBe(true);
        expect(mapStory.steps.at(-1)?.sel).toBe('.leaflet-popup-content');
        expect(mapStory.minRuntimeMs).toBe(15000);
        expect(showcaseSource).toContain("await clickEl('.customer-stack-card')");
        expect(showcaseSource).toContain("await clickEl('.customer-marker-card')");
        expect(showcaseSource).toContain("emit('showcase:story-completed', story.id)");
    });

    it('die Stories in fester Reihenfolge', () => {
        expect(STORIES.map((s) => s.id)).toEqual(['excel-karte', 'tour', 'handy-qr', 'simulation', 'service-tag', 'chancen', 'tresor', 'empfang']);
    });

    it('am Desktop entfällt die mobile-only Empfangs-Story', () => {
        const ids = visibleStories({ isDesktop: true }).map((s) => s.id);
        expect(ids).toEqual(['excel-karte', 'tour', 'handy-qr', 'simulation', 'service-tag', 'chancen', 'tresor']);
        expect(ids).not.toContain('empfang');
    });

    it('am Smartphone entfallen die desktop-only Stories, dafür kommt die Empfangs-Story', () => {
        const ids = visibleStories({ isDesktop: false }).map((s) => s.id);
        expect(ids).toEqual(['excel-karte', 'tour', 'chancen', 'tresor', 'empfang']);
        expect(ids).not.toContain('handy-qr');
        expect(ids).not.toContain('simulation');
        expect(ids).not.toContain('service-tag');
    });

    it('die Service-Demo nutzt nur existierende Engine-Helfer', () => {
        const serviceStory = STORIES.find((story) => story.id === 'service-tag');
        const runKeys = serviceStory.steps.filter((step) => step.t === 'run').map((step) => step.key);
        for (const key of runKeys) {
            expect(showcaseSource, `Helfer fehlt: ${key}`).toContain(`async ${key}(`);
        }
    });

    it('die Tour-Demo zeigt die QR-Übergabe nur am Desktop', () => {
        const tour = STORIES.find((story) => story.id === 'tour');
        const desktopSteps = visibleStorySteps(tour, { isDesktop: true });
        const mobileSteps = visibleStorySteps(tour, { isDesktop: false });

        expect(desktopSteps.some((step) => step.key === 'shareTourQr')).toBe(true);
        expect(mobileSteps.some((step) => step.key === 'shareTourQr')).toBe(false);
        expect(mobileSteps.some((step) => step.sel === '#qr-share-canvas')).toBe(false);
        expect(mobileSteps.at(-1)?.text).toContain('Straßenroute');
    });

    it('blendet die QR-Übergabe-Taste im mobilen View aus', () => {
        expect(doc.querySelector('#btn-tour-qr')?.classList.contains('only-desktop')).toBe(true);
    });

    it('Tour-Vorführungen starten unabhängig von einer vorhandenen Tour', () => {
        const current = {
            bezirk: 'Nord',
            start: { lat: 51, lng: 7 },
            destination: { lat: 48, lng: 11 },
            stops: ['a', 'b'],
            radiusKm: 5,
            roundTrip: true,
            suggestMode: 'route',
            mapFocus: true,
            routeLineMode: 'road',
            customSetting: 'bleibt'
        };

        expect(prepareShowcaseTour(current)).toEqual({
            ...current,
            bezirk: null,
            start: null,
            destination: null,
            stops: [],
            radiusKm: 50,
            roundTrip: false,
            suggestMode: 'radius',
            mapFocus: false,
            routeLineMode: 'air'
        });
        expect(current.destination).toEqual({ lat: 48, lng: 11 });
    });

    it('Tour- und Tresor-Story enthalten die sichtbaren Abschlussmomente', () => {
        const tour = STORIES.find((story) => story.id === 'tour');
        const vault = STORIES.find((story) => story.id === 'tresor');
        expect(tour.steps.some((step) => step.t === 'run' && step.key === 'focusTourRoute')).toBe(true);
        expect(vault.steps.some((step) => step.t === 'say' && step.sel === '#recovery-code')).toBe(true);
    });

    it('öffnet native Dialoge in Demos zuverlässig und erklärt einen Abbruch konkret', () => {
        const handy = STORIES.find((story) => story.id === 'handy-qr');
        expect(handy.steps.some((step) => step.key === 'shareTourQr')).toBe(true);
        expect(showcaseSource).toContain("el.matches?.('dialog[open]')");
        expect(showcaseSource).toContain('Hängengeblieben bei Schritt');
        expect(showcaseSource).toContain('showStoryFailure(story, failure)');
    });

    it('verbindet die Kundenauswahl mit einem sicheren Copilot-Briefing', () => {
        const briefing = STORIES.find((story) => story.id === 'chancen');

        expect(briefing.title).toContain('Sofort gebrieft');
        expect(briefing.steps.some((step) => step.key === 'openCustomerBriefing')).toBe(true);
        expect(briefing.steps.some((step) => step.sel === '.briefing-demo-preview')).toBe(true);
        expect(briefing.steps.some((step) => step.sel === '.briefing-demo-note')).toBe(true);
        expect(briefing.steps.some((step) => step.sel === '[data-briefing-fallback]')).toBe(false);
        expect(briefing.steps.some((step) => step.key === 'closeCustomerBriefing')).toBe(true);
        expect(briefing.steps.some((step) => step.key === 'checkVisit')).toBe(false);
    });

    it('erkennt das geöffnete native Briefing-Dialogfenster zuverlässig', () => {
        const start = showcaseSource.indexOf('async openCustomerBriefing()');
        const end = showcaseSource.indexOf('async closeCustomerBriefing()', start);
        const helper = showcaseSource.slice(start, end);

        expect(helper).toContain("document.getElementById('customer-briefing-dialog')");
        expect(helper).toContain('briefing?.open');
        expect(helper).not.toContain("resolveEl('#customer-briefing-dialog[open]'");
    });

    it('wählt für die Tour-Demo getrennte Kunden quer durchs Ruhrgebiet', () => {
        const customers = [
            { id: 'start', name: 'Start Oberhausen', lat: 51.47, lng: 6.85 },
            { id: 'duplicate', name: 'Gleiche PLZ', lat: 51.47, lng: 6.85 },
            { id: 'essen', name: 'Kunde Essen', lat: 51.45, lng: 7.02 },
            { id: 'bochum', name: 'Kunde Bochum', lat: 51.48, lng: 7.22 },
            { id: 'dortmund', name: 'Kunde Dortmund', lat: 51.50, lng: 7.40 },
            { id: 'berlin', name: 'Kunde Berlin', lat: 52.52, lng: 13.40 }
        ];

        const plan = selectShowcaseTour(customers);
        expect(plan.start.id).toBe('start');
        expect(plan.stops.map((c) => c.id)).toEqual(['essen', 'dortmund']);
        expect(plan.stops.map((c) => c.id)).not.toContain('duplicate');
        expect(plan.inRuhr).toBe(true);
    });
});

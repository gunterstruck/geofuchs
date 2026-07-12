import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORIES, CRITICAL_SELECTORS, visibleStories, prepareShowcaseTour } from '../src/features/stories.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
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
            expect(Array.isArray(s.steps) && s.steps.length > 0).toBe(true);
            for (const step of s.steps) {
                expect(typeof step.t).toBe('string');
                if (step.t === 'run') expect(step.key).toBeTruthy();
                if (step.t === 'say') expect(step.text).toBeTruthy();
            }
        }
    });

    it('die Stories in fester Reihenfolge', () => {
        expect(STORIES.map((s) => s.id)).toEqual(['excel-karte', 'tour', 'handy-qr', 'simulation', 'chancen', 'tresor', 'empfang']);
    });

    it('am Desktop entfällt die mobile-only Empfangs-Story', () => {
        const ids = visibleStories({ isDesktop: true }).map((s) => s.id);
        expect(ids).toEqual(['excel-karte', 'tour', 'handy-qr', 'simulation', 'chancen', 'tresor']);
        expect(ids).not.toContain('empfang');
    });

    it('am Smartphone entfallen die desktop-only Stories, dafür kommt die Empfangs-Story', () => {
        const ids = visibleStories({ isDesktop: false }).map((s) => s.id);
        expect(ids).toEqual(['excel-karte', 'tour', 'chancen', 'tresor', 'empfang']);
        expect(ids).not.toContain('handy-qr');
        expect(ids).not.toContain('simulation');
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
});

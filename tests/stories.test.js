import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORIES, CRITICAL_SELECTORS, visibleStories } from '../src/features/stories.js';

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
        expect(STORIES.map((s) => s.id)).toEqual(['excel-karte', 'tour', 'handy-qr', 'simulation', 'chancen', 'tresor']);
    });

    it('am Desktop sind alle Stories sichtbar', () => {
        expect(visibleStories({ isDesktop: true }).map((s) => s.id))
            .toEqual(['excel-karte', 'tour', 'handy-qr', 'simulation', 'chancen', 'tresor']);
    });

    it('am Smartphone entfallen die desktop-only Stories (QR-Übergabe, Gebiets-Simulation)', () => {
        const ids = visibleStories({ isDesktop: false }).map((s) => s.id);
        expect(ids).toEqual(['excel-karte', 'tour', 'chancen', 'tresor']);
        expect(ids).not.toContain('handy-qr');
        expect(ids).not.toContain('simulation');
    });
});

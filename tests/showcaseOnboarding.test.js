import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    allShowcaseStoriesSeen,
    canAutoOfferShowcase,
    clearShowcaseImportCompleted,
    isShowcaseAutoSuppressed,
    markShowcaseCompleted,
    markShowcaseDismissed,
    markShowcaseImportCompleted,
    markShowcaseStorySeen,
    nextUnseenShowcaseStory,
    seenShowcaseIds
} from '../src/services/showcaseOnboarding.js';

const stories = [
    { id: 'eins' },
    { id: 'zwei' },
    { id: 'drei' }
];

beforeEach(() => localStorage.clear());

describe('Showcase-Onboarding', () => {
    it('merkt gesehene Demos ohne Duplikate', () => {
        markShowcaseStorySeen('eins');
        markShowcaseStorySeen('eins');
        markShowcaseStorySeen('zwei');
        expect(seenShowcaseIds()).toEqual(['eins', 'zwei']);
    });

    it('empfiehlt die nächste ungesehene Demo in sinnvoller Reihenfolge', () => {
        expect(nextUnseenShowcaseStory(stories, ['eins'], 'eins')?.id).toBe('zwei');
        expect(nextUnseenShowcaseStory(stories, ['eins', 'drei'], 'drei')?.id).toBe('zwei');
        expect(nextUnseenShowcaseStory(stories, ['eins', 'zwei', 'drei'], 'drei')).toBeNull();
    });

    it('erkennt den Abschluss aller sichtbaren Demos', () => {
        expect(allShowcaseStoriesSeen(stories, ['eins', 'zwei', 'drei'])).toBe(true);
        expect(allShowcaseStoriesSeen(stories, ['eins', 'zwei'])).toBe(false);
    });

    it('unterdrückt das automatische Angebot nach Abwahl, Import oder Abschluss', () => {
        expect(isShowcaseAutoSuppressed()).toBe(false);
        markShowcaseDismissed();
        expect(isShowcaseAutoSuppressed()).toBe(true);

        localStorage.clear();
        markShowcaseImportCompleted();
        expect(isShowcaseAutoSuppressed()).toBe(true);

        localStorage.clear();
        markShowcaseCompleted();
        expect(isShowcaseAutoSuppressed()).toBe(true);
    });

    it('hebt nach bewusstem Datenlöschen nur die Import-Sperre wieder auf', () => {
        markShowcaseImportCompleted();
        expect(isShowcaseAutoSuppressed()).toBe(true);
        clearShowcaseImportCompleted();
        expect(isShowcaseAutoSuppressed()).toBe(false);

        markShowcaseDismissed();
        markShowcaseImportCompleted();
        clearShowcaseImportCompleted();
        expect(isShowcaseAutoSuppressed()).toBe(true);
    });

    it('öffnet automatisch nur in einer freien, leeren App', () => {
        expect(canAutoOfferShowcase()).toBe(true);
        for (const blocker of [
            { suppressed: true },
            { hasCustomers: true },
            { allStoriesSeen: true },
            { running: true },
            { dialogOpen: true },
            { locked: true },
            { blockingDialogOpen: true }
        ]) {
            expect(canAutoOfferShowcase(blocker)).toBe(false);
        }
    });

    it('verdrahtet Fünf-Sekunden-Start, Importabschluss und mobiles Vollformat', () => {
        const showcase = readFileSync(resolve(process.cwd(), 'src/ui/showcase.js'), 'utf8');
        const importWizard = readFileSync(resolve(process.cwd(), 'src/ui/importWizard.js'), 'utf8');
        const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/showcase.css'), 'utf8');

        expect(showcase).toContain('AUTO_OFFER_DELAY_MS = 5000');
        expect(showcase).toContain("on('app:ready', scheduleAutoOffer)");
        expect(showcase).toContain("on('dataset:cleared', restartAutoOfferAfterDataClear)");
        expect(showcase).toContain('if (!hasCustomers)');
        expect(showcase).toContain('clearShowcaseImportCompleted()');
        expect(showcase).toContain('showStoryCompletion(story)');
        expect(importWizard).toContain('markShowcaseImportCompleted()');
        expect(main).toContain("emit('app:ready')");
        expect(sidebar).toContain("emit('dataset:cleared')");
        expect(css).toContain('#showcase-dialog[open]');
        expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) auto');
    });
});

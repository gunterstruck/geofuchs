import { beforeEach, describe, expect, it } from 'vitest';
import {
    FIRST_STEPS,
    firstStepsFor,
    allFirstStepsDone,
    deriveCompletedSteps,
    dismissFirstSteps,
    firstStepsProgress,
    markFirstStepDone,
    resetFirstSteps,
    setFirstStepsCollapsed,
    shouldAutoCollapseFirstSteps,
    shouldShowFirstSteps,
    unhideFirstSteps
} from '../src/features/firstSteps.js';

beforeEach(() => localStorage.clear());

describe('Erste-Schritte-Checkliste (Logik)', () => {
    it('hakt jeden Schritt genau einmal dauerhaft ab', () => {
        expect(markFirstStepDone('daten')).toBe(true);
        expect(markFirstStepDone('daten')).toBe(false);
        expect(firstStepsProgress().done).toEqual(['daten']);
    });

    it('ignoriert unbekannte Schritt-IDs', () => {
        expect(markFirstStepDone('quatsch')).toBe(false);
        expect(firstStepsProgress().done).toEqual([]);
    });

    it('leitet erledigte Schritte aus dem App-Zustand ab', () => {
        expect(deriveCompletedSteps()).toEqual([]);
        expect(deriveCompletedSteps({ tourStopCount: 0 })).toEqual([]);
        // Sobald die Tour Stopps hat, gilt „Erste Tour planen" als erledigt.
        expect(deriveCompletedSteps({ tourStopCount: 2 })).toEqual(['tour']);
    });

    it('bietet vier gerätegerechte Live-Demos (kein Import in der Checkliste)', () => {
        const desktop = firstStepsFor({ isDesktop: true });
        const mobile = firstStepsFor({ isDesktop: false });
        expect(desktop).toHaveLength(4);
        expect(mobile).toHaveLength(4);
        // Alle Schritte sind Live-Demos.
        expect(desktop.every((s) => s.showcase && !s.action)).toBe(true);
        expect(mobile.every((s) => s.showcase && !s.action)).toBe(true);
        // Stabile IDs (Fortschritt); nur der dritte Schritt ist gerätegerecht.
        expect(desktop.map((s) => s.id)).toEqual(['daten', 'tour', 'handy', 'sicher']);
        expect(mobile.map((s) => s.id)).toEqual(['daten', 'tour', 'handy', 'sicher']);
        expect(desktop.find((s) => s.id === 'handy').showcase).toBe('handy-qr');
        expect(mobile.find((s) => s.id === 'handy').showcase).toBe('empfang');
    });

    it('zeigt die Karte nur mit Daten, bis abgewählt oder alles erledigt ist', () => {
        expect(shouldShowFirstSteps({ customerCount: 0 })).toBe(false);
        expect(shouldShowFirstSteps({ customerCount: 3 })).toBe(true);
        expect(shouldShowFirstSteps({ customerCount: 3, dismissed: true })).toBe(false);
        const alle = FIRST_STEPS.map((step) => step.id);
        expect(allFirstStepsDone(alle)).toBe(true);
        expect(shouldShowFirstSteps({ customerCount: 3, doneIds: alle })).toBe(false);
    });

    it('merkt sich Abwahl und lässt sich zurücksetzen', () => {
        dismissFirstSteps();
        expect(firstStepsProgress().dismissed).toBe(true);
        markFirstStepDone('tour');
        resetFirstSteps();
        expect(firstStepsProgress()).toEqual({ done: [], dismissed: false, collapsed: undefined });
    });

    it('macht die Abwahl über „Erste Schritte anzeigen" rückgängig – ausgeklappt', () => {
        markFirstStepDone('daten');
        dismissFirstSteps();
        setFirstStepsCollapsed(true);
        unhideFirstSteps();
        const progress = firstStepsProgress();
        expect(progress.dismissed).toBe(false);
        expect(progress.collapsed).toBe(false);
        expect(progress.done).toEqual(['daten']); // Fortschritt bleibt erhalten
    });

    it('wechselt zwischen ein- und ausgeklappt, ohne Fortschritt zu verlieren', () => {
        markFirstStepDone('daten');
        setFirstStepsCollapsed(true);
        expect(firstStepsProgress().collapsed).toBe(true);
        setFirstStepsCollapsed(false);
        expect(firstStepsProgress().collapsed).toBe(false);
        expect(firstStepsProgress().done).toEqual(['daten']);
    });

    it('klappt automatisch ein, sobald der Nutzer erkennbar arbeitet', () => {
        // Nur Daten geladen: Kennenlernphase, Karte bleibt ausgeklappt.
        expect(shouldAutoCollapseFirstSteps({ doneIds: ['daten'] })).toBe(false);
        // Ein weiterer Schritt oder Stopps in der Tour: Zeile reicht.
        expect(shouldAutoCollapseFirstSteps({ doneIds: ['daten', 'tour'] })).toBe(true);
        expect(shouldAutoCollapseFirstSteps({ doneIds: ['daten'], tourStopCount: 1 })).toBe(true);
        expect(shouldAutoCollapseFirstSteps({})).toBe(false);
    });

    it('übersteht kaputte Persistenz ohne Fehler', () => {
        localStorage.setItem('tf_first_steps', '{kaputt');
        expect(firstStepsProgress()).toEqual({ done: [], dismissed: false, collapsed: undefined });
        localStorage.setItem('tf_first_steps', JSON.stringify({ done: [1, 'tour'], dismissed: 'ja', collapsed: 'ja' }));
        expect(firstStepsProgress()).toEqual({ done: ['tour'], dismissed: false, collapsed: undefined });
    });
});

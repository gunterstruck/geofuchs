import { beforeEach, describe, expect, it } from 'vitest';
import {
    FIRST_STEPS,
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
        expect(deriveCompletedSteps({ customerCount: 5, fileName: 'Demo-Daten' }))
            .toEqual(['daten']);
        expect(deriveCompletedSteps({ customerCount: 5, fileName: 'Demo-Daten', tourStopCount: 2 }))
            .toEqual(['daten', 'tour']);
        // Eigene Datei zählt nur mit geladenen Kunden und nicht für Demo-Daten
        expect(deriveCompletedSteps({ customerCount: 5, fileName: 'kunden.xlsx' }))
            .toEqual(['daten', 'eigene']);
        expect(deriveCompletedSteps({ customerCount: 0, fileName: 'kunden.xlsx' }))
            .toEqual([]);
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

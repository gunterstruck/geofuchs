/**
 * „Erste Schritte"-Karte in der Sidebar.
 *
 * Beobachtet den App-Zustand über die bestehenden Events und hakt Schritte
 * dauerhaft ab. Ausblendbar; verschwindet von selbst, sobald alles erledigt
 * ist (mit einem kurzen Abschluss-Toast).
 */

import { state, on } from '../core/state.js';
import {
    FIRST_STEPS,
    allFirstStepsDone,
    deriveCompletedSteps,
    dismissFirstSteps,
    firstStepsProgress,
    markFirstStepDone,
    shouldShowFirstSteps
} from '../features/firstSteps.js';
import { showToast } from './toast.js';

let container = null;
let celebrated = false;

/** Ableitbare Schritte dauerhaft festschreiben, dann Fortschritt lesen. */
function persistedProgress() {
    for (const id of deriveCompletedSteps({
        customerCount: state.customers.length,
        fileName: state.fileName,
        tourStopCount: state.tour.stops.length
    })) {
        markFirstStepDone(id);
    }
    return firstStepsProgress();
}

function render() {
    if (!container) return;
    const progress = persistedProgress();
    const allDone = allFirstStepsDone(progress.done);
    const show = shouldShowFirstSteps({
        customerCount: state.customers.length,
        doneIds: progress.done,
        dismissed: progress.dismissed
    });

    if (!show) {
        if (allDone && !progress.dismissed && state.customers.length > 0 && !celebrated) {
            celebrated = true;
            showToast('🎉 Erste Schritte abgeschlossen – TourFuchs gehört jetzt dir.', 'success', 5000);
        }
        container.hidden = true;
        container.innerHTML = '';
        return;
    }

    const done = new Set(progress.done);
    const doneCount = FIRST_STEPS.filter((step) => done.has(step.id)).length;
    container.hidden = false;
    container.innerHTML = `
        <div class="first-steps-head">
            <b>🦊 Erste Schritte</b>
            <span class="muted small">${doneCount}/${FIRST_STEPS.length}</span>
            <button type="button" class="first-steps-dismiss" title="Checkliste ausblenden" aria-label="Checkliste ausblenden">✕</button>
        </div>
        <ul class="first-steps-list">
            ${FIRST_STEPS.map((step) => `
                <li class="${done.has(step.id) ? 'done' : ''}">
                    <span class="first-steps-mark" aria-hidden="true">${done.has(step.id) ? '✓' : step.icon}</span>
                    <span class="first-steps-text"><b>${step.label}</b><small>${step.hint}</small></span>
                </li>`).join('')}
        </ul>`;
    container.querySelector('.first-steps-dismiss').addEventListener('click', () => {
        dismissFirstSteps();
        render();
    });
}

/** Vom Tour-Panel aufgerufen, sobald der QR-Übergabe-Dialog geöffnet wurde. */
export function noteTourSharedToPhone() {
    if (markFirstStepDone('handy')) render();
}

export function initFirstSteps() {
    container = document.getElementById('first-steps');
    if (!container) return;
    on('customers:changed', render);
    on('tour:changed', render);
    on('app:ready', render);
}

/**
 * „Erste Schritte"-Karte in der Sidebar – drei Zustände statt an/aus:
 *
 *  1. Ausgeklappt: volle Karte, gehört der Kennenlernphase.
 *  2. Eingeklappt: schmale Fortschrittszeile „🦊 Erste Schritte 2/4 ▸"
 *     (Muster wie der eingeklappte Bezirks-Scope). Klick klappt wieder auf.
 *  3. Abgewählt: nur über das explizite „Nicht mehr zeigen"; über den
 *     Info-Dialog („Erste Schritte anzeigen") jederzeit umkehrbar.
 *
 * Die Karte klappt von selbst ein, sobald der Nutzer erkennbar arbeitet:
 * Ein frisch abgehakter Schritt bleibt kurz als Feedback sichtbar (~4 s),
 * danach reicht die Zeile. Auf dem Handy startet sie direkt eingeklappt.
 */

import { state, on } from '../core/state.js';
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
} from '../features/firstSteps.js';
import { showToast } from './toast.js';
import { startShowcaseStory } from './showcase.js';

const COLLAPSE_FEEDBACK_MS = 4000;

let container = null;
let celebrated = false;
let collapseTimer = null;

const isMobileUi = () => window.matchMedia('(max-width: 900px)').matches;

/** Ableitbare Schritte festschreiben; liefert Fortschritt + frisch Erledigtes. */
function persistedProgress() {
    const fresh = [];
    for (const id of deriveCompletedSteps({
        customerCount: state.customers.length,
        fileName: state.fileName,
        tourStopCount: state.tour.stops.length
    })) {
        if (markFirstStepDone(id)) fresh.push(id);
    }
    return { progress: firstStepsProgress(), fresh };
}

/** Eingeklappt? Gespeicherte Wahl gewinnt; sonst Gerät + Arbeitskontext. */
function effectiveCollapsed(progress) {
    if (typeof progress.collapsed === 'boolean') return progress.collapsed;
    return isMobileUi() || shouldAutoCollapseFirstSteps({
        doneIds: progress.done,
        tourStopCount: state.tour.stops.length
    });
}

function scheduleAutoCollapse() {
    clearTimeout(collapseTimer);
    collapseTimer = setTimeout(() => {
        setFirstStepsCollapsed(true);
        render();
    }, COLLAPSE_FEEDBACK_MS);
}

function render() {
    if (!container) return;
    const { progress, fresh } = persistedProgress();
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
        clearTimeout(collapseTimer);
        container.hidden = true;
        container.classList.remove('collapsed');
        container.innerHTML = '';
        return;
    }

    const done = new Set(progress.done);
    const doneCount = FIRST_STEPS.filter((step) => done.has(step.id)).length;

    if (effectiveCollapsed(progress)) {
        clearTimeout(collapseTimer);
        container.hidden = false;
        container.classList.add('collapsed');
        container.innerHTML = `
            <button type="button" class="first-steps-chip">🦊 Erste Schritte <b>${doneCount}/${FIRST_STEPS.length}</b><span class="muted"> ▸</span></button>`;
        container.querySelector('.first-steps-chip').addEventListener('click', () => {
            setFirstStepsCollapsed(false);
            render();
        });
        return;
    }

    container.hidden = false;
    container.classList.remove('collapsed');
    container.innerHTML = `
        <div class="first-steps-head">
            <b>🦊 Erste Schritte</b>
            <span class="muted small">${doneCount}/${FIRST_STEPS.length}</span>
        </div>
        <ul class="first-steps-list">
            ${FIRST_STEPS.map((step) => `
                <li class="${done.has(step.id) ? 'done' : ''}">
                    ${step.showcase ? `<button type="button" class="first-steps-action" data-showcase="${step.showcase}" aria-label="${step.label} – Live-Demo starten">
                        <span class="first-steps-mark" aria-hidden="true">${done.has(step.id) ? '✓' : step.icon}</span>
                        <span class="first-steps-text"><b>${step.label}</b><small>${step.hint}</small></span>
                        <span class="first-steps-play" aria-hidden="true">▶</span>
                    </button>` : `<div class="first-steps-static">
                        <span class="first-steps-mark" aria-hidden="true">${done.has(step.id) ? '✓' : step.icon}</span>
                        <span class="first-steps-text"><b>${step.label}</b><small>${step.hint}</small></span>
                    </div>`}
                </li>`).join('')}
        </ul>
        <div class="first-steps-foot">
            <button type="button" class="first-steps-later">Später</button>
            <button type="button" class="linklike first-steps-never">Nicht mehr zeigen</button>
        </div>`;
    container.querySelectorAll('.first-steps-action').forEach((button) => {
        button.addEventListener('click', () => {
            if (!startShowcaseStory(button.dataset.showcase)) {
                showToast('Diese Live-Demo ist in dieser Ansicht nicht verfügbar.', 'info', 4000);
            }
        });
    });
    container.querySelector('.first-steps-later').addEventListener('click', () => {
        setFirstStepsCollapsed(true);
        render();
    });
    container.querySelector('.first-steps-never').addEventListener('click', () => {
        dismissFirstSteps();
        render();
        showToast('Erste Schritte ausgeblendet – jederzeit über ℹ️ Info wieder einblendbar.', 'info', 5000);
    });

    // Frisch abgehakte Schritte kurz zeigen, dann Platz freigeben.
    if (fresh.length && shouldAutoCollapseFirstSteps({
        doneIds: progress.done,
        tourStopCount: state.tour.stops.length
    })) scheduleAutoCollapse();
}

/** Vom Tour-Panel aufgerufen, sobald der QR-Übergabe-Dialog geöffnet wurde. */
export function noteTourSharedToPhone() {
    if (markFirstStepDone('handy')) render();
}

export function initFirstSteps() {
    container = document.getElementById('first-steps');
    if (!container) return;

    // Info-Dialog: bewusste Abwahl jederzeit umkehrbar machen.
    document.getElementById('btn-first-steps-restore')?.addEventListener('click', () => {
        unhideFirstSteps();
        document.getElementById('info-dialog')?.close();
        render();
        if (state.customers.length === 0) {
            showToast('Die Erste-Schritte-Checkliste erscheint, sobald Daten geladen sind.', 'info', 5000);
        }
    });

    on('customers:changed', render);
    on('tour:changed', render);
    on('app:ready', render);

    // Bewusstes „Daten löschen" ist ein Neustart: Wie beim Demo-Fortschritt des
    // Schaufensters beginnt auch die Erste-Schritte-Checkliste wieder von vorn –
    // inklusive einer früheren Abwahl.
    on('dataset:cleared', () => {
        resetFirstSteps();
        celebrated = false;
        render();
    });
}

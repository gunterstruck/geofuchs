/**
 * Zentraler Willkommens-Hinweis über der Karte, solange Beispieldaten laufen.
 *
 * Beantwortet im Demo-Termin die entscheidende Frage „Das sind nur Beispiele –
 * wie komme ich an MEINE Daten?": eine gut sichtbare, aber nicht blockierende
 * Karte über der Landkarte mit drei klaren Wegen (eigene Daten laden · Live-
 * Demos ansehen · erst umsehen). Jeder Weg quittiert den Hinweis, damit er nicht
 * bei jedem Laden erneut aufpoppt – über ℹ️ und den Demo-Streifen bleibt er
 * jederzeit erreichbar. Nach bewusstem Löschen der Daten (echter Neustart)
 * erscheint er wieder.
 */
import { state, on } from '../core/state.js';
import { isDemoDataset } from '../core/demoSafety.js';

const ACK_KEY = 'tf_demo_welcome_ack';
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');

let root = null;

function store() {
    try { return globalThis.localStorage || null; } catch { return null; }
}

function acknowledged() {
    return store()?.getItem(ACK_KEY) === '1';
}

function markAcknowledged() {
    try { store()?.setItem(ACK_KEY, '1'); } catch { /* Speicherung ist optional */ }
}

function forgetAcknowledged() {
    try { store()?.removeItem(ACK_KEY); } catch { /* Speicherung ist optional */ }
}

/** Sichtbar nur bei aktiven Beispieldaten, noch nicht quittiert, echte Ansicht. */
function shouldShow() {
    if (insideMobilePreview) return false;
    if (acknowledged()) return false;
    if (document.querySelector('.sc-shield')) return false; // laufende Live-Demo
    return isDemoDataset(state.customers);
}

function render() {
    if (!root) return;
    root.hidden = !shouldShow();
}

/** Quittieren: merken und ausblenden. */
function dismiss() {
    markAcknowledged();
    render();
}

export function initDemoWelcome() {
    root = document.getElementById('demo-welcome');
    if (!root) return;

    // „Eigene Daten laden" quittiert ebenfalls; das Öffnen des geführten Dialogs
    // übernimmt der Import-Assistent (zweiter Listener auf demselben Knopf).
    document.getElementById('btn-demo-welcome-own')?.addEventListener('click', dismiss);
    // „Live-Demos ansehen" quittiert; das Öffnen des Schaufensters übernimmt das
    // Showcase-Modul (dort ist der Knopf mitregistriert).
    document.getElementById('btn-demo-welcome-demos')?.addEventListener('click', dismiss);
    document.getElementById('btn-demo-welcome-ack')?.addEventListener('click', dismiss);
    document.getElementById('btn-demo-welcome-close')?.addEventListener('click', dismiss);

    on('app:ready', render);
    on('customers:changed', render);
    on('demo:loaded', render);
    on('demo:auto-loaded', render);
    // Bewusstes Löschen ist ein echter Neustart: der Hinweis darf wiederkommen.
    on('dataset:cleared', () => { forgetAcknowledged(); render(); });

    render();
}

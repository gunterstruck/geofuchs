/**
 * „Erste Schritte" – lokale Aktivierungs-Checkliste nach dem ersten Import.
 *
 * Ersetzt den flüchtigen 6-Sekunden-Toast durch einen sichtbaren roten Faden
 * zum Kernnutzen (Tour, Handy-Übergabe, eigene Daten). Bewusst ohne Telemetrie:
 * Der Fortschritt liegt ausschließlich im Browser und dient nur dem Nutzer.
 *
 * DOM-frei mit injizierbarem Storage (Muster wie showcaseOnboarding.js),
 * damit die Logik in Node unit-testbar bleibt.
 */

// Vier Live-Demos als roter Faden. Der dritte Schritt ist gerätegerecht: am
// Desktop wird die Tour PER QR ans Handy gegeben, am Handy werden die
// gesicherten Daten EMPFANGEN – jeweils die Demo, die dort auch wirklich läuft.
export const FIRST_STEPS = [
    { id: 'daten',  icon: '🗺️', label: 'Kunden auf der Karte verstehen', hint: 'Live-Demo: vom Kundenstapel bis zum Detail', showcase: 'excel-karte' },
    { id: 'tour',   icon: '🧭', label: 'Erste Tour planen', hint: 'Live-Demo: Start wählen und Stopps hinzufügen', showcase: 'tour' },
    {
        id: 'handy', icon: '📲', label: 'Tour aufs Handy holen',
        hint: 'Live-Demo: QR-Code anzeigen und scannen', showcase: 'handy-qr',
        mobile: { icon: '📥', label: 'Daten aufs Handy holen', hint: 'Live-Demo: Datei wählen und Schlüssel scannen', showcase: 'empfang' }
    },
    { id: 'sicher', icon: '🔐', label: 'Daten im Tresor sichern', hint: 'Live-Demo: PIN setzen, verschlüsselt speichern', showcase: 'tresor' }
];

/**
 * Die vier Schritte für die aktuelle Ansicht. Auf dem Handy ersetzt der
 * gerätegerechte Variantensatz (step.mobile) den Desktop-Schritt – damit die
 * angebotene Demo genau die ist, die dort auch startbar ist.
 */
export function firstStepsFor({ isDesktop = true } = {}) {
    return FIRST_STEPS.map((step) => {
        const { mobile, ...base } = step;
        return (!isDesktop && mobile) ? { ...base, ...mobile } : base;
    });
}

const STORE_KEY = 'tf_first_steps';

function store(provided) {
    if (provided) return provided;
    try { return globalThis.localStorage || null; } catch { return null; }
}

function read(provided) {
    try {
        const raw = JSON.parse(store(provided)?.getItem(STORE_KEY) || '{}');
        return {
            done: Array.isArray(raw.done) ? raw.done.filter((id) => typeof id === 'string') : [],
            dismissed: raw.dismissed === true,
            // undefined = noch keine bewusste/automatische Wahl -> UI entscheidet
            // nach Gerät (mobil startet eingeklappt, Desktop ausgeklappt).
            collapsed: typeof raw.collapsed === 'boolean' ? raw.collapsed : undefined
        };
    } catch {
        return { done: [], dismissed: false, collapsed: undefined };
    }
}

function write(progress, provided) {
    try { store(provided)?.setItem(STORE_KEY, JSON.stringify(progress)); } catch { /* Speicherung ist optional */ }
}

export function firstStepsProgress(provided) {
    return read(provided);
}

/** @returns {boolean} true, wenn der Schritt jetzt frisch erledigt wurde */
export function markFirstStepDone(id, provided) {
    if (!FIRST_STEPS.some((step) => step.id === id)) return false;
    const current = read(provided);
    if (current.done.includes(id)) return false;
    write({ ...current, done: [...current.done, id] }, provided);
    return true;
}

/** „Nicht mehr zeigen" – bewusste, explizite Abwahl (über Info umkehrbar). */
export function dismissFirstSteps(provided) {
    write({ ...read(provided), dismissed: true }, provided);
}

/** Abwahl aufheben und ausklappen („Erste Schritte anzeigen" im Info-Dialog). */
export function unhideFirstSteps(provided) {
    write({ ...read(provided), dismissed: false, collapsed: false }, provided);
}

/** „Später" bzw. Chip-Klick: nur die Darstellung wechseln, nichts geht verloren. */
export function setFirstStepsCollapsed(collapsed, provided) {
    write({ ...read(provided), collapsed: collapsed === true }, provided);
}

export function resetFirstSteps(provided) {
    try { store(provided)?.removeItem(STORE_KEY); } catch { /* optional */ }
}

/**
 * Aus dem aktuellen App-Zustand ableitbare, gerade erfüllte Schritte.
 * Einmal erledigte Schritte bleiben über markFirstStepDone dauerhaft ✓,
 * auch wenn z. B. die Tour später wieder geleert wird.
 */
export function deriveCompletedSteps({ tourStopCount = 0 } = {}) {
    const done = [];
    if (tourStopCount > 0) done.push('tour');
    return done;
}

export function allFirstStepsDone(doneIds = []) {
    const done = new Set(doneIds);
    return FIRST_STEPS.every((step) => done.has(step.id));
}

/** Sichtbar nur mit geladenen Daten, solange nicht abgewählt oder abgeschlossen. */
export function shouldShowFirstSteps({ customerCount = 0, doneIds = [], dismissed = false } = {}) {
    return customerCount > 0 && !dismissed && !allFirstStepsDone(doneIds);
}

/**
 * Die volle Karte gehört der Kennenlernphase. Sobald der Nutzer erkennbar
 * arbeitet – ein weiterer Schritt über „Daten laden" hinaus ist erledigt oder
 * die Tour hat Stopps –, reicht die schmale Fortschrittszeile.
 */
export function shouldAutoCollapseFirstSteps({ doneIds = [], tourStopCount = 0 } = {}) {
    const done = new Set(doneIds);
    const beyondData = FIRST_STEPS.filter((step) => step.id !== 'daten' && done.has(step.id)).length;
    return beyondData > 0 || tourStopCount > 0;
}

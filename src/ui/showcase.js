/**
 * Schaufenster / Showcase – geführte Live-Demos.
 *
 * Ein Geister-Cursor fährt sichtbar durch die ECHTE, laufende App und klickt
 * echte Bedienelemente – die App reagiert wirklich (kein Video). So werden
 * versteckte Stärken (Tour, QR-Übergabe, Mobile-Ansicht) erlebbar.
 *
 * Sicherheit: Während einer Vorführung fängt ein Schutz-Overlay echte Klicks
 * ab (die Geister-Klicks laufen programmatisch und werden dadurch nicht
 * blockiert). Stories, die den Tour-Zustand verändern, sichern und stellen ihn
 * am Ende wieder her. ESC / „Abbrechen" bricht jederzeit sauber ab.
 */

import { STORIES, visibleStories } from '../features/stories.js';
import { state, emit, markDirty } from '../core/state.js';

const SEEN_KEY = 'tf_showcase_seen';
const DISMISS_KEY = 'tf_showcase_dismissed';
const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let cursorEl = null;
let bubbleEl = null;
let shieldEl = null;
let toolbarEl = null;
let dialog = null;
let running = false;
let aborted = false;
let activeReject = null;
let tourSnapshot = null;
let visitRestore = null;      // { id, besuche } zum Zurücksetzen von „Heute besucht"
let origConfirm = null;       // Originales window.confirm während patchConfirm

class AbortError extends Error {}

// ---- Persistenz ----
function seenIds() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
function markSeen(id) {
    const set = new Set(seenIds());
    set.add(id);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])); } catch { /* egal */ }
}
function isDismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

// ---- DOM der Show ----
function ensureDom() {
    if (cursorEl) return;
    cursorEl = document.createElement('div');
    cursorEl.className = 'sc-cursor';
    cursorEl.hidden = true;
    cursorEl.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2 L4 19 L8.6 14.6 L11.8 21.6 L14.6 20.4 L11.5 13.6 L18 13.6 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    bubbleEl = document.createElement('div');
    bubbleEl.className = 'sc-bubble';
    bubbleEl.hidden = true;
    document.body.append(cursorEl, bubbleEl);
}

// ---- Abbruch-sichere Pausen ----
function sleep(ms) {
    return new Promise((resolve, reject) => {
        const dur = prefersReduced ? Math.min(ms, 250) : ms;
        const timer = setTimeout(() => { activeReject = null; resolve(); }, dur);
        activeReject = () => { clearTimeout(timer); reject(new AbortError()); };
    });
}
function guard() { if (aborted) throw new AbortError(); }
function abortNow() {
    if (!running) return;
    aborted = true;
    if (activeReject) activeReject();
}

// ---- Element-Auflösung ----
function isVisible(el) { return el && el.offsetParent !== null; }
async function resolveEl(sel, timeout = 4000) {
    const start = Date.now();
    for (;;) {
        guard();
        const el = document.querySelector(sel);
        if (isVisible(el)) return el;
        if (Date.now() - start > timeout) return null;
        await sleep(120);
    }
}
function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Cursor/Blase/Leiste in die richtige Ebene hängen: Ein modaler <dialog> liegt
// im Top-Layer und würde die Overlays sonst verdecken. Elemente im offenen
// Dialog rendern darüber – also die Overlays dorthin verschieben.
function moveOverlaysInto(layer) {
    if (!layer || cursorEl?.parentElement === layer) return;
    layer.append(cursorEl, bubbleEl);
    if (toolbarEl) layer.append(toolbarEl);
}
function layerFor(el) {
    return (el && el.closest('dialog[open]')) || document.body;
}

// ---- Cursor-Bewegung / Klick ----
function placeCursor(x, y) {
    cursorEl.style.setProperty('--sc-x', `${x - 4}px`);
    cursorEl.style.setProperty('--sc-y', `${y - 2}px`);
    cursorEl.style.transform = `translate(${x - 4}px, ${y - 2}px)`;
}
async function moveTo(x, y) {
    cursorEl.hidden = false;
    placeCursor(x, y);
    await sleep(prefersReduced ? 120 : 680);
}
async function moveToEl(sel) {
    const el = await resolveEl(sel);
    if (!el) return null;
    moveOverlaysInto(layerFor(el));
    el.scrollIntoView({ block: 'center', behavior: prefersReduced ? 'auto' : 'smooth' });
    await sleep(prefersReduced ? 60 : 260);
    const c = centerOf(el);
    await moveTo(c.x, c.y);
    return el;
}
async function clickEl(sel) {
    const el = await moveToEl(sel);
    if (!el) return false;
    cursorEl.classList.add('sc-click', 'sc-press');
    await sleep(150);
    cursorEl.classList.remove('sc-press');
    el.click();
    await sleep(120);
    cursorEl.classList.remove('sc-click');
    await sleep(prefersReduced ? 120 : 420);
    return true;
}
async function typeInto(sel, text) {
    const el = await moveToEl(sel);
    if (!el) return false;
    el.focus();
    el.value = '';
    for (const ch of text) {
        guard();
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(prefersReduced ? 0 : 130);
    }
    return true;
}
async function selectValue(sel, value) {
    const el = await moveToEl(sel);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(prefersReduced ? 120 : 500);
    return true;
}

// ---- Sprechblase ----
async function say(text, sel) {
    bubbleEl.textContent = text;
    bubbleEl.hidden = false;
    // vorläufig platzieren, um Maße zu kennen
    bubbleEl.style.left = '-9999px';
    bubbleEl.style.top = '0px';
    bubbleEl.classList.add('sc-show');
    await sleep(10);
    const bw = bubbleEl.offsetWidth;
    const bh = bubbleEl.offsetHeight;
    const anchor = sel ? await resolveEl(sel, 800) : null;
    if (anchor) moveOverlaysInto(layerFor(anchor));
    let x;
    let y;
    if (anchor) {
        const r = anchor.getBoundingClientRect();
        x = Math.min(window.innerWidth - bw - 12, Math.max(12, r.left));
        y = r.bottom + 12 + bh > window.innerHeight ? r.top - bh - 12 : r.bottom + 12;
    } else {
        x = Math.max(12, Math.min(window.innerWidth - bw - 12, window.innerWidth / 2 - bw / 2));
        y = Math.max(64, window.innerHeight * 0.16);
    }
    bubbleEl.style.left = `${x}px`;
    bubbleEl.style.top = `${Math.max(58, y)}px`;
}
function hideBubble() {
    if (!bubbleEl) return;
    bubbleEl.classList.remove('sc-show');
    bubbleEl.hidden = true;
}

// ---- benannte Helfer (aus den Stories referenziert) ----
function scopedWithCoords() {
    return state.customers.filter((c) => c.lat !== null && c.lng !== null);
}
async function waitForCustomers(timeout = 6000) {
    const start = Date.now();
    while (state.customers.length === 0) {
        guard();
        if (Date.now() - start > timeout) return;
        await sleep(150);
    }
}

const HELPERS = {
    async ensureDemo() {
        if (state.customers.length > 0) return;
        await clickEl('#btn-demo');
        await waitForCustomers();
        await sleep(900);
    },
    async excelToMap() {
        if (state.customers.length === 0) {
            await clickEl('#btn-demo');
            await waitForCustomers();
        }
    },
    async gotoTour() {
        await clickEl('.mode-btn[data-mode="aussendienst"]');
        await sleep(300);
        await clickEl('.tab-button[data-tab="tour"]');
        await resolveEl('#tour-scope', 3000);
        await sleep(300);
    },
    async gotoDaten() {
        await clickEl('.tab-button[data-tab="daten"]');
        await resolveEl('#vault-controls', 3000);
        await sleep(300);
    },
    async pickBezirkAll() {
        const ok = await selectValue('#tour-bezirk', '__all__');
        if (!ok) { state.tour.bezirk = '__all__'; emit('tour:scope-changed'); emit('tour:changed'); }
        await sleep(500);
    },
    async pickStart() {
        await typeInto('#start-search', 'au');
        const res = await resolveEl('#start-results .result-row', 2200);
        if (res) { await clickEl('#start-results .result-row'); await sleep(500); return; }
        // Fallback: Startpunkt direkt setzen
        const c = scopedWithCoords()[0];
        if (c) {
            state.tour.start = { lat: c.lat, lng: c.lng, label: c.name, customerId: c.id };
            emit('tour:changed');
        }
        await sleep(400);
    },
    async addTwoSuggestions() {
        for (let i = 0; i < 2; i++) {
            const add = await resolveEl('#tour-suggestions [data-add]', 2500);
            if (add) { await clickEl('#tour-suggestions [data-add]'); await sleep(600); continue; }
            // Fallback: einen weiteren verorteten Kunden anhängen
            const startId = state.tour.start?.customerId;
            const cand = scopedWithCoords().find((c) => c.id !== startId && !state.tour.stops.includes(c.id));
            if (cand) { state.tour.stops.push(cand.id); emit('tour:changed'); }
            await sleep(400);
        }
    },
    async closeQr() {
        const d = document.getElementById('qr-share-dialog');
        if (d?.open) d.close();
        await sleep(400);
    },
    // ---- Story 4: Simulation ----
    async gotoGebiete() {
        await clickEl('.mode-btn[data-mode="gebietsplanung"]');
        await sleep(300);
        await clickEl('.tab-button[data-tab="gebiete"]');
        await resolveEl('#btn-cockpit', 3000);
        await sleep(300);
    },
    async openCockpit() {
        await clickEl('#btn-cockpit');
        await resolveEl('#cockpit-dialog[open]', 3000);
        await sleep(600);
    },
    async simAssign() {
        // Alle sichtbaren Gebiete wählen und auf einen Zielbezirk umbuchen
        await clickEl('#sim-select-all');
        await sleep(500);
        const rep = await moveToEl('#sim-rep');
        if (rep && rep.options.length) {
            rep.value = rep.options[Math.min(1, rep.options.length - 1)].value;
            rep.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await sleep(400);
        await clickEl('#sim-apply');
        await sleep(700);
    },
    async simToMap() {
        await clickEl('#cockpit-to-map');
        await resolveEl('#simulation-map-bar:not([hidden])', 3000);
        await sleep(700);
    },
    async simCycleViews() {
        for (const v of ['old', 'new', 'changes']) {
            await clickEl(`[data-simulation-view="${v}"]`);
            await sleep(1100);
        }
    },
    async simDiscard() {
        // window.confirm ist während patchConfirm auf „true" gesetzt
        await clickEl('#simulation-map-discard');
        await sleep(600);
    },
    // ---- Story 5: Chancen & Abhaken ----
    async chancenOn() {
        await clickEl('.seg[data-view="chancen"]');
        await sleep(700);
    },
    async checkVisit() {
        const id = state.tour.stops[0];
        const c = id && state.customers.find((x) => x.id === id);
        if (c) visitRestore = { id: c.id, besuche: [...(c.besuche || [])] };
        const btn = await resolveEl('#tour-stops .stop-visit', 2500);
        if (btn) await clickEl('#tour-stops .stop-visit');
        await sleep(500);
    }
};

// ---- Schritt-Ausführung ----
async function runStep(step) {
    switch (step.t) {
        case 'say': await say(step.text, step.sel); await sleep(step.ms ?? 1800); break;
        case 'move': await moveToEl(step.sel); break;
        case 'click': await clickEl(step.sel); break;
        case 'type': await typeInto(step.sel, step.text); break;
        case 'select': await selectValue(step.sel, step.value); break;
        case 'wait': await sleep(step.ms ?? 800); break;
        case 'waitFor': await resolveEl(step.sel, step.ms ?? 4000); break;
        case 'run': if (HELPERS[step.key]) await HELPERS[step.key](); break;
        default: break;
    }
}

// ---- Chrome (Shield + Toolbar) ----
function showChrome(story) {
    shieldEl = document.createElement('div');
    shieldEl.className = 'sc-shield';
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'sc-toolbar';
    toolbarEl.innerHTML = `<span>🦊 <b>Vorführung läuft</b></span>
        <span class="sc-progress"></span>
        <button type="button" class="sc-cancel">Beenden</button>`;
    document.body.append(shieldEl, toolbarEl);
    toolbarEl.querySelector('.sc-cancel').addEventListener('click', abortNow);
    cursorEl.hidden = false;
    placeCursor(window.innerWidth / 2, window.innerHeight / 2);
}
function setProgress(i, n) {
    const el = toolbarEl?.querySelector('.sc-progress');
    if (el) el.textContent = `${Math.min(i + 1, n)} / ${n}`;
}
function cleanup(story) {
    hideBubble();
    // Overlays zurück in den Body holen (falls sie in einem Dialog hingen)
    if (cursorEl) { document.body.append(cursorEl, bubbleEl); cursorEl.hidden = true; cursorEl.classList.remove('sc-click', 'sc-press'); }
    shieldEl?.remove(); shieldEl = null;
    toolbarEl?.remove(); toolbarEl = null;

    // Simulation gefahrlos verwerfen (auch bei Abbruch) – confirm dabei bejahen
    const savedConfirm = window.confirm;
    window.confirm = () => true;
    try {
        const bar = document.getElementById('simulation-map-bar');
        if (bar && !bar.hidden) document.getElementById('simulation-map-discard')?.click();
        const cockpit = document.getElementById('cockpit-dialog');
        if (cockpit?.open) { document.getElementById('sim-reset')?.click(); cockpit.close(); }
    } finally {
        window.confirm = origConfirm ?? savedConfirm;
        origConfirm = null;
    }

    // Weitere Overlays schließen
    const qr = document.getElementById('qr-share-dialog');
    if (qr?.open) qr.close();
    const mp = document.getElementById('mobile-preview');
    if (mp && !mp.hidden) document.getElementById('btn-mobile-preview')?.click();

    // Chancen-Fokus zurücksetzen
    if (state.ui.opportunityOnly) { state.ui.opportunityOnly = false; emit('customers:changed'); }

    // „Heute besucht" der Vorführung zurücknehmen
    if (visitRestore) {
        const c = state.customers.find((x) => x.id === visitRestore.id);
        if (c) { c.besuche = visitRestore.besuche; markDirty(); }
        visitRestore = null;
    }

    // Tour-Zustand wiederherstellen
    if (story?.mutatesTour && tourSnapshot) {
        Object.keys(state.tour).forEach((k) => delete state.tour[k]);
        Object.assign(state.tour, tourSnapshot);
        emit('tour:scope-changed');
        emit('tour:changed');
    }
    tourSnapshot = null;
}

// ---- Ablauf ----
async function play(story) {
    if (running) return;
    running = true;
    aborted = false;
    ensureDom();
    if (story.mutatesTour) tourSnapshot = JSON.parse(JSON.stringify(state.tour));
    if (story.patchConfirm) { origConfirm = window.confirm; window.confirm = () => true; }
    showChrome(story);
    try {
        for (let i = 0; i < story.steps.length; i++) {
            guard();
            setProgress(i, story.steps.length);
            await runStep(story.steps[i]);
        }
        markSeen(story.id);
    } catch (err) {
        if (!(err instanceof AbortError)) console.warn('Showcase-Story abgebrochen:', err);
    } finally {
        cleanup(story);
        running = false;
    }
}

// ---- Intro-Panel ----
function buildPanel() {
    const seen = new Set(seenIds());
    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    const tiles = visibleStories({ isDesktop }).map((s) => `
        <button type="button" class="sc-tile" data-story="${s.id}">
            <span class="sc-tile-icon">${s.icon}</span>
            <span class="sc-tile-body"><b>${s.title}</b><span>${s.blurb}</span></span>
            ${seen.has(s.id) ? '<span class="sc-tile-seen" title="schon gesehen">✓</span>' : '<span class="sc-tile-play">▶</span>'}
        </button>`).join('');
    dialog.innerHTML = `
        <div class="sc-panel-head">
            <div class="sc-panel-fox">🦊</div>
            <h2>Soll ich dir kurz zeigen, was ich kann?</h2>
            <p>Wähl eine Geschichte – ich führe sie live vor, ganz von allein. Dauert je ~20 Sekunden.</p>
        </div>
        <div class="sc-tiles">${tiles}</div>
        <div class="sc-panel-foot">
            <label><input type="checkbox" id="sc-dismiss"> Nicht mehr automatisch zeigen</label>
            <button type="button" class="sc-later primary">Später</button>
        </div>`;
    dialog.querySelectorAll('.sc-tile').forEach((tile) => {
        tile.addEventListener('click', () => {
            const story = STORIES.find((s) => s.id === tile.dataset.story);
            persistDismissChoice();
            dialog.close();
            if (story) play(story);
        });
    });
    dialog.querySelector('.sc-later').addEventListener('click', () => { persistDismissChoice(); dialog.close(); });
}
function persistDismissChoice() {
    const cb = document.getElementById('sc-dismiss');
    if (cb?.checked) { try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* egal */ } }
}
function openPanel() {
    if (!dialog) return;
    buildPanel();
    dialog.showModal();
}

export function initShowcase() {
    dialog = document.getElementById('showcase-dialog');
    if (!dialog) return;
    ensureDom();

    document.getElementById('btn-showcase')?.addEventListener('click', () => {
        document.getElementById('info-dialog')?.close();
        openPanel();
    });

    // ESC bricht eine laufende Vorführung ab (statt nur den Dialog zu schließen)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && running) { e.preventDefault(); abortNow(); } }, true);

    // Erststart am Desktop: Angebot einmal automatisch einblenden
    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    if (isDesktop && !isDismissed()) {
        setTimeout(() => {
            const lock = document.getElementById('vault-lock');
            const locked = lock && !lock.hidden;
            if (!running && !dialog.open && !locked) openPanel();
        }, 1600);
    }
}

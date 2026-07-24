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

import { STORIES, visibleStories, visibleStorySteps, prepareShowcaseTour, selectShowcaseTour } from '../features/stories.js';
import { state, emit, markDirty, datasetSnapshot, on } from '../core/state.js';
import { isEnabled as vaultEnabled, removeVaultMeta } from '../services/vault.js';
import { saveDataset } from '../services/storage.js';
import {
    allShowcaseStoriesSeen,
    markShowcaseCompleted,
    markShowcaseStorySeen,
    nextUnseenShowcaseStory,
    resetShowcaseAfterDataClear,
    seenShowcaseIds
} from '../services/showcaseOnboarding.js';
import { distanceKm } from '../services/geocode.js';
import { openSetupDialog, showRecoveryCodeForDemo } from './lockVault.js';
import { flyToCustomer, fitToCustomers, fitTourRoute, focusMapArea, closeMapPopups } from '../features/map.js';
import { showMapView, captureSheetForDemo, expandSheetForDemo, restoreSheetAfterDemo, applyDepth, applyMode } from './sidebar.js';
import { showKeyStepForDemo } from './safeTransfer.js';
import { openCustomerBriefing as openBriefingDialog } from './customerBriefing.js';
import { loadDemo } from './importWizard.js';

const ROUTING_CONSENT_KEY = 'gf_routing_consent';

const isMobileView = () => window.matchMedia('(max-width: 768px)').matches;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');

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
let priorConsent = undefined; // Routing-Zustimmung vor der Demo (zum Zurücksetzen)
let demoVaultCreated = false; // hat DIESE Demo den Tresor angelegt? (nur dann abbauen)
let priorDepth = null;        // Ansichtstiefe vor der Demo (zum Zurücksetzen)
let priorMode = null;         // Arbeitsfokus vor der Demo (zum Zurücksetzen)
let showcaseTourPlan = null;  // reproduzierbare Start-/Stoppwahl der aktuellen Demo

class AbortError extends Error {}

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
function sleepExact(ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { activeReject = null; resolve(); }, ms);
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
function isVisible(el) {
    if (!el) return false;
    // Ein geöffnetes natives <dialog> liegt im Top-Layer und besitzt je nach
    // Browser keinen offsetParent. Es ist trotzdem sichtbar.
    if (el.matches?.('dialog[open]')) return true;
    return el.offsetParent !== null || el.getClientRects().length > 0;
}
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
async function clickEl(sel, { keepOverlaysOutside = false } = {}) {
    const el = await moveToEl(sel);
    if (!el) return false;
    cursorEl.classList.add('sc-click', 'sc-press');
    await sleep(150);
    cursorEl.classList.remove('sc-press');
    // Manche Dialog-Aktionen ersetzen ihren kompletten Inhalt. In diesem Fall
    // müssen Cursor, Blase und Fortschritt vorher aus dem Dialog heraus.
    if (keepOverlaysOutside) moveOverlaysInto(document.body);
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
// Wert setzen, ohne das Feld zu fokussieren – auf dem Handy poppt so keine
// Tastatur auf (für PIN-Felder in der Tresor-Demo). Die Ziffern werden sichtbar
// „getippt", indem der Wert Zeichen für Zeichen wächst.
async function fillNoFocus(sel, value) {
    const el = await moveToEl(sel);
    if (!el) return false;
    el.value = '';
    for (const ch of String(value)) {
        guard();
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(prefersReduced ? 0 : 160);
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
async function say(text, sel, pos) {
    bubbleEl.textContent = text;
    bubbleEl.hidden = false;
    bubbleEl.classList.remove('sc-show');
    // Vorläufig platzieren, um Maße zu kennen. Die Blase erscheint erst,
    // nachdem der Cursor sichtbar zum erklärten Element gewandert ist.
    bubbleEl.style.left = '-9999px';
    bubbleEl.style.top = '0px';
    await sleep(10);
    const bw = bubbleEl.offsetWidth;
    const bh = bubbleEl.offsetHeight;
    const anchor = sel ? await resolveEl(sel, 800) : null;
    if (anchor) {
        moveOverlaysInto(layerFor(anchor));
        anchor.scrollIntoView({ block: 'center', behavior: prefersReduced ? 'auto' : 'smooth' });
        await sleep(prefersReduced ? 40 : 240);
        const target = centerOf(anchor);
        await moveTo(target.x, target.y);
    }
    let x;
    let y;
    if (anchor) {
        const r = anchor.getBoundingClientRect();
        x = Math.min(window.innerWidth - bw - 12, Math.max(12, r.left));
        y = r.bottom + 12 + bh > window.innerHeight ? r.top - bh - 12 : r.bottom + 12;
    } else {
        x = Math.max(12, Math.min(window.innerWidth - bw - 12, window.innerWidth / 2 - bw / 2));
        // pos 'bottom': unter ein zentrales Karten-Popup, damit die Blase es nicht verdeckt.
        y = pos === 'bottom'
            ? Math.max(window.innerHeight * 0.5, window.innerHeight - bh - 180)
            : Math.max(64, window.innerHeight * 0.16);
    }
    bubbleEl.style.left = `${x}px`;
    bubbleEl.style.top = `${Math.max(58, y)}px`;
    bubbleEl.classList.add('sc-show');
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
function showcaseSearchTerm(customer) {
    const pool = scopedWithCoords();
    const name = String(customer?.name || '').trim();
    const terms = [name.slice(0, 12), name, String(customer?.plz || ''), String(customer?.ort || '')]
        .filter((term, index, all) => term.length >= 2 && all.indexOf(term) === index);
    return terms.find((term) => pool
        .filter((c) => c.name.toLowerCase().includes(term.toLowerCase())
            || String(c.ort || '').toLowerCase().includes(term.toLowerCase())
            || String(c.plz || '').startsWith(term))
        .slice(0, 6)
        .some((c) => c.id === customer.id)) || name;
}
function assignShowcaseStart(customer) {
    state.tour.start = {
        lat: customer.lat, lng: customer.lng, label: customer.name, customerId: customer.id,
        strasse: customer.strasse, plz: customer.plz, ort: customer.ort
    };
    emit('tour:changed');
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
        await loadDemo({ source: 'showcase', confirmReplacement: true, announce: false });
        await waitForCustomers();
        await sleep(1100);
    },
    async excelToMap() {
        if (state.customers.length === 0) {
            await loadDemo({ source: 'showcase', confirmReplacement: true, announce: false });
            await waitForCustomers();
        }
        showMapView();
        fitToCustomers();
        await sleep(1400);
    },
    async zoomToCustomerCards() {
        showMapView();
        await sleep(500);
        // Die echte Cluster-Interaktion sichtbar wiederholen, bis aus dem
        // Kundenstapel einzelne Kundenkacheln werden. So erklärt sich die
        // Zoom-Logik durch die Mausbewegung statt durch einen Sprung.
        for (let depth = 0; depth < 4; depth++) {
            if (await resolveEl('.customer-marker-card', 350)) break;
            if (!await resolveEl('.customer-stack-card', 900)) break;
            await clickEl('.customer-stack-card');
            await sleep(1100);
        }
    },
    async openCustomerCard() {
        if (await resolveEl('.customer-marker-card', 800)) {
            await clickEl('.customer-marker-card');
            await resolveEl('.leaflet-popup-content', 2200);
            await sleep(1100);
            return;
        }
        await HELPERS.showOneCustomer();
    },
    async openCustomerFromMap() {
        await HELPERS.zoomToCustomerCards();
        await HELPERS.openCustomerCard();
    },
    async focusDemoTourArea() {
        showcaseTourPlan = selectShowcaseTour(scopedWithCoords());
        const center = showcaseTourPlan?.center || { lat: 51.48, lng: 7.08 };
        document.querySelector('.mode-btn[data-mode="aussendienst"]')?.click();
        showMapView();
        focusMapArea(center.lat, center.lng, 10);
        await sleep(1700);
    },
    async showOneCustomer() {
        // Karte in den Vordergrund holen (auf dem Handy das Blatt einklappen),
        // dann in einen einzelnen Kunden zoomen und seine Infos zeigen.
        showMapView();
        await sleep(700);
        const located = scopedWithCoords();
        if (located.length === 0) return;
        const c = located.find((x) => x.umsatz && x.telefon) || located.find((x) => x.umsatz) || located[Math.floor(located.length / 2)];
        flyToCustomer(c, true);
        await sleep(2400);
    },
    async gotoTour() {
        await clickEl('.mode-btn[data-mode="aussendienst"]');
        await sleep(300);
        await clickEl('.tab-button[data-tab="tour"]');
        // Auf dem Handy das Blatt weit aufziehen, damit man die Bedienung sieht.
        expandSheetForDemo();
        await resolveEl('#tour-scope', 3000);
        await sleep(400);
    },
    async gotoDaten() {
        await clickEl('.tab-button[data-tab="daten"]');
        await resolveEl('#vault-controls', 3000);
        await sleep(300);
    },
    async gotoService() {
        await clickEl('.mode-btn[data-mode="service"]');
        await resolveEl('#service-customer-scope', 3000);
        await sleep(600);
    },
    async gotoServiceTour() {
        await clickEl('.tab-button[data-tab="tour"]');
        expandSheetForDemo();
        await resolveEl('#service-day-planner', 3000);
        await sleep(400);
    },
    async pickServiceStart() {
        // Start nahe am Tages-Cluster der Demo-Einsätze wählen, damit ein
        // kompakter, glaubwürdiger Tagesplan entsteht (statt Quer-durchs-Land).
        const byNumber = new Map(scopedWithCoords().map((c) => [String(c.nummer ?? '').trim(), c]));
        const clustered = (state.serviceVisits || [])
            .map((visit) => byNumber.get(String(visit.customerNumber ?? '').trim()))
            .filter(Boolean);
        const c = clustered[0] || scopedWithCoords()[0];
        if (c) assignShowcaseStart(c);
        await sleep(500);
    },
    async buildServiceDay() {
        await clickEl('#btn-service-day-preview');
        await resolveEl('#service-day-preview .service-day-preview-card', 6000);
        document.querySelector('#service-day-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(1200);
    },
    async pickBezirkAll() {
        const ok = await selectValue('#tour-bezirk', '__all__');
        if (!ok) { state.tour.bezirk = '__all__'; emit('tour:scope-changed'); emit('tour:changed'); }
        await sleep(500);
    },
    async pickStart() {
        const planned = showcaseTourPlan?.start;
        // Auf dem Handy NICHT ins Suchfeld tippen – das würde die Bildschirm-
        // tastatur öffnen und das halbe Panel verdecken. Dort Start direkt setzen.
        if (!isMobileView() && planned) {
            await typeInto('#start-search', showcaseSearchTerm(planned));
            const selector = `#start-results [data-id="${CSS.escape(String(planned.id))}"]`;
            const res = await resolveEl(selector, 2200);
            if (res) { await clickEl(selector); await sleep(500); return; }
        } else if (!isMobileView()) {
            await typeInto('#start-search', 'au');
            const res = await resolveEl('#start-results .result-row', 2200);
            if (res) { await clickEl('#start-results .result-row'); await sleep(500); return; }
        }
        const c = planned || scopedWithCoords()[0];
        if (c) assignShowcaseStart(c);
        await sleep(400);
    },
    async addOneSuggestion() {
        await HELPERS.addSuggestions(1);
    },
    async addTwoSuggestions() {
        await HELPERS.addSuggestions(2);
    },
    async addSuggestions(count = 2) {
        const plannedStops = showcaseTourPlan?.stops?.filter((c) => c.id !== state.tour.start?.customerId) || [];
        if (plannedStops.length >= count) {
            await moveToEl('#tour-suggestions');
            for (const customer of plannedStops.slice(0, count)) {
                const selector = `#tour-suggestions [data-add="${CSS.escape(String(customer.id))}"]`;
                if (await resolveEl(selector, 250)) await clickEl(selector);
                else if (!state.tour.stops.includes(customer.id)) {
                    state.tour.stops.push(customer.id);
                    emit('tour:changed');
                    await sleep(650);
                }
            }
            return;
        }
        for (let i = 0; i < count; i++) {
            const add = await resolveEl('#tour-suggestions [data-add]', 2500);
            if (add) { await clickEl('#tour-suggestions [data-add]'); await sleep(600); continue; }
            // Fallback: einen weiteren verorteten Kunden anhängen
            const startId = state.tour.start?.customerId;
            const cand = scopedWithCoords()
                .filter((c) => c.id !== startId && !state.tour.stops.includes(c.id))
                .sort((a, b) => distanceKm(state.tour.start, a) - distanceKm(state.tour.start, b))[0];
            if (cand) { state.tour.stops.push(cand.id); emit('tour:changed'); }
            await sleep(400);
        }
    },
    async focusTourRoute() {
        showMapView();
        await sleep(isMobileView() ? 700 : 300);
        fitTourRoute();
        await sleep(900);
    },
    async closeQr() {
        const d = document.getElementById('qr-share-dialog');
        if (d?.open) d.close();
        await sleep(400);
    },
    // Von Luftlinie auf die echte Straßenroute umschalten (OSRM). Zustimmung für
    // die Vorführung setzen und danach wieder auf den alten Stand bringen.
    async showRoadRoute() {
        if (priorConsent === undefined) {
            try { priorConsent = localStorage.getItem(ROUTING_CONSENT_KEY); } catch { priorConsent = null; }
        }
        try { localStorage.setItem(ROUTING_CONSENT_KEY, 'yes'); } catch { /* egal */ }
        await clickEl('#btn-route-focus');   // schaltet Luftlinie -> Straße (mapFocus ist bereits aktiv)
        await sleep(2600);                    // Straßenroute (OSRM) berechnen/zeichnen lassen
        fitTourRoute();
        await sleep(700);
    },
    // Fertige Tour als QR-Code zeigen (Barcode-Übergabe aufs Handy).
    async shareTourQr() {
        await clickEl('.tab-button[data-tab="tour"]');
        expandSheetForDemo();
        await sleep(300);
        const btn = await resolveEl('#btn-tour-qr', 2500);
        if (!btn || btn.disabled) throw new Error('Die Tour ist noch nicht für die QR-Übergabe bereit.');
        await clickEl('#btn-tour-qr');
        if (!await resolveEl('#qr-share-dialog[open]', 4000)) {
            throw new Error('Der QR-Code konnte nicht sichtbar geöffnet werden.');
        }
        await sleep(700);
    },
    // ---- Tresor: PIN wirklich eingeben und Wiederherstellungscode zeigen ----
    async typePinDemo() {
        await fillNoFocus('#setup-pin', '2468');
        await sleep(400);
        await fillNoFocus('#setup-pin2', '2468');
        await sleep(400);
    },
    async submitVaultSetup() {
        // Nur wirklich anlegen, wenn noch KEIN Tresor existiert – sonst würde ein
        // bestehender (echter) Tresor überschrieben. Bei vorhandenem Tresor wird
        // nur die Eingabe-UI gezeigt, ohne etwas anzulegen.
        if (vaultEnabled()) {
            moveOverlaysInto(document.body);
            showRecoveryCodeForDemo();
            await resolveEl('#recovery-code', 3000);
            await sleep(600);
            return;
        }
        await clickEl('#vault-setup-form button[type="submit"]', { keepOverlaysOutside: true });
        if (await resolveEl('#recovery-code', 12000)) demoVaultCreated = true;
        await sleep(600);
    },
    async finishVaultDemo() {
        const done = document.querySelector('#vault-dialog .vault-done');
        if (done) { await clickEl('#vault-dialog .vault-done'); }
        else { const d = document.getElementById('vault-dialog'); if (d?.open) d.close(); }
        await sleep(400);
    },
    async openReceive() {
        // Empfangs-Dialog öffnen (Datei-Schritt; Kamera startet hier noch nicht).
        // Auf dem Handy liegt der Button in der eingeklappten Daten-Ansicht und
        // ist für den Geister-Cursor nicht sichtbar erreichbar – dann direkt öffnen.
        const btn = await resolveEl('#btn-safe-receive', 1000);
        if (btn) await clickEl('#btn-safe-receive');
        else (document.getElementById('btn-safe-receive') || document.getElementById('btn-safe-receive-ob'))?.click();
        await resolveEl('#safe-receive-dialog[open]', 3000);
        await sleep(500);
    },
    async showReceiveKeyStep() {
        // Schritt 2 zeigen: Scanner-Bereich + manuelles Schlüsselfeld (ohne Kamera).
        showKeyStepForDemo();
        await sleep(800);
    },
    async typeReceiveKeyDemo() {
        // Den Eintipp-Fallback sichtbar aufklappen und einen Demo-Schlüssel
        // tippen – ohne „Entschlüsseln" zu drücken (es gibt ja keine Datei).
        const details = document.querySelector('#safe-step-key details.safe-fallback');
        if (details && !details.open) {
            await clickEl('#safe-step-key details.safe-fallback summary');
            await sleep(500);
        }
        await typeInto('#safe-key-input', 'TFK1:DEMO-SCHLÜSSEL');
        await sleep(700);
    },
    async closeReceive() {
        const d = document.getElementById('safe-receive-dialog');
        if (d?.open) d.close();
        const input = document.getElementById('safe-key-input');
        if (input) input.value = '';
        await sleep(400);
    },
    async openVaultSetup() {
        demoVaultCreated = false;
        // Setup-Formular garantiert öffnen (unabhängig von Tresor-Status/Topbar) –
        // sonst wäre das PIN-Modal in der Demo evtl. nicht sichtbar. Angelegt wird
        // erst beim Absenden, und nur wenn noch kein Tresor existiert.
        openSetupDialog();
        await resolveEl('#setup-pin', 3000);
        await sleep(500);
    },
    async closeVaultSetup() {
        const d = document.getElementById('vault-dialog');
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
    // ---- Story 5: Chancen & Kundenbriefing ----
    async chancenOn() {
        await clickEl('.seg[data-view="chancen"]');
        await sleep(700);
    },
    async openCustomerBriefing() {
        const stopId = state.tour.stops[0];
        const customer = state.customers.find((item) => item.id === stopId)
            || scopedWithCoords().find((item) => item.id !== state.tour.start?.customerId);
        if (!customer) throw new Error('Kein geeigneter Kunde für die Briefing-Demo gefunden.');

        showMapView();
        await sleep(isMobileView() ? 700 : 350);
        flyToCustomer(customer, true);
        await sleep(1600);

        const selector = `[data-action="customer-briefing"][data-id="${CSS.escape(String(customer.id))}"]`;
        const openedByClick = await clickEl(selector);
        if (!openedByClick) openBriefingDialog(customer);
        const briefing = document.getElementById('customer-briefing-dialog');
        if (!briefing?.open) throw new Error('Das Kundenbriefing konnte nicht geöffnet werden.');
        await sleep(500);
    },
    async closeCustomerBriefing() {
        moveOverlaysInto(document.body);
        const briefing = document.getElementById('customer-briefing-dialog');
        if (briefing?.open) briefing.close();
        await sleep(400);
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
    if (step.t !== 'say') hideBubble();
    switch (step.t) {
        case 'say': await say(step.text, step.sel, step.pos); await sleep(step.ms ?? 1800); break;
        case 'move': if (!await moveToEl(step.sel)) throw new Error('Demo-Ziel nicht sichtbar.'); break;
        case 'click': if (!await clickEl(step.sel)) throw new Error('Demo-Aktion nicht erreichbar.'); break;
        case 'type': if (!await typeInto(step.sel, step.text)) throw new Error('Demo-Eingabe nicht erreichbar.'); break;
        case 'select': if (!await selectValue(step.sel, step.value)) throw new Error('Demo-Auswahl nicht erreichbar.'); break;
        case 'wait': await sleep(step.ms ?? 800); break;
        case 'waitFor': if (!await resolveEl(step.sel, step.ms ?? 4000)) throw new Error('Demo-Ergebnis nicht sichtbar.'); break;
        case 'run': {
            const helper = HELPERS[step.key];
            if (!helper) throw new Error('Demo-Schritt ist nicht definiert.');
            await helper();
            break;
        }
        default: break;
    }
}

// ---- Chrome (Shield + Toolbar) ----
function showChrome(story) {
    shieldEl = document.createElement('div');
    shieldEl.className = 'sc-shield';
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'sc-toolbar';
    toolbarEl.innerHTML = `<span class="sc-story-label">${story.icon} <b>${story.title}</b></span>
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
    const recv = document.getElementById('safe-receive-dialog');
    if (recv?.open) recv.close();
    const briefing = document.getElementById('customer-briefing-dialog');
    if (briefing?.open) briefing.close();
    const vd = document.getElementById('vault-dialog');
    if (vd?.open) vd.close();
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
    showcaseTourPlan = null;

    // Routing-Zustimmung auf den Stand vor der Demo zurücksetzen.
    if (priorConsent !== undefined) {
        try {
            if (priorConsent === null) localStorage.removeItem(ROUTING_CONSENT_KEY);
            else localStorage.setItem(ROUTING_CONSENT_KEY, priorConsent);
        } catch { /* egal */ }
        priorConsent = undefined;
    }

    // Nur einen von DIESER Demo angelegten Tresor wieder abbauen – ein bereits
    // vorhandener (echter) Tresor bleibt unangetastet.
    if (story?.mutatesVault && demoVaultCreated && vaultEnabled()) {
        removeVaultMeta();
        saveDataset(datasetSnapshot()); // wieder im Klartext speichern (kein await nötig)
    }
    demoVaultCreated = false;

    // Blatt-Höhe (Handy) auf den Nutzerzustand zurücksetzen und Kartenausschnitt
    // auf die definierte Ausgangslage bringen (nicht dort stehen bleiben, wo die
    // Vorführung geendet hat).
    restoreSheetAfterDemo();
    // Ansichtstiefe und Arbeitsfokus auf den Stand vor der Demo zurück.
    if (priorDepth) { applyDepth(priorDepth, false); priorDepth = null; }
    if (priorMode) { applyMode(priorMode, false); priorMode = null; }
    resetView();
}

// Definierte Ausgangslage des Kartenausschnitts: Popups zu, Gesamtübersicht.
// So beginnt und endet jede Vorführung gleich – „so wie man startet".
function resetView() {
    closeMapPopups();
    if (state.customers.length > 0) fitToCustomers();
}

// ---- Ablauf ----
async function play(story) {
    if (running) return;
    running = true;
    aborted = false;
    let completed = false;
    let failure = null;
    ensureDom();
    showcaseTourPlan = null;
    captureSheetForDemo();
    if (story.mutatesTour) {
        tourSnapshot = JSON.parse(JSON.stringify(state.tour));
        Object.assign(state.tour, prepareShowcaseTour(state.tour));
        emit('tour:scope-changed');
        emit('tour:changed');
    }
    if (story.patchConfirm) { origConfirm = window.confirm; window.confirm = () => true; }
    showChrome(story);
    // Vorführungen laufen im Profi-Modus, damit alle Funktionen zeigbar sind.
    priorDepth = state.ui.depth;
    priorMode = state.ui.mode;
    applyDepth('profi', false);
    resetView();
    const startedAt = Date.now();
    try {
        const isDesktop = window.matchMedia('(min-width: 769px)').matches;
        const steps = visibleStorySteps(story, { isDesktop });
        for (let i = 0; i < steps.length; i++) {
            guard();
            setProgress(i, steps.length);
            try {
                await runStep(steps[i]);
            } catch (error) {
                if (error && typeof error === 'object') {
                    error.showcaseStep = i + 1;
                    error.showcaseStepCount = steps.length;
                }
                throw error;
            }
        }
        const remainingRuntime = Math.max(0, Number(story.minRuntimeMs || 0) - (Date.now() - startedAt));
        if (remainingRuntime > 0) await sleepExact(remainingRuntime);
        markShowcaseStorySeen(story.id);
        completed = true;
    } catch (err) {
        if (!(err instanceof AbortError)) {
            failure = err;
            console.warn('Showcase-Story abgebrochen:', err);
        }
    } finally {
        cleanup(story);
        running = false;
    }
    if (completed) {
        emit('showcase:story-completed', story.id);
        showStoryCompletion(story);
    }
    else if (failure) showStoryFailure(story, failure);
}

function currentVisibleStories() {
    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    return visibleStories({ isDesktop });
}

function showShowcaseDialog() {
    if (!dialog.open) dialog.showModal();
}

function startStory(story) {
    if (!story || running) return;
    if (dialog.open) dialog.close();
    void play(story);
}

function wireOutcomeActions({ next = null, retry = null } = {}) {
    dialog.querySelector('.sc-finish')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('.sc-overview')?.addEventListener('click', buildPanel);
    dialog.querySelector('.sc-next')?.addEventListener('click', () => startStory(next));
    dialog.querySelector('.sc-retry')?.addEventListener('click', () => startStory(retry));
}

function showStoryCompletion(story) {
    const stories = currentVisibleStories();
    const seen = seenShowcaseIds();
    const next = nextUnseenShowcaseStory(stories, seen, story.id);
    const allDone = allShowcaseStoriesSeen(stories, seen);
    if (allDone) markShowcaseCompleted();

    dialog.dataset.view = 'outcome';
    dialog.innerHTML = `
        <div class="sc-outcome-head">
            <div class="sc-outcome-icon" aria-hidden="true">✓</div>
            <span>Live-Demo abgeschlossen</span>
            <h2>${allDone ? 'Alle Demos angesehen' : story.title}</h2>
        </div>
        <div class="sc-outcome-body">
            <p>${allDone
                ? 'Du kennst jetzt die wichtigsten TourFuchs-Abläufe. Starte direkt mit deinen Kunden oder öffne die Demos später erneut über die Info.'
                : `Du hast gesehen: ${story.blurb}`}</p>
            ${next ? `<div class="sc-next-story">
                <span>Als Nächstes</span>
                <div><b>${next.icon} ${next.title}</b><small>${next.blurb}</small></div>
            </div>` : ''}
        </div>
        <div class="sc-outcome-actions">
            ${allDone
                ? '<button type="button" class="sc-overview">Demo-Auswahl</button><button type="button" class="primary sc-finish">TourFuchs verwenden</button>'
                : '<button type="button" class="sc-finish">Für jetzt beenden</button><button type="button" class="sc-overview">Demo-Auswahl</button><button type="button" class="primary sc-next">Nächste Demo starten</button>'}
        </div>`;
    wireOutcomeActions({ next });
    showShowcaseDialog();
}

function showStoryFailure(story, failure) {
    const step = Number(failure?.showcaseStep) || 0;
    const total = Number(failure?.showcaseStepCount) || 0;
    const reason = String(failure?.message || 'Der nächste Demo-Schritt war nicht erreichbar.');
    dialog.dataset.view = 'outcome';
    dialog.innerHTML = `
        <div class="sc-outcome-head sc-outcome-failed">
            <div class="sc-outcome-icon" aria-hidden="true">!</div>
            <span>Live-Demo unterbrochen</span>
            <h2>${story.title}</h2>
        </div>
        <div class="sc-outcome-body">
            <p>Diese Vorführung konnte nicht vollständig beendet werden. TourFuchs hat den vorherigen Zustand wiederhergestellt.</p>
            <p class="sc-failure-reason"><b>${step && total ? `Hängengeblieben bei Schritt ${step}/${total}:` : 'Grund:'}</b> ${escapeHtml(reason)}</p>
        </div>
        <div class="sc-outcome-actions">
            <button type="button" class="sc-finish">Beenden</button>
            <button type="button" class="sc-overview">Demo-Auswahl</button>
            <button type="button" class="primary sc-retry">Erneut versuchen</button>
        </div>`;
    wireOutcomeActions({ retry: story });
    showShowcaseDialog();
}

// ---- Intro-Panel ----
function buildPanel() {
    const seen = new Set(seenShowcaseIds());
    const tiles = currentVisibleStories().map((s) => `
        <button type="button" class="sc-tile" data-story="${s.id}">
            <span class="sc-tile-icon">${s.icon}</span>
            <span class="sc-tile-body"><b>${s.title}</b><span>${s.blurb}</span><small>ca. ${s.duration || 25} Sek.</small></span>
            ${seen.has(s.id) ? '<span class="sc-tile-seen" title="schon gesehen">✓</span>' : '<span class="sc-tile-play">▶</span>'}
        </button>`).join('');
    dialog.dataset.view = 'intro';
    dialog.innerHTML = `
        <div class="sc-panel-head">
            <div class="sc-panel-fox">🦊</div>
            <h2>Soll ich dir kurz zeigen, was ich kann?</h2>
            <p>Wähle einen Ablauf – der Cursor zeigt jeden Schritt direkt in der echten App.</p>
        </div>
        <div class="sc-tiles">${tiles}</div>
        <div class="sc-panel-foot">
            <button type="button" class="sc-later primary">Später</button>
        </div>`;
    dialog.querySelectorAll('.sc-tile').forEach((tile) => {
        tile.addEventListener('click', () => {
            const story = STORIES.find((s) => s.id === tile.dataset.story);
            startStory(story);
        });
    });
    dialog.querySelector('.sc-later').addEventListener('click', () => dialog.close());
}
function openPanel() {
    // In der Handy-Vorschau (iframe) keine Vorführungen starten.
    if (insideMobilePreview) return;
    if (!dialog) return;
    buildPanel();
    showShowcaseDialog();
}

/** Startet eine konkrete Live-Demo aus einem kontextuellen Einstieg. */
export function startShowcaseStory(storyId) {
    if (insideMobilePreview || !dialog || running) return false;
    const story = currentVisibleStories().find((item) => item.id === storyId);
    if (!story) return false;
    startStory(story);
    return true;
}

export function initShowcase() {
    dialog = document.getElementById('showcase-dialog');
    if (!dialog) return;
    ensureDom();

    // Ein Trichter statt konkurrierender Auto-Dialoge: Der Showcase öffnet nur
    // noch auf bewussten Klick – aus dem Willkommens-Panel oder der Info.
    document.getElementById('btn-showcase')?.addEventListener('click', () => {
        document.getElementById('info-dialog')?.close();
        openPanel();
    });
    ['btn-showcase-ob', 'btn-demo-welcome-demos'].forEach((id) => {
        document.getElementById(id)?.addEventListener('click', () => openPanel());
    });

    // ESC bricht eine laufende Vorführung ab (statt nur den Dialog zu schließen)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && running) { e.preventDefault(); abortNow(); } }, true);

    // Nach bewusstem Datenlöschen zählt der Demo-Fortschritt neu.
    on('dataset:cleared', () => resetShowcaseAfterDataClear());
}

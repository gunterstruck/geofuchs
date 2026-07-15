/**
 * Mobile-Vorschau am Desktop. Nach vorhandenen Kundendaten weist ein einmaliger,
 * ruhiger Kurzlauf auf den sonst leicht übersehbaren Einstieg hin.
 */

import { state, on } from '../core/state.js';
import { showTourView } from './sidebar.js';

const PARAM = 'mobilePreview';
const FOCUS_PARAM = 'mobileFocus';
const TEASER_KEY = 'tf_mobile_preview_teaser_seen';
const AUTO_TEASER_DELAY_MS = 3200;
const AUTO_TEASER_RETRY_MS = 1000;
const AUTO_TEASER_RETRY_LIMIT = 60;
const AUTO_TEASER_READY_FALLBACK_MS = 2400;
const PREVIEW_READY_MESSAGE = 'tourfuchs:mobile-preview-ready';
export const AUTO_TEASER_PREVIEW_MS = 2600;

export function canOfferMobilePreviewTeaser({
    desktop = false,
    appReady = false,
    hasCustomers = false,
    seen = false,
    blocked = false
} = {}) {
    return desktop && appReady && hasCustomers && !seen && !blocked;
}

function readSeen() {
    try { return localStorage.getItem(TEASER_KEY) === '1'; } catch { return false; }
}

function markSeen() {
    try { localStorage.setItem(TEASER_KEY, '1'); } catch { /* optional */ }
}

function previewUrl(cacheBust = '') {
    const params = new URLSearchParams({ [PARAM]: '1', [FOCUS_PARAM]: 'tour' });
    if (cacheBust) params.set('t', cacheBust);
    return `${location.pathname}?${params}`;
}

export function initMobilePreview() {
    const params = new URLSearchParams(location.search);
    const btn = document.getElementById('btn-mobile-preview');

    // Innerhalb der Vorschau: keine Verschachtelung. Der Tour-Bereich öffnet
    // sich nach dem Laden, ohne die gespeicherte Desktop-Ansicht zu verändern.
    if (params.has(PARAM)) {
        if (btn) btn.hidden = true;
        document.documentElement.classList.add('in-mobile-preview');
        on('app:ready', () => {
            if (params.get(FOCUS_PARAM) === 'tour') showTourView(false);
            window.parent.postMessage({ type: PREVIEW_READY_MESSAGE }, location.origin);
        });
        return;
    }

    const overlay = document.getElementById('mobile-preview');
    const iframe = document.getElementById('mp-iframe');
    const hint = document.getElementById('mobile-preview-hint');
    if (!btn || !overlay || !iframe || !hint) return;

    const desktopQuery = window.matchMedia('(min-width: 901px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let appReady = false;
    let autoTimer = null;
    let autoRetries = 0;
    let teaserRunning = false;
    let teaserMayOpen = false;
    let previewReady = false;
    const teaserTimers = new Set();

    const queueTeaserStep = (fn, delay) => {
        const timer = window.setTimeout(() => {
            teaserTimers.delete(timer);
            fn();
        }, delay);
        teaserTimers.add(timer);
    };

    const clearTeaserSteps = () => {
        teaserTimers.forEach((timer) => clearTimeout(timer));
        teaserTimers.clear();
    };

    const prepare = () => {
        previewReady = false;
        iframe.src = previewUrl();
    };
    const open = ({ prepared = false, teaser = false } = {}) => {
        if (!prepared) prepare();
        overlay.classList.toggle('mp-teaser', teaser);
        overlay.hidden = false;
        btn.textContent = '🖥️';
        btn.title = 'Zurück zur Desktop-Ansicht';
        btn.setAttribute('aria-label', 'Zurück zur Desktop-Ansicht');
        btn.classList.add('active');
    };
    const close = () => {
        overlay.hidden = true;
        overlay.classList.remove('mp-teaser');
        iframe.src = 'about:blank';
        previewReady = false;
        btn.textContent = '📱';
        btn.title = 'Mobile Außendienst & Tour ansehen';
        btn.setAttribute('aria-label', 'Mobile Außendienst und Tour ansehen');
        btn.classList.remove('active');
    };

    const hideHint = () => {
        hint.hidden = true;
        delete hint.dataset.phase;
    };

    const showLocationHint = (duration = 5200) => {
        hint.querySelector('strong').textContent = 'Hier wiederfinden';
        hint.querySelector('span').textContent = 'Kunden, Briefing & Tour mobil';
        hint.dataset.phase = 'return';
        hint.hidden = false;
        btn.classList.add('mobile-preview-return');
        queueTeaserStep(() => {
            hideHint();
            btn.classList.remove('mobile-preview-return');
        }, duration);
    };

    const cancelTeaser = ({ closePreview = true, showLocation = false } = {}) => {
        clearTeaserSteps();
        teaserRunning = false;
        btn.classList.remove('mobile-preview-target', 'mobile-preview-press', 'mobile-preview-return');
        hideHint();
        if (closePreview && !overlay.hidden) close();
        else if (overlay.hidden) iframe.src = 'about:blank';
        if (showLocation) showLocationHint();
    };

    const blockingUiOpen = () => {
        const lock = document.getElementById('vault-lock');
        return document.hidden
            || Boolean(lock && !lock.hidden)
            || Boolean(document.querySelector('dialog[open]'))
            || Boolean(document.querySelector('.sc-shield:not([hidden])'))
            || !overlay.hidden;
    };

    const finishTeaser = () => {
        teaserRunning = false;
        teaserMayOpen = false;
        btn.classList.remove('mobile-preview-target', 'mobile-preview-press');
    };

    const openTeaserPreview = () => {
        if (!teaserRunning || !teaserMayOpen || !overlay.hidden) return;
        if (blockingUiOpen()) {
            cancelTeaser();
            scheduleAutoTeaser(1000);
            return;
        }
        markSeen();
        btn.classList.remove('mobile-preview-press');
        hideHint();
        open({ prepared: true, teaser: true });
        queueTeaserStep(() => {
            close();
            showLocationHint();
        }, AUTO_TEASER_PREVIEW_MS);
        queueTeaserStep(finishTeaser, AUTO_TEASER_PREVIEW_MS + 5400);
    };

    const runTeaser = () => {
        teaserRunning = true;
        teaserMayOpen = false;
        prepare();
        hint.querySelector('strong').textContent = 'TourFuchs passt in die Tasche';
        hint.querySelector('span').textContent = 'Ein kurzer Blick auf deine mobile Tour';
        hint.dataset.phase = 'intro';
        hint.hidden = false;
        btn.classList.add('mobile-preview-target');

        queueTeaserStep(() => btn.classList.add('mobile-preview-press'), 500);
        queueTeaserStep(() => {
            teaserMayOpen = true;
            if (previewReady) openTeaserPreview();
        }, 800);
        queueTeaserStep(() => {
            teaserMayOpen = true;
            openTeaserPreview();
        }, AUTO_TEASER_READY_FALLBACK_MS);
    };

    const tryAutoTeaser = () => {
        autoTimer = null;
        const baseEligible = canOfferMobilePreviewTeaser({
            desktop: desktopQuery.matches,
            appReady,
            hasCustomers: state.customers.length > 0,
            seen: readSeen(),
            blocked: false
        });
        if (!baseEligible) return;
        if (blockingUiOpen()) {
            if (autoRetries++ < AUTO_TEASER_RETRY_LIMIT) {
                autoTimer = window.setTimeout(tryAutoTeaser, AUTO_TEASER_RETRY_MS);
            }
            return;
        }
        if (reducedMotion) {
            markSeen();
            showLocationHint(6000);
            return;
        }
        runTeaser();
    };

    const scheduleAutoTeaser = (delay = AUTO_TEASER_DELAY_MS) => {
        if (autoTimer || teaserRunning || readSeen() || !appReady || state.customers.length === 0) return;
        autoRetries = 0;
        autoTimer = window.setTimeout(tryAutoTeaser, delay);
    };

    btn.addEventListener('click', () => {
        const wasOpen = !overlay.hidden;
        if (teaserRunning) cancelTeaser({ closePreview: false });
        markSeen();
        if (wasOpen) close(); else open();
    });
    document.getElementById('mp-reload')?.addEventListener('click', () => {
        iframe.src = previewUrl(String(Date.now()));
    });
    overlay.querySelectorAll('[data-mp-close]').forEach((el) => el.addEventListener('click', () => {
        if (teaserRunning) cancelTeaser({ closePreview: false });
        close();
    }));
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || overlay.hidden) return;
        if (teaserRunning) cancelTeaser({ closePreview: false });
        close();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && teaserRunning) cancelTeaser();
        else if (!document.hidden) scheduleAutoTeaser(800);
    });
    desktopQuery.addEventListener?.('change', () => {
        if (!desktopQuery.matches && teaserRunning) cancelTeaser();
        else scheduleAutoTeaser(800);
    });
    document.getElementById('showcase-dialog')?.addEventListener('close', () => scheduleAutoTeaser(1000));
    window.addEventListener('message', (event) => {
        if (event.origin !== location.origin
            || event.source !== iframe.contentWindow
            || event.data?.type !== PREVIEW_READY_MESSAGE) return;
        previewReady = true;
        openTeaserPreview();
    });
    on('customers:changed', () => scheduleAutoTeaser());
    on('app:ready', () => {
        appReady = true;
        scheduleAutoTeaser();
    });
}

/**
 * Dezenter PWA-Update-Hinweis.
 *
 * Wichtig: Dieser Flow aktualisiert nur den Service Worker/App-Cache und lädt
 * die Seite neu. localStorage und IndexedDB werden weder gelesen noch gelöscht.
 */

import { showToast } from './toast.js';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const FOCUS_CHECK_THROTTLE_MS = 5 * 60 * 1000;

let registration = null;
let updateBanner = null;
let lastFocusCheck = 0;
let reloadStarted = false;

function reloadForUpdate() {
    if (reloadStarted) return;
    reloadStarted = true;
    window.location.reload();
}

function dismissUpdateBanner() {
    if (!updateBanner) return;
    updateBanner.classList.remove('visible');
    const oldBanner = updateBanner;
    updateBanner = null;
    window.setTimeout(() => oldBanner.remove(), 180);
}

function showUpdateBanner() {
    if (updateBanner) return;

    updateBanner = document.createElement('div');
    updateBanner.className = 'pwa-update-banner';
    updateBanner.setAttribute('role', 'status');
    updateBanner.innerHTML = `
        <div class="pwa-update-copy">
            <strong>Neue Version verfügbar</strong>
            <span>Aktualisieren lädt nur die App neu. Ihre lokalen Daten bleiben erhalten.</span>
        </div>
        <div class="pwa-update-actions">
            <button type="button" class="pwa-update-later">Später</button>
            <button type="button" class="pwa-update-now">Jetzt aktualisieren</button>
        </div>
    `;

    const later = updateBanner.querySelector('.pwa-update-later');
    const now = updateBanner.querySelector('.pwa-update-now');

    later.addEventListener('click', dismissUpdateBanner);
    now.addEventListener('click', async () => {
        now.disabled = true;
        now.textContent = 'Aktualisiere...';
        try {
            await activateWaitingServiceWorker();
        } catch (error) {
            console.warn('PWA-Update konnte nicht aktiviert werden:', error);
            now.disabled = false;
            now.textContent = 'Jetzt aktualisieren';
            showToast('Update konnte nicht gestartet werden. Bitte später erneut versuchen.', 'error', 6000);
        }
    });

    document.body.appendChild(updateBanner);
    requestAnimationFrame(() => updateBanner?.classList.add('visible'));
}

async function activateWaitingServiceWorker() {
    if (!registration?.waiting) {
        await checkForUpdates('button');
    }

    if (!registration?.waiting) {
        showToast('Noch kein Update bereit. GeoFuchs prüft weiter im Hintergrund.', 'info', 5000);
        dismissUpdateBanner();
        return;
    }

    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

async function checkForUpdates(reason = 'manual') {
    if (!registration || document.visibilityState === 'hidden') return;
    try {
        await registration.update();
    } catch (error) {
        console.debug(`PWA-Updateprüfung (${reason}) fehlgeschlagen:`, error);
    }
}

function scheduleUpdateChecks() {
    window.setInterval(() => checkForUpdates('interval'), UPDATE_CHECK_INTERVAL_MS);

    const checkOnFocus = () => {
        const now = Date.now();
        if (now - lastFocusCheck < FOCUS_CHECK_THROTTLE_MS) return;
        lastFocusCheck = now;
        checkForUpdates('focus');
    };

    window.addEventListener('focus', checkOnFocus);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkOnFocus();
    });
}

export function initPwaUpdates() {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker.addEventListener('controllerchange', reloadForUpdate);

    navigator.serviceWorker.register(swUrl)
        .then((swRegistration) => {
            registration = swRegistration;

            if (registration.waiting && navigator.serviceWorker.controller) {
                showUpdateBanner();
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner();
                    }
                });
            });

            scheduleUpdateChecks();
            checkForUpdates('initial');
        })
        .catch((error) => {
            console.warn('Service Worker konnte nicht registriert werden:', error);
        });
}

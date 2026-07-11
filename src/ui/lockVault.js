/**
 * Tresor-UI: Sperrbildschirm, Aktivierung, PIN-Wechsel, Deaktivieren,
 * Wiederherstellungscode, Auto-Lock-Anbindung.
 *
 * Trennung: Die gesamte Krypto-/Zustandslogik liegt in services/vault.js.
 * Hier nur DOM, Flows und die Verbindung zum App-Zustand.
 */

import * as vault from '../services/vault.js';
import { state, setCustomers, emit, datasetSnapshot } from '../core/state.js';
import { saveDataset } from '../services/storage.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let bootData = null;      // Nachladefunktion (Daten laden) nach dem Entsperren
let lockEl = null;
let dialog = null;

export function initVault(options = {}) {
    bootData = options.bootData || (async () => {});
    lockEl = document.getElementById('vault-lock');
    dialog = document.getElementById('vault-dialog');

    wireLockScreen();
    wireControls();
    wireActivity();

    vault.onVault('locked', onLocked);
    vault.onVault('wiped', onWiped);

    renderControls();

    // Beim Start gesperrt? Sperrbildschirm zeigen und Daten erst nach Entsperren laden.
    const gated = vault.isEnabled() && vault.isLocked();
    if (gated) showLockScreen();
    return gated;
}

// ---- Sperrbildschirm ----
function showLockScreen() {
    if (!lockEl) return;
    lockEl.hidden = false;
    document.getElementById('vault-recovery-form').hidden = true;
    document.getElementById('vault-recovery-link').hidden = !vault.hasRecovery();
    hideError();
    const pin = document.getElementById('vault-pin');
    pin.value = '';
    setTimeout(() => pin.focus(), 50);
}
function hideLockScreen() {
    if (lockEl) lockEl.hidden = true;
}
function showError(msg) {
    const el = document.getElementById('vault-error');
    el.textContent = msg;
    el.hidden = false;
}
function hideError() {
    const el = document.getElementById('vault-error');
    if (el) el.hidden = true;
}

function wireLockScreen() {
    document.getElementById('vault-unlock-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('vault-pin').value;
        if (!pin) return;
        try {
            await vault.unlock(pin);
            await afterUnlock();
        } catch (err) {
            handleUnlockError(err);
        }
    });
    document.getElementById('vault-recovery-link').addEventListener('click', () => {
        document.getElementById('vault-recovery-form').hidden = false;
        document.getElementById('vault-recovery-link').hidden = true;
        document.getElementById('vault-recovery').focus();
    });
    document.getElementById('vault-recovery-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('vault-recovery').value;
        try {
            await vault.unlockWithRecovery(code);
            await afterUnlock();
            showToast('Mit Wiederherstellungscode entsperrt. Tipp: PIN neu setzen.', 'info', 6000);
        } catch {
            showError('Wiederherstellungscode ungültig.');
        }
    });
}

function handleUnlockError(err) {
    if (err?.code === 'wiped') {
        showError('Zu viele Fehlversuche – der Tresor wurde gelöscht.');
        return;
    }
    if (err?.code === 'wrong-pin') {
        showError(`Falsche PIN. Noch ${err.remaining} Versuch${err.remaining === 1 ? '' : 'e'}, dann werden die lokalen Daten gelöscht.`);
        document.getElementById('vault-pin').value = '';
        document.getElementById('vault-pin').focus();
        return;
    }
    showError('Entsperren nicht möglich.');
}

async function afterUnlock() {
    hideError();
    hideLockScreen();
    try { await bootData(); } catch (e) { console.warn('Nachladen nach Entsperren fehlgeschlagen:', e); }
    renderControls();
}

// ---- Reaktion auf Sperren / Wipe ----
function onLocked() {
    // Sensible Daten aus dem Arbeitsspeicher entfernen und Sperre zeigen.
    state.territories = {};
    setCustomers([]);
    emit('customers:changed');
    renderControls();
    showLockScreen();
}
function onWiped() {
    state.territories = {};
    setCustomers([]);
    emit('customers:changed');
    hideLockScreen();
    renderControls();
    showToast('Der Tresor und die lokalen Daten wurden gelöscht.', 'error', 7000);
}

// ---- Steuerung im Daten-Tab + Topbar ----
function wireControls() {
    document.getElementById('btn-vault-setup')?.addEventListener('click', openSetupDialog);
    document.getElementById('btn-vault-lock')?.addEventListener('click', () => vault.lock());
    document.getElementById('btn-vault-toggle')?.addEventListener('click', () => vault.lock());
    document.getElementById('btn-vault-changepin')?.addEventListener('click', openChangePinDialog);
    document.getElementById('btn-vault-disable')?.addEventListener('click', disableVault);
}

function renderControls() {
    const enabled = vault.isEnabled();
    const unlocked = vault.isUnlocked();
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };
    show('btn-vault-setup', !enabled);
    show('btn-vault-lock', enabled && unlocked);
    show('btn-vault-changepin', enabled && unlocked);
    show('btn-vault-disable', enabled && unlocked);
    show('btn-vault-toggle', enabled && unlocked);
    const status = document.getElementById('vault-status');
    if (status) {
        status.textContent = !enabled
            ? 'Aus. Aktiviere den Tresor, damit deine Kundendaten AES-256-verschlüsselt gespeichert und beim Öffnen per PIN entsperrt werden.'
            : unlocked ? '🔓 Aktiv und entsperrt. Daten sind verschlüsselt gespeichert.' : '🔒 Aktiv und gesperrt.';
    }
}

// ---- Aktivierung ----
function openSetupDialog() {
    dialog.innerHTML = `
        <form method="dialog" class="vault-setup" id="vault-setup-form">
            <div class="vault-fox">🦊🔐</div>
            <h2>Datentresor aktivieren</h2>
            <p class="muted small">Deine Kundendaten werden ab dann <b>AES-256-verschlüsselt</b> auf diesem Gerät gespeichert und beim Öffnen per PIN entsperrt. Wähle eine PIN, die du dir merkst – ohne sie sind die Daten nicht wiederherstellbar (außer per Wiederherstellungscode).</p>
            <label class="vault-field">PIN (mind. 4 Zeichen)
                <input id="setup-pin" type="password" inputmode="numeric" autocomplete="new-password" required minlength="4"></label>
            <label class="vault-field">PIN wiederholen
                <input id="setup-pin2" type="password" inputmode="numeric" autocomplete="new-password" required></label>
            <p id="setup-error" class="vault-error" hidden></p>
            <div class="vault-actions">
                <button type="button" class="vault-cancel">Abbrechen</button>
                <button type="submit" class="primary">Tresor aktivieren</button>
            </div>
        </form>`;
    dialog.querySelector('.vault-cancel').addEventListener('click', () => dialog.close());
    dialog.querySelector('#vault-setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = dialog.querySelector('#setup-pin').value;
        const pin2 = dialog.querySelector('#setup-pin2').value;
        const err = dialog.querySelector('#setup-error');
        err.hidden = true;
        if (pin.length < 4) { err.textContent = 'Die PIN sollte mindestens 4 Zeichen haben.'; err.hidden = false; return; }
        if (pin !== pin2) { err.textContent = 'Die PINs stimmen nicht überein.'; err.hidden = false; return; }
        try {
            const { recoveryCode } = await vault.setup(pin, { recovery: true });
            // Bereits geladene Daten sofort verschlüsselt neu speichern
            await saveDataset(datasetSnapshot());
            emit('dataset:dirty');
            renderControls();
            showRecoveryCode(recoveryCode);
        } catch (e2) {
            err.textContent = 'Aktivierung fehlgeschlagen.';
            err.hidden = false;
            console.warn(e2);
        }
    });
    dialog.showModal();
}

function showRecoveryCode(code) {
    dialog.innerHTML = `
        <div class="vault-setup">
            <div class="vault-fox">🔑</div>
            <h2>Wiederherstellungscode</h2>
            <p class="muted small">Notiere oder drucke diesen Code und bewahre ihn <b>getrennt vom Gerät</b> auf. Mit ihm kommst du an deine Daten, falls du die PIN vergisst. Er wird <b>nur jetzt</b> angezeigt.</p>
            <div class="vault-recovery-code" id="recovery-code">${escapeHtml(code)}</div>
            <div class="vault-actions">
                <button type="button" class="vault-copy">📋 Kopieren</button>
                <button type="button" class="primary vault-done">Ich habe den Code sicher notiert</button>
            </div>
        </div>`;
    dialog.querySelector('.vault-copy').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(code); showToast('Code kopiert.', 'success'); } catch { /* egal */ }
    });
    dialog.querySelector('.vault-done').addEventListener('click', () => {
        dialog.close();
        showToast('Tresor aktiviert – deine Daten sind jetzt verschlüsselt.', 'success', 6000);
    });
}

// ---- PIN ändern ----
function openChangePinDialog() {
    dialog.innerHTML = `
        <form class="vault-setup" id="vault-change-form">
            <div class="vault-fox">🔐</div>
            <h2>PIN ändern</h2>
            <label class="vault-field">Aktuelle PIN
                <input id="cp-old" type="password" inputmode="numeric" autocomplete="off" required></label>
            <label class="vault-field">Neue PIN (mind. 4 Zeichen)
                <input id="cp-new" type="password" inputmode="numeric" autocomplete="new-password" required minlength="4"></label>
            <label class="vault-field">Neue PIN wiederholen
                <input id="cp-new2" type="password" inputmode="numeric" autocomplete="new-password" required></label>
            <p id="cp-error" class="vault-error" hidden></p>
            <div class="vault-actions">
                <button type="button" class="vault-cancel">Abbrechen</button>
                <button type="submit" class="primary">PIN ändern</button>
            </div>
        </form>`;
    dialog.querySelector('.vault-cancel').addEventListener('click', () => dialog.close());
    dialog.querySelector('#vault-change-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = dialog.querySelector('#cp-error');
        err.hidden = true;
        const oldPin = dialog.querySelector('#cp-old').value;
        const nw = dialog.querySelector('#cp-new').value;
        const nw2 = dialog.querySelector('#cp-new2').value;
        if (nw.length < 4) { err.textContent = 'Die neue PIN sollte mindestens 4 Zeichen haben.'; err.hidden = false; return; }
        if (nw !== nw2) { err.textContent = 'Die neuen PINs stimmen nicht überein.'; err.hidden = false; return; }
        try {
            await vault.changePin(oldPin, nw);
            dialog.close();
            showToast('PIN geändert.', 'success');
        } catch {
            err.textContent = 'Die aktuelle PIN ist falsch.';
            err.hidden = false;
        }
    });
    dialog.showModal();
}

// ---- Deaktivieren ----
async function disableVault() {
    if (!confirm('Tresor deaktivieren? Deine Daten werden danach wieder unverschlüsselt in diesem Browser gespeichert.')) return;
    const pin = prompt('Zur Bestätigung bitte die aktuelle PIN eingeben:');
    if (pin == null) return;
    try {
        await vault.verifyPin(pin);
        vault.removeVaultMeta();                 // Tresor aus – DEK bleibt noch im Speicher
        await saveDataset(datasetSnapshot());    // jetzt im Klartext neu speichern
        emit('dataset:dirty');
        vault.lock();                            // DEK aus dem Speicher entfernen
        renderControls();
        showToast('Tresor deaktiviert. Daten sind wieder unverschlüsselt gespeichert.', 'info', 6000);
    } catch {
        showToast('Falsche PIN – Tresor bleibt aktiv.', 'error');
    }
}

// ---- Auto-Lock: Nutzeraktivität registrieren ----
function wireActivity() {
    let throttle = 0;
    const note = () => {
        const now = Date.now();
        if (now - throttle < 5000) return;
        throttle = now;
        vault.noteActivity();
    };
    ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, note, { passive: true }));
}

/**
 * Tresor-UI: Sperrbildschirm, Aktivierung, PIN-Wechsel, Deaktivieren,
 * Wiederherstellungscode, Auto-Lock-Anbindung.
 *
 * Trennung: Die gesamte Krypto-/Zustandslogik liegt in services/vault.js.
 * Hier nur DOM, Flows und die Verbindung zum App-Zustand.
 */

import * as vault from '../services/vault.js';
import { state, setCustomers, clearServiceContracts, emit, on, datasetSnapshot } from '../core/state.js';
import { saveDataset } from '../services/storage.js';
import { isPlatformAuthenticatorAvailable, registerBiometric, evaluatePrf } from '../services/biometric.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let bootData = null;      // Nachladefunktion (Daten laden) nach dem Entsperren
let lockEl = null;
let dialog = null;
let bioAvailable = false; // Plattform-Authenticator (Face/Touch ID) vorhanden?

export function initVault(options = {}) {
    bootData = options.bootData || (async () => {});
    lockEl = document.getElementById('vault-lock');
    dialog = document.getElementById('vault-dialog');

    wireLockScreen();
    wireControls();
    wireActivity();

    vault.onVault('locked', onLocked);
    vault.onVault('wiped', onWiped);
    vault.onVault('disabled', renderControls);

    // Topbar-Schloss soll erscheinen, sobald Daten da sind (Einrichten anbieten).
    on('customers:changed', renderControls);
    // Eigene Daten importiert -> zum Verschlüsseln führen (Demo nicht).
    on('data:imported', onDataImported);

    renderControls();

    // Biometrie-Verfügbarkeit asynchron prüfen und danach neu rendern.
    isPlatformAuthenticatorAvailable().then((ok) => {
        bioAvailable = ok;
        renderControls();
        updateBioUnlockButton();
    }).catch(() => {});

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
    updateBioUnlockButton();
    hideError();
    const pin = document.getElementById('vault-pin');
    pin.value = '';
    setTimeout(() => pin.focus(), 50);
}

function updateBioUnlockButton() {
    const btn = document.getElementById('vault-bio-unlock');
    if (btn) btn.hidden = !(vault.hasBiometric() && bioAvailable);
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
            // PIN wurde vergessen (deshalb Recovery) -> direkt neue PIN festlegen.
            openResetPinDialog(code);
        } catch {
            showError('Wiederherstellungscode ungültig.');
        }
    });
    document.getElementById('vault-bio-unlock')?.addEventListener('click', bioUnlock);
}

async function bioUnlock() {
    const req = vault.getBiometricRequest();
    if (!req) return;
    hideError();
    try {
        const prf = await evaluatePrf(req.credentialId, req.salt);
        await vault.unlockWithBiometric(prf);
        await afterUnlock();
    } catch (e) {
        showError('Biometrisches Entsperren nicht möglich – bitte PIN verwenden.');
        console.warn(e);
    }
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
    clearServiceContracts({ dirty: false });
    setCustomers([]);
    emit('customers:changed');
    renderControls();
    showLockScreen();
}
function onWiped() {
    state.territories = {};
    clearServiceContracts({ dirty: false });
    setCustomers([]);
    emit('customers:changed');
    hideLockScreen();
    renderControls();
    showToast('Der Tresor und die lokalen Daten wurden gelöscht.', 'error', 7000);
}

// ---- Steuerung im Daten-Tab + Topbar ----
function wireControls() {
    document.getElementById('btn-vault-setup')?.addEventListener('click', () => openSetupDialog());
    document.getElementById('btn-vault-lock')?.addEventListener('click', () => vault.lock());
    // Topbar-Schloss: ohne Tresor -> Einrichten anbieten; mit Tresor -> sperren.
    document.getElementById('btn-vault-toggle')?.addEventListener('click', () => {
        if (!vault.isEnabled()) openSetupDialog();
        else vault.lock();
    });
    document.getElementById('btn-vault-changepin')?.addEventListener('click', openChangePinDialog);
    document.getElementById('btn-vault-disable')?.addEventListener('click', disableVault);
    document.getElementById('btn-vault-bio')?.addEventListener('click', setupBiometric);
    document.getElementById('btn-vault-bio-off')?.addEventListener('click', removeBiometric);
    document.getElementById('vault-autolock')?.addEventListener('change', (e) => {
        const ms = Number(e.target.value);
        vault.setAutoLockMs(ms);
        showToast(ms === 0 ? 'Automatisches Sperren ist aus.' : 'Auto-Lock-Zeit gespeichert.', 'info');
    });
}

function dataPresent() {
    return (state.customers?.length || 0) > 0
        || (state.serviceContracts?.length || 0) > 0
        || Object.keys(state.territories || {}).length > 0;
}

function renderControls() {
    const enabled = vault.isEnabled();
    const unlocked = vault.isUnlocked();
    const hasBio = vault.hasBiometric();
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };
    show('btn-vault-setup', !enabled);
    show('btn-vault-lock', enabled && unlocked);
    show('btn-vault-changepin', enabled && unlocked);
    show('btn-vault-disable', enabled && unlocked);
    show('btn-vault-bio', enabled && unlocked && bioAvailable && !hasBio);
    show('btn-vault-bio-off', enabled && unlocked && hasBio);
    show('vault-autolock-row', enabled && unlocked);
    const alSel = document.getElementById('vault-autolock');
    if (alSel && enabled) alSel.value = String(vault.autoLockMs());

    // Topbar-Schloss ist der stets erreichbare Sicherheits-Einstieg (auch am Handy,
    // wo die Daten-Ansicht im eingeklappten Blatt liegt): ohne Tresor „einrichten",
    // mit Tresor „sperren".
    const toggle = document.getElementById('btn-vault-toggle');
    if (toggle) {
        const showToggle = (enabled && unlocked) || (!enabled && dataPresent());
        toggle.hidden = !showToggle;
        if (!enabled) {
            toggle.textContent = '🔓';
            toggle.title = 'Daten sind unverschlüsselt – tippen, um den Tresor mit PIN einzurichten';
            toggle.setAttribute('aria-label', 'Datentresor einrichten');
        } else {
            toggle.textContent = '🔐';
            toggle.title = 'Tresor entsperrt – tippen zum Sofort-Sperren';
            toggle.setAttribute('aria-label', 'Tresor sperren');
        }
    }

    const status = document.getElementById('vault-status');
    if (status) {
        status.textContent = !enabled
            ? 'Aus. Aktiviere den Tresor, damit deine Kunden- und Vertragsdaten AES-256-verschlüsselt gespeichert und beim Öffnen per PIN entsperrt werden.'
            : unlocked
                ? `🔓 Aktiv und entsperrt. Daten sind verschlüsselt gespeichert.${hasBio ? ' Face/Touch ID eingerichtet.' : ''}`
                : '🔒 Aktiv und gesperrt.';
    }
}

// Nach einem Import EIGENER Daten (nicht Demo): zum Verschlüsseln führen.
function onDataImported(payload) {
    if (vault.isEnabled()) return;            // schon ein Tresor -> Daten werden bereits verschlüsselt gespeichert
    if (!dataPresent()) return;
    const count = payload?.count;
    const isContracts = payload?.type === 'service-contracts';
    const importedLabel = isContracts ? 'Servicevertragsdaten' : 'Kundendaten';
    openSetupDialog({
        forced: true,
        title: 'Eigene Daten schützen',
        intro: `Du hast${count ? ` ${count}` : ''} eigene ${importedLabel} geladen. Lege jetzt eine PIN fest, damit sie <b>AES-256-verschlüsselt</b> auf diesem Gerät gespeichert und beim Öffnen der App entsperrt werden.`,
        onDone: () => showToast('Deine Daten sind jetzt im Tresor – verschlüsselt gespeichert.', 'success', 6000),
        onDismiss: async () => {
            await saveDataset(datasetSnapshot());
            showToast('Ohne Tresor bleiben die Daten unverschlüsselt. Du kannst ihn jederzeit über das 🔓-Symbol oben einrichten.', 'info', 8000);
        }
    });
}

// ---- Biometrie (Face/Touch ID) ----
async function setupBiometric() {
    const pin = prompt('Zur Einrichtung von Face/Touch ID bitte die aktuelle PIN eingeben:');
    if (pin == null) return;
    try {
        await vault.verifyPin(pin);
    } catch {
        showToast('Falsche PIN – Face/Touch ID nicht eingerichtet.', 'error');
        return;
    }
    try {
        const { credentialIdB64, prfOutput, salt } = await registerBiometric();
        await vault.enableBiometric(pin, prfOutput, credentialIdB64, salt);
        renderControls();
        showToast('Face/Touch ID eingerichtet – du kannst den Tresor jetzt biometrisch entsperren.', 'success', 6000);
    } catch (e) {
        const msg = e?.message === 'prf-unsupported'
            ? 'Dieses Gerät/dieser Browser unterstützt biometrische Verschlüsselung (PRF) leider nicht.'
            : 'Face/Touch ID konnte nicht eingerichtet werden.';
        showToast(msg, 'error', 7000);
        console.warn(e);
    }
}

function removeBiometric() {
    if (!confirm('Face/Touch ID entfernen? Entsperren geht danach wieder nur per PIN oder Wiederherstellungscode.')) return;
    vault.disableBiometric();
    renderControls();
    showToast('Face/Touch ID entfernt.', 'info');
}

// ---- Aktivierung ----
/**
 * Tresor-Aktivierung anzeigen. Ohne Optionen der normale Button-Flow; mit
 * `forced: true` (z. B. nach einem verschlüsselten Import) ohne Abbrechen,
 * mit passendem Text und optionalen Callbacks.
 * @param {{forced?:boolean, title?:string, intro?:string, onDone?:Function, onDismiss?:Function}} [opts]
 */
export function openSetupDialog(opts = {}) {
    const forced = opts.forced === true;
    const title = opts.title || 'Datentresor aktivieren';
    const intro = opts.intro || 'Deine Kundendaten werden ab dann <b>AES-256-verschlüsselt</b> auf diesem Gerät gespeichert und beim Öffnen per PIN entsperrt. Wähle eine PIN, die du dir merkst – ohne sie sind die Daten nicht wiederherstellbar (außer per Wiederherstellungscode).';
    let done = false;

    dialog.innerHTML = `
        <form method="dialog" class="vault-setup" id="vault-setup-form">
            <div class="vault-fox">🦊🔐</div>
            <h2>${escapeHtml(title)}</h2>
            <p class="muted small">${intro}</p>
            <label class="vault-field">PIN (mind. 4 Zeichen)
                <input id="setup-pin" type="password" inputmode="numeric" autocomplete="new-password" required minlength="4"></label>
            <label class="vault-field">PIN wiederholen
                <input id="setup-pin2" type="password" inputmode="numeric" autocomplete="new-password" required></label>
            <p id="setup-error" class="vault-error" hidden></p>
            <div class="vault-actions">
                ${forced ? '' : '<button type="button" class="vault-cancel">Abbrechen</button>'}
                <button type="submit" class="primary">Tresor aktivieren</button>
            </div>
        </form>`;
    dialog.querySelector('.vault-cancel')?.addEventListener('click', () => dialog.close());
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
            done = true;
            showRecoveryCode(recoveryCode, opts.onDone);
        } catch (e2) {
            err.textContent = 'Aktivierung fehlgeschlagen.';
            err.hidden = false;
            console.warn(e2);
        }
    });
    // Abbruch (Escape/Backdrop) im erzwungenen Modus meldet zurück, damit der
    // Aufrufer die Daten notfalls im Klartext speichern und warnen kann.
    dialog.addEventListener('close', () => {
        if (!done && forced && typeof opts.onDismiss === 'function') opts.onDismiss();
    }, { once: true });
    dialog.showModal();
}

function showRecoveryCode(code, onDone, { preview = false } = {}) {
    const intro = preview
        ? 'So wird der einmalige Wiederherstellungscode nach einer echten Einrichtung angezeigt. Dieser Beispielcode gehört nur zur Vorführung; dein vorhandener Tresor bleibt unverändert.'
        : 'Notiere oder drucke diesen Code und bewahre ihn <b>getrennt vom Gerät</b> auf. Mit ihm kommst du an deine Daten, falls du die PIN vergisst. Er wird <b>nur jetzt</b> angezeigt.';
    dialog.innerHTML = `
        <div class="vault-setup">
            <div class="vault-fox">🔑</div>
            <h2>Wiederherstellungscode</h2>
            <p class="muted small">${intro}</p>
            <div class="vault-recovery-code" id="recovery-code">${escapeHtml(code)}</div>
            <div class="vault-actions">
                ${preview ? '' : '<button type="button" class="vault-copy">📋 Kopieren</button>'}
                <button type="button" class="primary vault-done">${preview ? 'Demo fortsetzen' : 'Ich habe den Code sicher notiert'}</button>
            </div>
        </div>`;
    dialog.querySelector('.vault-copy')?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(code); showToast('Code kopiert.', 'success'); } catch { /* egal */ }
    });
    dialog.querySelector('.vault-done').addEventListener('click', () => {
        dialog.close();
        if (preview) return;
        if (typeof onDone === 'function') onDone();
        else showToast('Tresor aktiviert – deine Daten sind jetzt verschlüsselt.', 'success', 6000);
    });
}

/** Sichere Vorschau für die Live-Demo, wenn bereits ein echter Tresor aktiv ist. */
export function showRecoveryCodeForDemo() {
    showRecoveryCode('TFRC-DEMO4-SICHER-CODE7-BEISPIEL', null, { preview: true });
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

// ---- Neue PIN nach Wiederherstellung ----
function openResetPinDialog(recoveryCode) {
    dialog.innerHTML = `
        <form class="vault-setup" id="vault-reset-form">
            <div class="vault-fox">🔑➡️🔐</div>
            <h2>Neue PIN festlegen</h2>
            <p class="muted small">Du hast dich mit dem <b>Wiederherstellungscode</b> angemeldet. Lege jetzt eine <b>neue PIN</b> fest, mit der du den Tresor künftig entsperrst.</p>
            <label class="vault-field">Neue PIN (mind. 4 Zeichen)
                <input id="rp-new" type="password" inputmode="numeric" autocomplete="new-password" required minlength="4"></label>
            <label class="vault-field">Neue PIN wiederholen
                <input id="rp-new2" type="password" inputmode="numeric" autocomplete="new-password" required></label>
            <p id="rp-error" class="vault-error" hidden></p>
            <div class="vault-actions">
                <button type="submit" class="primary">Neue PIN speichern</button>
            </div>
        </form>`;
    dialog.querySelector('#vault-reset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = dialog.querySelector('#rp-error');
        err.hidden = true;
        const nw = dialog.querySelector('#rp-new').value;
        const nw2 = dialog.querySelector('#rp-new2').value;
        if (nw.length < 4) { err.textContent = 'Die neue PIN sollte mindestens 4 Zeichen haben.'; err.hidden = false; return; }
        if (nw !== nw2) { err.textContent = 'Die PINs stimmen nicht überein.'; err.hidden = false; return; }
        try {
            await vault.resetPinWithRecovery(recoveryCode, nw);
            dialog.close();
            showToast('Neue PIN gespeichert – ab jetzt damit entsperren.', 'success', 6000);
        } catch {
            err.textContent = 'Neue PIN konnte nicht gesetzt werden.';
            err.hidden = false;
        }
    });
    // Kein Abbrechen-Knopf: ohne alte PIN wäre „PIN ändern" später nicht nutzbar.
    // Bricht man dennoch ab (Escape), bleibt der Wiederherstellungscode der Weg.
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

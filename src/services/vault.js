/**
 * Tresor-Manager – Zustandsmaschine über dem Krypto-Kern.
 *
 * Zustände:  disabled (kein Tresor) · locked (Tresor da, DEK nicht im Speicher)
 *            · unlocked (DEK im Speicher).
 *
 * Der Datenschlüssel (DEK) liegt nur im Arbeitsspeicher. Persistiert werden
 * ausschließlich: Salt(s) und der mit PIN bzw. Recovery-Code gewrappte DEK
 * (alles selbst verschlüsselt) sowie ein Fehlversuchszähler – in localStorage.
 *
 * Bewusst ohne DOM-/State-Importe (eigener Mini-Emitter, Storage-Fallback),
 * damit die sicherheitskritische Logik in Node unit-testbar ist.
 */

import {
    PBKDF2_ITERATIONS, SALT_BYTES,
    deriveKek, generateDek, importDek, wrapDek, unwrapDek,
    encryptJson, decryptJson, toB64, fromB64,
    generateRecoveryCode, normalizeRecoveryCode
} from './crypto.js';
import { clearDataset } from './storage.js';

const VAULT_KEY = 'tf_vault';
const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_AUTOLOCK_MS = 5 * 60 * 1000;

let dek = null;              // im Speicher gehaltener DEK (null = gesperrt/aus)
let autoLockTimer = null;

// ---- Meta-Speicher (localStorage mit In-Memory-Fallback für Tests/Private Mode) ----
const memStore = new Map();
function readMeta() {
    let raw = null;
    try { raw = globalThis.localStorage?.getItem(VAULT_KEY) ?? null; } catch { /* private mode */ }
    if (raw === null) raw = memStore.get(VAULT_KEY) ?? null;
    return raw ? JSON.parse(raw) : null;
}
function writeMeta(meta) {
    const s = JSON.stringify(meta);
    try { globalThis.localStorage?.setItem(VAULT_KEY, s); } catch { /* egal */ }
    memStore.set(VAULT_KEY, s);
}
function clearMeta() {
    try { globalThis.localStorage?.removeItem(VAULT_KEY); } catch { /* egal */ }
    memStore.delete(VAULT_KEY);
}

// ---- Mini-Emitter ----
const listeners = new Map();
export function onVault(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
}
function emit(event) { listeners.get(event)?.forEach((fn) => fn()); }

// ---- Statusabfragen ----
export function isEnabled() { return readMeta() !== null; }
export function isUnlocked() { return dek !== null; }
export function isLocked() { return isEnabled() && dek === null; }
export function hasRecovery() { return Boolean(readMeta()?.wrapRecovery); }
export function attemptsLeft() {
    const m = readMeta();
    if (!m) return null;
    return (m.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) - (m.attempts ?? 0);
}
export function autoLockMs() { return readMeta()?.autoLockMs ?? DEFAULT_AUTOLOCK_MS; }

// ---- Einrichtung ----
export async function setup(pin, { recovery = true, iterations = PBKDF2_ITERATIONS, maxAttempts = DEFAULT_MAX_ATTEMPTS, autoLockMs = DEFAULT_AUTOLOCK_MS } = {}) {
    const { raw } = await generateDek();
    const salt = randomSalt();
    const kek = await deriveKek(pin, salt, iterations);
    const meta = {
        v: 1,
        iterations,
        salt: toB64(salt),
        wrapPin: await wrapDek(kek, raw),
        attempts: 0,
        maxAttempts,
        autoLockMs,
        createdAt: new Date().toISOString()
    };
    let recoveryCode = null;
    if (recovery) {
        recoveryCode = generateRecoveryCode();
        const recSalt = randomSalt();
        const recKek = await deriveKek(normalizeRecoveryCode(recoveryCode), recSalt, iterations);
        meta.recoverySalt = toB64(recSalt);
        meta.wrapRecovery = await wrapDek(recKek, raw);
    }
    writeMeta(meta);
    dek = await importDek(raw);
    scheduleAutoLock();
    emit('unlocked');
    return { recoveryCode };
}

function randomSalt() {
    return globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

async function unwrapWith(passphrase, saltB64, wrapped, iterations) {
    const kek = await deriveKek(passphrase, fromB64(saltB64), iterations);
    return unwrapDek(kek, wrapped); // wirft bei falschem Schlüssel (GCM-Tag)
}

// ---- Entsperren ----
export async function unlock(pin) {
    const meta = readMeta();
    if (!meta) throw new Error('no-vault');
    try {
        const raw = await unwrapWith(pin, meta.salt, meta.wrapPin, meta.iterations);
        dek = await importDek(raw);
        meta.attempts = 0;
        writeMeta(meta);
        scheduleAutoLock();
        emit('unlocked');
        return true;
    } catch {
        meta.attempts = (meta.attempts ?? 0) + 1;
        writeMeta(meta);
        const max = meta.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        if (meta.attempts >= max) {
            await wipe();
            throw makeErr('wiped');
        }
        throw makeErr('wrong-pin', { remaining: max - meta.attempts });
    }
}

export async function unlockWithRecovery(code) {
    const meta = readMeta();
    if (!meta?.wrapRecovery) throw new Error('no-recovery');
    const raw = await unwrapWith(normalizeRecoveryCode(code), meta.recoverySalt, meta.wrapRecovery, meta.iterations);
    dek = await importDek(raw);
    meta.attempts = 0;
    writeMeta(meta);
    scheduleAutoLock();
    emit('unlocked');
    return true;
}

function makeErr(code, extra = {}) {
    const e = new Error(code);
    e.code = code;
    Object.assign(e, extra);
    return e;
}

// ---- Sperren / Auto-Lock ----
export function lock() {
    dek = null;
    clearTimeout(autoLockTimer);
    emit('locked');
}
function scheduleAutoLock() {
    clearTimeout(autoLockTimer);
    const ms = autoLockMs();
    if (ms > 0 && isUnlocked()) autoLockTimer = setTimeout(() => lock(), ms);
}
/** Bei Nutzeraktivität aufrufen, um den Auto-Lock zu verschieben. */
export function noteActivity() {
    if (isUnlocked()) scheduleAutoLock();
}

// ---- PIN wechseln ----
export async function changePin(oldPin, newPin) {
    const meta = readMeta();
    if (!meta) throw new Error('no-vault');
    const raw = await unwrapWith(oldPin, meta.salt, meta.wrapPin, meta.iterations); // wirft bei falscher alter PIN
    const salt = randomSalt();
    const kek = await deriveKek(newPin, salt, meta.iterations);
    meta.salt = toB64(salt);
    meta.wrapPin = await wrapDek(kek, raw);
    meta.attempts = 0;
    writeMeta(meta);
    return true;
}

/** PIN prüfen, ohne Zustand zu ändern (für „Tresor deaktivieren"). Wirft bei falsch. */
export async function verifyPin(pin) {
    const meta = readMeta();
    if (!meta) throw new Error('no-vault');
    await unwrapWith(pin, meta.salt, meta.wrapPin, meta.iterations);
    return true;
}

// ---- Löschen / Deaktivieren ----
export async function wipe() {
    clearMeta();
    dek = null;
    clearTimeout(autoLockTimer);
    try { await clearDataset(); } catch { /* IndexedDB evtl. nicht verfügbar */ }
    emit('wiped');
}

/** Tresor-Metadaten entfernen (DEK bleibt im Speicher, damit der Aufrufer die
 *  Daten noch entschlüsselt im Klartext neu speichern kann). */
export function removeVaultMeta() {
    clearMeta();
    emit('disabled');
}

// ---- Daten für die Persistenz ver-/entschlüsseln ----
export function getDek() { return dek; }
export async function encryptForStore(obj) {
    if (!dek) throw new Error('locked');
    return { __enc: 1, ...(await encryptJson(dek, obj)) };
}
export async function decryptFromStore(blob) {
    if (!dek) throw new Error('locked');
    return decryptJson(dek, blob);
}
export function isEncryptedPayload(value) {
    return Boolean(value && typeof value === 'object' && value.__enc);
}

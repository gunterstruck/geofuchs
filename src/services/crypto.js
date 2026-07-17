/**
 * Krypto-Kern des Tresors – ausschließlich native WebCrypto, keine Fremdbibliothek.
 *
 * Envelope-Verschlüsselung:
 *   PIN ──PBKDF2──► KEK  (wrappt)  DEK ──AES-256-GCM──► Daten
 * Die PIN verschlüsselt nur den zufälligen Datenschlüssel (DEK); dieser
 * verschlüsselt die eigentlichen Daten. So kann die PIN gewechselt werden,
 * ohne alle Daten neu zu verschlüsseln, und mehrere „Türen" (PIN, Recovery,
 * später Biometrie) können denselben DEK entsperren.
 *
 * Alle Ausgaben sind JSON-serialisierbar (Base64), damit sie in localStorage
 * bzw. IndexedDB abgelegt und als Datei transportiert werden können.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

// PBKDF2-Iterationen nach OWASP-Empfehlung (SHA-256). Bewusst hoch, um
// Brute-Force gegen eine kurze PIN teuer zu machen.
export const PBKDF2_ITERATIONS = 600000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const DEK_BYTES = 32; // AES-256

// ---- Base64 ----
export function toB64(bytes) {
    let bin = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (const b of arr) bin += String.fromCharCode(b);
    return btoa(bin);
}
export function fromB64(str) {
    const bin = atob(str);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

export function randomBytes(n) {
    return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

// ---- Schlüsselableitung ----
/** KEK (Wrapping-Schlüssel) aus Passphrase/PIN ableiten (nicht extrahierbar). */
export async function deriveKek(passphrase, saltBytes, iterations = PBKDF2_ITERATIONS) {
    const baseKey = await subtle().importKey('raw', encoder.encode(String(passphrase)), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey(
        { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/** Rohbytes als AES-GCM-Datenschlüssel (DEK) importieren (nicht extrahierbar). */
export function importDek(rawBytes) {
    return subtle().importKey('raw', rawBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Frischen DEK erzeugen. Gibt Rohbytes + importierten CryptoKey zurück. */
export async function generateDek() {
    const raw = randomBytes(DEK_BYTES);
    return { raw, key: await importDek(raw) };
}

// ---- AES-256-GCM ----
/** @returns {{iv:string, ct:string}} Base64 */
export async function aesEncrypt(key, plaintextBytes) {
    const iv = randomBytes(IV_BYTES);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes);
    return { iv: toB64(iv), ct: toB64(ct) };
}
/** @returns {Uint8Array} entschlüsselte Bytes; wirft bei falschem Schlüssel/Manipulation. */
export async function aesDecrypt(key, blob) {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
    return new Uint8Array(pt);
}

// ---- DEK wrappen / auswickeln ----
export function wrapDek(kek, dekRaw) {
    return aesEncrypt(kek, dekRaw);
}
/** @returns {Uint8Array} Roh-DEK; wirft bei falscher PIN (GCM-Tag stimmt nicht). */
export function unwrapDek(kek, wrapped) {
    return aesDecrypt(kek, wrapped);
}

// ---- Objekt-Verschlüsselung mit DEK ----
export async function encryptJson(dek, obj) {
    return aesEncrypt(dek, encoder.encode(JSON.stringify(obj)));
}
export async function decryptJson(dek, blob) {
    return JSON.parse(decoder.decode(await aesDecrypt(dek, blob)));
}

// ---- Wiederherstellungscode ----
// Zeichensatz ohne verwechselbare Zeichen (kein 0/O, 1/I/L): 31 Zeichen.
// 256 ist nicht durch 31 teilbar, deshalb würde ein reines `b % 31` einen
// Modulo-Bias erzeugen. Wir verwerfen daher die überzähligen Bytewerte
// (Rejection-Sampling) und ziehen gleichverteilt. 20 Zeichen ≈ 99 Bit Entropie.
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_LEN = 20;
// Größtes Vielfaches der Alphabetlänge, das noch in ein Byte passt.
const RECOVERY_LIMIT = 256 - (256 % RECOVERY_ALPHABET.length);

export function generateRecoveryCode() {
    let s = '';
    while (s.length < RECOVERY_LEN) {
        const b = randomBytes(1)[0];
        if (b >= RECOVERY_LIMIT) continue; // biasbehafteten Rest verwerfen
        s += RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length];
    }
    return 'TFRC-' + (s.match(/.{1,5}/g) || [s]).join('-');
}
export function normalizeRecoveryCode(code) {
    return String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TFRC/, '');
}

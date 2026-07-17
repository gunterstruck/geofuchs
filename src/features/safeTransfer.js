/**
 * Sicherer Umzug (Etappe 2 „Tresor"): verschlüsselter Export der Kundendaten
 * als Container-Datei plus getrennt reisender Schlüssel als QR-Code.
 *
 * Sicherheitsmodell – Kanaltrennung:
 *   • Die Container-Datei (.tfsafe) ist mit einem zufälligen 256-Bit-Schlüssel
 *     AES-256-GCM-verschlüsselt und darf beliebig transportiert werden
 *     (Mail, Cloud, USB) – ohne Schlüssel ist sie wertlos.
 *   • Der Schlüssel wandert ausschließlich per Bildschirm → Kamera (QR),
 *     niemals übers Netz und bewusst nicht als anklickbarer Link.
 * Ein Angreifer braucht BEIDES; ein Kanal allein gibt nichts preis.
 *
 * Dieses Modul ist reine, DOM-freie Logik (in Node testbar). Es nutzt
 * ausschließlich den WebCrypto-Kern aus services/crypto.js.
 */

import {
    generateDek, importDek, encryptJson, decryptJson,
    randomBytes, toB64, fromB64
} from '../services/crypto.js';

export const SAFE_MAGIC = '__tfsafe';
export const SAFE_VERSION = 1;
export const SAFE_KEY_PREFIX = 'TFK1:';   // Schlüssel-QR: TFK1:<id>:<base64key>
export const SAFE_FILE_EXT = '.tfsafe';

/** Kurze Zufalls-ID (Hex) zum Paaren von Datei und Schlüssel. */
function randomId(bytes = 6) {
    return Array.from(randomBytes(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Datensatz in einen verschlüsselten Container packen und den zugehörigen
 * Schlüssel als QR-Text zurückgeben.
 * @param {{customers:Array, serviceContracts?:Array, fileName?:string, importedAt?:string, territories?:object}} dataset
 * @returns {Promise<{container:object, keyQr:string, id:string, count:number,contractCount:number,territoryCount:number}>}
 */
export async function createSafeTransfer(dataset) {
    const { raw, key } = await generateDek();
    const id = randomId(6); // 12 Hex-Zeichen
    const blob = await encryptJson(key, dataset ?? {}); // { iv, ct } (Base64)
    const count = Array.isArray(dataset?.customers) ? dataset.customers.length : 0;
    const contractCount = Array.isArray(dataset?.serviceContracts) ? dataset.serviceContracts.length : 0;
    const territoryCount = Object.keys(dataset?.territories || {}).length;
    const container = {
        [SAFE_MAGIC]: 1,
        v: SAFE_VERSION,
        alg: 'AES-256-GCM',
        id,
        createdAt: new Date().toISOString(),
        count,            // nur Metadaten (Anzahl) – kein Inhalt im Klartext
        contractCount,
        territoryCount,
        iv: blob.iv,
        ct: blob.ct
    };
    const keyQr = `${SAFE_KEY_PREFIX}${id}:${toB64(raw)}`;
    return { container, keyQr, id, count, contractCount, territoryCount };
}

/** Prüft, ob ein Objekt ein gültiger TourFuchs-Container ist. */
export function isSafeContainer(obj) {
    return Boolean(obj)
        && obj[SAFE_MAGIC] === 1
        && typeof obj.id === 'string'
        && typeof obj.iv === 'string'
        && typeof obj.ct === 'string';
}

/**
 * Container aus String (Dateiinhalt) oder Objekt lesen.
 * @returns {object|null} der Container oder null, wenn ungültig
 */
export function parseSafeContainer(input) {
    let obj = input;
    if (typeof input === 'string') {
        try { obj = JSON.parse(input); } catch { return null; }
    }
    return isSafeContainer(obj) ? obj : null;
}

/**
 * Schlüssel-QR „TFK1:<id>:<base64key>" zerlegen.
 * @returns {{id:string, keyB64:string}|null}
 */
export function parseKeyQr(text) {
    const raw = String(text ?? '').trim();
    if (!raw.startsWith(SAFE_KEY_PREFIX)) return null;
    const rest = raw.slice(SAFE_KEY_PREFIX.length);
    const idx = rest.indexOf(':');
    if (idx <= 0) return null;
    const id = rest.slice(0, idx);
    const keyB64 = rest.slice(idx + 1);
    if (!id || !keyB64) return null;
    return { id, keyB64 };
}

/** Gehört der Schlüssel zu genau diesem Container? (ID-Abgleich) */
export function keyMatchesContainer(container, parsedKey) {
    return Boolean(container) && Boolean(parsedKey) && container.id === parsedKey.id;
}

/**
 * Container mit dem Base64-Schlüssel entschlüsseln.
 * @returns {Promise<object>} der Datensatz
 * @throws bei falschem Schlüssel oder Manipulation (GCM-Tag) sowie ungültigem Container
 */
export async function decryptSafeTransfer(container, keyB64) {
    const c = parseSafeContainer(container);
    if (!c) throw new Error('kein-gueltiger-container');
    const key = await importDek(fromB64(keyB64));
    // decryptJson wirft bei falschem Schlüssel/Manipulation.
    return decryptJson(key, { iv: c.iv, ct: c.ct });
}

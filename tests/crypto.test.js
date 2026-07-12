// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    deriveKek, generateDek, importDek, aesEncrypt, aesDecrypt,
    wrapDek, unwrapDek, encryptJson, decryptJson,
    toB64, fromB64, randomBytes, generateRecoveryCode, normalizeRecoveryCode,
    SALT_BYTES, DEK_BYTES
} from '../src/services/crypto.js';

// Weniger Iterationen im Test, damit die Ableitung schnell ist (Logik identisch)
const ITER = 1000;

describe('Base64', () => {
    it('roundtrip beliebiger Bytes', () => {
        const bytes = randomBytes(64);
        expect(Array.from(fromB64(toB64(bytes)))).toEqual(Array.from(bytes));
    });
});

describe('AES-256-GCM', () => {
    it('verschlüsselt und entschlüsselt Daten', async () => {
        const { key } = await generateDek();
        const blob = await aesEncrypt(key, new TextEncoder().encode('geheim 🦊'));
        const out = new TextDecoder().decode(await aesDecrypt(key, blob));
        expect(out).toBe('geheim 🦊');
    });

    it('scheitert mit falschem Schlüssel', async () => {
        const a = await generateDek();
        const b = await generateDek();
        const blob = await aesEncrypt(a.key, new Uint8Array([1, 2, 3]));
        await expect(aesDecrypt(b.key, blob)).rejects.toBeTruthy();
    });

    it('erkennt Manipulation am Ciphertext', async () => {
        const { key } = await generateDek();
        const blob = await aesEncrypt(key, new Uint8Array([9, 9, 9]));
        const tampered = fromB64(blob.ct);
        tampered[0] ^= 0xff;
        await expect(aesDecrypt(key, { iv: blob.iv, ct: toB64(tampered) })).rejects.toBeTruthy();
    });
});

describe('Envelope: PIN → KEK wrappt DEK', () => {
    it('richtige PIN wickelt den DEK aus, Daten sind lesbar', async () => {
        const salt = randomBytes(SALT_BYTES);
        const { raw: dekRaw, key: dek } = await generateDek();
        const kek = await deriveKek('1234', salt, ITER);
        const wrapped = await wrapDek(kek, dekRaw);

        const data = { customers: [{ id: 'a', name: 'Autohaus' }], territories: {} };
        const encData = await encryptJson(dek, data);

        // „Neustart": nur wrapped + salt + encData sind gespeichert
        const kek2 = await deriveKek('1234', salt, ITER);
        const dekRaw2 = await unwrapDek(kek2, wrapped);
        expect(Array.from(dekRaw2)).toEqual(Array.from(dekRaw));
        const dek2 = await importDek(dekRaw2);
        expect(await decryptJson(dek2, encData)).toEqual(data);
    });

    it('falsche PIN scheitert beim Auswickeln', async () => {
        const salt = randomBytes(SALT_BYTES);
        const { raw } = await generateDek();
        const kek = await deriveKek('1234', salt, ITER);
        const wrapped = await wrapDek(kek, raw);
        const wrong = await deriveKek('0000', salt, ITER);
        await expect(unwrapDek(wrong, wrapped)).rejects.toBeTruthy();
    });

    it('mehrere Türen (PIN + Recovery) entsperren denselben DEK', async () => {
        const { raw: dekRaw } = await generateDek();
        const pinSalt = randomBytes(SALT_BYTES);
        const recSalt = randomBytes(SALT_BYTES);
        const pinKek = await deriveKek('4321', pinSalt, ITER);
        const recKek = await deriveKek('TFRCABCDE', recSalt, ITER);
        const wrapPin = await wrapDek(pinKek, dekRaw);
        const wrapRec = await wrapDek(recKek, dekRaw);

        const viaPin = await unwrapDek(await deriveKek('4321', pinSalt, ITER), wrapPin);
        const viaRec = await unwrapDek(await deriveKek('TFRCABCDE', recSalt, ITER), wrapRec);
        expect(Array.from(viaPin)).toEqual(Array.from(dekRaw));
        expect(Array.from(viaRec)).toEqual(Array.from(dekRaw));
    });
});

describe('Wiederherstellungscode', () => {
    it('hat das erwartete Format und ist zufällig', () => {
        const a = generateRecoveryCode();
        const b = generateRecoveryCode();
        expect(a).toMatch(/^TFRC-[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/);
        expect(a).not.toBe(b);
    });
    it('normalisiert Eingaben (Groß/klein, Bindestriche, Präfix)', () => {
        expect(normalizeRecoveryCode('tfrc-abcde-fghjk')).toBe('ABCDEFGHJK');
        expect(normalizeRecoveryCode('TFRC-ABCDE-FGHJK')).toBe('ABCDEFGHJK');
    });
});

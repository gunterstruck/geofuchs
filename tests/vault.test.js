// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import * as vault from '../src/services/vault.js';

// Schnelle Ableitung im Test; Auto-Lock aus (0 = kein Timer)
const OPTS = { iterations: 1000, autoLockMs: 0 };
const DATA = { customers: [{ id: 'a', name: 'Autohaus Schmidt', umsatz: 45000 }], territories: { 'kreise:x': { bezirk: 'Nord' } } };

beforeEach(async () => { await vault.wipe(); });

describe('Vault: Einrichtung & Sperren', () => {
    it('setup aktiviert und entsperrt den Tresor und liefert einen Recovery-Code', async () => {
        const { recoveryCode } = await vault.setup('1234', OPTS);
        expect(vault.isEnabled()).toBe(true);
        expect(vault.isUnlocked()).toBe(true);
        expect(recoveryCode).toMatch(/^TFRC-/);
        expect(vault.hasRecovery()).toBe(true);
    });

    it('lock sperrt, danach ist der DEK weg', async () => {
        await vault.setup('1234', OPTS);
        vault.lock();
        expect(vault.isLocked()).toBe(true);
        expect(vault.isUnlocked()).toBe(false);
    });
});

describe('Vault: Datenpersistenz (verschlüsselt)', () => {
    it('encryptForStore/decryptFromStore ist ein verlustfreier Roundtrip', async () => {
        await vault.setup('1234', OPTS);
        const stored = await vault.encryptForStore(DATA);
        expect(stored.__enc).toBe(1);
        expect(vault.isEncryptedPayload(stored)).toBe(true);
        expect(JSON.stringify(stored)).not.toContain('Autohaus'); // wirklich verschlüsselt
        expect(await vault.decryptFromStore(stored)).toEqual(DATA);
    });

    it('gesperrt lässt sich nicht verschlüsseln', async () => {
        await vault.setup('1234', OPTS);
        vault.lock();
        await expect(vault.encryptForStore(DATA)).rejects.toThrow('locked');
    });

    it('nach lock + unlock sind die Daten wieder lesbar', async () => {
        await vault.setup('1234', OPTS);
        const stored = await vault.encryptForStore(DATA);
        vault.lock();
        await vault.unlock('1234');
        expect(await vault.decryptFromStore(stored)).toEqual(DATA);
    });
});

describe('Vault: Fehlversuche & Wipe', () => {
    it('falsche PIN wirft und zählt herunter, richtige PIN setzt zurück', async () => {
        await vault.setup('1234', { ...OPTS, maxAttempts: 5 });
        vault.lock();
        await expect(vault.unlock('0000')).rejects.toMatchObject({ code: 'wrong-pin', remaining: 4 });
        await expect(vault.unlock('9999')).rejects.toMatchObject({ code: 'wrong-pin', remaining: 3 });
        await vault.unlock('1234');
        expect(vault.isUnlocked()).toBe(true);
        expect(vault.attemptsLeft()).toBe(5);
    });

    it('nach maxAttempts wird der Tresor gelöscht', async () => {
        await vault.setup('1234', { ...OPTS, maxAttempts: 3 });
        vault.lock();
        await expect(vault.unlock('x')).rejects.toMatchObject({ code: 'wrong-pin' });
        await expect(vault.unlock('x')).rejects.toMatchObject({ code: 'wrong-pin' });
        await expect(vault.unlock('x')).rejects.toMatchObject({ code: 'wiped' });
        expect(vault.isEnabled()).toBe(false);
    });
});

describe('Vault: Recovery & PIN-Wechsel', () => {
    it('Recovery-Code entsperrt den Tresor', async () => {
        const { recoveryCode } = await vault.setup('1234', OPTS);
        const stored = await vault.encryptForStore(DATA);
        vault.lock();
        await vault.unlockWithRecovery(recoveryCode);
        expect(vault.isUnlocked()).toBe(true);
        expect(await vault.decryptFromStore(stored)).toEqual(DATA);
    });

    it('PIN-Wechsel: alte PIN gilt nicht mehr, neue schon – Daten bleiben lesbar', async () => {
        await vault.setup('1234', OPTS);
        const stored = await vault.encryptForStore(DATA);
        await vault.changePin('1234', '5678');
        vault.lock();
        await expect(vault.unlock('1234')).rejects.toMatchObject({ code: 'wrong-pin' });
        await vault.unlock('5678');
        expect(await vault.decryptFromStore(stored)).toEqual(DATA);
    });

    it('verifyPin akzeptiert richtige und lehnt falsche PIN ab', async () => {
        await vault.setup('1234', OPTS);
        await expect(vault.verifyPin('1234')).resolves.toBe(true);
        await expect(vault.verifyPin('0000')).rejects.toBeTruthy();
    });
});

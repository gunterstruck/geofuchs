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

describe('Vault: Biometrie-Tür (PRF)', () => {
    // Stellvertreter für den Authenticator-PRF-Ausgang (32 hochentrope Bytes)
    const prf = new Uint8Array(32).fill(7);
    const salt = new Uint8Array(32).fill(9);
    const credId = 'Y3JlZC1pZA=='; // "cred-id" base64

    it('richtet Biometrie ein und entsperrt später ohne PIN', async () => {
        await vault.setup('1234', OPTS);
        const stored = await vault.encryptForStore(DATA);
        expect(vault.hasBiometric()).toBe(false);
        await vault.enableBiometric('1234', prf, credId, salt);
        expect(vault.hasBiometric()).toBe(true);
        expect(vault.getBiometricRequest()).toMatchObject({ credentialId: credId });

        vault.lock();
        await vault.unlockWithBiometric(prf);
        expect(vault.isUnlocked()).toBe(true);
        expect(await vault.decryptFromStore(stored)).toEqual(DATA);
    });

    it('falscher PRF-Ausgang entsperrt nicht', async () => {
        await vault.setup('1234', OPTS);
        await vault.enableBiometric('1234', prf, credId, salt);
        vault.lock();
        await expect(vault.unlockWithBiometric(new Uint8Array(32).fill(1))).rejects.toBeTruthy();
        expect(vault.isUnlocked()).toBe(false);
    });

    it('Einrichten mit falscher PIN schlägt fehl', async () => {
        await vault.setup('1234', OPTS);
        await expect(vault.enableBiometric('0000', prf, credId, salt)).rejects.toBeTruthy();
        expect(vault.hasBiometric()).toBe(false);
    });

    it('disableBiometric entfernt die Tür, PIN bleibt', async () => {
        await vault.setup('1234', OPTS);
        await vault.enableBiometric('1234', prf, credId, salt);
        expect(vault.disableBiometric()).toBe(true);
        expect(vault.hasBiometric()).toBe(false);
        vault.lock();
        await expect(vault.unlockWithBiometric(prf)).rejects.toBeTruthy();
        await vault.unlock('1234');
        expect(vault.isUnlocked()).toBe(true);
    });

    it('PIN-Wechsel lässt die Biometrie-Tür weiter funktionieren', async () => {
        await vault.setup('1234', OPTS);
        await vault.enableBiometric('1234', prf, credId, salt);
        await vault.changePin('1234', '5678');
        vault.lock();
        // Biometrie umschließt denselben DEK -> unabhängig von der PIN-Änderung
        await vault.unlockWithBiometric(prf);
        expect(vault.isUnlocked()).toBe(true);
    });
});

describe('Vault: Auto-Lock-Zeit', () => {
    it('setAutoLockMs ändert die gespeicherte Zeit', async () => {
        await vault.setup('1234', OPTS);
        expect(vault.setAutoLockMs(60000)).toBe(true);
        expect(vault.autoLockMs()).toBe(60000);
        vault.setAutoLockMs(0);
        expect(vault.autoLockMs()).toBe(0);
    });
});

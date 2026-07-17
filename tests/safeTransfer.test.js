// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    createSafeTransfer, parseSafeContainer, isSafeContainer,
    parseKeyQr, keyMatchesContainer, decryptSafeTransfer,
    SAFE_MAGIC, SAFE_KEY_PREFIX
} from '../src/features/safeTransfer.js';

const DATASET = {
    customers: [
        { id: 'c1', name: 'Autohaus Sonnenschein', plz: '80331', umsatz: 120000, lat: 48.1, lng: 11.5 },
        { id: 'c2', name: 'Müller & Söhne KG', plz: '10115', lat: 52.5, lng: 13.4 }
    ],
    fileName: 'kunden.xlsx',
    importedAt: '2026-07-01T10:00:00.000Z',
    territories: { 'kreis:09162': { name: 'München', farbe: '#f00' } },
    serviceContracts: [
        { id: 'sc:SAP:SC-1', sourceSystem: 'SAP', contractId: 'SC-1', customerNumber: 'c1', annualValue: 42000 }
    ],
    serviceContractSources: { SAP: { fileName: 'sap-service.xlsx', count: 1 } }
};

describe('createSafeTransfer', () => {
    it('erzeugt Container + Schlüssel-QR mit passenden Metadaten', async () => {
        const { container, keyQr, id, count, contractCount, territoryCount } = await createSafeTransfer(DATASET);
        expect(container[SAFE_MAGIC]).toBe(1);
        expect(container.alg).toBe('AES-256-GCM');
        expect(container.id).toBe(id);
        expect(container.count).toBe(2);
        expect(count).toBe(2);
        expect(container.contractCount).toBe(1);
        expect(contractCount).toBe(1);
        expect(container.territoryCount).toBe(1);
        expect(territoryCount).toBe(1);
        expect(typeof container.iv).toBe('string');
        expect(typeof container.ct).toBe('string');
        expect(keyQr.startsWith(`${SAFE_KEY_PREFIX}${id}:`)).toBe(true);
        expect(isSafeContainer(container)).toBe(true);
    });

    it('legt keinen Klartext im Container ab', async () => {
        const { container } = await createSafeTransfer(DATASET);
        const serialized = JSON.stringify(container);
        expect(serialized).not.toContain('Autohaus');
        expect(serialized).not.toContain('Sonnenschein');
        expect(serialized).not.toContain('kunden.xlsx');
        expect(serialized).not.toContain('München');
        expect(serialized).not.toContain('SC-1');
        expect(serialized).not.toContain('sap-service.xlsx');
    });
});

describe('Roundtrip', () => {
    it('entschlüsselt mit dem passenden Schlüssel den Originaldatensatz', async () => {
        const { container, keyQr } = await createSafeTransfer(DATASET);
        const { keyB64 } = parseKeyQr(keyQr);
        const out = await decryptSafeTransfer(container, keyB64);
        expect(out).toEqual(DATASET);
    });

    it('funktioniert auch, wenn der Container als Datei-String vorliegt', async () => {
        const { container, keyQr } = await createSafeTransfer(DATASET);
        const fileText = JSON.stringify(container);
        const { keyB64 } = parseKeyQr(keyQr);
        const out = await decryptSafeTransfer(fileText, keyB64);
        expect(out.customers).toHaveLength(2);
    });
});

describe('Schutz gegen falschen Schlüssel / Manipulation', () => {
    it('scheitert mit fremdem Schlüssel', async () => {
        const a = await createSafeTransfer(DATASET);
        const b = await createSafeTransfer(DATASET);
        const wrong = parseKeyQr(b.keyQr).keyB64;
        await expect(decryptSafeTransfer(a.container, wrong)).rejects.toBeTruthy();
    });

    it('erkennt manipulierten Chiffretext', async () => {
        const { container, keyQr } = await createSafeTransfer(DATASET);
        const { keyB64 } = parseKeyQr(keyQr);
        const tampered = { ...container, ct: container.ct.slice(0, -4) + 'AAAA' };
        await expect(decryptSafeTransfer(tampered, keyB64)).rejects.toBeTruthy();
    });
});

describe('parseKeyQr', () => {
    it('zerlegt gültige Schlüssel', () => {
        const r = parseKeyQr('TFK1:abc123:QUJDRA==');
        expect(r).toEqual({ id: 'abc123', keyB64: 'QUJDRA==' });
    });
    it('lehnt fremde/kaputte Codes ab', () => {
        expect(parseKeyQr('TF1:{"v":1}')).toBeNull();      // Tour-QR, kein Schlüssel
        expect(parseKeyQr('TFK1:nurid')).toBeNull();        // kein Doppelpunkt-Trenner
        expect(parseKeyQr('TFK1::keyohneid')).toBeNull();   // leere ID
        expect(parseKeyQr('')).toBeNull();
        expect(parseKeyQr(null)).toBeNull();
    });
});

describe('keyMatchesContainer', () => {
    it('erkennt zusammengehörige und fremde Paare', async () => {
        const a = await createSafeTransfer(DATASET);
        const b = await createSafeTransfer(DATASET);
        expect(keyMatchesContainer(a.container, parseKeyQr(a.keyQr))).toBe(true);
        expect(keyMatchesContainer(a.container, parseKeyQr(b.keyQr))).toBe(false);
    });
});

describe('parseSafeContainer', () => {
    it('lehnt Nicht-Container ab', () => {
        expect(parseSafeContainer('kein json')).toBeNull();
        expect(parseSafeContainer('{"foo":1}')).toBeNull();
        expect(parseSafeContainer({ iv: 'x', ct: 'y' })).toBeNull(); // ohne Magic/ID
        expect(parseSafeContainer(null)).toBeNull();
    });
});

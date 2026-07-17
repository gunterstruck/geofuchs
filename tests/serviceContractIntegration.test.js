import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state, setCustomers, setServiceContracts } from '../src/core/state.js';
import { customerPopupHtml } from '../src/features/map.js';
import { readWorkbook } from '../src/services/excel.js';
import { autoDetectServiceContractMapping, parseServiceContractRows } from '../src/features/serviceContracts.js';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Servicevertrags-Radar Integration', () => {
    beforeEach(() => {
        state.ui.depth = 'basis';
        state.tour.stops = [];
        state.tour.destination = null;
        setCustomers([], { fileName: null });
        setServiceContracts([], {});
    });

    it('bleibt im Basis-Onboarding verborgen und erscheint als eigener Profi-Fokus', () => {
        const document = new DOMParser().parseFromString(source('index.html'), 'text/html');
        expect(document.querySelector('[data-mode="service"]')?.classList.contains('expert-only')).toBe(true);
        expect(document.querySelector('[data-tab="vertraege"]')?.classList.contains('expert-only')).toBe(true);
        const customerScope = document.getElementById('service-customer-scope');
        expect(customerScope?.classList.contains('expert-only')).toBe(true);
        expect(customerScope?.hasAttribute('hidden')).toBe(true);
        expect(customerScope?.querySelector('[data-service-customer-scope="contracts"]')).not.toBeNull();
        expect(customerScope?.querySelector('[data-service-customer-scope="all"]')).not.toBeNull();
        expect(document.querySelector('[data-tab="tour"]')?.dataset.modes?.split(/\s+/)).toContain('service');
        expect(document.getElementById('tab-vertraege')).not.toBeNull();
        expect(document.getElementById('contract-import-dialog')).not.toBeNull();
        expect(document.getElementById('contract-radar-dialog')).not.toBeNull();
    });

    it('liefert die geprüfte Excel- und CSV-Vorlage mit dem Produkt aus', () => {
        const xlsx = readFileSync(resolve(process.cwd(), 'public/templates/tourfuchs-servicevertraege-vorlage.xlsx'));
        const csv = source('public/templates/tourfuchs-servicevertraege-beispiel.csv');
        expect(xlsx.byteLength).toBeGreaterThan(20_000);
        expect(csv).toContain('Quellsystem;Vertrags-ID;Kundennummer;Status;Datenstand');
        expect(csv).toContain('SIESALES;CON-00991');
    });

    it('liest das ausgelieferte CSV ohne Locale-Verfälschung und importiert alle Beispielverträge', async () => {
        const csv = source('public/templates/tourfuchs-servicevertraege-beispiel.csv');
        const bytes = Uint8Array.from(Buffer.from(csv, 'utf8'));
        const file = {
            name: 'tourfuchs-servicevertraege-beispiel.csv',
            type: 'text/csv',
            arrayBuffer: async () => bytes.buffer
        };

        const workbook = await readWorkbook(file);
        expect(workbook.rows[0].Datenstand).toBe('2026-07-16');
        expect(workbook.rows[0].Kundennummer).toBe('0000102456');
        const mapping = autoDetectServiceContractMapping(workbook.headers);
        const parsed = parseServiceContractRows(workbook.rows, mapping, { today: '2026-07-17' });

        expect(parsed.errors).toEqual([]);
        expect(parsed.contracts.map((contract) => contract.id)).toEqual([
            'sc:SAP:SC-004781',
            'sc:SAP:SC-004912',
            'sc:SIESALES:CON-00991'
        ]);
    });

    it('zeigt zugeordnete aktive Verträge im Profi-Kundensteckbrief, nie in Basis', () => {
        const customer = {
            id: 'c1', nummer: '0000102456', name: 'Musterwerk', plz: '45127', ort: 'Essen',
            strasse: 'Werkstraße 1', besuche: [], lat: 51.4, lng: 7.0
        };
        setCustomers([customer], { fileName: 'test.xlsx' });
        setServiceContracts([
            {
                id: 'sc:SAP:SC-1', sourceSystem: 'SAP', contractId: 'SC-1', customerNumber: '0000102456',
                status: 'AKTIV', actionBy: '2026-08-31', annualValue: 185000
            },
            {
                id: 'sc:SAP:SC-2', sourceSystem: 'SAP', contractId: 'SC-2', customerNumber: '0000102456',
                status: 'ABGELAUFEN', actionBy: '2025-01-01', annualValue: 999999
            }
        ], { SAP: { count: 2 } });

        expect(customerPopupHtml(customer)).not.toContain('popup-contract-summary');
        state.ui.depth = 'profi';
        const html = customerPopupHtml(customer);
        expect(html).toContain('popup-contract-summary');
        expect(html).toContain('1 Servicevertrag');
        expect(html).toContain('185 T€');
        expect(html).toContain('data-action="service-contracts"');
    });

    it('addiert Vertragswerte im Kundensteckbrief nicht über Währungen hinweg', () => {
        const customer = {
            id: 'c1', nummer: '42', name: 'Internationales Werk', plz: '45127', ort: 'Essen',
            strasse: '', besuche: [], lat: 51.4, lng: 7.0
        };
        state.ui.depth = 'profi';
        setCustomers([customer], { fileName: 'test.xlsx' });
        setServiceContracts([
            { id: 'eur', sourceSystem: 'SAP', contractId: 'EUR-1', customerNumber: '42', status: 'AKTIV', annualValue: 100000, currency: 'EUR' },
            { id: 'usd', sourceSystem: 'SAP', contractId: 'USD-1', customerNumber: '42', status: 'AKTIV', annualValue: 100000, currency: 'USD' }
        ], { SAP: { count: 2 } });

        const html = customerPopupHtml(customer);
        expect(html).toContain('Werte in mehreren Währungen');
        expect(html).not.toContain('200 T€');
    });

    it('zeigt bei doppelt vergebenen Kundennummern keinen willkürlich verknüpften Popup-Vertrag', () => {
        const first = { id: 'c1', nummer: '42', name: 'Werk A', plz: '45127', ort: 'Essen', besuche: [], lat: 51.4, lng: 7.0 };
        const second = { ...first, id: 'c2', name: 'Werk B', lat: 51.5 };
        state.ui.depth = 'profi';
        setCustomers([first, second], { fileName: 'doppelt.xlsx' });
        setServiceContracts([
            { id: 'sc:SAP:X', sourceSystem: 'SAP', contractId: 'X', customerNumber: '42', status: 'AKTIV' }
        ], { SAP: { count: 1 } });

        expect(customerPopupHtml(first)).not.toContain('popup-contract-summary');
        expect(customerPopupHtml(second)).not.toContain('popup-contract-summary');
    });
});

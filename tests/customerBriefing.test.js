import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    buildCustomerBriefingPrompt,
    customerBriefingContext,
    customerBriefingFlow
} from '../src/features/customerBriefing.js';
import {
    CopilotApiError,
    clearCopilotConfig,
    copilotErrorMessage,
    loadCopilotConfig,
    saveCopilotConfig
} from '../src/services/copilot.js';

const customer = {
    id: 'kunde-1',
    name: 'Beispiel Technik GmbH',
    nummer: '4711',
    strasse: 'Geheime Straße 10',
    plz: '45136',
    ort: 'Essen',
    ansprechpartner: 'Frau Beispiel',
    telefon: '0201 123456',
    email: 'intern@example.test',
    umsatz: 900000,
    besuche: ['2026-02-04', '2026-06-21']
};

beforeEach(() => clearCopilotConfig());

describe('Kundenbriefing', () => {
    it('hält das Briefing in Basis manuell und die Automatisierung in Profi', () => {
        expect(customerBriefingFlow('basis', false)).toBe('manual');
        expect(customerBriefingFlow('basis', true)).toBe('manual');
        expect(customerBriefingFlow('profi', false)).toBe('setup');
        expect(customerBriefingFlow('profi', true)).toBe('automatic');
    });

    it('baut einen eindeutigen, datensparsamen Vertriebs-Prompt', () => {
        const prompt = buildCustomerBriefingPrompt(customer, {
            plannedDate: '2026-07-15',
            stopPosition: 2,
            stopCount: 5,
            lastLocalVisit: '2026-06-21'
        });

        expect(prompt).toContain('Beispiel Technik GmbH');
        expect(prompt).toContain('Kundennummer: 4711');
        expect(prompt).toContain('45136 Essen');
        expect(prompt).toContain('Hauptansprechpartner: Frau Beispiel');
        expect(prompt).toContain('Geplanter Besuch: 15.07.2026');
        expect(prompt).toContain('Stopp 2 von 5');
        expect(prompt).toContain('Nutze keine Websuche');
        expect(prompt).toContain('## Jetzt wichtig');
        expect(prompt).toContain('genau 3 kurze, konkrete Fragen');
        expect(prompt).toContain('höchstens 250 Wörter');
        expect(prompt).toContain('keinen Vorspann');
        expect(prompt).toContain('jeden Quellenlink höchstens einmal');
        expect(prompt).not.toContain('5 konkrete Fragen');
        expect(prompt).not.toContain('600 Wörtern');
        expect(prompt).not.toContain(customer.strasse);
        expect(prompt).not.toContain(customer.telefon);
        expect(prompt).not.toContain(customer.email);
        expect(prompt).not.toContain(String(customer.umsatz));
    });

    it('leitet nur den aktuellen Tourkontext des Kunden ab', () => {
        const context = customerBriefingContext(customer, {
            start: { customerId: 'anderer-kunde' },
            destination: { customerId: customer.id },
            stops: ['kunde-0', customer.id, 'kunde-2']
        }, '2026-07-16');

        expect(context).toEqual({
            plannedDate: '2026-07-16',
            stopPosition: 2,
            stopCount: 3,
            isStart: false,
            isDestination: true,
            lastLocalVisit: '2026-06-21'
        });
    });

    it('speichert ausschließlich öffentliche Entra-Kennungen lokal', () => {
        saveCopilotConfig({
            clientId: '12345678-1234-4123-a123-123456789abc',
            tenantId: 'example.onmicrosoft.com'
        });
        expect(loadCopilotConfig()).toMatchObject({
            clientId: '12345678-1234-4123-a123-123456789abc',
            tenantId: 'example.onmicrosoft.com'
        });
        expect(localStorage.getItem('tourfuchs:copilot-config:v1')).not.toContain('secret');
    });

    it('erklärt fehlende IT-Freigabe ohne technischen Jargon', () => {
        const error = new CopilotApiError('Forbidden', { status: 403, code: 'Authorization_RequestDenied' });
        expect(copilotErrorMessage(error)).toContain('IT freigegeben');
    });

    it('ersetzt den bisherigen Kopieren-Button durch Briefing', () => {
        const mapSource = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
        const briefingSource = readFileSync(resolve(process.cwd(), 'src/ui/customerBriefing.js'), 'utf8');
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        expect(mapSource).toContain('data-action="customer-briefing"');
        expect(mapSource).not.toContain('data-action="copy-customer"');
        expect(briefingSource).toContain('Prompt kopieren &amp; Copilot öffnen');
        expect(briefingSource).toContain("flow === 'manual'");
        expect(html).toContain('id="customer-briefing-dialog"');
    });
});

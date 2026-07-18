import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const document = new JSDOM(html).window.document;

describe('Ruhiger Daten-Einstieg', () => {
    it('führt im ersten Blick über Live-Demos und hält den eigenen Import sekundär bereit', () => {
        const onboarding = document.getElementById('onboarding');
        const actionIds = [...onboarding.querySelectorAll('.ob-primary-action')]
            .map((button) => button.id);

        expect(actionIds).toEqual(['btn-showcase-ob']);
        expect(onboarding.querySelector('#btn-demo')).toBeNull();
        expect(onboarding.querySelector('#btn-own-data')?.classList.contains('ob-secondary-action')).toBe(true);
        expect(onboarding.querySelector('#demo-preview-status')).not.toBeNull();
        expect(onboarding.querySelector('#btn-upload')).toBeNull();
        expect(onboarding.querySelector('#btn-safe-receive-ob')).toBeNull();
        expect(onboarding.querySelector('[data-compliance-optin]')).toBeNull();
    });

    it('hält die Live-Demos nach dem automatischen Einblenden der Daten prominent', () => {
        const loaded = document.getElementById('data-loaded');
        const launcher = document.getElementById('demo-launcher');
        expect(launcher.querySelector('#btn-showcase-data')).not.toBeNull();
        expect(launcher.compareDocumentPosition(document.getElementById('first-steps')) & 4).toBeTruthy();
        expect(loaded.querySelector('.demo-launcher')).toBeNull();
    });

    it('trennt Excel-Import und verschlüsselten Umzug erst in der zweiten Ebene', () => {
        const dialog = document.getElementById('own-data-dialog');

        expect(dialog).not.toBeNull();
        expect(dialog.querySelector('#btn-upload')).not.toBeNull();
        expect(dialog.querySelector('#btn-template')).not.toBeNull();
        expect(dialog.querySelector('#btn-safe-receive-ob')).not.toBeNull();
        expect(dialog.querySelector('[data-compliance-optin]')).not.toBeNull();
    });

    it('öffnet und schließt die Auswahl vor den bestehenden Importwegen', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/ui/importWizard.js'), 'utf8');

        expect(source).toContain("document.getElementById('btn-own-data')");
        expect(source).toContain('ownDataDialog?.showModal()');
        expect(source).toContain('if (ownDataDialog?.open) ownDataDialog.close();');
    });
});

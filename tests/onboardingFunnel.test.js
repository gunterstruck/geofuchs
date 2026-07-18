import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIELDS, parseRows } from '../src/services/excel.js';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Onboarding-Trichter: Import ohne Vertriebsbezirk', () => {
    it('führt den Vertriebsbezirk nicht mehr als Pflichtfeld', () => {
        const bezirk = FIELDS.find((field) => field.key === 'bezirk');
        expect(bezirk.required).toBe(false);
        const wizard = source('src/ui/importWizard.js');
        expect(wizard).not.toContain('sie ist Pflicht');
    });

    it('importiert eine einfache Liste (Name + PLZ) vollständig – mit Hinweis', () => {
        const mapping = { name: 'Kunde', plz: 'PLZ' };
        const rows = [
            { Kunde: 'A GmbH', PLZ: '45127' },
            { Kunde: 'B GmbH', PLZ: '50667' }
        ];
        const { customers, errors } = parseRows(rows, mapping);
        expect(customers).toHaveLength(2);
        expect(customers.every((c) => c.bezirk === '')).toBe(true);
        const hinweis = errors.find((e) => e.Typ === 'Hinweis' && e.Grund.includes('Ohne Zuordnung'));
        expect(hinweis).toBeTruthy();
        expect(hinweis.Grund).toContain('2 Kunden ohne Vertriebsbezirk');
    });

    it('mischt Kunden mit und ohne Bezirk, ohne Zeilen zu verlieren', () => {
        const mapping = { name: 'Kunde', plz: 'PLZ', bezirk: 'Bezirk' };
        const rows = [
            { Kunde: 'A GmbH', PLZ: '45127', Bezirk: 'West' },
            { Kunde: 'B GmbH', PLZ: '50667', Bezirk: '' }
        ];
        const { customers, errors } = parseRows(rows, mapping);
        expect(customers).toHaveLength(2);
        expect(customers[0].bezirk).toBe('West');
        expect(customers[1].bezirk).toBe('');
        expect(errors.find((e) => e.Grund.includes('1 Kunde ohne Vertriebsbezirk'))).toBeTruthy();
    });

    it('verlangt für Flächenzeilen weiterhin einen Bezirk', () => {
        const mapping = { name: 'Kunde', plz: 'PLZ', bezirk: 'Bezirk', gebiet: 'Gebiet' };
        const rows = [{ Kunde: '', PLZ: '', Bezirk: '', Gebiet: 'Oberhausen' }];
        const { customers, areaRows, errors } = parseRows(rows, mapping);
        expect(customers).toHaveLength(0);
        expect(areaRows).toHaveLength(0);
        expect(errors.some((e) => e.Grund.includes('Flächenzeile ohne Vertriebsbezirk'))).toBe(true);
    });
});

describe('Onboarding-Trichter: ein Einstieg, sichtbare nächste Schritte', () => {
    it('macht Live-Demos zum primären Einstieg, ohne einen Auto-Dialog zu öffnen', () => {
        const html = source('index.html');
        const showcase = source('src/ui/showcase.js');

        expect(html).toContain('id="btn-showcase-ob" class="primary ob-primary-action"');
        expect(html).toContain('id="btn-own-data" class="ob-secondary-action"');
        expect(html).not.toContain('id="btn-demo"');
        expect(html).toContain('id="demo-preview-status"');
        expect(html).toContain('id="btn-showcase-data"');
        expect(showcase).not.toContain('scheduleAutoOffer');
        expect(showcase).not.toContain('AUTO_OFFER_DELAY_MS');
    });

    it('verdrahtet die Erste-Schritte-Karte in Sidebar, Main und Tour-Übergabe', () => {
        const html = source('index.html');
        const main = source('src/main.js');
        const tourPanel = source('src/ui/tourPanel.js');
        const css = source('src/styles/components.css');

        expect(html).toContain('id="first-steps"');
        expect(main).toContain('initFirstSteps()');
        expect(tourPanel).toContain('noteTourSharedToPhone()');
        expect(css).toContain('.first-steps-list');
    });

    it('startet Live-Demos direkt aus den passenden Erste-Schritte-Einträgen', () => {
        const steps = source('src/features/firstSteps.js');
        const ui = source('src/ui/firstSteps.js');
        const showcase = source('src/ui/showcase.js');
        const css = source('src/styles/components.css');

        expect(steps).toContain("showcase: 'tour'");
        expect(steps).toContain("showcase: 'handy-qr'");
        expect(ui).toContain('data-showcase');
        expect(ui).toContain('startShowcaseStory(button.dataset.showcase)');
        expect(showcase).toContain('export function startShowcaseStory(storyId)');
        expect(css).toContain('.first-steps-action');
        expect(css).toContain('.first-steps-play');
    });

    it('bietet drei Zustände: „Später", Chip-Zeile und umkehrbares „Nicht mehr zeigen"', () => {
        const ui = source('src/ui/firstSteps.js');
        const html = source('index.html');
        const css = source('src/styles/components.css');

        // Kein unwiederbringliches Wegkreuzen mehr – nur Später/Chip/explizite Abwahl.
        expect(ui).not.toContain('first-steps-dismiss');
        expect(ui).toContain('first-steps-later');
        expect(ui).toContain('first-steps-never');
        expect(ui).toContain('first-steps-chip');
        expect(ui).toContain('unhideFirstSteps()');
        // Abwahl ist über den Info-Dialog umkehrbar.
        expect(html).toContain('id="btn-first-steps-restore"');
        expect(css).toContain('.first-steps-chip');
    });

    it('setzt die Erste-Schritte-Checkliste bei „Daten löschen" zurück', () => {
        const ui = source('src/ui/firstSteps.js');
        // Wie der Showcase-Fortschritt beginnt auch die Checkliste nach dem
        // bewussten Datenlöschen von vorn (inklusive einer früheren Abwahl).
        expect(ui).toContain("on('dataset:cleared'");
        expect(ui).toContain('resetFirstSteps()');
    });

    it('hebt die Compliance-Checkbox am Ort hervor, wenn sie fehlt', () => {
        const wizard = source('src/ui/importWizard.js');
        const css = source('src/styles/components.css');
        expect(wizard).toContain("classList.add('attention')");
        expect(css).toContain('.compliance-optin.attention');
    });
});

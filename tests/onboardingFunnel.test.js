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
        expect(html).not.toContain('id="btn-showcase-data"');
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
        // Vierte Demo statt Import; am Handy das Gerät-Gegenstück (Empfang).
        expect(steps).toContain("showcase: 'tresor'");
        expect(steps).toContain("showcase: 'empfang'");
        expect(ui).toContain('data-showcase');
        expect(ui).toContain('startShowcaseStory(button.dataset.showcase)');
        expect(ui).toContain("on('customer:detail-opened'");
        expect(ui).toContain("on('showcase:story-completed'");
        expect(source('src/features/map.js')).toContain("emit('customer:detail-opened', customer.id)");
        expect(showcase).toContain('export function startShowcaseStory(storyId)');
        expect(css).toContain('.first-steps-action');
        expect(css).toContain('.first-steps-play');
    });

    it('bietet vier Live-Demos gerätegerecht an, der Import bleibt im Onboarding', () => {
        const steps = source('src/features/firstSteps.js');
        const ui = source('src/ui/firstSteps.js');
        const html = source('index.html');

        // Die Checkliste besteht jetzt aus vier Live-Demos (kein Import-Schritt).
        expect(steps).toContain('export function firstStepsFor');
        expect(steps).not.toContain("action: 'own-data'");
        expect(ui).not.toContain("button.dataset.action === 'own-data'");
        // Der eigene Datenimport bleibt über das Onboarding erreichbar.
        expect(html).toContain('id="btn-own-data"');
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

    it('klappt die Checkliste ein, sobald der Nutzer erkennbar etwas anderes tut', () => {
        const ui = source('src/ui/firstSteps.js');
        // Aktivitäts-Signale (Bezirk wählen, Kunde öffnen, Karte antippen) klappen
        // die Karte zur schmalen Zeile ein – als hätte der Nutzer „Später" gedrückt.
        expect(ui).toContain('collapseOnActivity');
        expect(ui).toContain("'tour:scope-changed'");
        expect(ui).toContain("'customer:detail-opened'");
        expect(ui).toContain('setFirstStepsCollapsed(true)');
        // Echtes Antippen der Karte zählt, programmatische Ereignisse nicht.
        expect(ui).toContain("getElementById('map')?.addEventListener('pointerdown'");
        expect(ui).toContain('ev.isTrusted');
    });

    it('zeigt die Checkliste beim ersten automatischen Reveal ausgeklappt', () => {
        const ui = source('src/ui/firstSteps.js');
        // Auf dem Handy startet die Checkliste sonst als Chip; beim allerersten
        // Auto-Load der Beispielkunden wird sie einmal ausgeklappt gezeigt.
        expect(ui).toContain("on('demo:auto-loaded'");
        expect(ui).toContain('setFirstStepsCollapsed(false)');
    });

    it('startet nach dem Zurücksetzen einen Neustart mit Live-Demo statt leerer Karte', () => {
        const wizard = source('src/ui/importWizard.js');
        const css = source('src/styles/responsive.css');
        // Zurücksetzen ist ein Neustart: Die Willkommens-Demo wird neu geplant und
        // die Nutzerabsicht zurückgenommen, damit die Beispielkunden wiederkommen.
        expect(wizard).toContain("on('dataset:cleared'");
        expect(wizard).toContain('welcomeDemoUserIntent = false');
        expect(wizard).toContain('scheduleWelcomeDemo()');
        // Das mobile Onboarding-Panel bleibt kompakt (~ein Drittel), Karte sichtbar.
        expect(css).toContain('height: min(52dvh, 480px)');
        expect(css).toContain('.sidebar.onboarding .ob-primary-action');
    });

    it('hebt die Compliance-Checkbox am Ort hervor, wenn sie fehlt', () => {
        const wizard = source('src/ui/importWizard.js');
        const css = source('src/styles/components.css');
        expect(wizard).toContain("classList.add('attention')");
        expect(css).toContain('.compliance-optin.attention');
    });
});

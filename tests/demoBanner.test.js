import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Demo-Streifen: „Eigene Daten laden" bei Beispieldaten überall anbieten', () => {
    const html = read('index.html');
    const sidebar = read('src/ui/sidebar.js');
    const wizard = read('src/ui/importWizard.js');

    it('bringt einen ständigen Streifen mit direktem Upload-Einstieg', () => {
        expect(html).toContain('id="demo-banner"');
        expect(html).toContain('id="btn-demo-own-data"');
        // Steht oben im Panel (vor der Ansichtstiefe), damit er überall sichtbar ist.
        expect(html.indexOf('id="demo-banner"')).toBeLessThan(html.indexOf('id="depth-switch"'));
    });

    it('zeigt den Streifen nur bei aktiven Beispieldaten', () => {
        expect(sidebar).toContain("demoBanner.hidden = empty || !isDemoDataset(state.customers)");
    });

    it('führt den Streifen-Knopf in den geführten Upload-Dialog', () => {
        const from = wizard.indexOf("getElementById('btn-demo-own-data')");
        expect(from).toBeGreaterThan(-1);
        const block = wizard.slice(from, from + 200);
        expect(block).toContain('ownDataDialog?.showModal()');
    });

    it('macht den Daten-Tab-Knopf bei Demo zu „Eigene Daten laden" (geführt)', () => {
        expect(sidebar).toContain("'📂 Eigene Daten laden'");
        // Klick führt bei Demo in den Dialog statt in den rohen Datei-Picker.
        expect(wizard).toContain('if (isDemoDataset(state.customers)) { cancelWelcomeDemo(); ownDataDialog?.showModal(); return; }');
    });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Service-Modul ist optional (opt-in unter Gebietsplanung)', () => {
    const html = read('index.html');
    const layout = read('src/styles/layout.css');
    const sidebar = read('src/ui/sidebar.js');

    it('bietet das Häkchen unten in der Gebietsplanung an (nur im Profi-Modus)', () => {
        // Liegt im Gebiete-Tab, ist expert-only und heißt klar nach dem Modul.
        const gebiete = html.slice(html.indexOf('id="tab-gebiete"'), html.indexOf('<!-- Tab: Team'));
        expect(gebiete).toContain('id="chk-service-enabled"');
        expect(gebiete).toContain('service-optin expert-only');
        expect(gebiete).toContain('Service-Modul anzeigen');
    });

    it('blendet den Service-Modus standardmäßig aus, erst mit service-on sichtbar', () => {
        expect(layout).toContain('.sidebar > .mode-switch .mode-btn[data-mode="service"] { display: none; }');
        expect(layout).toContain('body.service-on .sidebar > .mode-switch .mode-btn[data-mode="service"] { display: block; }');
        // Der Schalter ist ohne Service zweispaltig, mit Service dreispaltig.
        expect(layout).toContain('body.depth-profi.service-on .sidebar > .mode-switch { grid-template-columns: repeat(3, minmax(0, 1fr)); }');
    });

    it('merkt sich die Wahl und fällt bei Deaktivierung aus dem Service zurück', () => {
        expect(sidebar).toContain("const SERVICE_ENABLED_KEY = 'gf_service_enabled'");
        expect(sidebar).toContain('function applyServiceEnabled');
        expect(sidebar).toContain("document.body.classList.toggle('service-on', !!on)");
        // Deaktivieren während Service läuft → still zurück auf Außendienst.
        expect(sidebar).toContain("if (!on && state.ui.mode === 'service') applyMode('aussendienst'");
        // Beim Start aus dem Speicher (Default aus – kein Bestandsschutz nötig).
        expect(sidebar).toContain('function initServiceOptIn');
        expect(sidebar).toContain('initServiceOptIn();');
    });
});

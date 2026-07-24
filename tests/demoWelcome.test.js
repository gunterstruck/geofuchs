import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Zentraler Willkommens-Hinweis bei Beispieldaten', () => {
    const html = read('index.html');
    const welcome = read('src/ui/demoWelcome.js');
    const main = read('src/main.js');
    const wizard = read('src/ui/importWizard.js');
    const showcase = read('src/ui/showcase.js');

    it('legt eine nicht-blockierende Willkommens-Karte über die Karte', () => {
        expect(html).toContain('id="demo-welcome"');
        expect(html).toContain('id="btn-demo-welcome-own"');
        expect(html).toContain('id="btn-demo-welcome-demos"');
        expect(html).toContain('id="btn-demo-welcome-ack"');
        // Sitzt im App-Bereich hinter der Karte (nach den Toasts), nicht in der Sidebar.
        expect(html.indexOf('id="demo-welcome"')).toBeGreaterThan(html.indexOf('id="toasts"'));
    });

    it('zeigt den Hinweis nur bei aktiven Beispieldaten und noch nicht quittiert', () => {
        expect(welcome).toContain('isDemoDataset(state.customers)');
        expect(welcome).toContain("'tf_demo_welcome_ack'");
        // Jeder Weg quittiert (merken + ausblenden).
        expect(welcome).toContain('markAcknowledged()');
        // Nach bewusstem Löschen darf der Hinweis wiederkommen.
        expect(welcome).toContain("on('dataset:cleared'");
        expect(welcome).toContain('forgetAcknowledged()');
    });

    it('wird in main.js initialisiert', () => {
        expect(main).toContain('initDemoWelcome');
    });

    it('führt „Eigene Daten laden" in den geführten Upload-Dialog', () => {
        const from = wizard.indexOf("getElementById('btn-demo-welcome-own')");
        expect(from).toBeGreaterThan(-1);
        expect(wizard.slice(from, from + 160)).toContain('ownDataDialog?.showModal()');
    });

    it('führt „Live-Demos ansehen" in das Showcase-Schaufenster', () => {
        expect(showcase).toContain("'btn-demo-welcome-demos'");
    });
});

describe('Entdeck-Hinweise bei Beispieldaten wieder scharf', () => {
    const map = read('src/features/map.js');
    const sidebar = read('src/ui/sidebar.js');
    const responsive = read('src/styles/responsive.css');

    it('behandelt die Entdeck-Reise bei Beispieldaten nie als „erledigt"', () => {
        // So spielen Stapel-Wackeln & Marker-Hinweis in jedem Demo-Termin (auch
        // nach Refresh und auf dem Desktop) wieder, statt dauerhaft still zu sein.
        expect(map).toContain('if (isDemoDataset(state.customers)) return false;');
    });

    it('zeigt den „nächster Schritt"-Fuchs auch auf dem Desktop', () => {
        // Der Mobil-Sonderfall (nur bei eingeklapptem Blatt) gilt nur noch mobil.
        expect(sidebar).toContain('isMobileUi() ? !state.ui.sidebarOpen : true');
        // Desktop-Styling ist bewusst ab 901px definiert, damit Mobil unverändert bleibt.
        expect(responsive).toContain('@media (min-width: 901px)');
        const desktopBlock = responsive.slice(responsive.indexOf('@media (min-width: 901px)'));
        expect(desktopBlock).toContain('.mobile-next-step');
    });
});

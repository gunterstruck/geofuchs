import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Tour-Aktionen: Scan als Einstieg, QR prominent, Desktop-Timeline', () => {
    const html = read('index.html');
    const responsive = read('src/styles/responsive.css');
    const components = read('src/styles/components.css');

    it('holt „Tour vom Desktop scannen" nach oben in die Einstiegszone (nur Handy)', () => {
        // Der Scan-Knopf steht jetzt bei „Was ist in meiner Nähe?", nicht mehr
        // unten in der „Meine Tour"-Aktionsliste.
        expect(html).toMatch(/id="btn-tour-scan"[^>]*class="[^"]*only-mobile[^"]*btn-scan-entry/);
        const scanIdx = html.indexOf('id="btn-tour-scan"');
        const nearbyIdx = html.indexOf('id="btn-nearby"');
        const optimizeIdx = html.indexOf('id="btn-optimize"'); // erster Knopf des Aktionsstapels
        expect(scanIdx).toBeGreaterThan(nearbyIdx);   // direkt nach „In der Nähe"
        expect(scanIdx).toBeLessThan(optimizeIdx);     // nicht mehr im Aktionsstapel
    });

    it('blendet den Scan-Einstieg im Fokus-Modus aus und stylt ihn sekundär', () => {
        expect(responsive).toContain('body.tour-focus #btn-tour-scan');
        expect(responsive).toContain('.btn-scan-entry');
    });

    it('rückt die QR-Übergabe am Desktop nach oben und hebt sie hervor', () => {
        expect(html).toMatch(/id="btn-tour-qr"[^>]*class="[^"]*only-desktop[^"]*qr-handoff/);
        const gmapsIdx = html.indexOf('id="btn-gmaps"');
        const qrIdx = html.indexOf('id="btn-tour-qr"');
        const printIdx = html.indexOf('id="btn-tour-print"');
        expect(qrIdx).toBeGreaterThan(gmapsIdx);
        expect(qrIdx).toBeLessThan(printIdx);           // direkt unter „Google Maps"
        expect(components).toContain('.qr-handoff:not(:disabled)');
    });

    it('bringt die grüne Tourlinie auch auf den Desktop', () => {
        expect(components).toContain('.stop-row::before');
        expect(components).toContain('.stop-row.stop-first::before { top: 50%; }');
        expect(components).toContain('.stop-row.stop-last::before { bottom: 50%; }');
        // Punkt liegt über der Linie, mit hellem Ring.
        expect(components).toMatch(/\.stop-num \{[\s\S]*z-index: 1;/);
    });
});

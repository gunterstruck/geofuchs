import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Teilbarkeit: Link-Vorschau, Rechtsseiten und Feedback-Kanal', () => {
    const html = read('index.html');

    it('liefert eine vollständige Open-Graph-/Twitter-Vorschau', () => {
        expect(html).toContain('<link rel="canonical" href="https://tourfuchs.vercel.app/">');
        expect(html).toContain('property="og:title"');
        expect(html).toContain('property="og:description"');
        expect(html).toContain('property="og:image" content="https://tourfuchs.vercel.app/og-image.png"');
        expect(html).toContain('property="og:image:alt"');
        expect(html).toContain('name="twitter:card" content="summary_large_image"');
    });

    it('bringt das Vorschaubild in 1200×630 mit', () => {
        const png = readFileSync(resolve(process.cwd(), 'public/og-image.png'));
        // PNG-Header: Breite/Höhe stehen big-endian in Byte 16–23.
        expect(png.readUInt32BE(16)).toBe(1200);
        expect(png.readUInt32BE(20)).toBe(630);
        expect(statSync(resolve(process.cwd(), 'public/og-image.png')).size).toBeGreaterThan(10_000);
    });

    it('verlinkt einen sichtbaren Feedback-Kanal im Info-Dialog', () => {
        expect(html).toContain('https://github.com/gunterstruck/geofuchs/issues');
        expect(html).toContain('mailto:geofuchs@online.de?subject=TourFuchs%20Feedback');
    });

    it('hält Impressum und Datenschutzerklärung erreichbar', () => {
        expect(html).toContain('href="/datenschutz.html"');
        expect(html).toContain('href="/license.html"');
        const datenschutz = read('public/datenschutz.html');
        expect(datenschutz).toContain('Verantwortlicher');
        expect(datenschutz).toContain('ausschließlich lokal in Ihrem Browser');
    });
});

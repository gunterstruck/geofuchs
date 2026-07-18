import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    ZANOBO_DEFAULT_BASE,
    setZanoboBaseUrl,
    zanoboBaseUrl,
    zanoboMachineUrl
} from '../src/services/zanobo.js';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

beforeEach(() => localStorage.clear());

describe('Zanobo-Brücke: Deep-Links', () => {
    it('baut den Maschinen-Link auf der öffentlichen Instanz', () => {
        expect(zanoboMachineUrl('DEMO-ASSET-20001-01'))
            .toBe('https://zanobo.vercel.app/#/m/DEMO-ASSET-20001-01');
    });

    it('kodiert Sonderzeichen und schneidet Basis-Schrägstriche ab', () => {
        expect(zanoboMachineUrl('Pumpe 4/BA#7', 'https://intern.example.de/zanobo/'))
            .toBe('https://intern.example.de/zanobo/#/m/Pumpe%204%2FBA%237');
    });

    it('liefert null ohne Anlagen-ID oder Basis', () => {
        expect(zanoboMachineUrl('')).toBeNull();
        expect(zanoboMachineUrl('   ')).toBeNull();
        expect(zanoboMachineUrl(null)).toBeNull();
        expect(zanoboMachineUrl('A1', '')).toBeNull();
    });
});

describe('Zanobo-Brücke: Instanz-Konfiguration', () => {
    it('nutzt ohne Konfiguration die öffentliche Instanz', () => {
        expect(zanoboBaseUrl()).toBe(ZANOBO_DEFAULT_BASE);
    });

    it('speichert eine eigene Instanz normalisiert (ohne Fragment/Query/Slash)', () => {
        expect(setZanoboBaseUrl('https://intern.example.de/zanobo/?x=1#top'))
            .toBe('https://intern.example.de/zanobo');
        expect(zanoboBaseUrl()).toBe('https://intern.example.de/zanobo');
        expect(zanoboMachineUrl('M-1')).toBe('https://intern.example.de/zanobo/#/m/M-1');
    });

    it('lehnt unsichere oder kaputte Adressen ab', () => {
        expect(setZanoboBaseUrl('javascript:alert(1)')).toBeNull();
        expect(setZanoboBaseUrl('nix')).toBeNull();
        expect(zanoboBaseUrl()).toBe(ZANOBO_DEFAULT_BASE);
    });

    it('leeres Feld kehrt zur öffentlichen Instanz zurück', () => {
        setZanoboBaseUrl('https://intern.example.de');
        expect(setZanoboBaseUrl('')).toBe(ZANOBO_DEFAULT_BASE);
        expect(zanoboBaseUrl()).toBe(ZANOBO_DEFAULT_BASE);
    });
});

describe('Zanobo-Brücke: Verdrahtung in der App', () => {
    it('verlinkt Einsatzkarte, Tour-Stopp, Tagesplan-Druck und Kalender', () => {
        expect(source('src/ui/serviceVisitPlanner.js')).toContain('zanoboMachineUrl(visit.assetId)');
        expect(source('src/ui/tourPanel.js')).toContain('zanoboMachineUrl(');
        const exportSource = source('src/features/tourExport.js');
        expect(exportSource).toContain('zanoboMachineUrl(visit.assetId)');
        expect(exportSource).toContain('Maschine anhören (Zanobo)');
    });

    it('bietet die Instanz-Einstellung im Einsätze-Tab an', () => {
        const html = source('index.html');
        expect(html).toContain('id="zanobo-base-url"');
        // Ehrliches Wording: Vergleich/Orientierung, keine Diagnose.
        expect(html).toContain('Orientierung, keine Diagnose');
    });

    it('die Service-Demo erzählt den Zanobo-Abschluss', () => {
        const stories = source('src/features/stories.js');
        expect(stories).toContain('Zanobo');
        expect(stories).toContain('Orientierung, keine Diagnose');
    });
});

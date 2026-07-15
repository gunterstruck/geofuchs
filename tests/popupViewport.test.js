import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { popupSafeRect, popupPanOffset, popupContentHeightLimit } from '../src/features/popupViewport.js';

const mapCss = readFileSync(resolve(process.cwd(), 'src/styles/map.css'), 'utf8');

const rect = (left, top, right, bottom) => ({
    left, top, right, bottom,
    width: right - left,
    height: bottom - top
});

describe('mobiler Popup-Sichtbereich', () => {
    it('reserviert die echte Kopfsteuerung und das sichtbare Bottom-Sheet', () => {
        expect(popupSafeRect(rect(0, 52, 390, 844), {
            topObstruction: rect(0, 52, 390, 142),
            bottomObstruction: rect(0, 798, 390, 844),
            margin: 12
        })).toEqual({ left: 12, top: 154, right: 378, bottom: 786 });
    });

    it('verschiebt ein von Karte/Tour verdecktes Popup nach unten', () => {
        expect(popupPanOffset(
            rect(45, 118, 345, 470),
            rect(12, 154, 378, 786)
        )).toEqual([0, -36]);
    });

    it('verschiebt ein vom Bottom-Sheet verdecktes Popup nach oben', () => {
        expect(popupPanOffset(
            rect(45, 480, 345, 812),
            rect(12, 154, 378, 786)
        )).toEqual([0, 26]);
    });

    it('lässt ein vollständig sichtbares Popup unverändert', () => {
        expect(popupPanOffset(
            rect(45, 180, 345, 620),
            rect(12, 154, 378, 786)
        )).toEqual([0, 0]);
    });

    it('begrenzt lange Inhalte so, dass Rahmen und Pfeil sichtbar bleiben', () => {
        expect(popupContentHeightLimit(
            rect(45, 110, 345, 610),
            rect(57, 130, 333, 570),
            rect(12, 154, 378, 530),
            380
        )).toBe(316);
    });

    it('blendet die redundanten Karten-Zoomtasten nur mobil aus', () => {
        expect(mapCss).toMatch(/@media \(max-width: 768px\)[\s\S]*?#map \.leaflet-control-zoom\s*{\s*display: none;/);
        expect(mapCss).not.toMatch(/^#map \.leaflet-control-zoom\s*{\s*display: none;/m);
    });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    canOfferCustomerMarkerHint,
    customerMarkerLabel,
    customerMarkerMode,
    customerMarkerModeClass
} from '../src/features/customerMarkers.js';

describe('Lebendige Kunden-Kacheln', () => {
    it('enthüllt Information progressiv mit dem Kartenzoom', () => {
        expect(customerMarkerMode(7.75)).toBe('dot');
        expect(customerMarkerMode(8)).toBe('card');
        expect(customerMarkerMode(12)).toBe('label');
        expect(customerMarkerMode(14.5)).toBe('detail');
    });

    it('zeigt Namen und Details mobil etwas später, um die Karte ruhig zu halten', () => {
        expect(customerMarkerMode(12, { mobile: true })).toBe('card');
        expect(customerMarkerMode(13, { mobile: true })).toBe('label');
        expect(customerMarkerMode(15.5, { mobile: true })).toBe('detail');
        expect(customerMarkerModeClass('label')).toBe('customer-marker-mode-label');
        expect(customerMarkerModeClass('unbekannt')).toBe('customer-marker-mode-dot');
    });

    it('zeigt bei Demokunden sofort den unterscheidbaren Namen statt des langen Präfixes', () => {
        expect(customerMarkerLabel('TourFuchs Demo · Autohaus 0339', { demo: true })).toBe('Autohaus 0339');
        expect(customerMarkerLabel('Müller Maschinenbau', { demo: false })).toBe('Müller Maschinenbau');
    });

    it('bietet den Entdecken-Hinweis nur einmal und nicht während einer Vorführung an', () => {
        expect(canOfferCustomerMarkerHint({ zoom: 8, hasCustomers: true })).toBe(true);
        expect(canOfferCustomerMarkerHint({ zoom: 7, hasCustomers: true })).toBe(false);
        expect(canOfferCustomerMarkerHint({ zoom: 12, hasCustomers: true, alreadyShown: true })).toBe(false);
        expect(canOfferCustomerMarkerHint({ zoom: 12, hasCustomers: true, showcaseRunning: true })).toBe(false);
        expect(canOfferCustomerMarkerHint({ zoom: 12, hasCustomers: true, insidePreview: true })).toBe(false);
    });

    it('verdrahtet Klemmbrett, Namensstufe, Hinweis und Popup-Animation', () => {
        const map = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/map.css'), 'utf8');
        expect(map).toContain('customer-marker-symbol');
        expect(map).toContain('Kundenkarte antippen und Details entdecken');
        expect(map).toContain("className: 'customer-detail-popup'");
        expect(css).toContain('.customer-marker-mode-label .customer-marker-card');
        expect(css).toContain('@keyframes customer-popup-unfold');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });
});

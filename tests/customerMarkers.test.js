import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    DEFAULT_CUSTOMER_COLOR,
    canOfferCustomerMarkerHint,
    customerClusterRadius,
    customerClusterSummary,
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

    it('hält dichte Kundenbestände länger in ruhigen Stapeln zusammen', () => {
        expect(customerClusterRadius(6)).toBe(104);
        expect(customerClusterRadius(9)).toBe(112);
        expect(customerClusterRadius(13)).toBe(68);
        expect(customerClusterRadius(15)).toBe(42);
        expect(customerClusterRadius(9, { mobile: true })).toBe(120);
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

    it('hält Kundenstapel operativ grün und nutzt Gebietsfarben nur im Planungskontext', () => {
        const customers = [{ bezirk: 'Nord' }, { bezirk: 'Nord' }];
        expect(customerClusterSummary(customers)).toMatchObject({
            count: 2,
            color: DEFAULT_CUSTOMER_COLOR,
            kind: 'neutral',
            context: '2 Kunden in diesem Bereich'
        });
        expect(customerClusterSummary(customers, {
            planning: true,
            colorFor: () => '#2563eb'
        })).toMatchObject({ color: '#2563eb', accent: '#2563eb', kind: 'assigned' });
    });

    it('macht gemischte und unzugeordnete Planungsstapel explizit', () => {
        const mixed = customerClusterSummary([{ gruppe: 'Nord' }, { gruppe: 'Süd' }], {
            planning: true,
            attr: 'gruppe',
            dimensionLabel: 'Vertriebsgruppen',
            colorFor: (value) => value === 'Nord' ? '#2563eb' : '#dc2626'
        });
        expect(mixed.kind).toBe('mixed');
        expect(mixed.accent).toContain('linear-gradient');
        expect(mixed.context).toBe('2 Kunden · mehrere Vertriebsgruppen');

        expect(customerClusterSummary([{ bezirk: '' }], {
            planning: true,
            colorFor: () => '#94a3b8'
        }).kind).toBe('unassigned');
    });

    it('verdrahtet Klemmbrett, Namensstufe, Hinweis und Popup-Animation', () => {
        const map = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/map.css'), 'utf8');
        expect(map).toContain('customer-marker-symbol');
        expect(map).toContain('customer-stack-card');
        expect(map).toContain('customer-stack-discovery-label');
        expect(map).toContain('Tippe einen Kundenstapel an');
        expect(map).toContain('territory-stack-card');
        expect(map).toContain('tl-dimension');
        expect(map).toContain("? 'Bezirk'");
        expect(map).toContain('{ width: 94, height: 84 }');
        // Umsatz je Gebiet ab Vertriebsbezirk aufwärts in jeder Labelstufe.
        expect(map).toContain('class="tl-rev"');
        expect(css).toContain('.territory-stack-card .tl-rev');
        // Vollständigkeits-Modus beim Gebiete-Managen: adaptiv verkleinern + Code-Chip-Fallback.
        expect(map).toContain("state.ui.mode === 'gebietsplanung'");
        expect(map).toContain('territory-stack-card--mini');
        expect(css).toContain('.territory-stack-card--mini');
        // Der Mini-Chip hängt in Leaflets 0 Pixel breiter Marker-Ebene:
        // „width: auto" kollabierte dort zur leeren Pille ohne Bezirks-Code.
        expect(css).toMatch(/\.territory-stack-card--mini \{[^}]*width: max-content;/);
        expect(css).not.toMatch(/\.territory-stack-card--mini \{[^}]*width: auto;/);
        expect(map).toContain('Kundenkarte antippen und Details entdecken');
        expect(map).toContain('resetCustomerDiscoveryHints');
        expect(map).toContain('localStorage.removeItem(CUSTOMER_DISCOVERY_DONE_KEY)');
        expect(map).toContain("className: 'customer-detail-popup'");
        expect(css).toContain('.customer-marker-mode-label .customer-marker-card');
        // Label-/Detailstufe ist eine hochkant „Tablet"-Kachel mit Pin-Spitze auf
        // der Adresse – kein flacher Zeilen-Streifen mehr.
        expect(map).toContain('customer-marker-accent');
        expect(css).toContain('.customer-marker-accent { display: none; }');
        expect(css).toContain('.customer-marker-mode-detail .customer-marker-card::after');
        expect(css).toMatch(/\.customer-marker-mode-label \.customer-marker-card,\s*\.customer-marker-mode-detail \.customer-marker-card \{\s*position: absolute;/);
        expect(css).toContain('@keyframes customer-popup-unfold');
        expect(css).toContain('.customer-stack-card.is-discovery .customer-stack-discovery-label');
        expect(css).toMatch(/\.territory-stack-card--compact\s*\{\s*width:\s*94px;\s*min-height:\s*84px;/);
        expect(css).not.toContain('text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.territory-stack-card .tl-metrics');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });
});

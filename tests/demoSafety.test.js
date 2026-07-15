import { describe, expect, it } from 'vitest';
import {
    DEMO_DATA_LABEL,
    DEMO_DATA_ORIGIN,
    demoEmail,
    demoPhone,
    demoCustomersNeedNormalization,
    isDemoCustomer,
    normalizeDemoCustomer
} from '../src/core/demoSafety.js';
import { customerExportRows } from '../src/services/excel.js';
import { exactGeocodeCandidates } from '../src/services/geocode.js';
import { customerText, tourText } from '../src/features/handoff.js';
import { customerPopupHtml } from '../src/features/map.js';

describe('Demo-Sicherheitsnetz', () => {
    it('nutzt ausschließlich offizielle Drama-Rufnummern und reservierte E-Mail-Domains', () => {
        const phones = Array.from({ length: 2250 }, (_, index) => demoPhone(index));
        expect(new Set(phones).size).toBe(2250);
        expect(phones.every((phone) => /^(030 23125|069 90009|040 66969|0221 4710|089 99998) \d{3}$/.test(phone))).toBe(true);
        expect(demoEmail(42)).toBe('kunde-0043@example.com');
    });

    it('migriert auch alte Demo-Kunden und entfernt erfundene Kontaktdaten und Straßen', () => {
        const customer = {
            id: 'demo-7', nummer: '20007', name: 'Autohaus Schmidt GmbH',
            strasse: 'Hauptstraße 99', telefon: '0172 1234567', email: 'info@zufall-firma.de'
        };

        expect(demoCustomersNeedNormalization([customer])).toBe(true);
        normalizeDemoCustomer(customer);

        expect(customer).toMatchObject({
            name: 'TourFuchs Demo · Autohaus 0008',
            strasse: '',
            telefon: demoPhone(7),
            email: demoEmail(7),
            dataOrigin: DEMO_DATA_ORIGIN,
            demo: true
        });
        expect(customer.contacts).toHaveLength(1);
        expect(demoCustomersNeedNormalization([customer])).toBe(false);
    });

    it('erkennt exportierte Demo-Zeilen, lässt echte Kunden aber unverändert', () => {
        const importedDemo = { id: 'k1', name: 'Neutral', extra: { Datenstatus: DEMO_DATA_LABEL } };
        const real = { id: 'kunde-1', name: 'Echter Import', telefon: '0201 123456' };
        const snapshot = { ...real };

        expect(isDemoCustomer(importedDemo)).toBe(true);
        expect(normalizeDemoCustomer(real)).toBe(real);
        expect(real).toEqual(snapshot);
    });

    it('schließt Demo-Kunden aus der externen Adress-Geocodierung aus', () => {
        const demo = { id: 'demo-1', name: 'Demo', strasse: 'Falsch 1', plz: '45127', geo: 'plz' };
        const real = { id: 'real-1', name: 'Real', strasse: 'Richtig 1', plz: '45127', geo: 'plz' };
        expect(exactGeocodeCandidates([demo, real])).toEqual([real]);
    });

    it('rendert bei Demo-Kunden weder tel: noch mailto:, bei Echtdaten weiterhin schon', () => {
        const base = {
            nummer: '1', strasse: '', plz: '45127', ort: 'Essen', bezirk: 'West',
            telefon: '0201 123456', email: 'kontakt@example.org', besuche: [], lat: 51.4, lng: 7.0
        };
        const demoHtml = customerPopupHtml({ ...base, id: 'demo-1', name: 'Demo' });
        const realHtml = customerPopupHtml({ ...base, id: 'real-1', name: 'Real' });

        expect(demoHtml).not.toContain('href="tel:');
        expect(demoHtml).not.toContain('href="mailto:');
        expect(demoHtml).toContain('data-action="demo-call"');
        expect(demoHtml).toContain('data-action="demo-email"');
        expect(realHtml).toContain('href="tel:');
        expect(realHtml).toContain('href="mailto:');
    });

    it('kennzeichnet Excel- und Textübergaben eindeutig als nicht produktiv', () => {
        const demo = normalizeDemoCustomer({
            id: 'demo-2', nummer: '20002', name: 'Logistik Zufall', plz: '45127', ort: 'Essen',
            telefon: 'x', email: 'x', besuche: [], lat: 51.4, lng: 7.0
        });
        expect(customerExportRows([demo])[0].Datenstatus).toBe(DEMO_DATA_LABEL);
        expect(customerText(demo)).toContain(DEMO_DATA_LABEL);
        expect(tourText({ ...demo, label: demo.name }, [demo], null)).toContain(DEMO_DATA_LABEL);
    });
});

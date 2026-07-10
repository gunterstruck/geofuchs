import { describe, it, expect } from 'vitest';
import { encodeTourPayload, decodeTourPayload, matchStopsToCustomers, TOUR_QR_PREFIX, MAX_QR_STOPS } from '../src/features/tourShare.js';

const START = { lat: 51.4501234, lng: 7.0123456, label: 'Mein Standort' };
const STOPS = [
    { name: 'Autohaus Schmidt', lat: 51.5, lng: 7.1, strasse: 'Hauptstr. 1', plz: '45136', ort: 'Essen', telefon: '0201 123', nummer: 'K100' },
    { name: 'Bäckerei Ruhr', lat: 51.6, lng: 7.2, strasse: '', plz: '45127', ort: 'Essen', telefon: '', nummer: '' }
];

describe('QR-Payload encode/decode', () => {
    it('Roundtrip erhält alle planungsrelevanten Daten', () => {
        const text = encodeTourPayload({
            start: START, stops: STOPS, tourName: 'Dienstag Nord',
            date: '2026-07-15', startTime: '08:30', visitMinutes: 45, roundTrip: true
        });
        expect(text.startsWith(TOUR_QR_PREFIX)).toBe(true);

        const decoded = decodeTourPayload(text);
        expect(decoded.tourName).toBe('Dienstag Nord');
        expect(decoded.date).toBe('2026-07-15');
        expect(decoded.startTime).toBe('08:30');
        expect(decoded.visitMinutes).toBe(45);
        expect(decoded.roundTrip).toBe(true);
        expect(decoded.start.lat).toBeCloseTo(51.45012, 4);
        expect(decoded.stops).toHaveLength(2);
        expect(decoded.stops[0].name).toBe('Autohaus Schmidt');
        expect(decoded.stops[0].adresse).toContain('Hauptstr. 1');
        expect(decoded.stops[0].nummer).toBe('K100');
    });

    it('bleibt für eine volle Tagestour QR-tauglich (< 2,3 KB)', () => {
        const many = Array.from({ length: MAX_QR_STOPS }, (_, i) => ({
            name: `Kunde mit längerem Namen GmbH & Co. KG ${i}`, lat: 51 + i * 0.01, lng: 7 + i * 0.01,
            strasse: 'Musterstraße 123', plz: '45136', ort: 'Essen', telefon: '0201 1234567', nummer: `K10${i}`
        }));
        const text = encodeTourPayload({ start: START, stops: many, tourName: 'Volle Tour', date: '2026-07-15', startTime: '08:00', visitMinutes: 45 });
        expect(new TextEncoder().encode(text).length).toBeLessThan(2300);
    });

    it('lehnt fremde und kaputte Inhalte ab', () => {
        expect(decodeTourPayload('https://example.com')).toBeNull();
        expect(decodeTourPayload(`${TOUR_QR_PREFIX}kein-json`)).toBeNull();
        expect(decodeTourPayload(`${TOUR_QR_PREFIX}{"v":2}`)).toBeNull();
        expect(decodeTourPayload(null)).toBeNull();
    });

    it('null ohne Start oder ohne verortete Stopps', () => {
        expect(encodeTourPayload({ start: null, stops: STOPS })).toBeNull();
        expect(encodeTourPayload({ start: START, stops: [{ name: 'x', lat: null, lng: null }] })).toBeNull();
    });
});

describe('matchStopsToCustomers', () => {
    const customers = [
        { id: 'c1', nummer: 'K100', name: 'Autohaus Schmidt', plz: '45136', lat: 51.5, lng: 7.1 },
        { id: 'c2', nummer: '', name: 'Bäckerei Ruhr', plz: '45127', lat: 51.6, lng: 7.2 }
    ];

    it('matcht über Kundennummer und über Name+PLZ', () => {
        const stops = [
            { name: 'ANDERER NAME', nummer: 'K100', plz: '' },
            { name: 'bäckerei ruhr', nummer: '', plz: '45127' },
            { name: 'Unbekannt', nummer: '', plz: '99999' }
        ];
        const { matched, unmatched } = matchStopsToCustomers(stops, customers);
        expect(matched.map((m) => m.customer.id)).toEqual(['c1', 'c2']);
        expect(unmatched).toHaveLength(1);
    });
});

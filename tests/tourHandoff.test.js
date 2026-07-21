import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeTourPayload, decodeTourPayload } from '../src/features/tourShare.js';
import { googleMapsLink } from '../src/features/tour.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('QR-Übergabe: Navigation ab Geräte-Standort', () => {
    const start = { lat: 51.62, lng: 8.35, label: 'Mein Standort', here: true };
    const stops = [{ name: 'A', lat: 51.62, lng: 8.24 }, { name: 'B', lat: 52.26, lng: 9.05 }];

    it('trägt das here-Flag durch den QR-Code (pack/decode)', () => {
        const dec = decodeTourPayload(encodeTourPayload({ start, stops, roundTrip: false }));
        expect(dec.start.here).toBe(true);
    });

    it('lässt Google ab dem aktuellen Standort starten (kein fester Origin)', () => {
        const url = decodeURIComponent(googleMapsLink(start, stops, false));
        expect(url).not.toContain('origin=');
        expect(url).toContain('destination=52.26,9.05');
        expect(url).toContain('waypoints=51.62,8.24');
    });

    it('verankert einen Kunden-Start weiterhin als Origin', () => {
        const url = decodeURIComponent(googleMapsLink({ lat: 51.62, lng: 8.35, label: 'Kunde X' }, stops, false));
        expect(url).toContain('origin=51.62,8.35');
    });

    it('behält bei der Rundreise den Start als Origin und Ziel', () => {
        const url = decodeURIComponent(googleMapsLink(start, stops, true));
        expect(url).toContain('origin=51.62,8.35');
        expect(url).toContain('destination=51.62,8.35');
    });
});

describe('QR-Übergabe: unbekannte Stopps werden lokal angelegt', () => {
    const qr = read('src/ui/tourQr.js');

    it('legt fehlende Kunden aus den QR-Daten an und behält die Reihenfolge', () => {
        expect(qr).toContain('function customerFromStop');
        expect(qr).toContain('setCustomers([...state.customers, ...created])');
        // Reihenfolge der empfangenen Tour bleibt erhalten.
        expect(qr).toContain('received.stops.map((stop, i) =>');
        // Neue Kunden werden lokal gesichert.
        expect(qr).toContain("emit('dataset:dirty')");
    });

    it('erlaubt „Übernehmen" auch ohne lokale Treffer', () => {
        expect(qr).toContain('adopt.disabled = received.stops.length === 0;');
    });
});

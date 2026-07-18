import { describe, it, expect } from 'vitest';
import { groupExactGeocodeCandidates } from '../src/services/geocode.js';

describe('Exakt-Geocoding bündelt identische Adressen', () => {
    it('fragt jede eindeutige Adresse nur einmal an (mehrere Kunden je Adresse)', () => {
        const customers = [
            { id: 'a', name: 'A', strasse: 'Hauptstr 1', plz: '10115', ort: 'Berlin' },
            { id: 'b', name: 'B', strasse: 'Hauptstr 1', plz: '10115', ort: 'Berlin' },
            { id: 'c', name: 'C', strasse: 'Nebenstr 2', plz: '10115', ort: 'Berlin' },
            { id: 'd', name: 'D', strasse: '', plz: '10115', ort: 'Berlin' } // ohne Straße -> kein Kandidat
        ];
        const groups = groupExactGeocodeCandidates(customers);
        // 3 Kandidaten (a, b, c) fallen auf 2 eindeutige Adressen zusammen.
        expect(groups.length).toBe(2);
        const shared = groups.find((g) => g.customers.length === 2);
        expect(shared.customers.map((c) => c.id).sort()).toEqual(['a', 'b']);
        const total = groups.reduce((n, g) => n + g.customers.length, 0);
        expect(total).toBe(3);
    });

    it('behandelt Groß-/Kleinschreibung derselben Adresse als eine Anfrage', () => {
        const customers = [
            { id: 'a', strasse: 'Marktplatz 5', plz: '80331', ort: 'München' },
            { id: 'b', strasse: 'MARKTPLATZ 5', plz: '80331', ort: 'MÜNCHEN' }
        ];
        expect(groupExactGeocodeCandidates(customers).length).toBe(1);
    });
});

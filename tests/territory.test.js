import { describe, it, expect } from 'vitest';
import { aggregateByRegion, dominantRep, regionMembership } from '../src/features/territory.js';

// Minimales PLZ-GeoJSON (2-stellig), Geometrie wird für PLZ-Ebenen nicht benötigt
const plz2geo = {
    features: [
        { properties: { plz: '45' } },
        { properties: { plz: '46' } }
    ]
};

const customers = [
    { id: 'a', name: 'A', plz: '45136', vb: 'Meier', umsatz: 100 },
    { id: 'b', name: 'B', plz: '45127', vb: 'Meier', umsatz: 200 },
    { id: 'c', name: 'C', plz: '45888', vb: 'Kunz', umsatz: 300 },
    { id: 'd', name: 'D', plz: '46045', vb: 'Kunz', umsatz: 400 },
    { id: 'e', name: 'E', plz: '', vb: 'Kunz', umsatz: 500 },      // ohne PLZ -> keinem Gebiet zugeordnet
    { id: 'f', name: 'F', plz: '99999', vb: 'Kunz', umsatz: 600 }  // PLZ außerhalb der Ebene
];

describe('aggregateByRegion (PLZ-Ebene)', () => {
    it('ordnet Kunden über PLZ-Präfix zu', () => {
        const stats = aggregateByRegion('plz2', plz2geo, customers);
        const r45 = stats.get('plz-45');
        const r46 = stats.get('plz-46');
        expect(r45.total).toBe(3);
        expect(r46.total).toBe(1);
        expect(r45.customers.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('zählt je Vertriebsbeauftragtem und findet den dominanten', () => {
        const stats = aggregateByRegion('plz2', plz2geo, customers);
        const r45 = stats.get('plz-45');
        expect(r45.byRep.get('Meier')).toBe(2);
        expect(r45.byRep.get('Kunz')).toBe(1);
        expect(dominantRep(r45)).toBe('Meier');
    });

    it('ignoriert Kunden ohne oder mit unbekannter PLZ', () => {
        const stats = aggregateByRegion('plz2', plz2geo, customers);
        const assigned = [...stats.values()].reduce((n, e) => n + e.total, 0);
        expect(assigned).toBe(4); // e und f fehlen bewusst
    });
});

describe('regionMembership', () => {
    it('liefert nur Gebiete mit Kunden, sortiert nach Kundenzahl', () => {
        const rows = regionMembership('plz2', plz2geo, customers);
        expect(rows.map((r) => r.key)).toEqual(['plz-45', 'plz-46']);
        expect(rows[0].customerIds).toHaveLength(3);
    });
});

import { describe, it, expect } from 'vitest';
import { revenueWeightedCentroids } from '../src/features/labelPlacement.js';

describe('revenueWeightedCentroids', () => {
    it('einzelnes Polygon: Label sitzt in dessen Mitte', () => {
        const pos = revenueWeightedCentroids(new Map([
            ['Nord', [{ lat: 53.5, lng: 10.0, count: 5, revenue: 100000 }]]
        ]));
        expect(pos.get('Nord')).toEqual([53.5, 10.0]);
    });

    it('umsatzstarkes Kerngebiet zieht das Label an, Enklave verschiebt kaum', () => {
        // Kern: viel Umsatz bei (51,7). Enklave: winziger Umsatz weit weg bei (53.5,10) (Hamburg).
        const pos = revenueWeightedCentroids(new Map([
            ['West', [
                { lat: 51.0, lng: 7.0, count: 40, revenue: 1_000_000 },
                { lat: 53.5, lng: 10.0, count: 1, revenue: 5_000 }
            ]]
        ]));
        const [lat, lng] = pos.get('West');
        // Schwerpunkt liegt praktisch im Kern, nicht auf halbem Weg nach Hamburg
        expect(lat).toBeCloseTo(51.012, 2);
        expect(lng).toBeCloseTo(7.015, 2);
    });

    it('zwei Werte mit gleichem stärkstem Polygon erhalten unterschiedliche Positionen', () => {
        // Beide haben ihr umsatzstärkstes Polygon in Hamburg (53.5,10),
        // aber unterschiedliche Zweitgebiete -> Labels dürfen nicht koinzidieren.
        const pos = revenueWeightedCentroids(new Map([
            ['A', [
                { lat: 53.5, lng: 10.0, count: 10, revenue: 500000 },
                { lat: 54.5, lng: 9.0, count: 3, revenue: 200000 }
            ]],
            ['B', [
                { lat: 53.5, lng: 10.0, count: 10, revenue: 500000 },
                { lat: 52.5, lng: 11.0, count: 3, revenue: 200000 }
            ]]
        ]));
        expect(pos.get('A')).not.toEqual(pos.get('B'));
        expect(pos.get('A')[0]).toBeGreaterThan(pos.get('B')[0]); // A zieht nach Norden, B nach Süden
    });

    it('ohne Umsatz wird nach Kundenzahl gewichtet', () => {
        const pos = revenueWeightedCentroids(new Map([
            ['Ohne', [
                { lat: 50.0, lng: 8.0, count: 9, revenue: 0 },
                { lat: 52.0, lng: 8.0, count: 1, revenue: 0 }
            ]]
        ]));
        const [lat] = pos.get('Ohne');
        expect(lat).toBeCloseTo(50.2, 5); // (50*9 + 52*1)/10
    });

    it('kundenlose Gebietszuordnung: Rückfall auf das Polygon', () => {
        const pos = revenueWeightedCentroids(new Map([
            ['Leer', [{ lat: 49.0, lng: 9.0, count: 0, revenue: 0 }]]
        ]));
        expect(pos.get('Leer')).toEqual([49.0, 9.0]);
    });

    it('ignoriert Polygone ohne gültige Koordinaten', () => {
        const pos = revenueWeightedCentroids(new Map([
            ['X', [
                { lat: NaN, lng: 10, count: 5, revenue: 100 },
                { lat: 51.0, lng: 7.0, count: 5, revenue: 100 }
            ]]
        ]));
        expect(pos.get('X')).toEqual([51.0, 7.0]);
    });

    it('negativer/kaputter Umsatz zählt als 0, fällt auf Kundenzahl zurück', () => {
        const pos = revenueWeightedCentroids(new Map([
            ['Y', [
                { lat: 50.0, lng: 8.0, count: 2, revenue: -5 },
                { lat: 52.0, lng: 8.0, count: 2, revenue: NaN }
            ]]
        ]));
        expect(pos.get('Y')[0]).toBeCloseTo(51.0, 5); // reiner Kundenschwerpunkt
    });
});

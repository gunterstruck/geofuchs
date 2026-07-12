/**
 * Platzierung der Flächen-Labels (Vertriebsbezirk/-gruppe) auf der Karte.
 *
 * Problem der alten Logik: Als Ankerpunkt diente das eine Polygon mit den
 * meisten Kunden eines Werts. Hatten zwei Werte ihr stärkstes Polygon im
 * exakt selben Gebiet (z. B. dieselbe PLZ in Hamburg), landeten beide Labels
 * auf identischen Koordinaten und verdeckten sich.
 *
 * Lösung: ein umsatzgewichteter geografischer Schwerpunkt über ALLE Polygone,
 * die zu einem Wert gehören. Umsatzstarke Kerngebiete ziehen das Label an,
 * unbedeutende Enklaven (wenig Umsatz, weit entfernt) verschieben es kaum.
 * Ohne jeglichen Umsatz wird nach Kundenzahl gewichtet; hat ein Wert nur
 * kundenlose Gebietszuordnungen, dient deren erstes Polygon als Rückfall.
 */

/**
 * @param {Map<string, Array<{lat:number, lng:number, count:number, revenue:number}>>} polygonsByValue
 *   Je Attributwert die Liste seiner Polygone mit Mittelpunkt, Kundenzahl und Umsatz.
 * @returns {Map<string, [number, number]>} Wert -> [lat, lng] des Labels
 */
export function revenueWeightedCentroids(polygonsByValue) {
    const out = new Map();
    for (const [value, polygons] of polygonsByValue) {
        let latR = 0, lngR = 0, weightR = 0;   // umsatzgewichtet
        let latC = 0, lngC = 0, weightC = 0;    // kundengewichtet (Rückfall)
        let fallback = null;                     // erstes gültiges Polygon

        for (const p of polygons) {
            if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) continue;
            const revenue = Number.isFinite(p.revenue) && p.revenue > 0 ? p.revenue : 0;
            const count = Number.isFinite(p.count) && p.count > 0 ? p.count : 0;
            latR += p.lat * revenue; lngR += p.lng * revenue; weightR += revenue;
            latC += p.lat * count;   lngC += p.lng * count;   weightC += count;
            if (!fallback) fallback = [p.lat, p.lng];
        }

        if (weightR > 0) out.set(value, [latR / weightR, lngR / weightR]);
        else if (weightC > 0) out.set(value, [latC / weightC, lngC / weightC]);
        else if (fallback) out.set(value, fallback);
    }
    return out;
}

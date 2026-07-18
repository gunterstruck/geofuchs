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

/** Progressive Informationsdichte für Organisationskarten. */
export function territoryLabelMode(zoom, { mobile = false } = {}) {
    const value = Number(zoom) || 0;
    if (value < (mobile ? 8 : 7)) return 'chip';
    if (value < (mobile ? 10 : 9)) return 'compact';
    return 'detail';
}

/** Bewusstes Kartenbudget: auf kleinen/entfernten Ansichten weniger Objekte. */
export function territoryLabelBudget(mode, { mobile = false } = {}) {
    const budgets = mobile
        ? { chip: 18, compact: 12, detail: 8 }
        : { chip: 36, compact: 24, detail: 14 };
    return budgets[mode] || budgets.detail;
}

/** Entfernt redundante Organisationspräfixe in kleinen Kartenstufen. */
export function compactTerritoryLabel(value) {
    const label = String(value ?? '').trim();
    return label.replace(/^(?:vertriebshauptgruppe|vertriebsgruppe|vertriebsbezirk|channel|gruppe|bezirk)\s+/i, '') || label;
}

function overlaps(a, b, gap) {
    return a.left < b.right + gap
        && a.right + gap > b.left
        && a.top < b.bottom + gap
        && a.bottom + gap > b.top;
}

/**
 * Wählt nach fachlicher Priorität eine kollisionsfreie Teilmenge von Labels.
 * Koordinaten und Abmessungen sind Bildschirm-Pixel, damit die Entscheidung
 * unabhängig von Landkreis-/PLZ-Geometrien stabil bleibt.
 */
export function selectNonOverlappingLabels(candidates, {
    viewportWidth,
    viewportHeight,
    maxItems = Infinity,
    gap = 8,
    margin = 6
} = {}) {
    const width = Number(viewportWidth) || 0;
    const height = Number(viewportHeight) || 0;
    if (!Array.isArray(candidates) || width <= 0 || height <= 0 || maxItems <= 0) return [];

    const placed = [];
    const rects = [];
    const sorted = [...candidates].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
    for (const candidate of sorted) {
        const itemWidth = Math.max(1, Number(candidate.width) || 1);
        const itemHeight = Math.max(1, Number(candidate.height) || 1);
        const rect = {
            left: Number(candidate.x) - itemWidth / 2,
            right: Number(candidate.x) + itemWidth / 2,
            top: Number(candidate.y) - itemHeight / 2,
            bottom: Number(candidate.y) + itemHeight / 2
        };
        if (rect.right < margin || rect.left > width - margin || rect.bottom < margin || rect.top > height - margin) continue;
        if (rects.some((other) => overlaps(rect, other, gap))) continue;
        placed.push(candidate);
        rects.push(rect);
        if (placed.length >= maxItems) break;
    }
    return placed;
}

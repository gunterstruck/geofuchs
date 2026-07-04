/**
 * Gebiets-Aggregation
 * Ordnet Kunden den Gebieten der aktiven Ebene zu und berechnet je Gebiet
 * die Verteilung auf Vertriebsbeauftragte (für Einfärbung & Popups).
 *
 * PLZ-Ebenen: Zuordnung über PLZ-Präfix (schnell, exakt zur Kunden-PLZ).
 * Landkreise: Punkt-in-Polygon über die Kundenkoordinaten.
 */

import { UNASSIGNED } from '../core/state.js';
import { pointInFeature, regionKey, regionName } from '../services/geodata.js';

/**
 * @param {string} level  aktive Ebene ('kreise' | 'plz1' | ...)
 * @param {object} geojson  Gebiets-GeoJSON der Ebene
 * @param {Array} customers  sichtbare Kunden
 * @returns {Map<regionKey, { total, byRep: Map<vb, count>, customers: [] }>}
 */
export function aggregateByRegion(level, geojson, customers) {
    const stats = new Map();
    const ensure = (key) => {
        if (!stats.has(key)) stats.set(key, { total: 0, byRep: new Map(), customers: [] });
        return stats.get(key);
    };

    if (level.startsWith('plz')) {
        const len = parseInt(level.slice(3), 10);
        const byPrefix = new Map();
        for (const feature of geojson.features) {
            byPrefix.set(String(feature.properties.plz), regionKey(level, feature));
        }
        for (const c of customers) {
            if (!c.plz) continue;
            const key = byPrefix.get(c.plz.slice(0, len));
            if (!key) continue;
            addCustomer(ensure(key), c);
        }
    } else if (level === 'kreise') {
        for (const c of customers) {
            if (c.lat === null || c.lng === null) continue;
            for (const feature of geojson.features) {
                if (pointInFeature(c.lng, c.lat, feature)) {
                    addCustomer(ensure(regionKey(level, feature)), c);
                    break;
                }
            }
        }
    }
    return stats;
}

function addCustomer(entry, customer) {
    entry.total++;
    entry.customers.push(customer);
    const vb = customer.vb || UNASSIGNED;
    entry.byRep.set(vb, (entry.byRep.get(vb) ?? 0) + 1);
}

/** Dominanter Vertriebsbeauftragter eines Gebiets (meiste Kunden) */
export function dominantRep(entry) {
    let best = null;
    let bestCount = 0;
    for (const [vb, count] of entry.byRep) {
        if (count > bestCount) { best = vb; bestCount = count; }
    }
    return best;
}

/**
 * Zuordnung Gebiet -> Kunden-IDs (für das Gebiets-Cockpit / What-if).
 * Nur Gebiete mit mindestens einem Kunden werden zurückgegeben.
 * @returns {Array<{ key, name, customerIds: string[] }>} nach Kundenzahl sortiert
 */
export function regionMembership(level, geojson, customers) {
    const stats = aggregateByRegion(level, geojson, customers);
    const nameByKey = new Map();
    for (const feature of geojson.features) {
        nameByKey.set(regionKey(level, feature), regionName(level, feature));
    }
    return [...stats.entries()]
        .map(([key, entry]) => ({
            key,
            name: nameByKey.get(key) ?? key,
            customerIds: entry.customers.map((c) => c.id)
        }))
        .sort((a, b) => b.customerIds.length - a.customerIds.length);
}

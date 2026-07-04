/**
 * Besuchsplaner
 * - Umkreis-Vorschläge: welche Kunden liegen nahe am Startpunkt / an der Tour?
 * - Routenoptimierung: Nearest-Neighbor-Heuristik + 2-Opt-Verbesserung
 *   auf Luftlinien-Basis (für Tagesplanung völlig ausreichend).
 * - Export als Google-Maps-Navigationslink.
 */

import { CONFIG } from '../core/config.js';
import { distanceKm } from '../services/geocode.js';
import { statusRank } from './visits.js';

/**
 * Kunden im Umkreis eines Punkts.
 * @param {{lat,lng}} origin
 * @param {Array} customers  Kandidaten (bereits gefiltert)
 * @param {number} radiusKm
 * @param {Set<string>} excludeIds  z. B. bereits eingeplante Stopps
 * @param {boolean} overdueFirst  überfällige/fällige Kunden bevorzugt sortieren
 */
export function suggestNearby(origin, customers, radiusKm, excludeIds = new Set(), overdueFirst = false) {
    return customers
        .filter((c) => c.lat !== null && !excludeIds.has(c.id))
        .map((c) => ({ customer: c, km: distanceKm(origin, c) }))
        .filter((entry) => entry.km <= radiusKm)
        .sort((a, b) => {
            if (overdueFirst) {
                const r = statusRank(a.customer) - statusRank(b.customer);
                if (r !== 0) return r;
            }
            return a.km - b.km;
        })
        .slice(0, CONFIG.tour.maxSuggestions);
}

/**
 * Reihenfolge der Stopps optimieren (Start fix, Ende offen).
 * @param {{lat,lng}} start
 * @param {Array} stops  Kunden mit Koordinaten
 * @returns {Array} Stopps in optimierter Reihenfolge
 */
export function optimizeOrder(start, stops) {
    if (stops.length <= 1) return [...stops];

    // 1) Nearest Neighbor
    const remaining = [...stops];
    const route = [];
    let current = start;
    while (remaining.length > 0) {
        let bestIndex = 0;
        let bestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = distanceKm(current, remaining[i]);
            if (d < bestDist) { bestDist = d; bestIndex = i; }
        }
        current = remaining.splice(bestIndex, 1)[0];
        route.push(current);
    }

    // 2) 2-Opt-Verbesserung (offene Route: Start fix, kein Rückweg)
    const points = [start, ...route];
    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 1; i < points.length - 1; i++) {
            for (let k = i + 1; k < points.length; k++) {
                const before = distanceKm(points[i - 1], points[i]) +
                    (k + 1 < points.length ? distanceKm(points[k], points[k + 1]) : 0);
                const after = distanceKm(points[i - 1], points[k]) +
                    (k + 1 < points.length ? distanceKm(points[i], points[k + 1]) : 0);
                if (after < before - 1e-9) {
                    // Segment i..k umdrehen
                    let a = i, b = k;
                    while (a < b) { [points[a], points[b]] = [points[b], points[a]]; a++; b--; }
                    improved = true;
                }
            }
        }
    }
    return points.slice(1);
}

/** Gesamtdistanz einer Route (Luftlinie + Straßenfaktor als Schätzung) */
export function routeDistance(start, stops) {
    let air = 0;
    let current = start;
    for (const stop of stops) {
        air += distanceKm(current, stop);
        current = stop;
    }
    return { airKm: air, roadKmEstimate: air * CONFIG.tour.roadFactor };
}

function pointParam(p) {
    // Adresse ist für Google Maps robuster als rohe Koordinaten
    if (p.strasse && p.ort) return `${p.strasse}, ${p.plz ?? ''} ${p.ort}`.trim();
    return `${p.lat},${p.lng}`;
}

/**
 * Google-Maps-Directions-Link (max. 9 Zwischenziele).
 * Letzter Stopp = Ziel, alle davor = Waypoints.
 */
export function googleMapsLink(start, stops) {
    if (stops.length === 0) return null;
    const limited = stops.slice(0, CONFIG.tour.maxWaypoints + 1);
    const destination = limited[limited.length - 1];
    const waypoints = limited.slice(0, -1);

    const params = new URLSearchParams({
        api: '1',
        origin: pointParam(start),
        destination: pointParam(destination),
        travelmode: 'driving'
    });
    if (waypoints.length > 0) {
        params.set('waypoints', waypoints.map(pointParam).join('|'));
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
}

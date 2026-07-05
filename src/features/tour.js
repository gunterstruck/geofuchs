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

// ---- Korridor entlang der Route ----

/** lokale Planar-Projektion (km) relativ zu einem Referenzpunkt */
function projKm(o, ref) {
    const R = 6371, rad = Math.PI / 180;
    return [(o.lng - ref.lng) * Math.cos(ref.lat * rad) * rad * R, (o.lat - ref.lat) * rad * R];
}
/** Abstand Punkt→Segment in km (Luftlinie) */
function distToSegmentKm(p, a, b) {
    const A = projKm(a, p), B = projKm(b, p); // P = Ursprung [0,0]
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? -(A[0] * dx + A[1] * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(A[0] + t * dx, A[1] + t * dy);
}
/** kürzester Abstand eines Punkts zur gesamten Route (Polylinie) */
export function distanceToRouteKm(p, path) {
    let min = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
        const d = distToSegmentKm(p, path[i], path[i + 1]);
        if (d < min) min = d;
    }
    return min;
}

/**
 * Vorschläge entlang der geplanten Route: Kunden, die höchstens `corridorKm`
 * neben der Strecke Start → Stopps (→ Start bei Rundreise) liegen.
 */
export function suggestAlongRoute(start, stops, customers, corridorKm, excludeIds = new Set(), roundTrip = false, overdueFirst = false) {
    const path = [start, ...stops];
    if (roundTrip && stops.length) path.push(start);
    if (path.length < 2) return [];
    return customers
        .filter((c) => c.lat !== null && !excludeIds.has(c.id))
        .map((c) => ({ customer: c, km: distanceToRouteKm(c, path) }))
        .filter((entry) => entry.km <= corridorKm)
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
 * Reihenfolge der Stopps optimieren (Start fix).
 * @param {{lat,lng}} start
 * @param {Array} stops  Kunden mit Koordinaten
 * @param {boolean} roundTrip  bei Rundreise wird der Rückweg zum Start mitbewertet
 * @returns {Array} Stopps in optimierter Reihenfolge
 */
export function optimizeOrder(start, stops, roundTrip = false) {
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

    // 2) 2-Opt-Verbesserung (Start fix; bei Rundreise schließt sich die Route zum Start)
    const points = [start, ...route];
    const closingEdge = (idx) => roundTrip ? distanceKm(points[idx], start) : 0;
    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 1; i < points.length - 1; i++) {
            for (let k = i + 1; k < points.length; k++) {
                const nextExists = k + 1 < points.length;
                const before = distanceKm(points[i - 1], points[i]) +
                    (nextExists ? distanceKm(points[k], points[k + 1]) : closingEdge(k));
                const after = distanceKm(points[i - 1], points[k]) +
                    (nextExists ? distanceKm(points[i], points[k + 1]) : closingEdge(i));
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
export function routeDistance(start, stops, roundTrip = false) {
    let air = 0;
    let current = start;
    for (const stop of stops) {
        air += distanceKm(current, stop);
        current = stop;
    }
    if (roundTrip && stops.length) air += distanceKm(current, start);
    return { airKm: air, roadKmEstimate: air * CONFIG.tour.roadFactor };
}

function pointParam(p) {
    // Adresse ist für Google Maps robuster als rohe Koordinaten
    if (p.strasse && p.ort) return `${p.strasse}, ${p.plz ?? ''} ${p.ort}`.trim();
    return `${p.lat},${p.lng}`;
}

/**
 * Google-Maps-Directions-Link (max. 9 Zwischenziele).
 * - Einfache Tour: letzter Stopp = Ziel, alle davor = Waypoints.
 * - Rundreise: Ziel = Start, alle Stopps = Waypoints (Google zeigt den Rückweg).
 */
export function googleMapsLink(start, stops, roundTrip = false) {
    if (stops.length === 0) return null;

    let destination;
    let waypoints;
    if (roundTrip) {
        destination = start;
        waypoints = stops.slice(0, CONFIG.tour.maxWaypoints);
    } else {
        const limited = stops.slice(0, CONFIG.tour.maxWaypoints + 1);
        destination = limited[limited.length - 1];
        waypoints = limited.slice(0, -1);
    }

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

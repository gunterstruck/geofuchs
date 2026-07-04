/**
 * Geodata-Service
 * Lädt die gebündelten Gebietsdaten (Landkreise, PLZ-Ebenen) und hält sie
 * im Speicher. Die Dateien liegen als statische Assets unter /geodata und
 * werden vom Service Worker für die Offline-Nutzung gecacht.
 */

import { CONFIG } from '../core/config.js';

const cache = new Map();

/**
 * GeoJSON einer Gebietsebene laden ('kreise' | 'plz1' | 'plz2' | 'plz3' | 'plz5')
 */
export async function loadLevel(level) {
    if (cache.has(level)) return cache.get(level);
    const def = CONFIG.levels[level];
    if (!def?.file) return null;

    const response = await fetch(def.file);
    if (!response.ok) {
        throw new Error(`Gebietsdaten "${def.label}" konnten nicht geladen werden (HTTP ${response.status}).`);
    }
    const geojson = await response.json();

    // Bounding-Box je Feature vorberechnen (für schnelles Point-in-Polygon)
    for (const feature of geojson.features) {
        feature._bbox = computeBbox(feature.geometry);
    }
    cache.set(level, geojson);
    return geojson;
}

function computeBbox(geometry) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const scan = (coords) => {
        if (typeof coords[0] === 'number') {
            if (coords[0] < minX) minX = coords[0];
            if (coords[0] > maxX) maxX = coords[0];
            if (coords[1] < minY) minY = coords[1];
            if (coords[1] > maxY) maxY = coords[1];
        } else {
            coords.forEach(scan);
        }
    };
    scan(geometry.coordinates);
    return [minX, minY, maxX, maxY];
}

/** Punkt-in-Polygon (Ray Casting), unterstützt Polygon & MultiPolygon */
export function pointInFeature(lng, lat, feature) {
    const [minX, minY, maxX, maxY] = feature._bbox;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) return false;

    const polygons = feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;

    for (const polygon of polygons) {
        let inside = false;
        for (const ring of polygon) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [xi, yi] = ring[i];
                const [xj, yj] = ring[j];
                if (((yi > lat) !== (yj > lat)) &&
                    (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }
        }
        if (inside) return true;
    }
    return false;
}

/** Anzeigename eines Gebiets-Features */
export function regionName(level, feature) {
    const p = feature.properties;
    if (level === 'kreise') return `${p.gen}${p.bez ? ` (${p.bez})` : ''}`;
    return `PLZ ${p.plz}`;
}

/** Eindeutiger Schlüssel eines Gebiets-Features */
export function regionKey(level, feature) {
    const p = feature.properties;
    return level === 'kreise' ? `krs-${p.ars}` : `plz-${p.plz}`;
}

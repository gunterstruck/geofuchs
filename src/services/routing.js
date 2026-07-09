/**
 * Street-routing helpers.
 * Uses OSRM's HTTP API with OpenStreetMap data and falls back gracefully in UI.
 */

import { CONFIG } from '../core/config.js';

const routeCache = new Map();
const pendingRoutes = new Map();

function routePoint(point) {
    return {
        lat: Number(point.lat ?? point[0]),
        lng: Number(point.lng ?? point[1])
    };
}

function pointKey(point) {
    const p = routePoint(point);
    return `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
}

export function routingKey(points) {
    return points.map(pointKey).join(';');
}

export function peekRoadRoute(points) {
    return routeCache.get(routingKey(points));
}

export async function getRoadRoute(points) {
    const key = routingKey(points);
    if (routeCache.has(key)) return routeCache.get(key);
    if (pendingRoutes.has(key)) return pendingRoutes.get(key);

    const pending = fetchRoadRoute(points).then((route) => {
        routeCache.set(key, route);
        pendingRoutes.delete(key);
        return route;
    });
    pendingRoutes.set(key, pending);
    return pending;
}

export async function fetchRoadRoute(points) {
    const clean = points.map(routePoint).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (clean.length < 2 || clean.length > CONFIG.routing.maxPoints) return null;

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), CONFIG.routing.timeoutMs);
    try {
        const coords = clean.map((p) => `${p.lng},${p.lat}`).join(';');
        const params = new URLSearchParams({
            overview: 'full',
            geometries: 'geojson',
            steps: 'false',
            alternatives: 'false'
        });
        const response = await fetch(`${CONFIG.routing.url}/${coords}?${params.toString()}`, {
            signal: controller.signal
        });
        if (!response.ok) return null;
        const data = await response.json();
        const route = data?.code === 'Ok' ? data.routes?.[0] : null;
        const coordinates = route?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
        return {
            provider: CONFIG.routing.provider,
            latLngs: coordinates.map(([lng, lat]) => [lat, lng]),
            distanceKm: route.distance / 1000,
            durationMin: route.duration / 60
        };
    } catch {
        return null;
    } finally {
        globalThis.clearTimeout(timeout);
    }
}

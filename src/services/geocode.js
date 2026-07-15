/**
 * Geocoding-Service – ohne Schlüssel oder Benutzerkonto.
 *
 * Stufe 1 (sofort, offline): PLZ-Zentroide aus gebündeltem Lookup
 *   (~8.300 deutsche Postleitzahlen). Genauigkeit: Ortsmitte.
 * Stufe 2 (optional, online): exakte Adress-Geocodierung über
 *   Nominatim/OpenStreetMap – gedrosselt auf 1 Anfrage/Sekunde,
 *   Ergebnisse werden dauerhaft im Browser gecacht.
 */

import { CONFIG } from '../core/config.js';
import { isDemoCustomer } from '../core/demoSafety.js';
import { loadGeocodeCache, saveGeocodeCache } from './storage.js';

let plzCentroids = null;
let plzPlaces = null;

export async function loadPlzCentroids() {
    if (plzCentroids) return plzCentroids;
    const response = await fetch(CONFIG.plzCentroidsUrl);
    if (!response.ok) throw new Error('PLZ-Koordinaten konnten nicht geladen werden.');
    plzCentroids = await response.json();
    return plzCentroids;
}

export async function loadPlzPlaces() {
    if (plzPlaces) return plzPlaces;
    const response = await fetch(CONFIG.plzPlacesUrl);
    if (!response.ok) throw new Error('PLZ-Ortsnamen konnten nicht geladen werden.');
    const data = await response.json();
    plzPlaces = data.places || data;
    return plzPlaces;
}

export async function enrichPlacesByPlz(customers) {
    const places = await loadPlzPlaces();
    let updated = 0;
    for (const customer of customers) {
        if (String(customer.ort ?? '').trim()) continue;
        const place = places[String(customer.plz ?? '').trim()];
        if (!place) continue;
        customer.ort = place;
        updated++;
    }
    return updated;
}

/**
 * Deterministischer "Jitter", damit mehrere Kunden mit derselben PLZ
 * nicht exakt übereinander liegen (~ +/- 500 m um den PLZ-Mittelpunkt).
 */
function jitterFor(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    const a = ((hash & 0xffff) / 0xffff - 0.5) * 0.009;
    const b = (((hash >> 16) & 0xffff) / 0xffff - 0.5) * 0.013;
    return [a, b];
}

/**
 * Kunden über PLZ verorten (mutiert die Objekte).
 * Bereits exakt georeferenzierte Kunden bleiben unangetastet.
 * @returns {{ located: number, missing: string[] }} fehlende PLZ
 */
export async function geocodeByPlz(customers) {
    const centroids = await loadPlzCentroids();
    let located = 0;
    const missing = new Set();

    for (const c of customers) {
        // Auch ältere Demo-Datensätze mit vermeintlich exakter Position werden
        // auf die lokal gebündelte PLZ-Position zurückgeführt.
        if (c.geo === 'exakt' && !isDemoCustomer(c)) continue;
        const hit = c.plz ? centroids[c.plz] : null;
        if (hit) {
            const [dLat, dLng] = jitterFor(c.id + c.name);
            c.lat = hit[0] + dLat;
            c.lng = hit[1] + dLng;
            c.geo = 'plz';
            located++;
        } else {
            c.lat = null;
            c.lng = null;
            c.geo = 'none';
            if (c.plz) missing.add(c.plz);
        }
    }
    return { located, missing: [...missing] };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function addressKey(c) {
    return `${c.strasse}|${c.plz}|${c.ort}`.toLowerCase();
}

function nominatimAddressParams(c) {
    return Object.fromEntries(Object.entries({
        street: String(c.strasse || '').trim(),
        postalcode: String(c.plz || '').trim(),
        city: String(c.ort || '').trim()
    }).filter(([, value]) => value));
}

/**
 * Exakte Adress-Geocodierung über Nominatim (OpenStreetMap).
 * Datenschutz-Audit: An Nominatim gehen ausschließlich neutrale Adressdaten
 * (Straße, PLZ, Ort) plus technische Suchparameter. Namen, Kundennummern,
 * Umsätze, Vertriebsgebiete oder sonstige Kundendaten werden nie übertragen.
 * Läuft sequenziell mit Drosselung; onProgress(done, total) für die UI.
 * Über das zurückgegebene Handle abbrechbar: handle.cancel()
 */
export function exactGeocodeCandidates(customers) {
    return (customers || []).filter((c) => !isDemoCustomer(c) && c.geo !== 'exakt' && c.strasse && (c.plz || c.ort));
}

export function geocodeExact(customers, onProgress) {
    const queue = exactGeocodeCandidates(customers);
    let cancelled = false;
    const handle = { cancel: () => { cancelled = true; }, total: queue.length };

    handle.run = (async () => {
        if (queue.length === 0) return { updated: 0, failed: 0, cancelled: false };
        const cache = await loadGeocodeCache();
        let updated = 0;
        let failed = 0;
        let requestsMade = 0;

        for (let i = 0; i < queue.length; i++) {
            if (cancelled) break;
            const c = queue[i];
            const key = addressKey(c);

            let result = cache[key];
            if (result === undefined) {
                if (requestsMade > 0) await sleep(CONFIG.nominatim.delayMs);
                requestsMade++;
                try {
                    const addressParams = nominatimAddressParams(c);
                    const params = new URLSearchParams({
                        format: 'jsonv2',
                        countrycodes: 'de',
                        limit: '1',
                        ...addressParams
                    });
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), CONFIG.nominatim.timeout);
                    const response = await fetch(`${CONFIG.nominatim.url}?${params}`, {
                        signal: controller.signal,
                        headers: { 'Accept-Language': 'de' }
                    });
                    clearTimeout(timer);
                    const json = response.ok ? await response.json() : [];
                    result = json[0] ? { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) } : null;
                    cache[key] = result;
                    if (i % 10 === 0) await saveGeocodeCache(cache);
                } catch {
                    result = undefined; // Netzfehler: nicht als "nicht gefunden" cachen
                }
            }

            if (result) {
                c.lat = result.lat;
                c.lng = result.lng;
                c.geo = 'exakt';
                updated++;
            } else {
                failed++;
            }
            onProgress?.(i + 1, queue.length);
        }

        await saveGeocodeCache(cache);
        return { updated, failed, cancelled };
    })();

    return handle;
}

/** Haversine-Distanz in Kilometern */
export function distanceKm(a, b) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

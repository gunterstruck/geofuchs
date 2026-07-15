/**
 * QR-Tour-Übergabe Desktop → Handy.
 * Es wird NIE die Kundendatenbank übertragen – nur die geplante Tour mit den
 * Daten, die unterwegs gebraucht werden (Name, Koordinaten, Adresse, Telefon,
 * Kundennummer zum Wiederfinden). Der Transportweg ist Bildschirm → Kamera,
 * ohne Netzwerk, Datei oder Server.
 */

import { DEMO_DATA_ORIGIN, isDemoCustomer } from '../core/demoSafety.js';

export const TOUR_QR_PREFIX = 'TF1:';
export const TOUR_HASH_KEY = 't';   // Fragment-Schlüssel: host/…#t=<base64url>
export const MAX_QR_STOPS = 12;

const round5 = (n) => Math.round(Number(n) * 1e5) / 1e5;

// UTF-8-sicheres base64url (Umlaute in Namen/Adressen) – ohne externe Abhängigkeit.
function toBase64Url(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(b64) {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

// Achtung: Number(null) wäre 0 – Strings konvertieren, alles andere direkt prüfen
const isCoord = (v) => Number.isFinite(typeof v === 'string' && v !== '' ? Number(v) : v);
const hasCoords = (p) => Boolean(p) && isCoord(p.lat) && isCoord(p.lng);

function packPoint(point) {
    if (!hasCoords(point)) return null;
    const packed = { lat: round5(point.lat), lng: round5(point.lng), l: point.label || point.name || '' };
    if (isDemoCustomer(point)) packed.d = 1;
    return packed;
}

function packStop(customer) {
    const stop = {
        n: customer.name || '',
        lat: round5(customer.lat),
        lng: round5(customer.lng)
    };
    const addr = [customer.strasse, `${customer.plz ?? ''} ${customer.ort ?? ''}`.trim()]
        .filter(Boolean).join(', ');
    if (addr) stop.a = addr;
    if (customer.telefon) stop.t = customer.telefon;
    if (customer.nummer) stop.k = customer.nummer;
    if (customer.plz) stop.p = customer.plz;
    if (isDemoCustomer(customer)) stop.d = 1;
    return stop;
}

/**
 * @returns {string|null} QR-Text oder null, wenn keine übertragbare Tour vorliegt
 */
export function encodeTourPayload({ start, stops, tourName, date, startTime, visitMinutes, roundTrip }) {
    const s = packPoint(start);
    const list = (stops || [])
        .filter(hasCoords)
        .slice(0, MAX_QR_STOPS)
        .map(packStop);
    if (!s || list.length === 0) return null;
    const payload = { v: 1, s, x: list };
    if (tourName) payload.tn = tourName;
    if (date) payload.d = date;
    if (startTime) payload.st = startTime;
    if (visitMinutes) payload.vm = Number(visitMinutes);
    if (roundTrip) payload.r = 1;
    return TOUR_QR_PREFIX + JSON.stringify(payload);
}

/**
 * Baut die App-URL, die als QR-Code angezeigt wird. Die native Handy-Kamera
 * erkennt sie als Link und öffnet die installierte PWA (Scope „/") bzw. den
 * Browser – ohne dass die App vorher manuell geöffnet werden muss. Die Tour
 * steckt im Hash-Fragment (#t=…): Fragmente werden nie an einen Server
 * gesendet, die Daten bleiben also auf dem Gerät.
 * @param {string} encoded  Ergebnis von encodeTourPayload (TF1:…)
 * @param {string} baseUrl  z. B. location.origin + location.pathname
 */
export function encodeTourUrl(encoded, baseUrl) {
    if (!encoded) return null;
    const base = String(baseUrl || '').replace(/[#?].*$/, '').replace(/\/$/, '');
    return `${base}/#${TOUR_HASH_KEY}=${toBase64Url(encoded)}`;
}

/** Tour-Fragment aus einer (Hash-)URL herauslösen, sonst null. */
export function extractTourFromUrl(text) {
    const hash = String(text || '');
    const m = hash.match(new RegExp(`[#&]${TOUR_HASH_KEY}=([A-Za-z0-9\\-_]+)`));
    if (!m) return null;
    try {
        return fromBase64Url(m[1]);
    } catch {
        return null;
    }
}

/**
 * Nimmt QR-Rohtext (App-URL, „TF1:…" oder pures JSON) und liefert die Tour.
 * @returns {{ start, stops, tourName, date, startTime, visitMinutes, roundTrip }|null}
 */
export function decodeTourPayload(text) {
    if (typeof text !== 'string' || !text) return null;
    // 1) App-URL mit Tour im Hash-Fragment
    let raw = text;
    if (text.includes(`#${TOUR_HASH_KEY}=`) || text.includes(`&${TOUR_HASH_KEY}=`)) {
        raw = extractTourFromUrl(text) ?? text;
    }
    // 2) Prefix „TF1:" abtrennen, sonst pures JSON zulassen
    const json = raw.startsWith(TOUR_QR_PREFIX) ? raw.slice(TOUR_QR_PREFIX.length) : raw;
    let payload;
    try {
        payload = JSON.parse(json);
    } catch {
        return null;
    }
    if (payload?.v !== 1 || !payload.s || !Array.isArray(payload.x) || payload.x.length === 0) return null;

    const point = (p) => ({
        lat: Number(p.lat), lng: Number(p.lng), label: p.l || '',
        ...(p.d === 1 ? { demo: true, dataOrigin: DEMO_DATA_ORIGIN } : {})
    });
    if (!hasCoords(payload.s)) return null;
    const stops = payload.x
        .filter(hasCoords)
        .map((p) => ({
            name: p.n || 'Stopp',
            lat: Number(p.lat),
            lng: Number(p.lng),
            adresse: p.a || '',
            telefon: p.t || '',
            nummer: p.k || '',
            plz: p.p || '',
            ...(p.d === 1 ? { demo: true, dataOrigin: DEMO_DATA_ORIGIN } : {})
        }));
    if (stops.length === 0) return null;

    return {
        start: point(payload.s),
        stops,
        tourName: payload.tn || 'Empfangene Tour',
        date: payload.d || '',
        startTime: payload.st || '08:00',
        visitMinutes: Number(payload.vm) || 45,
        roundTrip: payload.r === 1
    };
}

/**
 * Empfangene Stopps mit lokal vorhandenen Kunden abgleichen:
 * Kundennummer zuerst, dann Name + PLZ (unabhängig von Groß-/Kleinschreibung).
 * @returns {{ matched: Array<{stop, customer}>, unmatched: Array }}
 */
export function matchStopsToCustomers(stops, customers) {
    const byNummer = new Map();
    const byNamePlz = new Map();
    const kind = (item) => isDemoCustomer(item) ? 'demo' : 'real';
    for (const c of customers || []) {
        const nummer = String(c.nummer ?? '').trim();
        if (nummer) byNummer.set(`${kind(c)}|${nummer}`, c);
        const key = `${kind(c)}|${String(c.name ?? '').trim().toLowerCase()}|${String(c.plz ?? '').trim()}`;
        if (!key.endsWith('||')) byNamePlz.set(key, c);
    }
    const matched = [];
    const unmatched = [];
    for (const stop of stops || []) {
        const prefix = kind(stop);
        const customer = (stop.nummer && byNummer.get(`${prefix}|${String(stop.nummer).trim()}`))
            || byNamePlz.get(`${prefix}|${String(stop.name ?? '').trim().toLowerCase()}|${String(stop.plz ?? '').trim()}`);
        if (customer && Number.isFinite(Number(customer.lat))) matched.push({ stop, customer });
        else unmatched.push(stop);
    }
    return { matched, unmatched };
}

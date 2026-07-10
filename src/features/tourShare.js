/**
 * QR-Tour-Übergabe Desktop → Handy.
 * Es wird NIE die Kundendatenbank übertragen – nur die geplante Tour mit den
 * Daten, die unterwegs gebraucht werden (Name, Koordinaten, Adresse, Telefon,
 * Kundennummer zum Wiederfinden). Der Transportweg ist Bildschirm → Kamera,
 * ohne Netzwerk, Datei oder Server.
 */

export const TOUR_QR_PREFIX = 'TF1:';
export const MAX_QR_STOPS = 12;

const round5 = (n) => Math.round(Number(n) * 1e5) / 1e5;

// Achtung: Number(null) wäre 0 – Strings konvertieren, alles andere direkt prüfen
const isCoord = (v) => Number.isFinite(typeof v === 'string' && v !== '' ? Number(v) : v);
const hasCoords = (p) => Boolean(p) && isCoord(p.lat) && isCoord(p.lng);

function packPoint(point) {
    if (!hasCoords(point)) return null;
    return { lat: round5(point.lat), lng: round5(point.lng), l: point.label || point.name || '' };
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
 * @returns {{ start, stops, tourName, date, startTime, visitMinutes, roundTrip }|null}
 */
export function decodeTourPayload(text) {
    if (typeof text !== 'string' || !text.startsWith(TOUR_QR_PREFIX)) return null;
    let payload;
    try {
        payload = JSON.parse(text.slice(TOUR_QR_PREFIX.length));
    } catch {
        return null;
    }
    if (payload?.v !== 1 || !payload.s || !Array.isArray(payload.x) || payload.x.length === 0) return null;

    const point = (p) => ({ lat: Number(p.lat), lng: Number(p.lng), label: p.l || '' });
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
            plz: p.p || ''
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
    for (const c of customers || []) {
        const nummer = String(c.nummer ?? '').trim();
        if (nummer) byNummer.set(nummer, c);
        const key = `${String(c.name ?? '').trim().toLowerCase()}|${String(c.plz ?? '').trim()}`;
        if (key !== '|') byNamePlz.set(key, c);
    }
    const matched = [];
    const unmatched = [];
    for (const stop of stops || []) {
        const customer = (stop.nummer && byNummer.get(String(stop.nummer).trim()))
            || byNamePlz.get(`${String(stop.name ?? '').trim().toLowerCase()}|${String(stop.plz ?? '').trim()}`);
        if (customer && Number.isFinite(Number(customer.lat))) matched.push({ stop, customer });
        else unmatched.push(stop);
    }
    return { matched, unmatched };
}

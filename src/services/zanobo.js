/**
 * Brücke zur Schwester-App Zanobo (akustischer Maschinen-Check).
 *
 * Zanobo (https://zanobo.vercel.app) vergleicht das Betriebsgeräusch einer
 * Maschine lokal im Browser mit einer Referenzaufnahme – ein Vergleichs- und
 * Orientierungsinstrument, ausdrücklich kein Diagnosewerkzeug.
 *
 * Konvention: Die Anlagen-ID aus TourFuchs-Einsätzen (assetId) ist dieselbe
 * Maschinen-ID wie am Zanobo-NFC-Tag. Der Deep-Link nutzt Zanobos Route
 * "#/m/<id>" – die ID steckt im URL-Fragment und wird daher nie an den
 * Server übertragen (gleiche Datenschutz-Mechanik wie beim Tour-QR).
 */

const STORAGE_KEY = 'tf_zanobo_base';
export const ZANOBO_DEFAULT_BASE = 'https://zanobo.vercel.app';

function store() {
    try { return globalThis.localStorage || null; } catch { return null; }
}

/** Konfigurierte Zanobo-Instanz; ohne eigene Konfiguration die öffentliche. */
export function zanoboBaseUrl() {
    const stored = String(store()?.getItem(STORAGE_KEY) ?? '').trim();
    return stored || ZANOBO_DEFAULT_BASE;
}

/**
 * Eigene Zanobo-Instanz setzen (z. B. firmenintern gehostet).
 * Leerer Wert kehrt zur öffentlichen Instanz zurück.
 * @returns {string|null} gespeicherte Basis-URL oder null bei ungültiger Eingabe
 */
export function setZanoboBaseUrl(value) {
    const raw = String(value ?? '').trim();
    if (!raw) {
        try { store()?.removeItem(STORAGE_KEY); } catch { /* optional */ }
        return zanoboBaseUrl();
    }
    try {
        const url = new URL(raw);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
        const base = url.href.replace(/[#?].*$/, '').replace(/\/+$/, '');
        try { store()?.setItem(STORAGE_KEY, base); } catch { /* optional */ }
        return base;
    } catch {
        return null;
    }
}

/**
 * Deep-Link auf eine Maschine (Zanobo-Route "#/m/<id>") oder null,
 * wenn keine Anlagen-ID vorliegt.
 */
export function zanoboMachineUrl(assetId, base = zanoboBaseUrl()) {
    const id = String(assetId ?? '').trim();
    const cleanBase = String(base ?? '').trim().replace(/\/+$/, '');
    if (!id || !cleanBase) return null;
    return `${cleanBase}/#/m/${encodeURIComponent(id)}`;
}

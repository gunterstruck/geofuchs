/**
 * „Mein Tag" – Ein-Klick-Tagesplaner.
 * Baut aus fälligen/überfälligen Kunden des aktuellen Tour-Pools automatisch
 * eine kompakte Tagestour: überfällige Kunden haben strikt Vorrang, innerhalb
 * derselben Dringlichkeit entscheidet die Nähe (Nearest-Neighbor ab Start),
 * anschließend glättet die 2-Opt-Optimierung die Reihenfolge.
 * Läuft vollständig offline (Luftlinien-Distanzen).
 */

import { distanceKm } from '../services/geocode.js';
import { visitStatus } from './visits.js';
import { optimizeOrder } from './tour.js';

export const DEFAULT_MAX_STOPS = 8;

/**
 * @param {{lat, lng}} start Startpunkt (GPS oder Kunde)
 * @param {Array} pool Kandidaten (bereits nach Bezirk/Filtern eingegrenzt)
 * @param {{ maxStops?: number, now?: Date }} options
 * @returns {{ stops: Array, totalOpportunities: number }}
 */
export function planMyDay(start, pool, { maxStops = DEFAULT_MAX_STOPS, now = new Date() } = {}) {
    const rank = (c) => {
        const s = visitStatus(c, now);
        return s === 'ueberfaellig' ? 0 : s === 'faellig' ? 1 : 2;
    };
    const candidates = (pool || []).filter((c) =>
        Number.isFinite(c?.lat) && Number.isFinite(c?.lng) && rank(c) < 2);
    if (!start || candidates.length === 0) {
        return { stops: [], totalOpportunities: candidates.length };
    }

    const chosen = [];
    const remaining = new Set(candidates);
    let current = start;
    while (chosen.length < maxStops && remaining.size > 0) {
        let best = null;
        let bestScore = Infinity;
        for (const c of remaining) {
            // Dringlichkeit strikt vor Distanz: kein fälliger Kunde verdrängt
            // einen überfälligen, egal wie nah er liegt.
            const score = rank(c) * 100000 + distanceKm(current, c);
            if (score < bestScore) { bestScore = score; best = c; }
        }
        chosen.push(best);
        remaining.delete(best);
        current = best;
    }

    return {
        stops: optimizeOrder(start, chosen, null),
        totalOpportunities: candidates.length
    };
}

/** Datum (yyyy-mm-dd) + Uhrzeit (HH:MM) zu einem lokalen Date kombinieren. */
export function combinePlanStart(dateStr, timeStr) {
    const fallback = new Date();
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    const [hh, mm] = String(timeStr || '08:00').split(':').map(Number);
    const date = y && m && d ? new Date(y, m - 1, d) : fallback;
    date.setHours(Number.isFinite(hh) ? hh : 8, Number.isFinite(mm) ? mm : 0, 0, 0);
    return date;
}

/** Heute als Wert für <input type="date"> (lokale Zeitzone). */
export function todayInputValue(now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

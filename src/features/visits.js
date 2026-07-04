/**
 * Besuchsstatus & Besuchsrhythmus
 *
 * Kunde: besuche = ['2026-05-12', ...] (aufsteigend), rhythmusWochen = 6 | null
 * Status (nur wenn ein Rhythmus gesetzt ist):
 *   'ok'           – Besuch liegt gut im Rhythmus
 *   'faellig'      – Fälligkeit steht kurz bevor
 *   'ueberfaellig' – Rhythmus überschritten (oder noch nie besucht)
 *   'none'         – kein Rhythmus definiert
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const STATUS_COLORS = {
    ok: '#16a34a',
    faellig: '#eab308',
    ueberfaellig: '#dc2626',
    none: '#94a3b8'
};

export const STATUS_LABELS = {
    ok: 'im Rhythmus',
    faellig: 'bald fällig',
    ueberfaellig: 'überfällig',
    none: 'kein Rhythmus'
};

export function lastVisit(customer) {
    const visits = customer.besuche;
    return visits && visits.length > 0 ? visits[visits.length - 1] : null;
}

export function visitStatus(customer, now = new Date()) {
    if (!customer.rhythmusWochen) return 'none';
    const last = lastVisit(customer);
    if (!last) return 'ueberfaellig';

    const lastMs = new Date(`${last}T12:00:00`).getTime();
    const intervalMs = customer.rhythmusWochen * 7 * DAY_MS;
    const dueMs = lastMs + intervalMs;
    // "bald fällig": letzte Woche vor Fälligkeit (mind. 3 Tage, max. 25 % des Intervalls)
    const windowMs = Math.min(Math.max(intervalMs * 0.25, 3 * DAY_MS), 7 * DAY_MS);

    if (now.getTime() >= dueMs) return 'ueberfaellig';
    if (now.getTime() >= dueMs - windowMs) return 'faellig';
    return 'ok';
}

/** Für Sortierungen: überfällig zuerst */
export function statusRank(customer) {
    const status = visitStatus(customer);
    return status === 'ueberfaellig' ? 0 : status === 'faellig' ? 1 : 2;
}

/** Besuch (heute) eintragen; gleicher Tag wird nicht doppelt gespeichert */
export function markVisitedToday(customer) {
    const today = new Date().toISOString().slice(0, 10);
    if (!Array.isArray(customer.besuche)) customer.besuche = [];
    if (customer.besuche[customer.besuche.length - 1] !== today) {
        customer.besuche.push(today);
    }
    return today;
}

export function formatDateDe(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}.${m}.${y}`;
}

/** "vor 3 Wochen" / "vor 5 Tagen" */
export function agoText(isoDate, now = new Date()) {
    if (!isoDate) return 'noch nie';
    const days = Math.max(0, Math.round((now.getTime() - new Date(`${isoDate}T12:00:00`).getTime()) / DAY_MS));
    if (days === 0) return 'heute';
    if (days === 1) return 'gestern';
    if (days < 21) return `vor ${days} Tagen`;
    return `vor ${Math.round(days / 7)} Wochen`;
}

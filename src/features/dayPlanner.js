/**
 * Plan-Einstellungen für die Tagestour: Datum, Startzeit und Besuchsdauer
 * steuern Tagesplan-Druck, Kalender-Termine (.ics) und die QR-Übergabe.
 * Die Tour selbst plant der Nutzer manuell (bewusste Produktentscheidung:
 * kein automatischer Tourvorschlag).
 */

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

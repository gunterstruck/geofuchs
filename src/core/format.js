/**
 * Einheitliche Zahlen-Darstellung.
 * Verbindliche Regel für Umsätze (Roadmap R1.5): ab 10.000 € wird kompakt in
 * T€ gerundet angezeigt, darunter in vollen Euro. Der exakte Betrag gehört in
 * einen Tooltip (formatRevenueFull).
 */

export function formatRevenueShort(value) {
    const v = Math.round(value || 0);
    if (Math.abs(v) >= 10000) return `${Math.round(v / 1000).toLocaleString('de-DE')} T€`;
    return `${v.toLocaleString('de-DE')} €`;
}

export function formatRevenueFull(value) {
    return `${Math.round(value || 0).toLocaleString('de-DE')} €`;
}

/**
 * Übergabe an andere Werkzeuge (Outlook, Copilot, Notizen …) per Zwischenablage.
 * Bewusst schlank: TourFuchs baut keine Berichts-/Briefing-Logik nach, sondern
 * reicht Kunde bzw. Tour als sauberen Text weiter, den man dort einfügen kann.
 */

import { visitStatus, lastVisit, agoText, formatDateDe, STATUS_LABELS } from './visits.js';
import { DEMO_DATA_LABEL, isDemoCustomer } from '../core/demoSafety.js';

/** Text in die Zwischenablage kopieren (mit Fallback für ältere Browser) */
export async function copyText(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) { /* Fallback unten */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        return false;
    }
}

function addressOf(p) {
    return [p.strasse, `${p.plz ?? ''} ${p.ort ?? ''}`.trim()].filter(Boolean).join(', ');
}

/** Ein-/Mehrzeiler zu einem Kunden (für Kunden-Kopie und Tour-Zeilen) */
export function customerText(c) {
    const lines = isDemoCustomer(c) ? [DEMO_DATA_LABEL, c.name] : [c.name];
    const addr = addressOf(c);
    if (addr) lines.push(addr);
    if (c.nummer) lines.push(`Kd.-Nr. ${c.nummer}`);
    if (c.vb) lines.push(`Vertriebsbeauftragte(r): ${c.vb}`);
    const hier = [c.channel, c.gruppe, c.bezirk].filter(Boolean).join(' › ');
    if (hier) lines.push(hier);
    const contact = [
        c.ansprechpartner && `Hauptansprechpartner: ${c.ansprechpartner}`,
        c.telefon && `Tel: ${c.telefon}`,
        c.email && `E-Mail: ${c.email}`
    ].filter(Boolean);
    if (contact.length) lines.push(contact.join(' · '));
    if (c.umsatz) lines.push(`Umsatz: ${c.umsatz.toLocaleString('de-DE')} €`);
    if (c.rhythmusWochen) {
        const last = lastVisit(c);
        lines.push(`Rhythmus ${c.rhythmusWochen} Wochen · letzter Besuch ${last ? formatDateDe(last) : '—'} (${agoText(last)}) · ${STATUS_LABELS[visitStatus(c)]}`);
    }
    return lines.join('\n');
}

/** Kompakte Kunden-Zeile für die Tour (Name, Adresse, Telefon) */
function tourLine(c) {
    const parts = [`${isDemoCustomer(c) ? '[DEMO] ' : ''}${c.name}`];
    const addr = addressOf(c);
    if (addr) parts.push(addr);
    if (c.telefon) parts.push(`Tel: ${c.telefon}`);
    return parts.join(' · ');
}

/**
 * Ganze Tour als Text (Start → Stopps → Ziel), zum Einfügen in Outlook/Copilot.
 * @param {{label,strasse,plz,ort}} start
 * @param {Array} stops  Zwischenstopps (Kunden)
 * @param {object|null} destination  Zielkunde/-punkt
 */
export function tourText(start, stops, destination, { tourName = 'Tagestour', roadKm = null, roundTrip = false } = {}) {
    const demo = [start, ...(stops || []), destination].filter(Boolean).some(isDemoCustomer);
    const lines = demo ? [DEMO_DATA_LABEL, `Tour: ${tourName}`] : [`Tour: ${tourName}`];
    if (start) lines.push(`Start: ${start.label || addressOf(start)}`);
    stops.forEach((c, i) => lines.push(`${i + 1}. ${tourLine(c)}`));
    if (destination) lines.push(`Ziel: ${tourLine(destination)}`);
    if (roundTrip && start) lines.push(`Zurück zum Start: ${start.label || addressOf(start)}`);
    if (roadKm) lines.push(`Strecke ca. ${Math.round(roadKm)} km${roundTrip ? ' (Rundreise)' : ''} – Luftlinie geschätzt.`);
    return lines.join('\n');
}

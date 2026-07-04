/**
 * Tour-Exporte: druckbarer Tagesplan und Kalender-Datei (.ics).
 * Zeiten werden aus einer geschätzten Besuchsdauer und der Luftlinien-Fahrzeit
 * hochgerechnet (grobe Planungshilfe, keine echte Routing-Zeit).
 */

import { CONFIG } from '../core/config.js';
import { distanceKm } from '../services/geocode.js';
import { formatDateDe, lastVisit, agoText } from './visits.js';

const VISIT_MINUTES = 45;      // angenommene Dauer je Besuch
const AVG_SPEED_KMH = 60;      // Durchschnittstempo für Fahrzeit-Schätzung

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/**
 * Fahr-/Besuchszeiten für die Stopps berechnen.
 * @returns {Array<{customer, arrival: Date, driveMin, km}>}
 */
function schedule(start, stops, startTime) {
    const result = [];
    let current = start;
    let clock = new Date(startTime);
    for (const c of stops) {
        const km = distanceKm(current, c) * CONFIG.tour.roadFactor;
        const driveMin = Math.round((km / AVG_SPEED_KMH) * 60);
        clock = new Date(clock.getTime() + driveMin * 60000);
        result.push({ customer: c, arrival: new Date(clock), driveMin, km });
        clock = new Date(clock.getTime() + VISIT_MINUTES * 60000);
        current = c;
    }
    return result;
}

function hhmm(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Druckbaren Tagesplan in neuem Fenster öffnen */
export function printDayPlan(start, stops, { startTime = defaultStart(), tourName = 'Tagestour' } = {}) {
    const rows = schedule(start, stops, startTime);
    const totalKm = rows.reduce((sum, r) => sum + r.km, 0);
    const dateStr = new Date(startTime).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    const body = rows.map((r, i) => {
        const c = r.customer;
        const addr = [c.strasse, `${c.plz} ${c.ort}`.trim()].filter(Boolean).join(', ');
        const contact = [c.ansprechpartner, c.telefon].filter(Boolean).join(' · ');
        const last = lastVisit(c);
        return `<tr>
            <td class="num">${i + 1}</td>
            <td class="time">${hhmm(r.arrival)}<br><span class="muted">${r.driveMin} min · ${Math.round(r.km)} km</span></td>
            <td>
                <b>${escapeHtml(c.name)}</b><br>
                ${escapeHtml(addr)}
                ${contact ? `<br><span class="muted">${escapeHtml(contact)}</span>` : ''}
                ${c.rhythmusWochen ? `<br><span class="muted">Rhythmus: ${c.rhythmusWochen} Wochen · letzter Besuch ${last ? formatDateDe(last) : '—'} (${agoText(last)})</span>` : ''}
            </td>
            <td class="check">☐</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
        <title>${escapeHtml(tourName)} – ${dateStr}</title>
        <style>
            body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
            h1 { font-size: 1.4rem; margin: 0 0 2px; }
            .sub { color: #64748b; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
            .num { font-weight: 700; width: 28px; }
            .time { white-space: nowrap; font-variant-numeric: tabular-nums; }
            .check { font-size: 1.3rem; width: 30px; text-align: center; }
            .muted { color: #64748b; font-size: 0.85rem; }
            .foot { margin-top: 16px; color: #64748b; font-size: 0.85rem; }
            @media print { body { margin: 0; } .noprint { display: none; } }
        </style></head><body>
        <h1>🦊 ${escapeHtml(tourName)}</h1>
        <p class="sub">${dateStr} · Start ${hhmm(new Date(startTime))} bei „${escapeHtml(start.label)}" · ${rows.length} Besuche · ca. ${Math.round(totalKm)} km</p>
        <table>
            <thead><tr><th>#</th><th>Ankunft</th><th>Kunde</th><th>✓</th></tr></thead>
            <tbody>${body}</tbody>
        </table>
        <p class="foot">Zeiten geschätzt (${VISIT_MINUTES} min je Besuch, ${AVG_SPEED_KMH} km/h Fahrt). Erstellt mit GeoFuchs Vertrieb.</p>
        <button class="noprint" onclick="window.print()" style="margin-top:16px;padding:8px 16px;">Drucken</button>
        </body></html>`;

    const win = window.open('', '_blank');
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    return true;
}

function icsEscape(text) {
    return String(text ?? '').replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
}

function icsDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/** Tour als .ics-Datei (ein VEVENT je Stopp) herunterladen */
export function downloadIcs(start, stops, { startTime = defaultStart(), tourName = 'Tagestour' } = {}) {
    const rows = schedule(start, stops, startTime);
    const now = icsDate(new Date());
    const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GeoFuchs Vertrieb//DE', 'CALSCALE:GREGORIAN'
    ];
    rows.forEach((r, i) => {
        const c = r.customer;
        const end = new Date(r.arrival.getTime() + VISIT_MINUTES * 60000);
        const addr = [c.strasse, `${c.plz} ${c.ort}`.trim()].filter(Boolean).join(', ');
        const desc = [
            c.ansprechpartner && `Ansprechpartner: ${c.ansprechpartner}`,
            c.telefon && `Telefon: ${c.telefon}`,
            c.email && `E-Mail: ${c.email}`,
            c.nummer && `Kd.-Nr.: ${c.nummer}`
        ].filter(Boolean).join('\n');
        lines.push(
            'BEGIN:VEVENT',
            `UID:geofuchs-${Date.now()}-${i}@geofuchs`,
            `DTSTAMP:${now}`,
            `DTSTART:${icsDate(r.arrival)}`,
            `DTEND:${icsDate(end)}`,
            `SUMMARY:${icsEscape(`${i + 1}. ${c.name} (${tourName})`)}`,
            addr ? `LOCATION:${icsEscape(addr)}` : '',
            desc ? `DESCRIPTION:${icsEscape(desc)}` : '',
            'END:VEVENT'
        );
    });
    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tourName.replace(/[^\w-]+/g, '-')}-${new Date(startTime).toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Nächster Werktag, 8:00 Uhr */
function defaultStart() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
}

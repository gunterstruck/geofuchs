/**
 * Fachlicher Prompt für ein kompaktes Kundenbriefing aus Microsoft-365-Wissen.
 * Es werden nur die zur eindeutigen Zuordnung und Besuchsvorbereitung nötigen
 * TourFuchs-Felder aufgenommen, nicht der vollständige Kundendatensatz.
 */

import { isDemoCustomer } from '../core/demoSafety.js';

function value(value) {
    return String(value ?? '').trim();
}

function formatLocalDate(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value(isoDate));
    return match ? `${match[3]}.${match[2]}.${match[1]}` : value(isoDate);
}

export function customerBriefingFlow(depth, configured) {
    if (depth !== 'profi') return 'manual';
    return configured ? 'automatic' : 'setup';
}

function identityLines(customer) {
    const lines = [`- Kundenname: ${value(customer.name) || 'nicht angegeben'}`];
    if (value(customer.nummer)) lines.push(`- Kundennummer: ${value(customer.nummer)}`);
    const location = [value(customer.plz), value(customer.ort)].filter(Boolean).join(' ');
    if (location) lines.push(`- Ort: ${location}`);
    if (value(customer.ansprechpartner)) {
        lines.push(`- Hauptansprechpartner: ${value(customer.ansprechpartner)}`);
    }
    return lines;
}

function tourLines(context) {
    const lines = [];
    if (value(context.plannedDate)) {
        lines.push(`- Geplanter Besuch: ${formatLocalDate(context.plannedDate)}`);
    }
    if (Number.isInteger(context.stopPosition) && context.stopPosition > 0) {
        const total = Number.isInteger(context.stopCount) && context.stopCount > 0
            ? ` von ${context.stopCount}`
            : '';
        lines.push(`- Position in der Tour: Stopp ${context.stopPosition}${total}`);
    }
    if (context.isStart) lines.push('- Tourrolle: Startpunkt');
    if (context.isDestination) lines.push('- Tourrolle: Ziel');
    if (value(context.lastLocalVisit)) {
        lines.push(`- Letzter lokal dokumentierter Besuch: ${formatLocalDate(context.lastLocalVisit)}`);
    }
    return lines;
}

export function buildCustomerBriefingPrompt(customer, context = {}) {
    if (isDemoCustomer(customer)) {
        throw new Error('Für Demo-Kunden wird kein externer Copilot-Prompt erzeugt.');
    }
    const identifiers = identityLines(customer);
    const plan = tourLines(context);
    const localContext = plan.length
        ? `\nTourFuchs-Kontext:\n${plan.join('\n')}\n`
        : '';

    return `Du bist meine Vertriebsassistenz. Erstelle ein kompaktes, belastbares Briefing für meinen nächsten Kundenkontakt.

Kunde zur eindeutigen Zuordnung:
${identifiers.join('\n')}
${localContext}
Durchsuche ausschließlich Microsoft-365-Inhalte, auf die ich mit meinem Arbeitskonto zugreifen darf: relevante E-Mails, Outlook-Termine, Teams-Chats, Besprechungen, Transkripte und Dateien. Ordne Treffer nur diesem Kunden zu. Nutze dafür gemeinsam Kundenname, Kundennummer, Ort und Ansprechpartner. Vermische keine ähnlich benannten Kunden.

Zeitraum:
- letzte 12 Monate, mit Schwerpunkt auf den letzten 90 Tagen
- zusätzlich zukünftige Termine, zugesagte Aufgaben und Fristen

Verdichte nur Informationen, die für den nächsten Kundenkontakt handlungsrelevant sind. Relevanz ist wichtiger als Vollständigkeit.

Liefere ausschließlich dieses Format:
## Jetzt wichtig
- höchstens 4 kurze Stichpunkte zu Anlass, jüngstem relevanten Kontakt, Ansprechpartnern und offenen Zusagen

## Gespräch
- Ziel: ein Satz
- Einstieg: ein Satz
- Fragen: genau 3 kurze, konkrete Fragen

## Handlung
- höchstens je ein kurzer Punkt zu Offen, Chance und Risiko; nicht belegbare oder unzutreffende Punkte weglassen

## Belege
- höchstens 3 entscheidende Quellen als „Datum – Betreff/Anlass – direkter Link"

Qualitätsregeln:
- Das gesamte Briefing einschließlich Überschriften hat höchstens 250 Wörter.
- Beginne direkt mit „## Jetzt wichtig". Schreibe keinen Vorspann und keinen Bericht über Trefferzahlen, Suchvorgänge oder ausgeschlossene Dokumente.
- Wiederhole keine Fakten, Personen oder Links. Führe jeden Quellenlink höchstens einmal und nur unter „Belege" auf.
- Erfinde nichts.
- Kennzeichne Schlussfolgerungen oder Empfehlungen knapp als solche.
- Erwähne ähnlich benannte Konzerngesellschaften nur, wenn sie für die nächste Aktion unmittelbar relevant sind, und fasse die Unsicherheit in höchstens einem Satz zusammen.
- Wenn du keine belastbaren internen Informationen findest, sage das in einem Satz und blähe das Briefing nicht mit allgemeinen Aussagen auf.
- Nutze keine Websuche und keine allgemeinen Internetinformationen.
- Schreibe präzise, scanbar und auf Deutsch.`;
}

export function customerBriefingContext(customer, tour, plannedDate = '') {
    const stopIndex = Array.isArray(tour?.stops) ? tour.stops.indexOf(customer.id) : -1;
    const visits = Array.isArray(customer.besuche) ? customer.besuche.filter(Boolean).sort() : [];
    return {
        plannedDate,
        stopPosition: stopIndex >= 0 ? stopIndex + 1 : null,
        stopCount: Array.isArray(tour?.stops) ? tour.stops.length : 0,
        isStart: tour?.start?.customerId === customer.id,
        isDestination: tour?.destination?.customerId === customer.id,
        lastLocalVisit: visits.at(-1) || ''
    };
}

/**
 * Fachlicher Prompt für ein kompaktes Kundenbriefing aus Microsoft-365-Wissen.
 * Es werden nur die zur eindeutigen Zuordnung und Besuchsvorbereitung nötigen
 * TourFuchs-Felder aufgenommen, nicht der vollständige Kundendatensatz.
 */

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

Liefere in dieser Reihenfolge:
1. 30-Sekunden-Zusammenfassung mit höchstens 5 Stichpunkten
2. Letzte relevante Kontakte: Datum, Beteiligte, Kanal, Ergebnis und zugesagter nächster Schritt
3. Wichtige Ansprechpartner und aktueller Beziehungsstand
4. Offene Punkte, Zusagen, Fristen oder Eskalationen
5. Erkennbare Chancen und Risiken
6. Besuchsvorbereitung: sinnvolles Gesprächsziel, möglicher Einstieg, 5 konkrete Fragen, erwartbare kritische Rückfragen und beste nächste Aktion

Qualitätsregeln:
- Erfinde nichts.
- Trenne belegte Fakten, Schlussfolgerungen und Empfehlungen klar.
- Nenne Unsicherheiten und widersprüchliche Informationen ausdrücklich.
- Wenn du keine belastbaren internen Informationen findest, sage das klar.
- Belege wesentliche Aussagen möglichst mit Datum, Quelle und direktem Verweis.
- Nutze keine Websuche und keine allgemeinen Internetinformationen.
- Bleibe unter 600 Wörtern und schreibe auf Deutsch.`;
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

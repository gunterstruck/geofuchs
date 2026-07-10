/**
 * Showcase-Stories – reine Datendefinitionen (keine App-Importe, damit sie
 * gefahrlos im Test geladen werden können). Die Engine (src/ui/showcase.js)
 * führt die Schritte auf der echten, laufenden App aus – ein Geister-Cursor
 * klickt echte Bedienelemente, die App reagiert wirklich.
 *
 * Schritttypen:
 *  { t:'say', text, sel?, ms? }   Sprechblase (am Element oder Cursor)
 *  { t:'move', sel }              Cursor zum Element bewegen
 *  { t:'click', sel }             Cursor hin + echten Klick auslösen
 *  { t:'type', sel, text }        In ein Feld tippen (input-Event)
 *  { t:'select', sel, value }     Auswahlfeld setzen (change-Event)
 *  { t:'wait', ms }               Pause
 *  { t:'waitFor', sel, ms? }      Warten, bis Element sichtbar ist
 *  { t:'run', key }               benannter Helfer aus der Engine
 */

export const STORIES = [
    {
        id: 'excel-karte',
        icon: '🗺️',
        title: 'Aus Excel wird eine Landkarte',
        blurb: 'Kundenliste rein – Deutschlandkarte raus.',
        steps: [
            { t: 'say', text: 'Schau: Deine Kundenliste landet mit einem Klick auf der Karte.', ms: 1900 },
            { t: 'run', key: 'excelToMap' },
            { t: 'wait', ms: 2400 },
            { t: 'say', text: 'Jeder Punkt ein Kunde, jede Farbe ein Vertriebsbezirk. Fertig!', ms: 2600 }
        ]
    },
    {
        id: 'tour',
        icon: '🚗',
        title: 'Deine Tour in 30 Sekunden',
        blurb: 'Startpunkt, Vorschläge, optimierte Route.',
        needsData: true,
        mutatesTour: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'gotoTour' },
            { t: 'say', text: 'Zuerst den Vertriebsbezirk wählen – dann kommen nur passende Kunden.', sel: '#tour-scope', ms: 2200 },
            { t: 'run', key: 'pickBezirkAll' },
            { t: 'say', text: 'Jetzt einen Startpunkt setzen …', sel: '#start-search', ms: 1500 },
            { t: 'run', key: 'pickStart' },
            { t: 'say', text: 'TourFuchs schlägt Kunden in der Nähe vor – einfach hinzufügen.', ms: 2200 },
            { t: 'run', key: 'addTwoSuggestions' },
            { t: 'click', sel: '#btn-optimize' },
            { t: 'say', text: 'Reihenfolge optimiert – kürzeste Strecke.', ms: 1800 },
            { t: 'click', sel: '#btn-route-focus' },
            { t: 'wait', ms: 1600 },
            { t: 'say', text: 'Die Route liegt auf der Karte. Ein Tipp – und Google Maps navigiert.', sel: '#btn-gmaps', ms: 2600 },
            { t: 'move', sel: '#btn-gmaps' },
            { t: 'wait', ms: 900 }
        ]
    },
    {
        id: 'handy-qr',
        icon: '📲',
        title: 'Aufs Handy – ohne Kabel, ohne Cloud',
        blurb: 'Tour per QR-Code an dein Smartphone.',
        needsData: true,
        mutatesTour: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'gotoTour' },
            { t: 'run', key: 'pickBezirkAll' },
            { t: 'run', key: 'pickStart' },
            { t: 'run', key: 'addTwoSuggestions' },
            { t: 'say', text: 'So sieht das Ganze auf dem Handy aus …', sel: '#btn-mobile-preview', ms: 1900 },
            { t: 'click', sel: '#btn-mobile-preview' },
            { t: 'wait', ms: 2600 },
            { t: 'say', text: 'Dieselbe App, im Taschenformat.', ms: 1900 },
            { t: 'click', sel: '#btn-mobile-preview' },
            { t: 'wait', ms: 700 },
            { t: 'say', text: 'Und jetzt die geplante Tour aufs Handy geben …', sel: '#btn-tour-qr', ms: 2000 },
            { t: 'click', sel: '#btn-tour-qr' },
            { t: 'waitFor', sel: '#qr-share-dialog[open]', ms: 2000 },
            { t: 'wait', ms: 3200 },
            { t: 'run', key: 'closeQr' },
            { t: 'say', text: 'Mit der Handy-Kamera scannen – die Tour ist drüben. Kein Server, kein Kabel.', ms: 3200 }
        ]
    }
];

/**
 * Statische Selektoren, die in index.html vorhanden sein MÜSSEN. Der
 * Guardrail-Test prüft das – so bricht ein künftiger Umbau die Stories nicht
 * unbemerkt. (Dynamisch gerenderte Elemente wie #tour-bezirk sind bewusst
 * nicht dabei; sie werden per waitFor/Helfer abgesichert.)
 */
export const CRITICAL_SELECTORS = [
    '#btn-demo',
    '.mode-btn[data-mode="aussendienst"]',
    '.tab-button[data-tab="tour"]',
    '#tour-scope',
    '#start-search',
    '#btn-optimize',
    '#btn-route-focus',
    '#btn-gmaps',
    '#btn-mobile-preview',
    '#btn-tour-qr',
    '#qr-share-dialog',
    '#mobile-preview'
];

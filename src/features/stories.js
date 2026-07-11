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
        desktopOnly: true,   // Übergabe Desktop -> Handy; auf dem Handy selbst sinnlos
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
    },
    {
        id: 'simulation',
        icon: '🧪',
        title: 'Was wäre wenn? Gebiete umbauen – ohne Risiko',
        blurb: 'Testweise umverteilen, Wirkung sofort sehen.',
        desktopOnly: true,   // Gebietsplanung/Cockpit gibt es nur auf dem Desktop
        needsData: true,
        patchConfirm: true,   // „Verwerfen" bestätigt sich in der Vorführung automatisch
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'gotoGebiete' },
            { t: 'say', text: 'Das Gebiets-Cockpit: Kennzahlen je Vertriebsbezirk auf einen Blick.', sel: '#btn-cockpit', ms: 2400 },
            { t: 'run', key: 'openCockpit' },
            { t: 'say', text: 'Ich buche testweise Gebiete auf einen anderen Bezirk um …', ms: 2400 },
            { t: 'run', key: 'simAssign' },
            { t: 'say', text: 'Schau die Kennzahlen: grün rauf, rot runter – sofort sichtbar.', ms: 2800 },
            { t: 'run', key: 'simToMap' },
            { t: 'say', text: 'Und auf der Karte: Alt, Neu und nur die Änderungen.', ms: 2200 },
            { t: 'run', key: 'simCycleViews' },
            { t: 'say', text: 'Experimentieren erlaubt – echt wird es erst beim „Übernehmen". Ich verwerfe das jetzt.', sel: '#simulation-map-discard', ms: 3400 },
            { t: 'run', key: 'simDiscard' }
        ]
    },
    {
        id: 'chancen',
        icon: '🎯',
        title: 'Wen besuche ich zuerst?',
        blurb: 'Fällige Kunden filtern und unterwegs abhaken.',
        needsData: true,
        mutatesTour: true,
        restoresVisit: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'gotoTour' },
            { t: 'say', text: '„Chancen" zeigt nur fällige und überfällige Kunden.', sel: '.seg[data-view="chancen"]', ms: 2200 },
            { t: 'run', key: 'chancenOn' },
            { t: 'wait', ms: 1400 },
            { t: 'run', key: 'pickBezirkAll' },
            { t: 'run', key: 'pickStart' },
            { t: 'run', key: 'addTwoSuggestions' },
            { t: 'say', text: 'Und unterwegs einfach abhaken …', sel: '#tour-stops', ms: 1900 },
            { t: 'run', key: 'checkVisit' },
            { t: 'say', text: 'Erledigt – der Besuchsstatus springt sofort auf grün.', ms: 2600 }
        ]
    },
    {
        id: 'tresor',
        icon: '🔐',
        title: 'Deine Daten im Tresor',
        blurb: 'Verschlüsselt, PIN-geschützt, sicher aufs Handy.',
        needsData: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'gotoDaten' },
            { t: 'say', text: 'Deine Kundendaten kannst du in einen Tresor legen – AES-256-verschlüsselt auf diesem Gerät.', sel: '#vault-controls', ms: 2800 },
            { t: 'move', sel: '#btn-vault-setup' },
            { t: 'say', text: 'Einmal eine PIN setzen – ab dann sind die Daten verschlüsselt und beim Öffnen der App gesperrt.', sel: '#btn-vault-setup', ms: 2800 },
            { t: 'say', text: 'Wenn das Gerät es kann, entsperrst du auch per Face- oder Touch-ID – ganz ohne Tippen.', ms: 2400 },
            { t: 'move', sel: '#btn-safe-export' },
            { t: 'say', text: 'Für den Umzug aufs Handy: eine verschlüsselte Datei plus Schlüssel-QR – getrennt und damit sicher.', sel: '#btn-safe-export', ms: 3000 },
            { t: 'say', text: 'Geht das Gerät verloren, bleiben die Daten unlesbar. Das ist der Tresor.', ms: 2600 }
        ]
    },
    {
        id: 'empfang',
        icon: '📥',
        title: 'Verschlüsselte Daten aufs Handy holen',
        blurb: 'Datei wählen, Schlüssel scannen, fertig.',
        mobileOnly: true,     // Gegenstück zur Desktop-QR-Story; nur am Handy sinnvoll
        needsData: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'openReceive' },
            { t: 'say', text: 'Am Desktop hast du deine Daten verschlüsselt exportiert – so holst du sie sicher aufs Handy.', ms: 2800 },
            { t: 'say', text: 'Schritt 1: die verschlüsselte Datei (.tfsafe) wählen, die du dir geschickt hast.', sel: '#safe-step-file', ms: 3000 },
            { t: 'say', text: 'Schritt 2: den Schlüssel-QR vom Desktop scannen – der Schlüssel reist getrennt von der Datei.', ms: 3000 },
            { t: 'say', text: 'Zum Schluss legst du eine PIN fest – die Daten liegen sofort verschlüsselt im Tresor.', ms: 2800 },
            { t: 'run', key: 'closeReceive' }
        ]
    }
];

/**
 * Statische Selektoren, die in index.html vorhanden sein MÜSSEN. Der
 * Guardrail-Test prüft das – so bricht ein künftiger Umbau die Stories nicht
 * unbemerkt. (Dynamisch gerenderte Elemente wie #tour-bezirk sind bewusst
 * nicht dabei; sie werden per waitFor/Helfer abgesichert.)
 */
/**
 * Stories für die aktuelle Ansicht.
 * - `desktopOnly` entfällt auf dem Smartphone (Funktionen, die es dort nicht
 *   gibt – Gebietsplanung – oder die dort sinnlos sind – Tour AN das Handy
 *   senden, während man schon am Handy ist).
 * - `mobileOnly` entfällt am Desktop (z. B. Daten AUFS Handy empfangen).
 * @param {{isDesktop?: boolean}} [opts]
 */
export function visibleStories({ isDesktop = true } = {}) {
    return STORIES.filter((s) => {
        if (s.desktopOnly && !isDesktop) return false;
        if (s.mobileOnly && isDesktop) return false;
        return true;
    });
}

export const CRITICAL_SELECTORS = [
    '#btn-demo',
    '.mode-btn[data-mode="aussendienst"]',
    '.mode-btn[data-mode="gebietsplanung"]',
    '.tab-button[data-tab="tour"]',
    '.tab-button[data-tab="gebiete"]',
    '#tour-scope',
    '#start-search',
    '#btn-optimize',
    '#btn-route-focus',
    '#btn-gmaps',
    '#btn-mobile-preview',
    '#btn-tour-qr',
    '#qr-share-dialog',
    '#mobile-preview',
    '#btn-cockpit',
    '#cockpit-dialog',
    '#cockpit-to-map',
    '#sim-select-all',
    '#sim-rep',
    '#sim-apply',
    '#simulation-map-bar',
    '#simulation-map-discard',
    '[data-simulation-view]',
    '.seg[data-view="chancen"]',
    '.tab-button[data-tab="daten"]',
    '#vault-controls',
    '#btn-vault-setup',
    '#btn-safe-export',
    '#btn-safe-receive',
    '#safe-receive-dialog',
    '#safe-step-file'
];

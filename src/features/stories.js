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
            { t: 'wait', ms: 1800 },
            { t: 'say', text: 'Jeder Punkt ein Kunde, jede Farbe ein Vertriebsbezirk.', ms: 2200 },
            { t: 'run', key: 'showOneCustomer' },
            { t: 'say', text: 'Reinzoomen und einen Kunden antippen – Adresse, Kontakt und Umsatz auf einen Blick.', ms: 3200, pos: 'bottom' }
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
            { t: 'run', key: 'focusDemoTourArea' },
            { t: 'say', text: 'Wir starten im Ruhrgebiet: Hier liegen genug Kunden für eine sichtbare, sinnvolle Tagestour.', ms: 2400, pos: 'bottom' },
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
            { t: 'wait', ms: 1500 },
            { t: 'run', key: 'focusTourRoute' },
            { t: 'say', text: 'Die Route liegt auf der Karte – zuerst als Luftlinie.', ms: 2200, pos: 'bottom' },
            { t: 'run', key: 'showRoadRoute' },
            { t: 'say', text: 'Ein Tipp – und statt Luftlinie siehst du die echte Straßenroute.', ms: 2800, pos: 'bottom' },
            { t: 'run', key: 'shareTourQr' },
            { t: 'say', text: 'Und die fertige Tour per QR-Code aufs Handy – ohne Kabel, ohne Cloud.', sel: '#qr-share-canvas', ms: 3200 },
            { t: 'run', key: 'closeQr' }
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
        mutatesVault: true,   // Demo legt einen Tresor an – cleanup baut ihn wieder ab
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'openVaultSetup' },
            { t: 'say', text: 'Ein Tipp aufs 🔓-Symbol oben – und du legst eine PIN fest.', sel: '#setup-pin', ms: 2400 },
            { t: 'run', key: 'typePinDemo' },
            { t: 'say', text: 'PIN zweimal eingeben – ab dann sind deine Daten AES-256-verschlüsselt.', sel: '#setup-pin2', ms: 2600 },
            { t: 'run', key: 'submitVaultSetup' },
            { t: 'say', text: 'In der echten Einrichtung erscheint jetzt dieser einmalige Wiederherstellungscode. Er gehört getrennt vom Gerät aufbewahrt.', sel: '#recovery-code', ms: 3400 },
            { t: 'say', text: 'Entsperrt wird künftig per PIN – oder per Face-/Touch-ID, wenn dein Gerät das kann.', ms: 2600 },
            { t: 'say', text: 'Geht das Gerät verloren, bleiben die Daten unlesbar. Das ist der Tresor.', ms: 2400 },
            { t: 'run', key: 'finishVaultDemo' }
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
            { t: 'say', text: 'Am Desktop hast du deine Daten verschlüsselt exportiert – so holst du sie sicher aufs Handy.', ms: 2600 },
            { t: 'say', text: 'Schritt 1: die verschlüsselte Datei (.tfsafe) wählen, die du dir geschickt hast.', sel: '#safe-file-input', ms: 2800 },
            { t: 'run', key: 'showReceiveKeyStep' },
            { t: 'say', text: 'Schritt 2: den Schlüssel-QR mit der Kamera scannen – der Schlüssel reist getrennt von der Datei.', sel: '#safe-scan-video', ms: 3000 },
            { t: 'say', text: '… oder den Schlüssel einfach eintippen. Danach eine PIN festlegen – fertig.', sel: '#safe-key-input', ms: 3200 },
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

/** Definierter, temporärer Tourzustand für reproduzierbare Vorführungen. */
export function prepareShowcaseTour(tour, { radiusKm = 50 } = {}) {
    return {
        ...tour,
        bezirk: null,
        start: null,
        destination: null,
        stops: [],
        radiusKm,
        roundTrip: false,
        suggestMode: 'radius',
        mapFocus: false,
        routeLineMode: 'air'
    };
}

const RUHR_CENTER = { lat: 51.48, lng: 7.08 };
const RUHR_ROUTE_TARGETS = [
    { lat: 51.47, lng: 6.85 }, // Oberhausen
    { lat: 51.45, lng: 7.02 }, // Essen
    { lat: 51.50, lng: 7.40 }  // westliches Dortmund
];

function geoDistanceKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (Number(b.lat) - Number(a.lat)) * rad;
    const dLng = (Number(b.lng) - Number(a.lng)) * rad;
    const lat1 = Number(a.lat) * rad;
    const lat2 = Number(b.lat) * rad;
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestTo(target, candidates) {
    return [...candidates].sort((a, b) => geoDistanceKm(target, a) - geoDistanceKm(target, b))[0] || null;
}

/**
 * Wählt für die Tour-Demo drei geografisch getrennte Kunden. Im Regelfall
 * entsteht Oberhausen -> Essen -> westliches Dortmund; bei anderen Datensätzen
 * wird dieselbe Tagesentfernung rund um den nächstgelegenen Kunden nachgebildet.
 */
export function selectShowcaseTour(customers, { areaRadiusKm = 85, maxRouteKm = 60 } = {}) {
    const located = customers.filter((c) => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)));
    if (located.length < 3) return null;

    const ruhr = located.filter((c) => geoDistanceKm(RUHR_CENTER, c) <= areaRadiusKm);
    const start = nearestTo(RUHR_ROUTE_TARGETS[0], ruhr.length ? ruhr : located);
    if (!start) return null;

    const routePool = located.filter((c) => c.id !== start.id && geoDistanceKm(start, c) <= maxRouteKm);
    const choose = (target, desiredKm, minFromStart, used = [], minFromUsed = 7) => routePool
        .filter((c) => !used.some((u) => u.id === c.id))
        .filter((c) => geoDistanceKm(start, c) >= minFromStart)
        .filter((c) => used.every((u) => u.id === start.id || geoDistanceKm(u, c) >= minFromUsed))
        .sort((a, b) => {
            const score = (c) => geoDistanceKm(target, c) + Math.abs(geoDistanceKm(start, c) - desiredKm) * 0.35;
            return score(a) - score(b);
        })[0] || null;

    let first = choose(RUHR_ROUTE_TARGETS[1], 14, 7, [start]);
    if (!first) first = choose(RUHR_ROUTE_TARGETS[1], 18, 2, [start], 2);
    let second = first ? choose(RUHR_ROUTE_TARGETS[2], 38, 18, [start, first], 8) : null;
    if (!second && first) second = choose(RUHR_ROUTE_TARGETS[2], 32, 8, [start, first], 4);
    if (!first || !second) return null;

    const points = [start, first, second];
    return {
        start,
        stops: [first, second],
        center: {
            lat: points.reduce((sum, p) => sum + Number(p.lat), 0) / points.length,
            lng: points.reduce((sum, p) => sum + Number(p.lng), 0) / points.length
        },
        inRuhr: geoDistanceKm(RUHR_CENTER, start) <= areaRadiusKm
    };
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
    '#btn-vault-toggle',
    '#vault-dialog',
    '#btn-safe-export',
    '#btn-safe-receive',
    '#safe-receive-dialog',
    '#safe-step-file'
];

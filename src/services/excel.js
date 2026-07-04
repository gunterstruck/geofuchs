/**
 * Excel-Service
 * Einlesen von Excel-/CSV-Kundenlisten (SheetJS), automatische
 * Spaltenerkennung, Excel-Vorlage und Demo-Daten.
 */

import * as XLSX from 'xlsx';

/** Interne Felder mit deutschen Labels und Erkennungs-Synonymen */
export const FIELDS = [
    { key: 'nummer',  label: 'Kundennummer',           required: false, synonyms: ['kundennummer', 'kundennr', 'kunden-nr', 'nummer', 'nr', 'debitor', 'debitorennummer', 'kdnr', 'kd-nr', 'id'] },
    { key: 'name',    label: 'Kundenname',             required: true,  synonyms: ['kundenname', 'kunde', 'name', 'firma', 'firmenname', 'unternehmen', 'account', 'kunden'] },
    { key: 'strasse', label: 'Straße & Hausnummer',    required: false, synonyms: ['straße', 'strasse', 'str', 'straße und hausnummer', 'adresse', 'anschrift', 'street'] },
    { key: 'plz',     label: 'PLZ',                    required: true,  synonyms: ['plz', 'postleitzahl', 'zip', 'zipcode', 'postcode'] },
    { key: 'ort',     label: 'Ort',                    required: false, synonyms: ['ort', 'stadt', 'city', 'gemeinde', 'wohnort'] },
    { key: 'vb',      label: 'Vertriebsbeauftragter',  required: false, synonyms: ['vertriebsbeauftragter', 'vertriebsbeauftragte', 'vb', 'betreuer', 'außendienst', 'aussendienst', 'ad', 'vertriebler', 'verkäufer', 'verkaeufer', 'sales rep', 'mitarbeiter', 'ansprechpartner vertrieb', 'gebietsleiter', 'kam'] },
    { key: 'gruppe',  label: 'Vertriebsgruppe',        required: false, synonyms: ['vertriebsgruppe', 'gruppe', 'kundengruppe', 'kundenkreis', 'segment', 'kategorie', 'sparte', 'branche', 'klasse', 'team', 'region'] },
    { key: 'umsatz',  label: 'Umsatz (optional)',      required: false, synonyms: ['umsatz', 'jahresumsatz', 'umsatz €', 'revenue', 'potenzial', 'potential'] },
    { key: 'lat',     label: 'Breitengrad (optional)', required: false, synonyms: ['lat', 'latitude', 'breitengrad', 'breite'] },
    { key: 'lng',     label: 'Längengrad (optional)',  required: false, synonyms: ['lng', 'lon', 'longitude', 'längengrad', 'laengengrad', 'länge'] }
];

function normalizeHeader(h) {
    return String(h ?? '').toLowerCase().trim()
        .replace(/[._\-/]/g, ' ')
        .replace(/\s+/g, ' ');
}

/**
 * Datei einlesen -> { headers, rows } (rows als Objekte je Header)
 */
export async function readWorkbook(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('Die Datei enthält kein Tabellenblatt.');

    // defval: '' damit leere Zellen nicht fehlen; raw: false liefert formatierte Strings
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (rows.length === 0) throw new Error('Das Tabellenblatt enthält keine Datenzeilen.');

    const headers = Object.keys(rows[0]);
    return { headers, rows, sheetName: workbook.SheetNames[0] };
}

/**
 * Automatische Zuordnung: Header -> internes Feld.
 * Liefert { fieldKey: headerName | null }
 */
export function autoDetectMapping(headers) {
    const mapping = {};
    const used = new Set();

    for (const field of FIELDS) {
        mapping[field.key] = null;
        // exakte Treffer zuerst, dann "beginnt mit"/"enthält"
        for (const matchFn of [
            (h, s) => h === s,
            (h, s) => h.startsWith(s),
            (h, s) => h.includes(s)
        ]) {
            if (mapping[field.key]) break;
            for (const header of headers) {
                if (used.has(header)) continue;
                const norm = normalizeHeader(header);
                if (field.synonyms.some((s) => matchFn(norm, s))) {
                    mapping[field.key] = header;
                    used.add(header);
                    break;
                }
            }
        }
    }
    return mapping;
}

function cleanPlz(value) {
    const digits = String(value ?? '').trim().match(/\d+/)?.[0] ?? '';
    if (!digits) return '';
    // Excel schneidet führende Nullen ab: 1067 -> 01067
    return digits.padStart(5, '0').slice(0, 5);
}

function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseFloat(String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
}

function parseCoord(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

/**
 * Zeilen anhand Mapping in Kunden-Objekte umwandeln.
 * Liefert { customers, skipped } – skipped = Zeilen ohne Namen.
 */
export function rowsToCustomers(rows, mapping) {
    const customers = [];
    let skipped = 0;

    rows.forEach((row, index) => {
        const get = (key) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '');
        const name = get('name');
        if (!name) { skipped++; return; }

        const lat = parseCoord(mapping.lat ? row[mapping.lat] : null);
        const lng = parseCoord(mapping.lng ? row[mapping.lng] : null);
        const hasCoords = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

        customers.push({
            id: `k${index}-${name.slice(0, 12)}`,
            nummer: get('nummer'),
            name,
            strasse: get('strasse'),
            plz: cleanPlz(get('plz')),
            ort: get('ort'),
            vb: get('vb'),
            gruppe: get('gruppe'),
            umsatz: parseNumber(mapping.umsatz ? row[mapping.umsatz] : null),
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lng : null,
            geo: hasCoords ? 'exakt' : 'none'
        });
    });

    return { customers, skipped };
}

/** Excel-Vorlage mit Beispielzeilen erzeugen und herunterladen */
export function downloadTemplate() {
    const rows = [
        {
            'Kundennummer': '10001', 'Kundenname': 'Autohaus Schmidt GmbH',
            'Straße': 'Hauptstraße 12', 'PLZ': '50667', 'Ort': 'Köln',
            'Vertriebsbeauftragter': 'Max Mustermann', 'Vertriebsgruppe': 'Handel', 'Umsatz': 125000
        },
        {
            'Kundennummer': '10002', 'Kundenname': 'Bäckerei Müller KG',
            'Straße': 'Marktplatz 3', 'PLZ': '80331', 'Ort': 'München',
            'Vertriebsbeauftragter': 'Anna Beispiel', 'Vertriebsgruppe': 'Lebensmittel', 'Umsatz': 48000
        },
        {
            'Kundennummer': '10003', 'Kundenname': 'Elektro Weber e.K.',
            'Straße': 'Industrieweg 8', 'PLZ': '04109', 'Ort': 'Leipzig',
            'Vertriebsbeauftragter': 'Max Mustermann', 'Vertriebsgruppe': 'Handwerk', 'Umsatz': 87500
        }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 8 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunden');
    XLSX.writeFile(wb, 'geofuchs-kundenliste-vorlage.xlsx');
}

/** Aktuelle Kundenliste als Excel exportieren */
export function exportCustomers(customers) {
    const rows = customers.map((c) => ({
        'Kundennummer': c.nummer,
        'Kundenname': c.name,
        'Straße': c.strasse,
        'PLZ': c.plz,
        'Ort': c.ort,
        'Vertriebsbeauftragter': c.vb,
        'Vertriebsgruppe': c.gruppe,
        'Umsatz': c.umsatz ?? '',
        'Lat': c.lat ?? '',
        'Lng': c.lng ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunden');
    XLSX.writeFile(wb, `geofuchs-kunden-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Demo-Datensatz: 3 Vertriebsbeauftragte, 3 Gruppen, quer durch Deutschland */
export function demoCustomers() {
    const data = [
        ['Autohaus Schmidt GmbH', 'Hauptstraße 12', '50667', 'Köln', 'Max Mustermann', 'Handel', 125000],
        ['Sanitär Krause', 'Ehrenfeldgürtel 99', '50823', 'Köln', 'Max Mustermann', 'Handwerk', 43000],
        ['Metallbau Peters', 'Bahnhofstr. 5', '40210', 'Düsseldorf', 'Max Mustermann', 'Industrie', 210000],
        ['Getränke Vogel', 'Ruhrallee 20', '45138', 'Essen', 'Max Mustermann', 'Handel', 66000],
        ['Dachdecker Lorenz', 'Kortumstr. 45', '44787', 'Bochum', 'Max Mustermann', 'Handwerk', 38000],
        ['Logistik Brandt', 'Hafenstr. 1', '47119', 'Duisburg', 'Max Mustermann', 'Industrie', 175000],
        ['Apotheke am Dom', 'Domkloster 2', '50667', 'Köln', 'Max Mustermann', 'Handel', 52000],
        ['Werkzeug Wagner', 'Berliner Allee 30', '30175', 'Hannover', 'Max Mustermann', 'Handel', 91000],

        ['Bäckerei Müller KG', 'Marktplatz 3', '80331', 'München', 'Anna Beispiel', 'Lebensmittel', 48000],
        ['Brauerei Huber', 'Brauhausgasse 7', '94032', 'Passau', 'Anna Beispiel', 'Lebensmittel', 156000],
        ['Metzgerei Alt', 'Sendlinger Str. 21', '80331', 'München', 'Anna Beispiel', 'Lebensmittel', 39000],
        ['Maschinen Sailer', 'Industriestr. 14', '86159', 'Augsburg', 'Anna Beispiel', 'Industrie', 320000],
        ['Hotel Alpenblick', 'Seepromenade 9', '82319', 'Starnberg', 'Anna Beispiel', 'Handel', 74000],
        ['Schreinerei Wimmer', 'Holzweg 4', '93047', 'Regensburg', 'Anna Beispiel', 'Handwerk', 45000],
        ['Autoteile Nürnberg', 'Fürther Str. 88', '90429', 'Nürnberg', 'Anna Beispiel', 'Handel', 118000],
        ['Kaffee Rösterei Blank', 'Maximilianstr. 15', '87435', 'Kempten', 'Anna Beispiel', 'Lebensmittel', 29000],

        ['Hafen Service Nord', 'Am Sandtorkai 40', '20457', 'Hamburg', 'Lena Krüger', 'Industrie', 265000],
        ['Fisch Feinkost Petersen', 'Fischmarkt 11', '20359', 'Hamburg', 'Lena Krüger', 'Lebensmittel', 58000],
        ['Windtechnik Jansen', 'Deichstr. 2', '26382', 'Wilhelmshaven', 'Lena Krüger', 'Industrie', 410000],
        ['Baustoffe Lüders', 'Industriering 6', '28197', 'Bremen', 'Lena Krüger', 'Handel', 133000],
        ['Kieler Segelservice', 'Kaistr. 30', '24103', 'Kiel', 'Lena Krüger', 'Handwerk', 27000],
        ['Druckerei Nordlicht', 'Papierweg 3', '23552', 'Lübeck', 'Lena Krüger', 'Industrie', 88000],
        ['Berlin Bio Markt', 'Prenzlauer Allee 200', '10405', 'Berlin', 'Lena Krüger', 'Lebensmittel', 61000],
        ['Spree Elektro', 'Karl-Marx-Str. 60', '12043', 'Berlin', 'Lena Krüger', 'Handwerk', 49000],
        ['Sächsische Werkzeuge', 'Könneritzstr. 25', '01067', 'Dresden', 'Lena Krüger', 'Industrie', 142000],
        ['Leipziger Kaffeehaus', 'Grimmaische Str. 10', '04109', 'Leipzig', 'Lena Krüger', 'Lebensmittel', 33000]
    ];
    return data.map(([name, strasse, plz, ort, vb, gruppe, umsatz], i) => ({
        id: `demo-${i}`,
        nummer: String(20000 + i),
        name, strasse, plz, ort, vb, gruppe, umsatz,
        lat: null, lng: null, geo: 'none'
    }));
}

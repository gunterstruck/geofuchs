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
    { key: 'channel', label: 'Vertriebschannel',       required: false, synonyms: ['vertriebschannel', 'vertriebskanal', 'channel', 'kanal', 'absatzkanal', 'vertriebsweg', 'saleschannel', 'sales channel', 'vertriebslinie'] },
    { key: 'gruppe',  label: 'Vertriebsgruppe',        required: false, synonyms: ['vertriebsgruppe', 'gruppe', 'kundengruppe', 'kundenkreis', 'segment', 'kategorie', 'sparte', 'branche', 'klasse', 'team'] },
    { key: 'bezirk',  label: 'Betriebsbezirk',         required: false, synonyms: ['betriebsbezirk', 'bezirk', 'vertriebsbezirk', 'verkaufsbezirk', 'gebietsbezirk', 'außendienstbezirk', 'aussendienstbezirk', 'district', 'gebiet'] },
    { key: 'ansprechpartner', label: 'Ansprechpartner', required: false, synonyms: ['ansprechpartner', 'kontaktperson', 'kontakt', 'contact', 'ap', 'ansprechpartner in'] },
    { key: 'telefon', label: 'Telefon',                required: false, synonyms: ['telefon', 'tel', 'telefonnummer', 'phone', 'mobil', 'handy', 'rufnummer', 'festnetz'] },
    { key: 'email',   label: 'E-Mail',                 required: false, synonyms: ['email', 'e-mail', 'mail', 'e mail', 'emailadresse', 'e-mail-adresse'] },
    { key: 'umsatz',  label: 'Umsatz (optional)',      required: false, synonyms: ['umsatz', 'jahresumsatz', 'umsatz €', 'revenue', 'potenzial', 'potential'] },
    { key: 'rhythmusWochen', label: 'Besuchsrhythmus (Wochen)', required: false, synonyms: ['besuchsrhythmus', 'rhythmus', 'rhythmus wochen', 'besuchsintervall', 'intervall', 'turnus', 'besuchsturnus', 'frequenz', 'zyklus wochen'] },
    { key: 'letzterBesuch', label: 'Letzter Besuch (Datum)', required: false, synonyms: ['letzter besuch', 'letzterbesuch', 'besuchsdatum', 'last visit', 'zuletzt besucht', 'letzter kontakt', 'letzter termin'] },
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

function parseWeeks(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseInt(String(value).match(/\d+/)?.[0] ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Datum robust nach ISO (YYYY-MM-DD) parsen; unterstützt dd.mm.yyyy, ISO, Excel-Seriennummer */
function parseDateIso(value) {
    if (value === null || value === undefined || value === '') return null;
    const str = String(value).trim();

    // Excel-Seriennummer (Tage seit 1899-12-30)
    if (/^\d{5}$/.test(str)) {
        const ms = (parseInt(str, 10) - 25569) * 86400 * 1000;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    // dd.mm.yyyy oder dd/mm/yyyy
    let m = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
    if (m) {
        let [, d, mo, y] = m;
        if (y.length === 2) y = `20${y}`;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // yyyy-mm-dd (evtl. mit Zeitanteil)
    m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
        const [, y, mo, d] = m;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
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

        const letzterBesuch = mapping.letzterBesuch ? parseDateIso(row[mapping.letzterBesuch]) : null;

        customers.push({
            id: `k${index}-${name.slice(0, 12)}`,
            nummer: get('nummer'),
            name,
            strasse: get('strasse'),
            plz: cleanPlz(get('plz')),
            ort: get('ort'),
            vb: get('vb'),
            channel: get('channel'),
            gruppe: get('gruppe'),
            bezirk: get('bezirk'),
            ansprechpartner: get('ansprechpartner'),
            telefon: get('telefon'),
            email: get('email'),
            umsatz: parseNumber(mapping.umsatz ? row[mapping.umsatz] : null),
            rhythmusWochen: parseWeeks(mapping.rhythmusWochen ? row[mapping.rhythmusWochen] : null),
            besuche: letzterBesuch ? [letzterBesuch] : [],
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
            'Vertriebsbeauftragter': 'Max Mustermann',
            'Vertriebschannel': 'Fachhandel', 'Vertriebsgruppe': 'Handel', 'Betriebsbezirk': 'Bezirk West',
            'Ansprechpartner': 'Herr Schmidt', 'Telefon': '0221 1234567', 'E-Mail': 'info@autohaus-schmidt.de',
            'Umsatz': 125000, 'Besuchsrhythmus (Wochen)': 6, 'Letzter Besuch': '12.05.2026'
        },
        {
            'Kundennummer': '10002', 'Kundenname': 'Bäckerei Müller KG',
            'Straße': 'Marktplatz 3', 'PLZ': '80331', 'Ort': 'München',
            'Vertriebsbeauftragter': 'Anna Beispiel',
            'Vertriebschannel': 'Direktvertrieb', 'Vertriebsgruppe': 'Lebensmittel', 'Betriebsbezirk': 'Bezirk Süd',
            'Ansprechpartner': 'Frau Müller', 'Telefon': '089 7654321', 'E-Mail': 'kontakt@baeckerei-mueller.de',
            'Umsatz': 48000, 'Besuchsrhythmus (Wochen)': 4, 'Letzter Besuch': '28.06.2026'
        },
        {
            'Kundennummer': '10003', 'Kundenname': 'Elektro Weber e.K.',
            'Straße': 'Industrieweg 8', 'PLZ': '04109', 'Ort': 'Leipzig',
            'Vertriebsbeauftragter': 'Max Mustermann',
            'Vertriebschannel': 'Direktvertrieb', 'Vertriebsgruppe': 'Handwerk', 'Betriebsbezirk': 'Bezirk Ost',
            'Ansprechpartner': '', 'Telefon': '0341 9998877', 'E-Mail': '',
            'Umsatz': 87500, 'Besuchsrhythmus (Wochen)': 8, 'Letzter Besuch': ''
        }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 8 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 12 }, { wch: 20 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunden');
    XLSX.writeFile(wb, 'geofuchs-kundenliste-vorlage.xlsx');
}

/** Aktuelle Kundenliste als Excel exportieren (inkl. Besuchsdaten) */
export function exportCustomers(customers) {
    const rows = customers.map((c) => ({
        'Kundennummer': c.nummer,
        'Kundenname': c.name,
        'Straße': c.strasse,
        'PLZ': c.plz,
        'Ort': c.ort,
        'Vertriebsbeauftragter': c.vb,
        'Vertriebschannel': c.channel ?? '',
        'Vertriebsgruppe': c.gruppe,
        'Betriebsbezirk': c.bezirk ?? '',
        'Ansprechpartner': c.ansprechpartner ?? '',
        'Telefon': c.telefon ?? '',
        'E-Mail': c.email ?? '',
        'Umsatz': c.umsatz ?? '',
        'Besuchsrhythmus (Wochen)': c.rhythmusWochen ?? '',
        'Letzter Besuch': (c.besuche && c.besuche.length) ? c.besuche[c.besuche.length - 1] : '',
        'Lat': c.lat ?? '',
        'Lng': c.lng ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunden');
    XLSX.writeFile(wb, `geofuchs-kunden-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Demo-Datensatz: 3 Vertriebsbeauftragte, je 2 geografisch zusammenhängende
 * Betriebsbezirke (benachbarte Städte/Kreise), quer durch Deutschland.
 * Spalten: [name, straße, plz, ort, vb, gruppe, umsatz, bezirk]
 */
export function demoCustomers() {
    const data = [
        // Max Mustermann – Bezirk Rheinland (Köln/Bonn/Düsseldorf/Leverkusen)
        ['Autohaus Schmidt GmbH', 'Hauptstraße 12', '50667', 'Köln', 'Max Mustermann', 'Handel', 125000, 'Bezirk Rheinland'],
        ['Sanitär Krause', 'Ehrenfeldgürtel 99', '50823', 'Köln', 'Max Mustermann', 'Handwerk', 43000, 'Bezirk Rheinland'],
        ['Bonner Medizintechnik', 'Adenauerallee 8', '53111', 'Bonn', 'Max Mustermann', 'Industrie', 188000, 'Bezirk Rheinland'],
        ['Metallbau Peters', 'Bahnhofstr. 5', '40210', 'Düsseldorf', 'Max Mustermann', 'Industrie', 210000, 'Bezirk Rheinland'],
        ['Rhein Getränke Bayer', 'Kölner Str. 4', '51373', 'Leverkusen', 'Max Mustermann', 'Lebensmittel', 72000, 'Bezirk Rheinland'],
        // Max Mustermann – Bezirk Ruhrgebiet (Essen/Bochum/Dortmund/Duisburg)
        ['Getränke Vogel', 'Ruhrallee 20', '45127', 'Essen', 'Max Mustermann', 'Handel', 66000, 'Bezirk Ruhrgebiet'],
        ['Dachdecker Lorenz', 'Kortumstr. 45', '44787', 'Bochum', 'Max Mustermann', 'Handwerk', 38000, 'Bezirk Ruhrgebiet'],
        ['Westfalen Stahl', 'Hafenstr. 30', '44137', 'Dortmund', 'Max Mustermann', 'Industrie', 245000, 'Bezirk Ruhrgebiet'],
        ['Logistik Brandt', 'Hafenstr. 1', '47051', 'Duisburg', 'Max Mustermann', 'Industrie', 175000, 'Bezirk Ruhrgebiet'],

        // Anna Beispiel – Bezirk Oberbayern (München/Augsburg/Ingolstadt/Rosenheim)
        ['Bäckerei Müller KG', 'Marktplatz 3', '80331', 'München', 'Anna Beispiel', 'Lebensmittel', 48000, 'Bezirk Oberbayern'],
        ['Metzgerei Alt', 'Sendlinger Str. 21', '81667', 'München', 'Anna Beispiel', 'Lebensmittel', 39000, 'Bezirk Oberbayern'],
        ['Maschinen Sailer', 'Industriestr. 14', '86150', 'Augsburg', 'Anna Beispiel', 'Industrie', 320000, 'Bezirk Oberbayern'],
        ['Audi-Zulieferer Ingol', 'Ringstr. 2', '85049', 'Ingolstadt', 'Anna Beispiel', 'Industrie', 410000, 'Bezirk Oberbayern'],
        ['Hotel Alpenblick', 'Seepromenade 9', '83022', 'Rosenheim', 'Anna Beispiel', 'Handel', 74000, 'Bezirk Oberbayern'],
        // Anna Beispiel – Bezirk Franken (Nürnberg/Fürth/Erlangen/Würzburg)
        ['Autoteile Nürnberg', 'Fürther Str. 88', '90402', 'Nürnberg', 'Anna Beispiel', 'Handel', 118000, 'Bezirk Franken'],
        ['Spielwaren Fürth', 'Schwabacher Str. 5', '90762', 'Fürth', 'Anna Beispiel', 'Handel', 54000, 'Bezirk Franken'],
        ['MedTech Erlangen', 'Henkestr. 40', '91052', 'Erlangen', 'Anna Beispiel', 'Industrie', 275000, 'Bezirk Franken'],
        ['Weinkellerei Würzburg', 'Zeller Str. 3', '97070', 'Würzburg', 'Anna Beispiel', 'Lebensmittel', 63000, 'Bezirk Franken'],

        // Lena Krüger – Bezirk Küste (Hamburg/Bremen/Kiel/Lübeck)
        ['Hafen Service Nord', 'Am Sandtorkai 40', '20095', 'Hamburg', 'Lena Krüger', 'Industrie', 265000, 'Bezirk Küste'],
        ['Fisch Feinkost Petersen', 'Fischmarkt 11', '22767', 'Hamburg', 'Lena Krüger', 'Lebensmittel', 58000, 'Bezirk Küste'],
        ['Baustoffe Lüders', 'Industriering 6', '28195', 'Bremen', 'Lena Krüger', 'Handel', 133000, 'Bezirk Küste'],
        ['Kieler Segelservice', 'Kaistr. 30', '24103', 'Kiel', 'Lena Krüger', 'Handwerk', 27000, 'Bezirk Küste'],
        ['Druckerei Nordlicht', 'Papierweg 3', '23552', 'Lübeck', 'Lena Krüger', 'Industrie', 88000, 'Bezirk Küste'],
        // Lena Krüger – Bezirk Ost (Berlin/Potsdam/Leipzig/Dresden)
        ['Berlin Bio Markt', 'Prenzlauer Allee 200', '10115', 'Berlin', 'Lena Krüger', 'Lebensmittel', 61000, 'Bezirk Ost'],
        ['Spree Elektro', 'Karl-Marx-Str. 60', '12043', 'Berlin', 'Lena Krüger', 'Handwerk', 49000, 'Bezirk Ost'],
        ['Havel Handwerk Potsdam', 'Zeppelinstr. 9', '14467', 'Potsdam', 'Lena Krüger', 'Handwerk', 36000, 'Bezirk Ost'],
        ['Leipziger Kaffeehaus', 'Grimmaische Str. 10', '04109', 'Leipzig', 'Lena Krüger', 'Lebensmittel', 33000, 'Bezirk Ost'],
        ['Sächsische Werkzeuge', 'Könneritzstr. 25', '01067', 'Dresden', 'Lena Krüger', 'Industrie', 142000, 'Bezirk Ost']
    ];
    const rhythmChoices = [4, 6, 6, 8, 12];
    // Tage seit letztem Besuch – gemischt, damit Status ok/fällig/überfällig sichtbar wird
    const daysAgoChoices = [7, 20, 45, 70, 110, null];

    // Vertriebschannel (oberste Ebene) aus der Gruppe abgeleitet
    const channelByGruppe = { Handel: 'Fachhandel', Lebensmittel: 'Fachhandel', Handwerk: 'Direktvertrieb', Industrie: 'Key Account' };

    return data.map(([name, strasse, plz, ort, vb, gruppe, umsatz, bezirk], i) => {
        const rhythmusWochen = rhythmChoices[i % rhythmChoices.length];
        const daysAgo = daysAgoChoices[i % daysAgoChoices.length];
        let besuche = [];
        if (daysAgo !== null) {
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            besuche = [d.toISOString().slice(0, 10)];
        }
        return {
            id: `demo-${i}`,
            nummer: String(20000 + i),
            name, strasse, plz, ort, vb,
            channel: channelByGruppe[gruppe] ?? 'Direktvertrieb',
            gruppe,
            bezirk,
            ansprechpartner: '',
            telefon: `0${(1500 + i)} ${100000 + i * 137}`,
            email: `info@${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20)}.de`,
            umsatz,
            rhythmusWochen,
            besuche,
            lat: null, lng: null, geo: 'none'
        };
    });
}

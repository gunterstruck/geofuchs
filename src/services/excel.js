/**
 * Excel-Service
 * Einlesen von Excel-/CSV-Kundenlisten (SheetJS), automatische
 * Spaltenerkennung, Excel-Vorlage und Demo-Daten.
 */

import * as XLSX from 'xlsx';
import { loadPlzCentroids } from './geocode.js';

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
    { key: 'bezirk',  label: 'Vertriebsbezirk',        required: true,  synonyms: ['vertriebsbezirk', 'betriebsbezirk', 'bezirk', 'verkaufsbezirk', 'gebietsbezirk', 'außendienstbezirk', 'aussendienstbezirk', 'district'] },
    { key: 'gebiet',  label: 'Gebiet (nur Flächenzeile: LK oder PLZ)', required: false, synonyms: ['gebiet', 'landkreis', 'lk', 'kreis', 'plz-gebiet', 'plz gebiet', 'fläche', 'flaeche', 'gebietszuweisung', 'nur gebiet'] },
    { key: 'ansprechpartner', label: 'Hauptansprechpartner', required: false, synonyms: ['hauptansprechpartner', 'haupt ansprechpartner', 'ansprechpartner', 'kontaktperson', 'kontakt', 'hauptkontakt', 'primary contact', 'main contact', 'contact', 'ap', 'ansprechpartner in'] },
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
 * Zeilen anhand Mapping einlesen und dabei auf Plausibilität prüfen.
 *
 * Unterscheidet:
 *  - Kundenzeilen (Kundenname vorhanden)
 *  - Flächenzeilen (kein Kundenname, aber „Gebiet" gefüllt) → Gebietszuordnung
 *
 * @returns {{ customers, areaRows, errors, skipped }}
 *   errors: [{ Zeile, Typ: 'Fehler'|'Hinweis', Grund, ...Originalspalten }]
 */
export function parseRows(rows, mapping) {
    const customers = [];
    const areaRows = [];
    const errors = [];
    const seen = new Map(); // Dublettenschlüssel -> erste Zeilennummer
    let skipped = 0;

    const err = (sheetRow, grund, raw, typ = 'Fehler') => errors.push({ Zeile: sheetRow, Typ: typ, Grund: grund, ...raw });

    rows.forEach((row, index) => {
        const sheetRow = index + 2; // Kopfzeile = Zeile 1
        const get = (key) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '');
        const name = get('name');
        const gebiet = get('gebiet');

        // Leere Zeile
        if (!name && !gebiet) { skipped++; return; }

        // Flächenzeile (Gebietszuordnung ohne Kunde)
        if (!name && gebiet) {
            const bezirk = get('bezirk');
            const vb = get('vb');
            if (!bezirk) { err(sheetRow, 'Flächenzeile ohne Vertriebsbezirk', row); return; }
            areaRows.push({ gebiet, bezirk, vb, sheetRow, raw: row });
            return;
        }

        // Kundenzeile
        const bezirk = get('bezirk');
        if (!bezirk) { err(sheetRow, 'Vertriebsbezirk fehlt (Pflichtfeld)', row); return; }

        const plz = cleanPlz(get('plz'));
        const lat = parseCoord(mapping.lat ? row[mapping.lat] : null);
        const lng = parseCoord(mapping.lng ? row[mapping.lng] : null);
        const hasCoords = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        if (!plz && !hasCoords) { err(sheetRow, 'Weder PLZ noch Koordinaten – nicht verortbar', row); return; }

        const nummer = get('nummer');
        const dupKey = nummer ? `nr:${nummer}` : `np:${name.toLowerCase()}|${plz}`;
        if (seen.has(dupKey)) {
            err(sheetRow, `Dublette – ${nummer ? `gleiche Kundennummer` : `gleicher Name + PLZ`} wie Zeile ${seen.get(dupKey)}`, row);
            return;
        }
        seen.set(dupKey, sheetRow);

        const letzterBesuch = mapping.letzterBesuch ? parseDateIso(row[mapping.letzterBesuch]) : null;
        customers.push({
            id: `k${index}-${name.slice(0, 12)}`,
            nummer, name,
            strasse: get('strasse'),
            plz,
            ort: get('ort'),
            vb: get('vb'),
            channel: get('channel'),
            gruppe: get('gruppe'),
            bezirk,
            ansprechpartner: get('ansprechpartner'),
            telefon: get('telefon'),
            email: get('email'),
            umsatz: parseNumber(mapping.umsatz ? row[mapping.umsatz] : null),
            rhythmusWochen: parseWeeks(mapping.rhythmusWochen ? row[mapping.rhythmusWochen] : null),
            besuche: letzterBesuch ? [letzterBesuch] : [],
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lng : null,
            geo: hasCoords ? 'exakt' : 'none',
            _sheetRow: sheetRow,
            _raw: row
        });
    });

    return { customers, areaRows, errors, skipped };
}

/** Fehler-/Hinweisliste als Excel herunterladen */
export function exportErrors(errors, fileBase = 'geofuchs') {
    const ws = XLSX.utils.json_to_sheet(errors);
    ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fehler & Hinweise');
    XLSX.writeFile(wb, `${fileBase}-importfehler-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Excel-Vorlage mit Beispielzeilen erzeugen und herunterladen */
export function downloadTemplate() {
    const rows = [
        {
            'Kundennummer': '10001', 'Kundenname': 'Autohaus Schmidt GmbH',
            'Straße': 'Hauptstraße 12', 'PLZ': '50667', 'Ort': 'Köln',
            'Vertriebsbeauftragter': 'Max Mustermann',
            'Vertriebschannel': 'Fachhandel', 'Vertriebsgruppe': 'Handel', 'Vertriebsbezirk': 'Bezirk West',
            'Gebiet (LK/PLZ)': '',
            'Hauptansprechpartner': 'Herr Schmidt', 'Telefon': '0221 1234567', 'E-Mail': 'info@autohaus-schmidt.de',
            'Umsatz': 125000, 'Besuchsrhythmus (Wochen)': 6, 'Letzter Besuch': '12.05.2026'
        },
        {
            'Kundennummer': '10002', 'Kundenname': 'Bäckerei Müller KG',
            'Straße': 'Marktplatz 3', 'PLZ': '80331', 'Ort': 'München',
            'Vertriebsbeauftragter': 'Anna Beispiel',
            'Vertriebschannel': 'Direktvertrieb', 'Vertriebsgruppe': 'Lebensmittel', 'Vertriebsbezirk': 'Bezirk Süd',
            'Hauptansprechpartner': 'Frau Müller', 'Telefon': '089 7654321', 'E-Mail': 'kontakt@baeckerei-mueller.de',
            'Umsatz': 48000, 'Besuchsrhythmus (Wochen)': 4, 'Letzter Besuch': '28.06.2026'
        },
        {
            'Kundennummer': '10003', 'Kundenname': 'Elektro Weber e.K.',
            'Straße': 'Industrieweg 8', 'PLZ': '04109', 'Ort': 'Leipzig',
            'Vertriebsbeauftragter': 'Max Mustermann',
            'Vertriebschannel': 'Direktvertrieb', 'Vertriebsgruppe': 'Handwerk', 'Vertriebsbezirk': 'Bezirk Ost',
            'Gebiet (LK/PLZ)': '',
            'Hauptansprechpartner': '', 'Telefon': '0341 9998877', 'E-Mail': '',
            'Umsatz': 87500, 'Besuchsrhythmus (Wochen)': 8, 'Letzter Besuch': ''
        },
        {
            // Flächenzeile: nur ein Gebiet einem Bezirk/VB zuordnen (ohne Kunde).
            // „Gebiet" = Landkreis-Name oder PLZ/PLZ-Präfix (z. B. 46 oder 46045).
            'Kundennummer': '', 'Kundenname': '',
            'Straße': '', 'PLZ': '', 'Ort': '',
            'Vertriebsbeauftragter': '',
            'Vertriebschannel': '', 'Vertriebsgruppe': '', 'Vertriebsbezirk': 'Bezirk West',
            'Gebiet (LK/PLZ)': 'Oberhausen',
            'Hauptansprechpartner': '', 'Telefon': '', 'E-Mail': '',
            'Umsatz': '', 'Besuchsrhythmus (Wochen)': '', 'Letzter Besuch': ''
        }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 8 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 12 }, { wch: 20 }, { wch: 16 }];
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
        'Vertriebsbezirk': c.bezirk ?? '',
        'Hauptansprechpartner': c.ansprechpartner ?? '',
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
 * Vertriebsbezirke (benachbarte Städte/Kreise), quer durch Deutschland.
 * Spalten: [name, straße, plz, ort, vb, gruppe, umsatz, bezirk]
 */
/**
 * Umfangreiche, flächendeckende Demodaten.
 * Hierarchie: Channel „Digital" → Vertriebsgruppe (Nord/Ost/Süd) →
 * Vertriebsbezirk (viele, je eine Farbe). Jeder Bezirk ist ein zusammenhängendes
 * Gebiet aus mehreren Landkreisen – realisiert über eine Nächster-Anker-Zuordnung
 * (Voronoi) aller echten deutschen PLZ zu Bezirks-Ankern. So füllt sich ganz
 * Deutschland; die Färbung hängt am Vertriebsbezirk.
 */
export async function demoCustomers() {
    const centroids = await loadPlzCentroids();

    // Bezirks-Anker (Name, Vertriebsgruppe, optionaler VB, Position)
    const anchors = [
        // Nord (inkl. West)
        { name: 'Bezirk Hamburg-Küste',   gruppe: 'Nord', vb: 'Lena Krüger',    lat: 53.55, lng: 9.99 },
        { name: 'Bezirk Bremen-Weser',    gruppe: 'Nord', vb: '',               lat: 53.08, lng: 8.80 },
        { name: 'Bezirk Hannover-Leine',  gruppe: 'Nord', vb: 'Jonas Weber',    lat: 52.37, lng: 9.73 },
        { name: 'Bezirk Ruhr-Dortmund',   gruppe: 'Nord', vb: 'Max Mustermann', lat: 51.51, lng: 7.47 },
        { name: 'Bezirk Rheinland-Köln',  gruppe: 'Nord', vb: 'Max Mustermann', lat: 50.94, lng: 6.96 },
        // Ost
        { name: 'Bezirk Berlin-Spree',    gruppe: 'Ost',  vb: 'Tim Schulz',     lat: 52.52, lng: 13.40 },
        { name: 'Bezirk Rostock-Ostsee',  gruppe: 'Ost',  vb: '',               lat: 54.09, lng: 12.13 },
        { name: 'Bezirk Magdeburg-Elbe',  gruppe: 'Ost',  vb: 'Tim Schulz',     lat: 52.13, lng: 11.63 },
        { name: 'Bezirk Leipzig-Sachsen', gruppe: 'Ost',  vb: 'Nina Hoffmann',  lat: 51.34, lng: 12.37 },
        { name: 'Bezirk Dresden-Elbland', gruppe: 'Ost',  vb: 'Nina Hoffmann',  lat: 51.05, lng: 13.74 },
        // Süd (inkl. Mitte)
        { name: 'Bezirk Frankfurt-Main',  gruppe: 'Süd',  vb: 'Sofia Richter',  lat: 50.11, lng: 8.68 },
        { name: 'Bezirk Stuttgart-Neckar', gruppe: 'Süd', vb: 'Sofia Richter',  lat: 48.78, lng: 9.18 },
        { name: 'Bezirk Freiburg-Schwarzwald', gruppe: 'Süd', vb: '',           lat: 48.00, lng: 7.85 },
        { name: 'Bezirk Franken-Nürnberg', gruppe: 'Süd', vb: 'Anna Beispiel',  lat: 49.45, lng: 11.08 },
        { name: 'Bezirk München-Oberbayern', gruppe: 'Süd', vb: 'Anna Beispiel', lat: 48.14, lng: 11.58 }
    ];

    // Jede PLZ dem nächstgelegenen Anker zuordnen (Voronoi -> zusammenhängende Bezirke)
    const pools = anchors.map(() => []);
    for (const plz in centroids) {
        const [la, ln] = centroids[plz];
        let best = 0, bestD = Infinity;
        for (let a = 0; a < anchors.length; a++) {
            const dl = la - anchors[a].lat, dn = ln - anchors[a].lng;
            const d = dl * dl + dn * dn;
            if (d < bestD) { bestD = d; best = a; }
        }
        pools[best].push(plz);
    }

    // Deterministischer Pseudo-Zufall, damit die Demo bei jedem Laden gleich aussieht
    let seed = 0x9e3779b9;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

    const branchen = ['Autohaus', 'Bäckerei', 'Metallbau', 'Getränke', 'MedTech', 'Baustoffe', 'Elektro', 'Logistik', 'Hotel', 'Feinkost', 'Werkzeuge', 'Maschinenbau', 'Sanitär', 'Druckerei', 'Gartenbau', 'Fliesen', 'Dachdecker', 'Kfz-Service', 'Textil', 'Optik'];
    const namen = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Zimmermann', 'Braun', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Köhler', 'Herrmann', 'König', 'Walter', 'Peters', 'Jung'];
    const rechtsform = [' GmbH', ' KG', ' e.K.', ' GmbH & Co. KG', ' AG', '', ' OHG'];
    const strassen = ['Industriestr.', 'Hauptstr.', 'Bahnhofstr.', 'Marktplatz', 'Gewerbepark', 'Ringstr.', 'Am Hafen'];
    const umsatzChoices = [24000, 33000, 48000, 61000, 79000, 104000, 138000, 176000, 224000, 295000, 360000];
    const rhythmChoices = [4, 6, 6, 8, 12];
    const daysAgoChoices = [7, 20, 45, 70, 110, null];

    const PER_BEZIRK = 150;
    const out = [];
    let i = 0;
    anchors.forEach((anchor, ai) => {
        const pool = pools[ai];
        if (pool.length === 0) return;
        for (let n = 0; n < PER_BEZIRK; n++) {
            const plz = pool[Math.floor(rnd() * pool.length)];
            const name = `${pick(branchen)} ${pick(namen)}${pick(rechtsform)}`;
            const daysAgo = daysAgoChoices[i % daysAgoChoices.length];
            let besuche = [];
            if (daysAgo !== null) {
                const d = new Date();
                d.setDate(d.getDate() - daysAgo);
                besuche = [d.toISOString().slice(0, 10)];
            }
            out.push({
                id: `demo-${i}`,
                nummer: String(20000 + i),
                name,
                strasse: `${pick(strassen)} ${1 + Math.floor(rnd() * 120)}`,
                plz,
                ort: '',
                vb: anchor.vb,
                channel: 'Digital',
                gruppe: anchor.gruppe,
                bezirk: anchor.name,
                ansprechpartner: '',
                telefon: `0${1500 + (i % 8000)} ${100000 + i * 137}`,
                email: `info@${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)}-${i}.de`,
                umsatz: pick(umsatzChoices),
                rhythmusWochen: rhythmChoices[i % rhythmChoices.length],
                besuche,
                lat: null, lng: null, geo: 'none'
            });
            i++;
        }
    });
    return out;
}

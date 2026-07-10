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
    { key: 'gruppe',  label: 'Vertriebsgruppe',        required: false, synonyms: ['vertriebsgruppe', 'gruppe', 'vg neu', 'vg', 'kundengruppe', 'kundenkreis', 'segment', 'kategorie', 'sparte', 'branche', 'klasse', 'team'] },
    { key: 'bezirk',  label: 'Vertriebsbezirk',        required: true,  synonyms: ['vertriebsbezirk', 'betriebsbezirk', 'bezirk', 'vbez neu', 'vbez', 'verkaufsbezirk', 'gebietsbezirk', 'außendienstbezirk', 'aussendienstbezirk', 'district'] },
    { key: 'gebiet',  label: 'Gebiet (nur Flächenzeile: LK oder PLZ)', required: false, synonyms: ['gebiet', 'landkreis', 'lk', 'kreis', 'plz-gebiet', 'plz gebiet', 'fläche', 'flaeche', 'gebietszuweisung', 'nur gebiet'] },
    { key: 'ansprechpartner', label: 'Hauptansprechpartner', required: false, synonyms: ['hauptansprechpartner', 'haupt ansprechpartner', 'ansprechpartner', 'kontaktperson', 'kontakt', 'hauptkontakt', 'primary contact', 'main contact', 'contact', 'ap', 'ansprechpartner in'] },
    { key: 'telefon', label: 'Telefon',                required: false, synonyms: ['telefon', 'tel', 'telefonnummer', 'phone', 'mobil', 'handy', 'rufnummer', 'festnetz'] },
    { key: 'email',   label: 'E-Mail',                 required: false, synonyms: ['email', 'e-mail', 'mail', 'e mail', 'emailadresse', 'e-mail-adresse'] },
    { key: 'umsatz',  label: 'Umsatz (optional)',      required: false, synonyms: ['umsatz', 'jahresumsatz', 'umsatz €', 'revenue', 'potenzial', 'potential'] },
    { key: 'kontaktPrimaer', label: 'Primärkontakt?',  required: false, synonyms: ['primärkontakt', 'primaerkontakt', 'hauptkontakt ja nein', 'hauptkontakt?', 'primary', 'primary contact flag', 'main contact flag', 'ist hauptkontakt', 'standardkontakt'] },
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
    const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
    let workbook;
    if (isCsv) {
        let text;
        try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
            text = new TextDecoder('windows-1252').decode(buffer);
        }
        text = text.replace(/^\uFEFF/, '');
        const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
        const delimiters = [';', ',', '\t'];
        const separator = delimiters.reduce((best, candidate) => (
            firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best
        ), ';');
        workbook = XLSX.read(text, { type: 'string', FS: separator, raw: false });
    } else {
        workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error(isCsv ? 'Die CSV-Datei enthält keine Tabelle.' : 'Die Datei enthält kein Tabellenblatt.');

    // defval: '' damit leere Zellen nicht fehlen; raw: false liefert formatierte Strings
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (rows.length === 0) throw new Error(isCsv ? 'Die CSV-Datei enthält keine Datenzeilen.' : 'Das Tabellenblatt enthält keine Datenzeilen.');

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
    const matchers = [
        { exact: true, fn: (h, s) => h === s },
        { exact: false, fn: (h, s) => h.startsWith(s) },
        { exact: false, fn: (h, s) => h.includes(s) }
    ];

    for (const field of FIELDS) {
        mapping[field.key] = null;
        // exakte Treffer zuerst, dann "beginnt mit"/"enthält"
        for (const matcher of matchers) {
            if (mapping[field.key]) break;
            for (const header of headers) {
                if (used.has(header)) continue;
                const norm = normalizeHeader(header);
                if (field.synonyms.some((s) => (matcher.exact || s.length > 2) && matcher.fn(norm, s))) {
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

/**
 * Betrags-/Zahlenspalte robust einlesen. Excel liefert numerische Zellen bereits
 * als Zahl – die darf nicht wie ein deutsch formatierter String behandelt werden
 * (sonst wird z. B. 1234.56 zu 123456). Strings können deutsch (1.234,56),
 * englisch (1,234.56) oder ohne Gruppierung (45000 / 45.5) formatiert sein.
 */
export function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    let str = String(value).replace(/[^\d.,\-]/g, '');
    if (!str) return null;

    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
        // Beide Trennzeichen: das hintere ist das Dezimaltrennzeichen
        str = lastComma > lastDot
            ? str.replace(/\./g, '').replace(',', '.')
            : str.replace(/,/g, '');
    } else if (lastComma !== -1) {
        const parts = str.split(',');
        // Mehrere Kommas in 3er-Gruppen = englische Tausendertrennung, sonst Dezimalkomma
        str = parts.length > 2 && parts.slice(1).every((p) => p.length === 3)
            ? parts.join('')
            : str.replace(/,/g, '.');
    } else if (lastDot !== -1) {
        const parts = str.split('.');
        // Punkte in 3er-Gruppen = deutsche Tausendertrennung (1.234 / 1.234.567),
        // alles andere (45.5, 12.34) ist ein Dezimalpunkt
        if (parts.slice(1).every((p) => p.length === 3)) str = parts.join('');
    }

    const n = parseFloat(str);
    return Number.isFinite(n) ? n : null;
}

/**
 * Aus der Umsatz-Spaltenüberschrift ableiten, ob die Werte in Tausend Euro
 * (T€, TEUR, Tsd €, k€) oder Millionen (Mio €) angegeben sind. In deutschen
 * kaufmännischen Listen steht der Umsatz häufig verkürzt, z. B. „Umsatz T€"
 * mit Wert 45 statt 45000. Rückgabe ist der Multiplikator (1, 1000, 1_000_000).
 */
export function detectRevenueScale(header) {
    const h = normalizeHeader(header).replace(/\s+/g, ' ');
    if (/\bmio\b|million/.test(h)) return 1_000_000;
    // t€/teur/tsd/tausend/k€/keur als eigenständiges Token, um Fehltreffer zu vermeiden
    if (/t€|k€|\bteur\b|\bkeur\b|\btsd\b|\btsd €|tausend/.test(h)) return 1000;
    return 1;
}

const scaleNumber = (n, scale) => (n === null ? null : n * scale);

/** Deutsche Schreibweise erzwingen: Punkte = Tausender, Komma = Dezimal. */
function parseGermanAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^\d.,\-]/g, '').replace(/\./g, '').replace(',', '.');
    if (!cleaned || cleaned === '-') return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
}

/**
 * Betragsspalte spaltenweit einlesen. Zahlformate sind pro Wert oft mehrdeutig
 * (deutsch „350.070" vs. englisch „350.07"), aber innerhalb einer Spalte
 * einheitlich. Enthält die Spalte eindeutige deutsche Tausenderpunkte
 * (z. B. „189.245", „1.822") und keine englische Tausendertrennung mit Komma,
 * wird die GANZE Spalte deutsch interpretiert – das verhindert, dass einzelne
 * Werte wie „350.070" fälschlich zu 350,07 (1000× zu klein) werden.
 * @returns {{ values: (number|null)[], format: 'de'|'auto' }}
 */
export function parseAmountColumn(rawValues) {
    let deThousands = 0;
    let enThousands = 0;
    let hasComma = 0;
    for (const raw of rawValues) {
        const s = raw === null || raw === undefined ? '' : String(raw).trim();
        if (!s) continue;
        if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) deThousands++;           // 189.245 / 1.234.567
        if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) enThousands++;      // 1,234 / 1,234.56
        if (s.includes(',')) hasComma++;
    }
    const forceGerman = deThousands > 0 && enThousands === 0 && hasComma === 0;
    return {
        values: rawValues.map((v) => (forceGerman ? parseGermanAmount(v) : parseNumber(v))),
        format: forceGerman ? 'de' : 'auto'
    };
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

function parseBool(value) {
    const str = String(value ?? '').trim().toLowerCase();
    return ['1', 'ja', 'j', 'yes', 'y', 'true', 'wahr', 'x', 'primär', 'primaer', 'haupt'].includes(str);
}

function contactFromValues({ nummer, name, telefon, email, primary, sheetRow }) {
    const cleanName = String(name ?? '').trim();
    const cleanPhone = String(telefon ?? '').trim();
    const cleanEmail = String(email ?? '').trim();
    if (!cleanName && !cleanPhone && !cleanEmail) return null;
    return {
        id: `ct-${String(nummer ?? '').trim() || sheetRow}-${sheetRow}`,
        nummer: String(nummer ?? '').trim(),
        name: cleanName,
        telefon: cleanPhone,
        email: cleanEmail,
        primary: !!primary,
        _sheetRow: sheetRow
    };
}

function syncPrimaryContact(customer) {
    const contacts = Array.isArray(customer.contacts) ? customer.contacts.filter(Boolean) : [];
    if (contacts.length === 0) {
        delete customer.contacts;
        return customer;
    }
    const primary = contacts.find((c) => c.primary) || contacts.find((c) => c.name) || contacts[0];
    customer.contacts = contacts.map((c) => ({ ...c, primary: c.id === primary.id }));
    customer.primaryContactId = primary.id;
    customer.ansprechpartner = primary.name || '';
    customer.telefon = primary.telefon || '';
    customer.email = primary.email || '';
    return customer;
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
    const contactRows = [];
    const errors = [];
    const seen = new Map(); // Dublettenschlüssel -> erste Zeilennummer
    const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));
    let skipped = 0;

    const err = (sheetRow, grund, raw, typ = 'Fehler') => errors.push({ Zeile: sheetRow, Typ: typ, Grund: grund, ...raw });

    // Umsatz spaltenweit einlesen (einheitliches Zahlformat) + optionale
    // Skalierung aus der Überschrift (z. B. „Umsatz T€" → ×1000).
    const umsatzScale = mapping.umsatz ? detectRevenueScale(mapping.umsatz) : 1;
    const umsatzColumn = mapping.umsatz
        ? parseAmountColumn(rows.map((r) => r[mapping.umsatz]))
        : { values: [], format: 'auto' };
    const umsatzByRow = umsatzColumn.values.map((n) => scaleNumber(n, umsatzScale));
    if (mapping.umsatz) {
        const total = umsatzByRow.reduce((sum, n) => sum + (n || 0), 0);
        const hinweise = [];
        if (umsatzColumn.format === 'de') hinweise.push('deutsche Tausendertrennung (Punkt) erkannt');
        if (umsatzScale !== 1) hinweise.push(`Einheit ${umsatzScale === 1_000_000 ? 'Millionen' : 'Tausend'} Euro (×${umsatzScale.toLocaleString('de-DE')})`);
        if (hinweise.length) {
            errors.push({
                Zeile: '—', Typ: 'Hinweis',
                Grund: `Umsatzspalte „${mapping.umsatz}": ${hinweise.join(', ')}. Gesamtsumme ${Math.round(total).toLocaleString('de-DE')} €. Bitte prüfen.`
            });
        }
    }

    rows.forEach((row, index) => {
        const sheetRow = index + 2; // Kopfzeile = Zeile 1
        const get = (key) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '');
        const name = get('name');
        const gebiet = get('gebiet');
        const nummer = get('nummer');
        const contact = contactFromValues({
            nummer,
            name: get('ansprechpartner'),
            telefon: get('telefon'),
            email: get('email'),
            primary: parseBool(get('kontaktPrimaer')),
            sheetRow
        });

        // Leere Zeile
        if (!name && !gebiet && !contact) { skipped++; return; }

        // Kontaktdatei: kein Kundenstamm, aber Kontaktinfos mit Kundennummer
        if (!name && !gebiet && contact) {
            if (!nummer) { err(sheetRow, 'Kontaktzeile ohne Kundennummer - Zuordnung nicht möglich', row); return; }
            contactRows.push({ ...contact, raw: row });
            return;
        }

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

        const dupKey = nummer ? `nr:${nummer}` : `np:${name.toLowerCase()}|${plz}`;
        if (seen.has(dupKey)) {
            err(sheetRow, `Dublette – ${nummer ? `gleiche Kundennummer` : `gleicher Name + PLZ`} wie Zeile ${seen.get(dupKey)}`, row);
            return;
        }
        seen.set(dupKey, sheetRow);

        const letzterBesuch = mapping.letzterBesuch ? parseDateIso(row[mapping.letzterBesuch]) : null;
        const extra = Object.fromEntries(Object.entries(row)
            .filter(([header, value]) => !mappedHeaders.has(header) && String(value ?? '').trim() !== '')
            .map(([header, value]) => [header, String(value ?? '').trim()]));
        const customer = {
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
            umsatz: umsatzByRow[index] ?? null,
            rhythmusWochen: parseWeeks(mapping.rhythmusWochen ? row[mapping.rhythmusWochen] : null),
            besuche: letzterBesuch ? [letzterBesuch] : [],
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lng : null,
            geo: hasCoords ? 'exakt' : 'none',
            extra,
            _sheetRow: sheetRow,
            _raw: row
        };
        if (contact) {
            customer.contacts = [{ ...contact, primary: true }];
            customer.primaryContactId = contact.id;
        }
        customers.push(syncPrimaryContact(customer));
    });

    return { customers, areaRows, contactRows, errors, skipped };
}

export function attachContacts(customers, contactRows, errors = []) {
    const byNumber = new Map(customers
        .filter((c) => String(c.nummer ?? '').trim())
        .map((c) => [String(c.nummer).trim(), c]));
    let matched = 0;

    for (const contact of contactRows) {
        const customer = byNumber.get(String(contact.nummer ?? '').trim());
        if (!customer) {
            errors.push({
                Zeile: contact._sheetRow,
                Typ: 'Fehler',
                Grund: `Kontakt konnte keiner Kundennummer zugeordnet werden: ${contact.nummer}`,
                ...(contact.raw || {})
            });
            continue;
        }
        const existing = Array.isArray(customer.contacts) ? customer.contacts : [];
        const next = {
            id: contact.id,
            name: contact.name,
            telefon: contact.telefon,
            email: contact.email,
            primary: contact.primary
        };
        const duplicate = existing.find((c) =>
            (c.name || '') === next.name && (c.telefon || '') === next.telefon && (c.email || '') === next.email);
        if (duplicate) Object.assign(duplicate, next);
        else existing.push(next);
        customer.contacts = existing;
        if (next.primary || !customer.primaryContactId) {
            customer.contacts.forEach((c) => { c.primary = c.id === next.id; });
        }
        syncPrimaryContact(customer);
        matched++;
    }

    return { matched, unmatched: contactRows.length - matched };
}

/** Fehler-/Hinweisliste als Excel herunterladen */
export function exportErrors(errors, fileBase = 'tourfuchs') {
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
    XLSX.writeFile(wb, 'tourfuchs-kundenliste-vorlage.xlsx');
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
    XLSX.writeFile(wb, `tourfuchs-kunden-${new Date().toISOString().slice(0, 10)}.xlsx`);
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

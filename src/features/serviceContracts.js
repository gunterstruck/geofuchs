/**
 * DOM-freie Fachlogik fuer Servicevertraege.
 *
 * Vertraege werden ueber den stabilen Composite-Key
 * Quellsystem + Vertragsnummer identifiziert. Die Beziehung zum Kunden wird
 * ausschliesslich ueber die exakte Kundennummer hergestellt; Namen, PLZ und die
 * importabhaengige interne Kunden-ID sind bewusst keine Fallbacks.
 */

export const SERVICE_CONTRACT_FIELDS = [
    {
        key: 'sourceSystem', label: 'Quellsystem', required: true,
        synonyms: ['quellsystem', 'quelle system', 'source system', 'sourcesystem']
    },
    {
        key: 'contractId', label: 'Vertragsnummer', required: true,
        synonyms: ['vertragsnummer', 'vertrags nr', 'vertrags id', 'servicevertragsnummer', 'service contract id', 'contract id', 'contract number']
    },
    {
        key: 'sourceCustomerId', label: 'Quell-Kunden-ID', required: false,
        synonyms: ['quell kunden id', 'quellkunden id', 'quellsystem kunden id', 'source customer id', 'source account id', 'external customer id']
    },
    {
        key: 'customerNumber', label: 'Kundennummer', required: true,
        synonyms: ['kundennummer', 'kunden nr', 'kunden id', 'debitorennummer', 'debitor', 'customer number', 'customer id', 'account id']
    },
    {
        key: 'title', label: 'Vertragsname', required: false,
        synonyms: ['vertragsname', 'vertragstitel', 'bezeichnung', 'contract name', 'contract title']
    },
    {
        key: 'type', label: 'Vertragstyp', required: false,
        synonyms: ['vertragstyp', 'vertragsart', 'servicevertragstyp', 'contract type', 'service contract type']
    },
    {
        key: 'status', label: 'Status', required: true,
        synonyms: ['vertragsstatus', 'contract status', 'status']
    },
    {
        key: 'startDate', label: 'Vertragsbeginn', required: false,
        synonyms: ['vertragsbeginn', 'startdatum', 'gueltig ab', 'gültig ab', 'contract start', 'start date']
    },
    {
        key: 'endDate', label: 'Vertragsende', required: false,
        synonyms: ['vertragsende', 'enddatum', 'gueltig bis', 'gültig bis', 'contract end', 'end date', 'expiry date']
    },
    {
        key: 'unlimited', label: 'Unbefristet?', required: true,
        synonyms: ['unbefristet', 'unbefristeter vertrag', 'unlimited', 'open ended', 'open ended contract', 'indefinite']
    },
    {
        key: 'cancellationDeadline', label: 'Kündigungsstichtag', required: false,
        synonyms: ['kuendigungsstichtag', 'kündigungsstichtag', 'kuendigen bis', 'kündigen bis', 'cancellation deadline', 'termination deadline', 'notice deadline']
    },
    {
        key: 'actionBy', label: 'Handeln bis', required: false,
        synonyms: ['handeln bis', 'spaetestens handeln bis', 'spätestens handeln bis', 'aktionsdatum', 'entscheidung bis', 'kuendigen bis', 'kündigen bis', 'action by']
    },
    {
        key: 'autoRenewal', label: 'Automatische Verlängerung', required: true,
        synonyms: ['automatische verlaengerung', 'automatische verlängerung', 'auto verlaengerung', 'auto verlängerung', 'auto renewal', 'automatic renewal']
    },
    {
        key: 'renewalMonths', label: 'Verlängerung Monate', required: false,
        synonyms: ['verlaengerung monate', 'verlängerung monate', 'verlaengerungsdauer monate', 'renewal months', 'renewal term months']
    },
    {
        key: 'noticeDays', label: 'Kündigungsfrist Tage', required: false,
        synonyms: ['kuendigungsfrist tage', 'kündigungsfrist tage', 'frist tage', 'notice period days', 'notice days']
    },
    {
        key: 'annualValue', label: 'Jahreswert', required: false,
        synonyms: ['jahreswert eur', 'jahreswert', 'vertragswert eur', 'vertragswert', 'annual contract value', 'annual value', 'contract value']
    },
    {
        key: 'currency', label: 'Währung', required: false,
        synonyms: ['waehrung', 'währung', 'currency', 'currency code']
    },
    {
        key: 'owner', label: 'Verantwortlich', required: false,
        synonyms: ['verantwortlich', 'owner', 'zustaendig', 'zuständig']
    },
    {
        key: 'managerId', label: 'Contract-Manager-ID', required: false,
        synonyms: ['contract manager id', 'vertragsmanager id', 'manager id', 'owner id']
    },
    {
        key: 'manager', label: 'Contract Manager', required: false,
        synonyms: ['contract manager', 'contract manager name', 'vertragsmanager', 'vertragsmanager name', 'service contract manager', 'manager name']
    },
    {
        key: 'managerEmail', label: 'Contract-Manager-E-Mail', required: false,
        synonyms: ['contract manager e mail', 'vertragsmanager e mail', 'manager e mail', 'manager email', 'owner email']
    },
    {
        key: 'dataAsOf', label: 'Datenstand', required: true,
        synonyms: ['datenstand', 'stand datum', 'snapshot datum', 'data as of', 'last updated']
    },
    {
        key: 'scope', label: 'Leistungsumfang', required: false,
        synonyms: ['leistungsumfang', 'leistungen', 'vertragsinhalt', 'scope', 'service scope']
    },
    {
        key: 'sla', label: 'SLA', required: false,
        synonyms: ['sla', 'service level agreement']
    },
    {
        key: 'slaResponseHours', label: 'SLA-Reaktionszeit (Stunden)', required: false,
        synonyms: ['sla reaktionszeit stunden', 'sla reaktionszeit std', 'reaktionszeit stunden', 'reaktionszeit std', 'response hours', 'sla response hours']
    },
    {
        key: 'slaResolutionHours', label: 'SLA-Lösungszeit (Stunden)', required: false,
        synonyms: ['sla loesungszeit stunden', 'sla lösungszeit stunden', 'sla loesungszeit std', 'sla lösungszeit std', 'loesungszeit stunden', 'loesungszeit std', 'resolution hours', 'sla resolution hours']
    },
    {
        key: 'slaTimeBasis', label: 'SLA-Zeitbasis', required: false,
        synonyms: ['sla zeitbasis', 'zeitbasis', 'servicezeit', 'sla time basis', 'business hours basis']
    },
    {
        key: 'maintenanceIntervalMonths', label: 'Wartungsintervall (Monate)', required: false,
        synonyms: ['wartungsintervall monate', 'wartungszyklus monate', 'maintenance interval months', 'maintenance months']
    },
    {
        key: 'criticality', label: 'Kritikalität', required: false,
        synonyms: ['kritikalitaet', 'kritikalität', 'kritischkeit', 'criticality', 'asset criticality']
    },
    {
        key: 'siteId', label: 'Standort-ID', required: false,
        synonyms: ['standort id', 'standortnummer', 'werk id', 'site id', 'location id']
    },
    {
        key: 'assetIds', label: 'Anlagen-IDs', required: false,
        synonyms: ['anlagen ids', 'anlagen id', 'equipment ids', 'equipment id', 'asset ids', 'asset id']
    },
    {
        key: 'sourceUrl', label: 'Quell-Link', required: false,
        synonyms: ['quell link', 'quelllink', 'source url', 'source link', 'sap link', 'salesforce link', 'url', 'link']
    },
    {
        key: 'note', label: 'Notiz', required: false,
        synonyms: ['notiz', 'bemerkung', 'kommentar', 'note', 'comment']
    }
];

const DAY_MS = 24 * 60 * 60 * 1000;

function textValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).normalize('NFKC').replace(/\u00a0/g, ' ').trim();
}

function normalizeHeader(value) {
    return textValue(value).toLowerCase()
        .replace(/ß/g, 'ss')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[._\-/()]/g, ' ')
        .replace(/\s+/g, ' ');
}

function canonicalKeyPart(value) {
    return textValue(value).toLocaleUpperCase('de-DE');
}

function contractCompositeId(sourceSystem, contractId) {
    const sourceKey = canonicalKeyPart(sourceSystem);
    const contractKey = canonicalKeyPart(contractId);
    return `sc:${encodeURIComponent(sourceKey)}:${encodeURIComponent(contractKey)}`;
}

/**
 * Exakte Kundennummer fuer den Join. Nur Unicode-/Rand-Leerzeichen werden
 * normalisiert; insbesondere bleiben fuehrende Nullen, Satzzeichen,
 * Binnen-Leerzeichen und Gross-/Kleinschreibung erhalten.
 */
export function normalizeCustomerNumber(value) {
    return textValue(value);
}

/** Automatische, kollisionsfreie Spaltenzuordnung fuer Vertragsdateien. */
export function autoDetectServiceContractMapping(headers) {
    const list = Array.isArray(headers) ? headers : [];
    const mapping = {};
    const used = new Set();
    const matchers = [
        (header, synonym) => header === synonym,
        (header, synonym) => synonym.length > 3 && header.startsWith(synonym),
        (header, synonym) => synonym.length > 3 && header.includes(synonym)
    ];

    for (const field of SERVICE_CONTRACT_FIELDS) {
        mapping[field.key] = null;
        const synonyms = field.synonyms.map(normalizeHeader);
        for (const matches of matchers) {
            if (mapping[field.key]) break;
            for (const header of list) {
                if (used.has(header)) continue;
                const normalized = normalizeHeader(header);
                if (synonyms.some((synonym) => matches(normalized, synonym))) {
                    mapping[field.key] = header;
                    used.add(header);
                    break;
                }
            }
        }
    }
    return mapping;
}

function isValidCalendarDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

/** Nur YYYY-MM-DD und D.M.YYYY/DD.MM.YYYY sind zulaessig. */
function parseStrictDate(value) {
    const raw = textValue(value);
    if (!raw) return { value: null, valid: true };

    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return { value: null, valid: false };

    const isoInput = /^\d{4}-/.test(raw);
    const year = Number(isoInput ? match[1] : match[3]);
    const month = Number(match[2]);
    const day = Number(isoInput ? match[3] : match[1]);
    if (!isValidCalendarDate(year, month, day)) return { value: null, valid: false };
    return {
        value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        valid: true
    };
}

function todayIso(today) {
    if (today instanceof Date && !Number.isNaN(today.getTime())) {
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    if (today !== undefined && today !== null) {
        const parsed = parseStrictDate(today);
        return parsed.valid ? parsed.value : null;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dateToUtcMs(iso) {
    const parsed = parseStrictDate(iso);
    if (!parsed.valid || !parsed.value) return null;
    const [year, month, day] = parsed.value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
}

function parseBoolean(value) {
    const raw = textValue(value).toLowerCase();
    if (!raw) return { value: null, valid: true };
    if (['1', 'ja', 'j', 'yes', 'y', 'true', 'wahr', 'x', 'automatisch'].includes(raw)) {
        return { value: true, valid: true };
    }
    if (['0', 'nein', 'n', 'no', 'false', 'falsch', 'manuell'].includes(raw)) {
        return { value: false, valid: true };
    }
    return { value: null, valid: false };
}

const STATUS_ALIASES = new Map([
    ['aktiv', 'AKTIV'],
    ['active', 'AKTIV'],
    ['in verlaengerung', 'IN_VERLAENGERUNG'],
    ['in verlangerung', 'IN_VERLAENGERUNG'],
    ['in renewal', 'IN_VERLAENGERUNG'],
    ['renewal', 'IN_VERLAENGERUNG'],
    ['renewing', 'IN_VERLAENGERUNG'],
    ['gekuendigt', 'GEKUENDIGT'],
    ['gekundigt', 'GEKUENDIGT'],
    ['cancelled', 'GEKUENDIGT'],
    ['canceled', 'GEKUENDIGT'],
    ['terminated', 'GEKUENDIGT'],
    ['abgelaufen', 'ABGELAUFEN'],
    ['expired', 'ABGELAUFEN'],
    ['entwurf', 'ENTWURF'],
    ['draft', 'ENTWURF'],
    ['pausiert', 'PAUSIERT'],
    ['paused', 'PAUSIERT'],
    ['suspended', 'PAUSIERT']
]);

function parseStatus(value) {
    const raw = textValue(value);
    if (!raw) return { value: null, valid: true };
    const normalized = normalizeHeader(raw).replace(/_/g, ' ');
    const canonical = STATUS_ALIASES.get(normalized);
    return canonical
        ? { value: canonical, valid: true }
        : { value: null, valid: false };
}

function parseInteger(value, { min = 0 } = {}) {
    const raw = textValue(value);
    if (!raw) return { value: null, valid: true };
    if (!/^\d+$/.test(raw)) return { value: null, valid: false };
    const number = Number(raw);
    return Number.isSafeInteger(number) && number >= min
        ? { value: number, valid: true }
        : { value: null, valid: false };
}

/** Wie beim Kundenimport: Excel-Zahlen sowie deutsche/englische Schreibweisen. */
function parseAmount(value) {
    if (value === null || value === undefined || value === '') return { value: null, valid: true };
    if (typeof value === 'number') {
        return Number.isFinite(value)
            ? { value, valid: true }
            : { value: null, valid: false };
    }

    let raw = String(value).replace(/[^\d.,\-]/g, '');
    if (!raw || raw === '-') return { value: null, valid: false };
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
        raw = lastComma > lastDot
            ? raw.replace(/\./g, '').replace(',', '.')
            : raw.replace(/,/g, '');
    } else if (lastComma !== -1) {
        const parts = raw.split(',');
        raw = parts.length > 2 && parts.slice(1).every((part) => part.length === 3)
            ? parts.join('')
            : raw.replace(/,/g, '.');
    } else if (lastDot !== -1) {
        const parts = raw.split('.');
        if (parts.slice(1).every((part) => part.length === 3)) raw = parts.join('');
    }
    const number = Number(raw);
    return Number.isFinite(number)
        ? { value: number, valid: true }
        : { value: null, valid: false };
}

function safeHttpUrl(value) {
    const raw = textValue(value);
    if (!raw) return { value: '', valid: true };
    try {
        const url = new URL(raw);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
            return { value: '', valid: false };
        }
        return { value: url.href, valid: true };
    } catch {
        return { value: '', valid: false };
    }
}

function issue(rawRow, sheetRow, type, code, field, message) {
    return {
        ...(rawRow && typeof rawRow === 'object' ? rawRow : {}),
        Zeile: sheetRow,
        Typ: type,
        Grund: message,
        code,
        field
    };
}

function mappedValue(row, mapping, key) {
    const header = mapping?.[key];
    return header ? row?.[header] : '';
}

function isBlankRow(row) {
    return !row || Object.values(row).every((value) => textValue(value) === '');
}

/**
 * Vertragszeilen parsen und normalisieren.
 *
 * `skipped` umfasst leere und wegen Fehlern verworfene Zeilen. Warnungen
 * (etwa fehlendes Handeln-bis oder ein unsicherer Link) lassen den Vertrag im
 * Ergebnis; unsichere Links werden dabei nicht gespeichert.
 */
export function parseServiceContractRows(rows, mapping, { today } = {}) {
    const inputRows = Array.isArray(rows) ? rows : [];
    const contracts = [];
    const errors = [];
    const warnings = [];
    const seen = new Map();
    const referenceToday = todayIso(today);
    let skipped = 0;

    for (const [index, rawRow] of inputRows.entries()) {
        const sheetRow = index + 2;
        if (isBlankRow(rawRow)) {
            skipped++;
            continue;
        }

        const sourceSystem = canonicalKeyPart(mappedValue(rawRow, mapping, 'sourceSystem'));
        const contractId = textValue(mappedValue(rawRow, mapping, 'contractId'));
        const customerNumber = normalizeCustomerNumber(mappedValue(rawRow, mapping, 'customerNumber'));
        let fatal = false;

        const requireValue = (value, key, label) => {
            if (value) return;
            errors.push(issue(rawRow, sheetRow, 'Fehler', `missing-${key}`, key, `${label} fehlt.`));
            fatal = true;
        };
        requireValue(sourceSystem, 'source-system', 'Quellsystem');
        requireValue(contractId, 'contract-id', 'Vertragsnummer');
        requireValue(customerNumber, 'customer-number', 'Kundennummer');
        if (fatal) {
            skipped++;
            continue;
        }

        const sourceKey = canonicalKeyPart(sourceSystem);
        const contractKey = canonicalKeyPart(contractId);
        const id = contractCompositeId(sourceSystem, contractId);
        if (seen.has(id)) {
            errors.push(issue(
                rawRow,
                sheetRow,
                'Fehler',
                'duplicate-contract',
                'contractId',
                `Doppelter Vertrag ${sourceSystem}/${contractId}; erster Treffer in Zeile ${seen.get(id)}.`
            ));
            skipped++;
            continue;
        }

        const status = parseStatus(mappedValue(rawRow, mapping, 'status'));
        if (!textValue(mappedValue(rawRow, mapping, 'status'))) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'missing-status', 'status', 'Status fehlt.'));
            fatal = true;
        } else if (!status.valid) {
            errors.push(issue(
                rawRow,
                sheetRow,
                'Fehler',
                'invalid-status',
                'status',
                'Status ist unbekannt. Erlaubt sind AKTIV, IN_VERLAENGERUNG, GEKUENDIGT, ABGELAUFEN, ENTWURF und PAUSIERT.'
            ));
            fatal = true;
        }

        const dateFields = [
            ['startDate', 'Vertragsbeginn'],
            ['endDate', 'Vertragsende'],
            ['cancellationDeadline', 'Kündigungsstichtag'],
            ['actionBy', 'Handeln bis'],
            ['dataAsOf', 'Datenstand']
        ];
        const dates = {};
        for (const [key, label] of dateFields) {
            const parsed = parseStrictDate(mappedValue(rawRow, mapping, key));
            dates[key] = parsed.value;
            if (!parsed.valid) {
                errors.push(issue(
                    rawRow,
                    sheetRow,
                    'Fehler',
                    'invalid-date',
                    key,
                    `${label} ist ungültig. Erlaubt sind YYYY-MM-DD und DD.MM.YYYY.`
                ));
                fatal = true;
            }
        }
        if (!dates.dataAsOf) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'missing-data-as-of', 'dataAsOf', 'Datenstand fehlt.'));
            fatal = true;
        }

        const unlimited = parseBoolean(mappedValue(rawRow, mapping, 'unlimited'));
        if (!unlimited.valid) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-boolean', 'unlimited', 'Unbefristet muss Ja/Nein sein.'));
            fatal = true;
        } else if (unlimited.value === null) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'missing-unlimited', 'unlimited', 'Unbefristet fehlt.'));
            fatal = true;
        }
        const autoRenewal = parseBoolean(mappedValue(rawRow, mapping, 'autoRenewal'));
        if (!autoRenewal.valid) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-boolean', 'autoRenewal', 'Automatische Verlängerung muss Ja/Nein sein.'));
            fatal = true;
        } else if (autoRenewal.value === null) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'missing-auto-renewal', 'autoRenewal', 'Automatische Verlängerung fehlt.'));
            fatal = true;
        }
        const renewalMonths = parseInteger(mappedValue(rawRow, mapping, 'renewalMonths'));
        if (!renewalMonths.valid) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-integer', 'renewalMonths', 'Verlängerung Monate muss eine nichtnegative ganze Zahl sein.'));
            fatal = true;
        }
        const noticeDays = parseInteger(mappedValue(rawRow, mapping, 'noticeDays'));
        if (!noticeDays.valid) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-integer', 'noticeDays', 'Kündigungsfrist Tage muss eine nichtnegative ganze Zahl sein.'));
            fatal = true;
        }
        const annualValue = parseAmount(mappedValue(rawRow, mapping, 'annualValue'));
        if (!annualValue.valid || (annualValue.value !== null && annualValue.value < 0)) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-amount', 'annualValue', 'Jahreswert muss ein nichtnegativer Betrag sein.'));
            fatal = true;
        }
        const currencyRaw = textValue(mappedValue(rawRow, mapping, 'currency')).toUpperCase();
        if (currencyRaw && !/^[A-Z]{3}$/.test(currencyRaw)) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-currency', 'currency', 'Währung muss ein dreistelliger Code wie EUR sein.'));
            fatal = true;
        }
        if (annualValue.value !== null && !currencyRaw) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'missing-currency', 'currency', 'Währung fehlt zum Jahreswert.'));
            fatal = true;
        }

        const slaResponseHours = parseAmount(mappedValue(rawRow, mapping, 'slaResponseHours'));
        if (!slaResponseHours.valid || (slaResponseHours.value !== null && slaResponseHours.value < 0)) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-hours', 'slaResponseHours', 'SLA-Reaktionszeit muss eine nichtnegative Stundenzahl sein.'));
            fatal = true;
        }
        const slaResolutionHours = parseAmount(mappedValue(rawRow, mapping, 'slaResolutionHours'));
        if (!slaResolutionHours.valid || (slaResolutionHours.value !== null && slaResolutionHours.value < 0)) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-hours', 'slaResolutionHours', 'SLA-Lösungszeit muss eine nichtnegative Stundenzahl sein.'));
            fatal = true;
        }
        const maintenanceIntervalMonths = parseInteger(mappedValue(rawRow, mapping, 'maintenanceIntervalMonths'), { min: 1 });
        if (!maintenanceIntervalMonths.valid) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'invalid-integer', 'maintenanceIntervalMonths', 'Wartungsintervall muss eine positive ganze Monatszahl sein.'));
            fatal = true;
        }

        if (unlimited.value === false && !dates.endDate) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'missing-end-date', 'endDate', 'Vertragsende fehlt bei einem befristeten Vertrag.'));
            fatal = true;
        }
        if (autoRenewal.value === true && (renewalMonths.value === null || renewalMonths.value < 1)) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'missing-renewal-months', 'renewalMonths', 'Verlängerung Monate fehlt bei automatischer Verlängerung.'));
            fatal = true;
        }
        if (dates.startDate && dates.endDate && dates.startDate > dates.endDate) {
            errors.push(issue(rawRow, sheetRow, 'Fehler', 'date-order', 'endDate', 'Vertragsende liegt vor Vertragsbeginn.'));
            fatal = true;
        }
        if (fatal) {
            skipped++;
            continue;
        }

        const sourceUrl = safeHttpUrl(mappedValue(rawRow, mapping, 'sourceUrl'));
        if (!sourceUrl.valid) {
            warnings.push(issue(
                rawRow,
                sheetRow,
                'Hinweis',
                'invalid-source-url',
                'sourceUrl',
                'Quell-Link wurde nicht übernommen; erlaubt sind nur vollständige http-/https-URLs.'
            ));
        }
        if (unlimited.value === true && dates.endDate) {
            warnings.push(issue(rawRow, sheetRow, 'Hinweis', 'unlimited-with-end-date', 'endDate', 'Unbefristeter Vertrag enthält zusätzlich ein Vertragsende.'));
        }
        if (!dates.actionBy) {
            // Bewusst keine Ableitung aus Vertragsende, Freitext oder Frist.
            warnings.push(issue(
                rawRow,
                sheetRow,
                'Hinweis',
                'missing-action-by',
                'actionBy',
                'Handeln bis fehlt; der Vertrag erscheint ohne Frist im Radar.'
            ));
        } else if (dates.endDate && dates.actionBy > dates.endDate) {
            warnings.push(issue(rawRow, sheetRow, 'Hinweis', 'action-after-end', 'actionBy', 'Handeln bis liegt nach dem Vertragsende.'));
        }
        if (referenceToday && dates.dataAsOf && dates.dataAsOf > referenceToday) {
            warnings.push(issue(rawRow, sheetRow, 'Hinweis', 'future-data-date', 'dataAsOf', 'Datenstand liegt in der Zukunft.'));
        }

        const assetIds = textValue(mappedValue(rawRow, mapping, 'assetIds'))
            .split(/[;,|\n]/)
            .map(textValue)
            .filter(Boolean);

        contracts.push({
            id,
            sourceSystem,
            sourceKey,
            contractId,
            contractKey,
            customerNumber,
            sourceCustomerId: textValue(mappedValue(rawRow, mapping, 'sourceCustomerId')),
            title: textValue(mappedValue(rawRow, mapping, 'title')),
            type: textValue(mappedValue(rawRow, mapping, 'type')),
            status: status.value,
            startDate: dates.startDate,
            endDate: dates.endDate,
            unlimited: unlimited.value,
            cancellationDeadline: dates.cancellationDeadline,
            actionBy: dates.actionBy,
            autoRenewal: autoRenewal.value,
            renewalMonths: renewalMonths.value,
            noticeDays: noticeDays.value,
            annualValue: annualValue.value,
            currency: currencyRaw,
            owner: textValue(mappedValue(rawRow, mapping, 'owner')),
            managerId: textValue(mappedValue(rawRow, mapping, 'managerId')),
            manager: textValue(mappedValue(rawRow, mapping, 'manager')),
            managerEmail: textValue(mappedValue(rawRow, mapping, 'managerEmail')),
            dataAsOf: dates.dataAsOf,
            scope: textValue(mappedValue(rawRow, mapping, 'scope')),
            sla: textValue(mappedValue(rawRow, mapping, 'sla')),
            slaResponseHours: slaResponseHours.value,
            slaResolutionHours: slaResolutionHours.value,
            slaTimeBasis: textValue(mappedValue(rawRow, mapping, 'slaTimeBasis')),
            maintenanceIntervalMonths: maintenanceIntervalMonths.value,
            criticality: textValue(mappedValue(rawRow, mapping, 'criticality')),
            siteId: textValue(mappedValue(rawRow, mapping, 'siteId')),
            assetIds,
            sourceUrl: sourceUrl.value,
            note: textValue(mappedValue(rawRow, mapping, 'note'))
        });
        seen.set(id, sheetRow);
    }

    // Strukturierte Identitaeten zusaetzlich zu den Originalspalten ablegen.
    // Damit kann die Quellenuebersicht Hinweise auch dann korrekt gruppieren,
    // wenn die Datei `sap` schreibt, der Vertrag aber kanonisch `SAP` traegt.
    for (const entry of [...errors, ...warnings]) {
        const rawRow = inputRows[Number(entry.Zeile) - 2];
        entry.sourceSystem = canonicalKeyPart(mappedValue(rawRow, mapping, 'sourceSystem'));
        entry.contractId = textValue(mappedValue(rawRow, mapping, 'contractId'));
        entry.customerNumber = normalizeCustomerNumber(mappedValue(rawRow, mapping, 'customerNumber'));
    }

    return { contracts, errors, warnings, skipped };
}

/**
 * Exakter Vertrags-Kunden-Abgleich.
 * @returns {{matched:Array<{contract:object,customer:object}>, unmatched:Array<object>, ambiguous:Array<{contract:object,customers:Array<object>}>}}
 */
export function linkServiceContracts(contracts, customers) {
    const byNumber = new Map();
    for (const customer of (Array.isArray(customers) ? customers : [])) {
        const number = normalizeCustomerNumber(customer?.nummer ?? customer?.customerNumber);
        if (!number) continue;
        if (!byNumber.has(number)) byNumber.set(number, []);
        byNumber.get(number).push(customer);
    }

    const matched = [];
    const unmatched = [];
    const ambiguous = [];
    for (const contract of (Array.isArray(contracts) ? contracts : [])) {
        const candidates = byNumber.get(normalizeCustomerNumber(contract?.customerNumber)) || [];
        if (candidates.length === 1) matched.push({ contract, customer: candidates[0] });
        else if (candidates.length > 1) ambiguous.push({ contract, customers: candidates });
        else unmatched.push(contract);
    }
    return { matched, unmatched, ambiguous };
}

const SERVICE_PLANNING_STATUSES = new Set(['AKTIV', 'IN_VERLAENGERUNG']);

/**
 * Ein Vertrag ist für die operative Serviceplanung relevant, wenn das
 * Quellsystem ihn ausdrücklich als aktiv oder in Verlängerung kennzeichnet.
 * Laufzeit und Freitext werden bewusst nicht juristisch interpretiert.
 */
export function isPlanningRelevantServiceContract(contract) {
    const status = String(contract?.status ?? '').normalize('NFKC').trim().toLocaleUpperCase('de-DE');
    return SERVICE_PLANNING_STATUSES.has(status);
}

/**
 * IDs der eindeutig per Kundennummer verknüpften Servicekunden.
 * Mehrere relevante Verträge desselben Kunden ergeben weiterhin nur eine ID;
 * unbekannte und mehrdeutige Kundennummern werden nicht aufgenommen.
 */
export function servicePlanningCustomerIds(contracts, customers) {
    const relevant = (Array.isArray(contracts) ? contracts : [])
        .filter(isPlanningRelevantServiceContract);
    const { matched } = linkServiceContracts(relevant, customers);
    return new Set(matched
        .map(({ customer }) => customer?.id)
        .filter((id) => id !== null && id !== undefined && String(id).trim() !== ''));
}

/**
 * Exklusiver Frist-Bucket anhand des expliziten Feldes `actionBy`:
 * 0 = heute/faellig/ueberfaellig, 30 = 1..30 Tage, 90 = 31..90 Tage,
 * 180 = 91..180 Tage, null = spaeter oder ohne gueltige Frist.
 */
export function contractUrgency(contract, today) {
    const days = serviceContractActionDays(contract, today);
    if (days === null) return null;
    if (days <= 0) return 0;
    if (days <= 30) return 30;
    if (days <= 90) return 90;
    if (days <= 180) return 180;
    return null;
}

/** Exakte Kalendertage bis zur expliziten Handlungsfrist, ohne Zeit-/DST-Effekt. */
export function serviceContractActionDays(contract, today) {
    const actionMs = dateToUtcMs(contract?.actionBy);
    const todayMs = dateToUtcMs(todayIso(today));
    if (actionMs === null || todayMs === null) return null;
    return Math.round((actionMs - todayMs) / DAY_MS);
}

/** Kennzahlen fuer Datenquelle und Vertragsradar. Buckets sind exklusiv. */
export function summarizeServiceContracts(contracts, customers, today) {
    const list = Array.isArray(contracts) ? contracts : [];
    const links = linkServiceContracts(list, customers);
    const urgency = { 0: 0, 30: 0, 90: 0, 180: 0, later: 0, missing: 0 };
    const urgencyValue = { 0: 0, 30: 0, 90: 0, 180: 0, later: 0, missing: 0 };
    let annualValue = 0;

    for (const contract of list) {
        const value = Number.isFinite(Number(contract?.annualValue)) ? Number(contract.annualValue) : 0;
        annualValue += value;
        const bucket = contractUrgency(contract, today);
        let key;
        if (bucket !== null) key = String(bucket);
        else {
            const actionMs = dateToUtcMs(contract?.actionBy);
            const currentMs = dateToUtcMs(todayIso(today));
            key = actionMs !== null && currentMs !== null && actionMs > currentMs ? 'later' : 'missing';
        }
        urgency[key]++;
        urgencyValue[key] += value;
    }

    const matchedCustomers = new Set(links.matched.map(({ customer }) => (
        customer?.id ?? normalizeCustomerNumber(customer?.nummer ?? customer?.customerNumber)
    ))).size;
    return {
        total: list.length,
        matched: links.matched.length,
        unmatched: links.unmatched.length,
        ambiguous: links.ambiguous.length,
        matchedCustomers,
        annualValue,
        withActionBy: list.filter((contract) => dateToUtcMs(contract?.actionBy) !== null).length,
        withoutActionBy: list.filter((contract) => dateToUtcMs(contract?.actionBy) === null).length,
        urgency,
        urgencyValue
    };
}

function contractSourceKey(contract) {
    return canonicalKeyPart(contract?.sourceKey || contract?.sourceSystem);
}

function sourceMetaFor(metaBySource, source) {
    return Object.entries(metaBySource || {}).find(([key]) => canonicalKeyPart(key) === source)?.[1] || {};
}

/**
 * Liefert erklärbare Risiken, bevor ein Quell-Snapshot den bisherigen Stand
 * ersetzt. Ein Rückgang kann fachlich korrekt sein, soll aber nie unbemerkt
 * durch einen gefilterten oder älteren Export entstehen.
 */
export function serviceContractReplacementRisks(
    existing,
    incoming,
    existingSources = {},
    incomingSources = {}
) {
    const oldList = Array.isArray(existing) ? existing : [];
    const newList = Array.isArray(incoming) ? incoming : [];
    const incomingGroups = new Map();
    for (const contract of newList) {
        const source = contractSourceKey(contract);
        if (!source) continue;
        if (!incomingGroups.has(source)) incomingGroups.set(source, []);
        incomingGroups.get(source).push(contract);
    }

    const risks = [];
    for (const [source, items] of incomingGroups) {
        const existingCount = oldList.filter((contract) => contractSourceKey(contract) === source).length;
        if (existingCount > 0 && items.length < existingCount) {
            risks.push({ type: 'count-drop', sourceSystem: source, existingCount, incomingCount: items.length });
        }
        const oldDate = textValue(sourceMetaFor(existingSources, source)?.dataAsOf);
        const newMetaDate = textValue(sourceMetaFor(incomingSources, source)?.dataAsOf);
        const newDate = newMetaDate || items.map((contract) => textValue(contract?.dataAsOf)).filter(Boolean).sort()[0] || '';
        if (parseStrictDate(oldDate).valid && parseStrictDate(oldDate).value
            && parseStrictDate(newDate).valid && parseStrictDate(newDate).value
            && newDate < oldDate) {
            risks.push({ type: 'older-snapshot', sourceSystem: source, existingDate: oldDate, incomingDate: newDate });
        }
    }
    return risks;
}

/**
 * Ersetzt ausschliesslich die in `incoming` vertretenen Quellen. Mit
 * `sourceMeta.sourceSystem` kann auch ein bewusst leerer Snapshot eine Quelle
 * leeren. Andere Quellen bleiben unveraendert.
 */
export function mergeServiceContractSources(existing, incoming, sourceMeta = {}) {
    const oldList = Array.isArray(existing) ? existing : [];
    const newList = Array.isArray(incoming) ? incoming : [];
    const replacedSources = new Set(newList.map(contractSourceKey).filter(Boolean));

    if (typeof sourceMeta === 'string') {
        const key = canonicalKeyPart(sourceMeta);
        if (key) replacedSources.add(key);
    } else {
        const metaSources = [
            sourceMeta?.sourceKey,
            sourceMeta?.sourceSystem,
            ...(Array.isArray(sourceMeta?.sourceSystems) ? sourceMeta.sourceSystems : [])
        ];
        metaSources.map(canonicalKeyPart).filter(Boolean).forEach((key) => replacedSources.add(key));
    }

    if (replacedSources.size === 0) return [...oldList];
    const kept = oldList.filter((contract) => !replacedSources.has(contractSourceKey(contract)));
    const uniqueIncoming = new Map();
    for (const contract of newList) {
        const id = contract?.id || contractCompositeId(contract?.sourceSystem, contract?.contractId);
        if (!uniqueIncoming.has(id)) uniqueIncoming.set(id, contract);
    }
    return [...kept, ...uniqueIncoming.values()];
}

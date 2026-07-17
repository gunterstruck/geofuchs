import { describe, expect, it } from 'vitest';
import {
    SERVICE_VISIT_FIELDS,
    autoDetectServiceVisitMapping,
    parseServiceVisitRows,
    isOpenServiceVisit,
    isSchedulableServiceVisit,
    serviceVisitWindow,
    serviceVisitCustomerIds,
    serviceVisitsForCustomer,
    serviceVisitReplacementRisks
} from '../src/features/serviceVisits.js';

const HEADERS = [
    'Quellsystem', 'Einsatz-ID', 'Vorgang-ID', 'Kundennummer', 'Vertrags-Quellsystem',
    'Vertragsnummer', 'Einsatzart / Kurztext', 'Fällig am', 'SLA-Frist', 'Termin von',
    'Termin bis', 'Dauer (Min.)', 'Priorität', 'Benötigte Qualifikation', 'Techniker / Team',
    'Status', 'Datenstand', 'Standort-ID', 'Anlagen-ID', 'Quell-Link', 'Notiz'
];

const MAPPING = autoDetectServiceVisitMapping(HEADERS);

function row(overrides = {}) {
    return {
        Quellsystem: 'SAP',
        'Einsatz-ID': 'WO-100',
        'Vorgang-ID': '10',
        Kundennummer: '0004711',
        'Vertrags-Quellsystem': 'SAP',
        Vertragsnummer: 'SV-1',
        'Einsatzart / Kurztext': 'Wartung Antrieb',
        'Fällig am': '2026-07-17',
        'SLA-Frist': '2026-07-17T14:30',
        'Termin von': '09:00',
        'Termin bis': '12:00',
        'Dauer (Min.)': '90',
        Priorität: 'HOCH',
        'Benötigte Qualifikation': 'Elektro; SPS | Elektro',
        'Techniker / Team': 'Team West',
        Status: 'OFFEN',
        Datenstand: '2026-07-17',
        'Standort-ID': 'SITE-1',
        'Anlagen-ID': 'ASSET-9',
        'Quell-Link': 'https://example.test/work-order/100',
        Notiz: 'Zutritt anmelden',
        ...overrides
    };
}

describe('Serviceeinsatz-Import', () => {
    it('erkennt die vorgesehenen Spalten vollständig und kollisionsfrei', () => {
        expect(Object.keys(MAPPING)).toHaveLength(SERVICE_VISIT_FIELDS.length);
        for (const field of SERVICE_VISIT_FIELDS.filter((item) => item.required)) {
            expect(MAPPING[field.key], field.key).toBeTruthy();
        }
        expect(new Set(Object.values(MAPPING).filter(Boolean)).size)
            .toBe(Object.values(MAPPING).filter(Boolean).length);
    });

    it('normalisiert eine vollständige Einsatzzeile und erhält führende Nullen', () => {
        const result = parseServiceVisitRows([row()], MAPPING, { fileName: 'sap.xlsx' });
        expect(result.errors).toEqual([]);
        expect(result.visits).toHaveLength(1);
        expect(result.visits[0]).toMatchObject({
            sourceSystem: 'SAP', workOrderId: 'WO-100', operationId: '10',
            customerNumber: '0004711', dueDate: '2026-07-17', slaDueAt: '2026-07-17T14:30',
            timeWindowStart: '09:00', timeWindowEnd: '12:00', durationMin: 90,
            priority: 'HOCH', status: 'OFFEN', importedFrom: 'sap.xlsx'
        });
        expect(result.visits[0].requiredSkills).toEqual(['Elektro', 'SPS']);
        expect(result.visits[0].id).toContain('WO-100');
    });

    it('akzeptiert deutsche Datumsformate, lokale Zeitpunkte und P1-Aliase', () => {
        const result = parseServiceVisitRows([row({
            'Einsatz-ID': 'WO-101', 'Fällig am': '18.07.2026', Datenstand: '17.07.2026',
            'Termin von': '2026-07-18 10:00', 'Termin bis': '2026-07-18 12:00',
            Priorität: 'P1', Status: 'in Arbeit'
        })], MAPPING);
        expect(result.errors).toEqual([]);
        expect(result.visits[0]).toMatchObject({
            dueDate: '2026-07-18', timeWindowStart: '2026-07-18T10:00',
            timeWindowEnd: '2026-07-18T12:00', priority: 'KRITISCH', status: 'IN_ARBEIT'
        });
    });

    it('blockiert doppelte Schlüssel und unvollständige Vertrags-/Zeitfensterpaare', () => {
        const result = parseServiceVisitRows([
            row(),
            row({ Vertragsnummer: '', 'Termin bis': '' }),
            row()
        ], MAPPING);
        expect(result.visits).toHaveLength(1);
        expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
            'contract-pair', 'window-pair', 'duplicate'
        ]));
    });

    it('verwirft ungültige Dauer, Fensterreihenfolge, Status und Pflichtdaten', () => {
        const result = parseServiceVisitRows([row({
            'Einsatz-ID': 'WO-X', 'Fällig am': '31.02.2026',
            'Termin von': '12:00', 'Termin bis': '11:00', 'Dauer (Min.)': '0',
            Priorität: 'sofort', Status: 'unbekannt'
        })], MAPPING);
        expect(result.visits).toEqual([]);
        expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
            'invalid-date', 'window-order', 'invalid-duration', 'invalid-priority', 'invalid-status'
        ]));
    });

    it('übernimmt einen unsicheren Link nicht, behält aber die sonst gültige Zeile', () => {
        const result = parseServiceVisitRows([row({ 'Quell-Link': 'javascript:alert(1)' })], MAPPING);
        expect(result.errors).toEqual([]);
        expect(result.warnings[0].code).toBe('invalid-url');
        expect(result.visits[0].sourceUrl).toBe('');
    });
});

describe('Service-Handlungsbedarf', () => {
    const today = new Date(2026, 6, 17, 12, 0, 0);
    const base = { status: 'OFFEN', priority: 'MITTEL' };

    it('trennt offen, blockiert und planbar', () => {
        expect(isOpenServiceVisit({ status: 'BLOCKIERT' })).toBe(true);
        expect(isSchedulableServiceVisit({ status: 'BLOCKIERT' })).toBe(false);
        expect(isOpenServiceVisit({ status: 'ERLEDIGT' })).toBe(false);
    });

    it('definiert Jetzt und Diese Woche ausschließlich aus Einsatzdaten', () => {
        expect(serviceVisitWindow({ ...base, dueDate: '2026-07-16' }, 'now', today)).toBe(true);
        expect(serviceVisitWindow({ ...base, dueDate: '2026-07-17' }, 'now', today)).toBe(true);
        expect(serviceVisitWindow({ ...base, dueDate: '2026-07-18' }, 'now', today)).toBe(false);
        expect(serviceVisitWindow({ ...base, dueDate: '2026-07-18' }, 'week', today)).toBe(true);
        expect(serviceVisitWindow({ ...base, dueDate: '2026-07-21', priority: 'KRITISCH' }, 'now', today)).toBe(true);
        expect(serviceVisitWindow({ ...base, dueDate: '2026-07-21', status: 'ERLEDIGT' }, 'week', today)).toBe(false);
    });

    it('verknüpft nur exakte und eindeutige Kundennummern', () => {
        const customers = [
            { id: 'one', nummer: '0001' }, { id: 'duplicate-a', nummer: '0002' },
            { id: 'duplicate-b', nummer: '0002' }, { id: 'trim-is-not-same', nummer: '1' }
        ];
        const list = [
            { ...base, id: 'a', customerNumber: '0001', dueDate: '2026-07-17' },
            { ...base, id: 'b', customerNumber: '0002', dueDate: '2026-07-17' },
            { ...base, id: 'c', customerNumber: ' 0001 ', dueDate: '2026-07-18' }
        ];
        expect([...serviceVisitCustomerIds(list, customers, 'week', today)]).toEqual(['one']);
        expect(serviceVisitsForCustomer(list, customers[0], { scope: 'week', today })).toHaveLength(2);
    });
});

describe('Einsatzquellen-Sicherheit', () => {
    it('warnt vor kleinerem und älterem Quell-Snapshot', () => {
        const existing = [
            { sourceSystem: 'SAP', dataAsOf: '2026-07-17' },
            { sourceSystem: 'SAP', dataAsOf: '2026-07-17' }
        ];
        const incoming = [{ sourceSystem: 'SAP', dataAsOf: '2026-07-16' }];
        const risks = serviceVisitReplacementRisks(
            existing, incoming,
            { SAP: { count: 2, dataAsOf: '2026-07-17' } },
            { SAP: { count: 1, dataAsOf: '2026-07-16' } }
        );
        expect(risks.map((risk) => risk.type)).toEqual(['count-drop', 'older-snapshot']);
    });
});


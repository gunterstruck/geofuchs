import { describe, expect, it } from 'vitest';
import {
    SERVICE_CONTRACT_FIELDS,
    autoDetectServiceContractMapping,
    contractUrgency,
    isPlanningRelevantServiceContract,
    linkServiceContracts,
    mergeServiceContractSources,
    normalizeCustomerNumber,
    parseServiceContractRows,
    serviceContractActionDays,
    servicePlanningCustomerIds,
    serviceContractReplacementRisks,
    summarizeServiceContracts
} from '../src/features/serviceContracts.js';

const MAPPING = {
    sourceSystem: 'Quellsystem',
    contractId: 'Vertragsnummer',
    sourceCustomerId: 'Quell-Kunden-ID',
    customerNumber: 'Kundennummer',
    title: 'Vertragsname',
    type: 'Vertragstyp',
    status: 'Status',
    startDate: 'Vertragsbeginn',
    endDate: 'Vertragsende',
    unlimited: 'Unbefristet?',
    cancellationDeadline: 'Kündigungsstichtag',
    actionBy: 'Handeln bis',
    autoRenewal: 'Automatische Verlängerung',
    renewalMonths: 'Verlängerung Monate',
    noticeDays: 'Kündigungsfrist Tage',
    annualValue: 'Jahreswert EUR',
    currency: 'Währung',
    owner: 'Verantwortlich',
    managerId: 'Contract-Manager-ID',
    manager: 'Contract Manager',
    managerEmail: 'Contract-Manager-E-Mail',
    dataAsOf: 'Datenstand',
    scope: 'Leistungsumfang',
    sla: 'SLA',
    slaResponseHours: 'SLA-Reaktionszeit (Stunden)',
    slaResolutionHours: 'SLA-Lösungszeit (Stunden)',
    slaTimeBasis: 'SLA-Zeitbasis',
    maintenanceIntervalMonths: 'Wartungsintervall (Monate)',
    criticality: 'Kritikalität',
    siteId: 'Standort-ID',
    assetIds: 'Anlagen-IDs',
    sourceUrl: 'Quell-Link',
    note: 'Notiz'
};

function row(overrides = {}) {
    return {
        Quellsystem: 'SAP',
        Vertragsnummer: 'SV-0001',
        'Quell-Kunden-ID': 'SAP-K-00001234',
        Kundennummer: '00001234',
        Vertragsname: 'Premium Service',
        Vertragstyp: 'Full Service',
        Status: 'Aktiv',
        Vertragsbeginn: '01.01.2026',
        Vertragsende: '2027-12-31',
        'Unbefristet?': 'Nein',
        Kündigungsstichtag: '',
        'Handeln bis': '30.09.2027',
        'Automatische Verlängerung': 'Ja',
        'Verlängerung Monate': '12',
        'Kündigungsfrist Tage': '90',
        'Jahreswert EUR': '125.000,50 €',
        Währung: 'eur',
        Verantwortlich: 'Alex Service',
        'Contract-Manager-ID': 'CM-007',
        'Contract Manager': 'Alex Service',
        'Contract-Manager-E-Mail': 'alex.service@example.com',
        Datenstand: '17.07.2026',
        Leistungsumfang: '24/7 Support',
        SLA: '4h',
        'SLA-Reaktionszeit (Stunden)': '4',
        'SLA-Lösungszeit (Stunden)': '12,5',
        'SLA-Zeitbasis': '24x7',
        'Wartungsintervall (Monate)': '6',
        Kritikalität: 'HOCH',
        'Standort-ID': 'WERK-01',
        'Anlagen-IDs': 'A-001; A-002|A-003',
        'Quell-Link': 'https://example.com/contracts/SV-0001',
        Notiz: 'Prioritaet A',
        Zusatzfeld: 'bleibt erhalten',
        ...overrides
    };
}

function contract(sourceSystem, contractId, customerNumber = '1', extra = {}) {
    const parsed = parseServiceContractRows([
        row({ Quellsystem: sourceSystem, Vertragsnummer: contractId, Kundennummer: customerNumber, ...extra })
    ], MAPPING, { today: '2026-07-17' });
    expect(parsed.errors).toEqual([]);
    return parsed.contracts[0];
}

describe('Servicevertrags-Spalten', () => {
    it('definiert eindeutige Pflichtschlüssel und erkennt typische deutsche/englische Header', () => {
        const required = SERVICE_CONTRACT_FIELDS.filter((field) => field.required).map((field) => field.key);
        expect(required).toEqual([
            'sourceSystem', 'contractId', 'customerNumber', 'status',
            'unlimited', 'autoRenewal', 'dataAsOf'
        ]);

        const mapping = autoDetectServiceContractMapping([
            'Source System', 'Service Contract ID', 'Source Customer ID', 'Customer ID', 'Contract Title',
            'Contract Start', 'Expiry Date', 'Action By', 'Annual Contract Value', 'Source URL'
        ]);
        expect(mapping).toMatchObject({
            sourceSystem: 'Source System',
            contractId: 'Service Contract ID',
            sourceCustomerId: 'Source Customer ID',
            customerNumber: 'Customer ID',
            title: 'Contract Title',
            startDate: 'Contract Start',
            endDate: 'Expiry Date',
            actionBy: 'Action By',
            annualValue: 'Annual Contract Value',
            sourceUrl: 'Source URL'
        });
        expect(new Set(Object.values(mapping).filter(Boolean)).size)
            .toBe(Object.values(mapping).filter(Boolean).length);
    });

    it('erkennt alle Spalten der ausgelieferten Servicevertrags-Vorlage', () => {
        const headers = [
            'Quellsystem', 'Vertrags-ID', 'Kundennummer', 'Status', 'Datenstand', 'Unbefristet',
            'Automatische Verlängerung', 'Vertragsende', 'Verlängerung (Monate)', 'Vertragsbeginn',
            'Vertragsbezeichnung', 'Vertragstyp', 'Kündigungsstichtag', 'Handeln bis', 'Jahreswert',
            'Währung', 'Vertragsmanager-ID', 'Vertragsmanager', 'Manager E-Mail', 'Leistungsumfang',
            'SLA Reaktionszeit (Std.)', 'SLA Lösungszeit (Std.)', 'SLA Zeitbasis',
            'Wartungsintervall (Monate)', 'Servicekritikalität', 'Quelllink',
            'Quellsystem Kunden-ID', 'Notiz'
        ];
        const mapping = autoDetectServiceContractMapping(headers);

        expect(Object.values(mapping).filter(Boolean)).toHaveLength(headers.length);
        expect(mapping).toMatchObject({
            cancellationDeadline: 'Kündigungsstichtag',
            managerEmail: 'Manager E-Mail',
            slaResponseHours: 'SLA Reaktionszeit (Std.)',
            slaResolutionHours: 'SLA Lösungszeit (Std.)',
            sourceCustomerId: 'Quellsystem Kunden-ID'
        });
    });
});

describe('parseServiceContractRows', () => {
    it('normalisiert einen vollständigen Vertrag ohne die führenden Kundennullen zu verlieren', () => {
        const result = parseServiceContractRows([row({ Quellsystem: ' sap ' })], MAPPING, { today: '2026-07-17' });

        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.skipped).toBe(0);
        expect(result.contracts).toHaveLength(1);
        expect(result.contracts[0]).toMatchObject({
            id: 'sc:SAP:SV-0001',
            sourceSystem: 'SAP',
            sourceKey: 'SAP',
            contractId: 'SV-0001',
            customerNumber: '00001234',
            sourceCustomerId: 'SAP-K-00001234',
            type: 'Full Service',
            status: 'AKTIV',
            startDate: '2026-01-01',
            endDate: '2027-12-31',
            unlimited: false,
            actionBy: '2027-09-30',
            autoRenewal: true,
            renewalMonths: 12,
            noticeDays: 90,
            annualValue: 125000.5,
            currency: 'EUR',
            managerId: 'CM-007',
            manager: 'Alex Service',
            managerEmail: 'alex.service@example.com',
            slaResponseHours: 4,
            slaResolutionHours: 12.5,
            slaTimeBasis: '24x7',
            maintenanceIntervalMonths: 6,
            criticality: 'HOCH',
            sourceUrl: 'https://example.com/contracts/SV-0001',
            assetIds: ['A-001', 'A-002', 'A-003']
        });
        expect(result.contracts[0]).not.toHaveProperty('extra');
        expect(JSON.stringify(result.contracts[0])).not.toContain('Zusatzfeld');
        expect(normalizeCustomerNumber('  00001234\u00a0')).toBe('00001234');
        expect(normalizeCustomerNumber('00001234')).not.toBe(normalizeCustomerNumber('1234'));
    });

    it('normalisiert die erlaubten deutschen und englischen Statuswerte kanonisch', () => {
        const variants = [
            ['Aktiv', 'AKTIV'],
            ['In Verlängerung', 'IN_VERLAENGERUNG'],
            ['cancelled', 'GEKUENDIGT'],
            ['expired', 'ABGELAUFEN'],
            ['Entwurf', 'ENTWURF'],
            ['paused', 'PAUSIERT']
        ];
        const result = parseServiceContractRows(variants.map(([status], index) => row({
            Vertragsnummer: `STATUS-${index}`,
            Status: status
        })), MAPPING);

        expect(result.errors).toEqual([]);
        expect(result.contracts.map((item) => item.status)).toEqual(variants.map(([, canonical]) => canonical));
    });

    it('lehnt unbekannte Statuswerte und fehlende MVP-Pflichtfelder ab', () => {
        const result = parseServiceContractRows([
            row({ Vertragsnummer: 'BAD-STATUS', Status: 'Irgendwie aktiv' }),
            row({ Vertragsnummer: 'NO-DATA', Datenstand: '' }),
            row({ Vertragsnummer: 'NO-UNLIMITED', 'Unbefristet?': '' }),
            row({ Vertragsnummer: 'NO-RENEWAL', 'Automatische Verlängerung': '' })
        ], MAPPING);

        expect(result.contracts).toEqual([]);
        expect(result.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
            'invalid-status', 'missing-data-as-of', 'missing-unlimited', 'missing-auto-renewal'
        ]));
        expect(result.skipped).toBe(4);
    });

    it('erzwingt Ende, Verlängerungsdauer und Währung nur unter den jeweiligen Bedingungen', () => {
        const result = parseServiceContractRows([
            row({ Vertragsnummer: 'NO-END', Vertragsende: '', 'Unbefristet?': 'Nein' }),
            row({ Vertragsnummer: 'UNLIMITED', Vertragsende: '', 'Unbefristet?': 'Ja' }),
            row({ Vertragsnummer: 'NO-MONTHS', 'Automatische Verlängerung': 'Ja', 'Verlängerung Monate': '' }),
            row({ Vertragsnummer: 'NO-CURRENCY', Währung: '' })
        ], MAPPING);

        expect(result.contracts.map((item) => item.contractId)).toEqual(['UNLIMITED']);
        expect(result.contracts[0]).toMatchObject({ unlimited: true, endDate: null });
        expect(result.errors.map((entry) => entry.code)).toEqual([
            'missing-end-date', 'missing-renewal-months', 'missing-currency'
        ]);
    });

    it('verwendet Quellsystem + Vertragsnummer als Composite-Key und erkennt nur echte Dubletten', () => {
        const result = parseServiceContractRows([
            row(),
            row({ Vertragsnummer: 'sv-0001', Kundennummer: '00009999' }),
            row({ Quellsystem: 'SieSales', Vertragsnummer: 'SV-0001' })
        ], MAPPING);

        expect(result.contracts.map((item) => item.id)).toEqual([
            'sc:SAP:SV-0001',
            'sc:SIESALES:SV-0001'
        ]);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatchObject({ code: 'duplicate-contract', Zeile: 3, Typ: 'Fehler' });
        expect(result.skipped).toBe(1);
    });

    it('akzeptiert ausschließlich strikte ISO-/deutsche Kalenderdaten', () => {
        const result = parseServiceContractRows([
            row({ Vertragsnummer: 'OK-DE', Vertragsbeginn: '1.2.2026', Vertragsende: '28.02.2026' }),
            row({ Vertragsnummer: 'BAD-DAY', Vertragsbeginn: '31.02.2026' }),
            row({ Vertragsnummer: 'BAD-ISO', Vertragsbeginn: '2026-2-01' }),
            row({ Vertragsnummer: 'BAD-ORDER', Vertragsbeginn: '2027-01-01', Vertragsende: '2026-12-31' })
        ], MAPPING);

        expect(result.contracts).toHaveLength(1);
        expect(result.contracts[0]).toMatchObject({ startDate: '2026-02-01', endDate: '2026-02-28' });
        expect(result.errors.map((entry) => entry.code)).toEqual(['invalid-date', 'invalid-date', 'date-order']);
        expect(result.skipped).toBe(3);
    });

    it('parst Bool und Beträge streng und speichert ausschließlich http-/https-Links', () => {
        const result = parseServiceContractRows([
            row({
                Vertragsnummer: 'SAFE-LINK',
                'Automatische Verlängerung': 'Nein',
                'Jahreswert EUR': '1,234.56',
                'Quell-Link': 'javascript:alert(1)'
            }),
            row({ Vertragsnummer: 'BAD-BOOL', 'Automatische Verlängerung': 'vielleicht' }),
            row({ Vertragsnummer: 'BAD-AMOUNT', 'Jahreswert EUR': 'unbekannt' }),
            row({ Vertragsnummer: 'NEGATIVE-AMOUNT', 'Jahreswert EUR': '-1' })
        ], MAPPING);

        expect(result.contracts).toHaveLength(1);
        expect(result.contracts[0]).toMatchObject({ autoRenewal: false, annualValue: 1234.56, sourceUrl: '' });
        expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'invalid-source-url' }));
        expect(result.errors.map((entry) => entry.code)).toEqual(['invalid-boolean', 'invalid-amount', 'invalid-amount']);
    });

    it('leitet Handeln-bis weder aus Vertragsende noch aus Kündigungsfrist oder Freitext ab', () => {
        const result = parseServiceContractRows([
            row({ 'Handeln bis': '', Vertragsende: '2027-12-31', 'Kündigungsfrist Tage': '90', Notiz: 'Bis Ende September kündigen' })
        ], MAPPING);

        expect(result.contracts[0].actionBy).toBeNull();
        expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'missing-action-by' }));
    });
});

describe('Kundenverknüpfung', () => {
    it('matcht ausschließlich die exakte Kundennummer und behält unbekannte Verträge', () => {
        const contracts = [
            contract('SAP', 'A', '000123'),
            contract('SAP', 'B', '123'),
            contract('SAP', 'C', 'FEHLT')
        ];
        const customers = [
            { id: 'k1', nummer: '000123', name: 'Alpha' },
            { id: 'k2', nummer: '123', name: 'Beta' }
        ];

        const links = linkServiceContracts(contracts, customers);
        expect(links.matched.map(({ contract: item, customer }) => [item.contractId, customer.id]))
            .toEqual([['A', 'k1'], ['B', 'k2']]);
        expect(links.unmatched.map((item) => item.contractId)).toEqual(['C']);
        expect(links.ambiguous).toEqual([]);
    });

    it('meldet doppelte Kundennummern als mehrdeutig statt willkürlich zuzuordnen', () => {
        const item = contract('SAP', 'A', '42');
        const links = linkServiceContracts([item], [
            { id: 'k1', nummer: '42' },
            { id: 'k2', nummer: '42' }
        ]);

        expect(links.matched).toEqual([]);
        expect(links.unmatched).toEqual([]);
        expect(links.ambiguous[0].contract).toBe(item);
        expect(links.ambiguous[0].customers).toHaveLength(2);
    });

    it('klassifiziert nur aktive Verträge und Verträge in Verlängerung als planungsrelevant', () => {
        expect(isPlanningRelevantServiceContract({ status: 'AKTIV' })).toBe(true);
        expect(isPlanningRelevantServiceContract({ status: ' in_verlaengerung ' })).toBe(true);
        expect(isPlanningRelevantServiceContract({ status: 'PAUSIERT' })).toBe(false);
        expect(isPlanningRelevantServiceContract({ status: 'ENTWURF' })).toBe(false);
        expect(isPlanningRelevantServiceContract({ status: 'GEKUENDIGT' })).toBe(false);
        expect(isPlanningRelevantServiceContract({ status: 'ABGELAUFEN' })).toBe(false);
        expect(isPlanningRelevantServiceContract({})).toBe(false);
    });

    it('liefert eindeutige Servicekunden-IDs und dedupliziert mehrere aktive Verträge', () => {
        const customers = [
            { id: 'mit-null', nummer: '000123' },
            { id: 'ohne-null', nummer: '123' },
            { id: 'inaktiv', nummer: '900' }
        ];
        const ids = servicePlanningCustomerIds([
            { ...contract('SAP', 'A', '000123'), status: 'AKTIV' },
            { ...contract('CRM', 'B', '000123'), status: 'IN_VERLAENGERUNG' },
            { ...contract('SAP', 'C', '123'), status: 'AKTIV' },
            { ...contract('SAP', 'D', '900'), status: 'ABGELAUFEN' }
        ], customers);

        expect([...ids]).toEqual(['mit-null', 'ohne-null']);
        expect(ids.size).toBe(2);
    });

    it('nimmt bei doppelt vergebener Kundennummer keinen Kunden in den Planungsscope auf', () => {
        const ids = servicePlanningCustomerIds([
            { ...contract('SAP', 'A', '42'), status: 'AKTIV' }
        ], [
            { id: 'k1', nummer: '42' },
            { id: 'k2', nummer: '42' }
        ]);

        expect([...ids]).toEqual([]);
    });
});

describe('Vertragsdringlichkeit und Zusammenfassung', () => {
    const today = '2026-01-01';

    it('ordnet die Grenzen 0/30/90/180 exklusiv und deterministisch zu', () => {
        expect(serviceContractActionDays({ actionBy: '2025-12-31' }, today)).toBe(-1);
        expect(serviceContractActionDays({ actionBy: '2026-01-25' }, today)).toBe(24);
        expect(serviceContractActionDays({ actionBy: '2026-03-10' }, today)).toBe(68);
        expect(serviceContractActionDays({ actionBy: null }, today)).toBeNull();
        expect(contractUrgency({ actionBy: '2025-12-31' }, today)).toBe(0);
        expect(contractUrgency({ actionBy: '2026-01-01' }, today)).toBe(0);
        expect(contractUrgency({ actionBy: '2026-01-31' }, today)).toBe(30);
        expect(contractUrgency({ actionBy: '2026-02-01' }, today)).toBe(90);
        expect(contractUrgency({ actionBy: '2026-04-01' }, today)).toBe(90);
        expect(contractUrgency({ actionBy: '2026-04-02' }, today)).toBe(180);
        expect(contractUrgency({ actionBy: '2026-06-30' }, today)).toBe(180);
        expect(contractUrgency({ actionBy: '2026-07-01' }, today)).toBeNull();
        expect(contractUrgency({ actionBy: null }, today)).toBeNull();
    });

    it('summiert Verknüpfung, Werte und Frist-Buckets ohne unbekannte Kunden zu verlieren', () => {
        const contracts = [
            { ...contract('SAP', 'A', '1'), actionBy: '2026-01-01', annualValue: 100 },
            { ...contract('SAP', 'B', '2'), actionBy: '2026-01-20', annualValue: 200 },
            { ...contract('SAP', 'C', 'FEHLT'), actionBy: '2026-03-15', annualValue: 300 },
            { ...contract('SAP', 'D', '1'), actionBy: '2026-05-01', annualValue: 400 },
            { ...contract('SAP', 'E', '1'), actionBy: '2027-01-01', annualValue: 500 },
            { ...contract('SAP', 'F', '1'), actionBy: null, annualValue: null }
        ];
        const summary = summarizeServiceContracts(contracts, [
            { id: 'k1', nummer: '1' },
            { id: 'k2', nummer: '2' }
        ], today);

        expect(summary).toMatchObject({
            total: 6,
            matched: 5,
            unmatched: 1,
            ambiguous: 0,
            matchedCustomers: 2,
            annualValue: 1500,
            withActionBy: 5,
            withoutActionBy: 1,
            urgency: { 0: 1, 30: 1, 90: 1, 180: 1, later: 1, missing: 1 }
        });
        expect(summary.urgencyValue).toMatchObject({ 0: 100, 30: 200, 90: 300, 180: 400, later: 500, missing: 0 });
    });
});

describe('mergeServiceContractSources', () => {
    it('ersetzt nur importierte Quellen und bewahrt alle anderen', () => {
        const existing = [
            contract('SAP', 'ALT-1'),
            contract('SAP', 'ALT-2'),
            contract('SieSales', 'CRM-1')
        ];
        const incoming = [contract('SAP', 'NEU-1')];

        const merged = mergeServiceContractSources(existing, incoming);
        expect(merged.map((item) => `${item.sourceSystem}/${item.contractId}`))
            .toEqual(['SIESALES/CRM-1', 'SAP/NEU-1']);
    });

    it('kann über sourceMeta einen bewusst leeren Quell-Snapshot übernehmen', () => {
        const existing = [contract('SAP', 'ALT'), contract('SieSales', 'CRM')];

        const merged = mergeServiceContractSources(existing, [], { sourceSystem: 'sap' });
        expect(merged.map((item) => item.contractId)).toEqual(['CRM']);
    });

    it('verändert ohne erkennbare Ersatzquelle nichts', () => {
        const existing = [contract('SAP', 'ALT')];
        expect(mergeServiceContractSources(existing, [])).toEqual(existing);
        expect(mergeServiceContractSources(existing, [])).not.toBe(existing);
    });
});

describe('serviceContractReplacementRisks', () => {
    it('warnt vor kleineren und älteren Quell-Snapshots', () => {
        const existing = [
            contract('SAP', 'ALT-1'),
            contract('SAP', 'ALT-2'),
            contract('SIESALES', 'CRM-1')
        ];
        const incoming = [contract('sap', 'NEU-1', '1', { Datenstand: '2026-06-01' })];

        expect(serviceContractReplacementRisks(
            existing,
            incoming,
            { Sap: { dataAsOf: '2026-07-01' } },
            { SAP: { dataAsOf: '2026-06-01' } }
        )).toEqual([
            { type: 'count-drop', sourceSystem: 'SAP', existingCount: 2, incomingCount: 1 },
            { type: 'older-snapshot', sourceSystem: 'SAP', existingDate: '2026-07-01', incomingDate: '2026-06-01' }
        ]);
    });

    it('lässt vollständige neue oder gleich aktuelle Snapshots ohne Warnung passieren', () => {
        const existing = [contract('SAP', 'ALT-1')];
        const incoming = [contract('SAP', 'NEU-1'), contract('SAP', 'NEU-2')];
        expect(serviceContractReplacementRisks(
            existing,
            incoming,
            { SAP: { dataAsOf: '2026-07-01' } },
            { SAP: { dataAsOf: '2026-07-17' } }
        )).toEqual([]);
    });
});

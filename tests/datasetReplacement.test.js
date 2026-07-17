import { beforeEach, describe, expect, it } from 'vitest';
import { state, setCustomers, setServiceContracts, setServiceVisits } from '../src/core/state.js';
import { datasetReplacementMessage, hasExistingDataset } from '../src/ui/datasetReplacement.js';

describe('Warnung vor Datensatz-Ersetzung', () => {
    beforeEach(() => {
        state.territories = {};
        setCustomers([], { fileName: null });
        setServiceContracts([], {});
        setServiceVisits([], {});
    });

    it('nennt Umfang, Wirkung und Wiederherstellung vor dem Vollimport', () => {
        setCustomers([{ id: 'alt-1', name: 'Alt' }, { id: 'alt-2', name: 'Alt 2' }]);
        state.territories = { 'plz2:45': { bezirk: 'West' } };

        const message = datasetReplacementMessage({
            incomingCount: 5,
            sourceLabel: 'Die ausgewählte Kundenliste'
        });

        expect(hasExistingDataset()).toBe(true);
        expect(message).toContain('mit 5 Kunden');
        expect(message).toContain('2 bisherige Kunden');
        expect(message).toContain('1 Gebietszuordnung');
        expect(message).toContain('bisherige Tour');
        expect(message).toContain('vorherigen Export');
    });

    it('weist beim Demo-Laden zusätzlich auf das Abschalten des Tresors hin', () => {
        const message = datasetReplacementMessage({
            incomingCount: 2250,
            sourceLabel: 'Die Beispieldaten',
            disablesVault: true
        });

        expect(message).toContain('Datentresor wird dabei deaktiviert');
        expect(message).toContain('PIN entfernt');
    });

    it('erklärt beim Kundenimport, dass separate Verträge erhalten und neu verknüpft werden', () => {
        setServiceContracts([{ sourceSystem: 'SAP', contractId: 'SC-1' }], { SAP: { count: 1 } });

        const preserving = datasetReplacementMessage({ incomingCount: 3 });
        const replacing = datasetReplacementMessage({ incomingCount: 3, replacesContracts: true });

        expect(hasExistingDataset()).toBe(true);
        expect(preserving).toContain('Serviceverträge bleiben erhalten');
        expect(preserving).toContain('über die Kundennummer neu zugeordnet');
        expect(replacing).toContain('1 Servicevertrag');
        expect(replacing).not.toContain('Serviceverträge bleiben erhalten');
    });

    it('behandelt operative Serviceeinsätze beim Erhalten und Vollersatz eindeutig', () => {
        setServiceVisits([
            { sourceSystem: 'SAP', workOrderId: 'WO-1' },
            { sourceSystem: 'OUTREACH', workOrderId: 'WO-2' }
        ], { SAP: { count: 1 }, OUTREACH: { count: 1 } });

        const preserving = datasetReplacementMessage({ incomingCount: 3 });
        const replacing = datasetReplacementMessage({ incomingCount: 3, replacesVisits: true });

        expect(hasExistingDataset()).toBe(true);
        expect(preserving).toContain('Serviceeinsätze bleiben erhalten');
        expect(preserving).toContain('über die Kundennummer neu zugeordnet');
        expect(replacing).toContain('2 Serviceeinsätze');
        expect(replacing).not.toContain('Serviceeinsätze bleiben erhalten');
    });
});

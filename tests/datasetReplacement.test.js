import { beforeEach, describe, expect, it } from 'vitest';
import { state, setCustomers } from '../src/core/state.js';
import { datasetReplacementMessage, hasExistingDataset } from '../src/ui/datasetReplacement.js';

describe('Warnung vor Datensatz-Ersetzung', () => {
    beforeEach(() => {
        state.territories = {};
        setCustomers([], { fileName: null });
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
});

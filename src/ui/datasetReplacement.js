import { state } from '../core/state.js';

export function hasExistingDataset() {
    return state.customers.length > 0
        || Object.keys(state.territories || {}).length > 0
        || state.serviceContracts.length > 0;
}

export function datasetReplacementMessage({
    incomingCount = 0,
    sourceLabel = 'Die neue Kundenliste',
    disablesVault = false,
    replacesContracts = false
} = {}) {
    const existing = [];
    if (state.customers.length) {
        existing.push(state.customers.length === 1
            ? '1 bisherigen Kunden'
            : `${state.customers.length} bisherige Kunden`);
    }
    const territoryCount = Object.keys(state.territories || {}).length;
    if (territoryCount) {
        existing.push(territoryCount === 1
            ? '1 Gebietszuordnung'
            : `${territoryCount} Gebietszuordnungen`);
    }
    const contractCount = state.serviceContracts.length;
    if (replacesContracts && contractCount) {
        existing.push(contractCount === 1
            ? '1 Servicevertrag'
            : `${contractCount} Serviceverträge`);
    }

    const incoming = incomingCount > 0 ? ` mit ${incomingCount} Kunden` : '';
    const replacement = existing.length
        ? `${sourceLabel}${incoming} ersetzt vollständig ${existing.join(' und ')}.`
        : `${sourceLabel}${incoming} wird als neuer vollständiger Datenbestand geladen.`;
    const vault = disablesVault
        ? '\n\nDer Datentresor wird dabei deaktiviert und die bisherige PIN entfernt.'
        : '';
    const contracts = !replacesContracts && contractCount
        ? '\n\nDie separat importierten Serviceverträge bleiben erhalten und werden anschließend über die Kundennummer neu zugeordnet.'
        : '';

    return `${replacement}\n\nDie bisherige Tour sowie nicht in der neuen Datei enthaltene Besuchs- und Gebietsdaten werden entfernt. Alte Daten lassen sich danach nur aus einem vorherigen Export wiederherstellen.${contracts}${vault}\n\nFortfahren?`;
}

export function confirmDatasetReplacement(options = {}) {
    if (!hasExistingDataset() && !options.disablesVault) return true;
    return globalThis.confirm(datasetReplacementMessage(options));
}

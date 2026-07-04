/**
 * GeoFuchs Vertrieb – Einstiegspunkt
 */

import './styles/main.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

import { CONFIG } from './core/config.js';
import { state, emit, setCustomers } from './core/state.js';
import { loadDataset, loadSettings } from './services/storage.js';
import { geocodeByPlz } from './services/geocode.js';
import { initMap } from './features/map.js';
import { initSidebar } from './ui/sidebar.js';
import { initImportWizard } from './ui/importWizard.js';
import { initTourPanel } from './ui/tourPanel.js';
import { initSearch } from './ui/search.js';
import { initToasts } from './ui/toast.js';
import { fitToCustomers } from './features/map.js';

async function restorePersistedState() {
    const settings = await loadSettings();
    if (settings?.level && settings.level in CONFIG.levels && settings.level !== state.level) {
        state.level = settings.level;
        const select = document.getElementById('level-select');
        if (select) select.value = settings.level;
        emit('level:changed');
    }
    if (settings?.radiusKm) state.tour.radiusKm = settings.radiusKm;

    const dataset = await loadDataset();
    if (dataset?.customers?.length) {
        // Sicherheitsnetz: falls ältere Datensätze ohne Koordinaten gespeichert wurden
        await geocodeByPlz(dataset.customers);
        setCustomers(dataset.customers, {
            fileName: dataset.fileName,
            importedAt: dataset.importedAt
        });

        // Persistierte Sichtbarkeiten anwenden
        if (settings?.repVisibility) {
            for (const [name, visible] of Object.entries(settings.repVisibility)) {
                if (state.reps.has(name)) state.reps.get(name).visible = visible;
            }
        }
        if (settings?.groupVisibility) {
            for (const [name, visible] of Object.entries(settings.groupVisibility)) {
                if (state.groups.has(name)) state.groups.get(name).visible = visible;
            }
        }
        emit('customers:changed');
        fitToCustomers();
    }
}

async function init() {
    initToasts();
    initMap('map');
    initSidebar();
    initImportWizard();
    initTourPanel();
    initSearch();

    try {
        await restorePersistedState();
    } catch (error) {
        console.warn('Gespeicherter Zustand konnte nicht wiederhergestellt werden:', error);
    }

    // Info-Dialog
    const infoDialog = document.getElementById('info-dialog');
    document.getElementById('btn-info').addEventListener('click', () => infoDialog.showModal());
    infoDialog.querySelector('.dialog-close').addEventListener('click', () => infoDialog.close());

    console.log('🦊 GeoFuchs Vertrieb bereit.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

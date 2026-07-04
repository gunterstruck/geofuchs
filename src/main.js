/**
 * GeoFuchs Vertrieb – Einstiegspunkt
 */

import './styles/main.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

import { CONFIG } from './core/config.js';
import { state, on, emit, setCustomers } from './core/state.js';
import { loadDataset, saveDataset, loadSettings } from './services/storage.js';
import { geocodeByPlz } from './services/geocode.js';
import { initMap } from './features/map.js';
import { initSidebar } from './ui/sidebar.js';
import { initImportWizard } from './ui/importWizard.js';
import { initTourPanel } from './ui/tourPanel.js';
import { initCockpit } from './ui/cockpit.js';
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
    const validModes = ['auto', 'rep', 'bezirk', 'gruppe', 'status'];
    if (validModes.includes(settings?.colorMode)) {
        state.colorMode = settings.colorMode;
        const sel = document.getElementById('colormode-select');
        if (sel) sel.value = settings.colorMode;
        emit('colormode:changed');
    }

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
        if (settings?.dimVisibility) {
            for (const [dimId, values] of Object.entries(settings.dimVisibility)) {
                const dim = state.dims[dimId];
                if (!dim) continue;
                for (const [name, visible] of Object.entries(values)) {
                    if (dim.values.has(name)) dim.values.get(name).visible = visible;
                }
            }
        }
        emit('customers:changed');
        fitToCustomers();
    }
}

// Kundendaten nach inhaltlichen Änderungen (Besuch, Rhythmus) speichern – gedrosselt
let saveTimer = null;
function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveDataset({
            customers: state.customers,
            fileName: state.fileName,
            importedAt: state.importedAt
        });
    }, 400);
}

async function init() {
    initToasts();
    initMap('map');
    initSidebar();
    initImportWizard();
    initTourPanel();
    initCockpit();
    initSearch();

    on('dataset:dirty', scheduleSave);

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

/**
 * TourFuchs Vertrieb – Einstiegspunkt
 */

import './styles/main.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

import { CONFIG } from './core/config.js';
import { demoCustomersNeedNormalization, normalizeDemoCustomers } from './core/demoSafety.js';
import { state, on, emit, setCustomers, setServiceContracts, setServiceVisits, datasetSnapshot } from './core/state.js';
import { loadDataset, saveDataset, loadSettings, hasStoredDataset } from './services/storage.js';
import { isEnabled as vaultEnabled, isLocked as vaultLocked, removeVaultMeta } from './services/vault.js';
import { enrichPlacesByPlz, geocodeByPlz } from './services/geocode.js';
import { initMap } from './features/map.js';
import { initSidebar, applyMode, autoRevealIfEmpty, showDataView } from './ui/sidebar.js';
import { initImportWizard } from './ui/importWizard.js';
import { initTourPanel } from './ui/tourPanel.js';
import { openReceivedFromUrl } from './ui/tourQr.js';
import { initSafeTransfer } from './ui/safeTransfer.js';
import { decodeTourPayload, TOUR_HASH_KEY } from './features/tourShare.js';
import { initCockpit } from './ui/cockpit.js';
import { initRegionEditor } from './ui/regionEditor.js';
import { initSearch } from './ui/search.js';
import { initNearby } from './ui/nearby.js';
import { initToasts } from './ui/toast.js';
import { initMobilePreview } from './ui/mobilePreview.js';
import { initShowcase } from './ui/showcase.js';
import { initVault } from './ui/lockVault.js';
import { initPwaUpdates } from './ui/pwaUpdate.js';
import { initContextHelp } from './ui/contextHelp.js';
import { initFirstSteps } from './ui/firstSteps.js';
import { initCustomerBriefing } from './ui/customerBriefing.js';
import { initContractRadar } from './ui/contractRadar.js';
import { upgradeDemoServiceContracts } from './features/demoServiceContracts.js';
import { upgradeDemoServiceVisits } from './features/demoServiceVisits.js';
import { fitToCustomers } from './features/map.js';

async function restorePersistedState() {
    const settings = await loadSettings();
    const savedFixedLevel = settings?.fixedLevel ?? settings?.level;
    if (savedFixedLevel && savedFixedLevel in CONFIG.levels) state.fixedLevel = savedFixedLevel;
    // Alte Einstellungen besaßen noch keinen bewussten Auto-/Fixiert-Schalter.
    // Sie starten deshalb im neuen, einfachen Standard: automatisch nach Zoom.
    state.levelMode = settings?.levelMode === 'fixed' ? 'fixed' : 'auto';
    emit('level:control-changed');
    if (settings?.radiusKm) state.tour.radiusKm = settings.radiusKm;
    state.ui.serviceCustomerScope = ['now', 'week', 'contracts', 'all'].includes(settings?.serviceCustomerScope)
        ? settings.serviceCustomerScope
        : 'contracts';
    if (settings?.basemap && CONFIG.tileLayers?.[settings.basemap]) {
        state.basemap = settings.basemap;
        const basemapSelect = document.getElementById('basemap-select');
        if (basemapSelect) basemapSelect.value = state.basemap;
        emit('basemap:changed');
    }
    const validModes = ['auto', 'rep', 'bezirk', 'gruppe', 'status', 'luecken'];
    if (validModes.includes(settings?.colorMode)) {
        state.colorMode = settings.colorMode;
        const sel = document.getElementById('colormode-select');
        if (sel) sel.value = settings.colorMode;
        emit('colormode:changed');
    }

    const dataset = await loadDataset();
    if (dataset?.territories) state.territories = dataset.territories;
    setServiceContracts(dataset?.serviceContracts || [], dataset?.serviceContractSources || {});
    setServiceVisits(dataset?.serviceVisits || [], dataset?.serviceVisitSources || {});
    if (dataset?.customers?.length) {
        let enrichedDemoPlaces = 0;
        let migratedDemoContracts = false;
        let migratedDemoVisits = false;
        const migratedDemoCustomers = demoCustomersNeedNormalization(dataset.customers);
        if (migratedDemoCustomers) normalizeDemoCustomers(dataset.customers);
        if (dataset.fileName === 'Demo-Daten') {
            try {
                enrichedDemoPlaces = await enrichPlacesByPlz(dataset.customers);
            } catch (error) {
                console.warn('Ortsnamen älterer Demodaten konnten nicht ergänzt werden:', error);
            }
        }
        // Sicherheitsnetz: falls ältere Datensätze ohne Koordinaten gespeichert wurden
        await geocodeByPlz(dataset.customers);
        setCustomers(dataset.customers, {
            fileName: dataset.fileName,
            importedAt: dataset.importedAt
        });
        const contractUpgrade = upgradeDemoServiceContracts({
            fileName: dataset.fileName,
            customers: state.customers,
            serviceContracts: state.serviceContracts,
            serviceContractSources: state.serviceContractSources
        });
        if (contractUpgrade.changed) {
            setServiceContracts(contractUpgrade.serviceContracts, contractUpgrade.serviceContractSources);
            migratedDemoContracts = true;
        }
        const visitUpgrade = upgradeDemoServiceVisits({
            fileName: dataset.fileName,
            customers: state.customers,
            serviceContracts: state.serviceContracts,
            serviceVisits: state.serviceVisits,
            serviceVisitSources: state.serviceVisitSources
        });
        if (visitUpgrade.changed) {
            setServiceVisits(visitUpgrade.serviceVisits, visitUpgrade.serviceVisitSources);
            migratedDemoVisits = true;
        }
        if (enrichedDemoPlaces > 0 || migratedDemoCustomers || migratedDemoContracts || migratedDemoVisits) {
            await saveDataset(datasetSnapshot());
        }

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
        // Persistierte, benutzerdefinierte Farben anwenden
        if (settings?.repColors) {
            for (const [name, color] of Object.entries(settings.repColors)) {
                if (state.reps.has(name) && color) state.reps.get(name).color = color;
            }
        }
        if (settings?.dimColors) {
            for (const [dimId, values] of Object.entries(settings.dimColors)) {
                const dim = state.dims[dimId];
                if (!dim) continue;
                for (const [name, color] of Object.entries(values)) {
                    if (dim.values.has(name) && color) dim.values.get(name).color = color;
                }
            }
        }
        emit('customers:changed');
        fitToCustomers();
    } else if (dataset?.territories && Object.keys(dataset.territories).length) {
        // Nur Gebietszuordnungen ohne Kunden -> Karte neu einfärben
        emit('customers:changed');
    }

    // Fokus-Modus wiederherstellen (Farbmodus wurde bereits oben gesetzt -> nicht überschreiben)
    const mobileStartup = window.matchMedia('(max-width: 900px)').matches;
    if (!mobileStartup && typeof settings?.activeTab === 'string') state.ui.activeTab = settings.activeTab;
    if (!mobileStartup && ['aussendienst', 'gebietsplanung', 'service'].includes(settings?.mode)) {
        state.ui.mode = settings.mode;
    }
    if (mobileStartup) {
        state.ui.mode = 'aussendienst';
        state.ui.activeTab = 'daten';
    }
    applyMode(state.ui.mode, false);
    if (mobileStartup) showDataView(false);
}

// Kundendaten nach inhaltlichen Änderungen (Besuch, Rhythmus, Gebiete) speichern – gedrosselt
let saveTimer = null;
function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveDataset(datasetSnapshot()), 400);
}

function handleSharedTourFromUrl() {
    const hash = window.location.hash || '';
    if (!hash.includes(`${TOUR_HASH_KEY}=`)) return;
    const payload = decodeTourPayload(window.location.href);
    // Fragment entfernen, damit ein Reload die Tour nicht erneut öffnet
    history.replaceState(null, '', window.location.pathname + window.location.search);
    if (payload) openReceivedFromUrl(payload);
    else emit('toast', { type: 'error', text: 'Der gescannte Tour-Link konnte nicht gelesen werden.' });
}

async function init() {
    initToasts();
    initCustomerBriefing();
    initContractRadar();
    initMap('map');
    initSidebar();
    initImportWizard();
    initTourPanel();
    initCockpit();
    initRegionEditor();
    initSearch();
    initNearby();
    initMobilePreview();
    initShowcase();
    initPwaUpdates();
    initContextHelp();
    initFirstSteps();
    initSafeTransfer();

    // Die operative Serviceplanung ist eine Profi-Funktion. Code, Styles und
    // Excel-Import werden erst beim Wechsel in den Service-Fokus geladen, damit
    // der 90-%-Basisweg schlank bleibt.
    let serviceVisitPlannerPromise = null;
    const ensureServiceVisitPlanner = () => {
        if (!serviceVisitPlannerPromise) {
            serviceVisitPlannerPromise = import('./ui/serviceVisitPlanner.js')
                .then(({ initServiceVisitPlanner }) => initServiceVisitPlanner())
                .catch((error) => {
                    serviceVisitPlannerPromise = null;
                    console.warn('Serviceeinsatz-Planung konnte nicht geladen werden:', error);
                });
        }
        return serviceVisitPlannerPromise;
    };
    on('mode:changed', (mode) => {
        if (mode === 'service') ensureServiceVisitPlanner();
    });

    on('dataset:dirty', scheduleSave);

    // Persistierte Daten laden (bei aktivem Tresor erst nach dem Entsperren).
    async function bootData() {
        try {
            await restorePersistedState();
        } catch (error) {
            console.warn('Gespeicherter Zustand konnte nicht wiederhergestellt werden:', error);
        }
        // QR-Übergabe: Wurde die App über einen gescannten Tour-Link geöffnet
        // (host/…#t=…), direkt den Empfangs-Dialog zeigen.
        handleSharedTourFromUrl();
        autoRevealIfEmpty();
        emit('app:ready');
    }

    // Migration/Konsistenz: Ein verwaister Tresor (aktiv, aber gar kein
    // gespeicherter Datensatz – z. B. nach „Daten löschen" einer Altversion)
    // würde sonst einen leeren Sperrbildschirm zeigen. Da nichts zu schützen
    // ist, wird er gefahrlos deaktiviert (nur wenn wirklich kein Datensatz da ist).
    if (vaultEnabled() && vaultLocked() && !(await hasStoredDataset())) {
        removeVaultMeta();
    }

    // Tresor: Ist er aktiv und gesperrt, zeigt initVault den Sperrbildschirm und
    // ruft bootData erst nach erfolgreichem Entsperren auf.
    const lockedAtStart = initVault({ bootData });

    window.addEventListener('hashchange', handleSharedTourFromUrl);

    if (!lockedAtStart) await bootData();

    // Info-Dialog
    const infoDialog = document.getElementById('info-dialog');
    document.getElementById('btn-info').addEventListener('click', () => infoDialog.showModal());
    infoDialog.querySelector('.dialog-close').addEventListener('click', () => infoDialog.close());

    console.log('🦊 TourFuchs Vertrieb bereit.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

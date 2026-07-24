/**
 * Import-Assistent
 * Schritt 1: Datei wählen (oder Drag & Drop)
 * Schritt 2: Spalten-Zuordnung prüfen/anpassen (mit Vorschau)
 * Schritt 3: Import + Verortung über PLZ
 */

import { geocodeByPlz } from '../services/geocode.js';
import {
    state, setCustomers, replaceCustomers, setServiceContracts, clearServiceContracts,
    setServiceVisits, clearServiceVisits, emit, on, datasetSnapshot, setTerritory
} from '../core/state.js';
import { loadLevel, regionName, regionKey } from '../services/geodata.js';
import { saveDataset } from '../services/storage.js';
import {
    canAutoLoadWelcomeDemo,
    hasClearedDataset,
    hasHandledWelcomeDemo,
    markDatasetCleared,
    markShowcaseImportCompleted,
    markWelcomeDemoHandled,
    resetWelcomeDemoAfterDataClear,
    welcomeDemoDelayMs
} from '../services/showcaseOnboarding.js';
import { isEnabled as vaultEnabled, removeVaultMeta } from '../services/vault.js';
import { isDemoDataset } from '../core/demoSafety.js';
import { showToast } from './toast.js';
import { fitToCustomers } from '../features/map.js';
import {
    createDemoServiceContracts,
    createDemoServiceContractSourceMeta
} from '../features/demoServiceContracts.js';
import {
    createDemoServiceVisits,
    createDemoServiceVisitSourceMeta
} from '../features/demoServiceVisits.js';
import { confirmDatasetReplacement, hasExistingDataset } from './datasetReplacement.js';

let dialog = null;
let resultDialog = null;
let ownDataDialog = null;
let parsed = null; // { headers, rows, fileName }
let lastErrors = [];
let lastFileBase = 'TourFuchs';
let welcomeDemoTimer = null;
let welcomeDemoUserIntent = false;
let demoLoadPromise = null;
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');

// SheetJS (xlsx) ist groß – erst laden, wenn wirklich importiert/exportiert wird
const excel = () => import('../services/excel.js');

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

export function initImportWizard() {
    dialog = document.getElementById('import-dialog');
    ownDataDialog = document.getElementById('own-data-dialog');

    document.getElementById('btn-own-data')?.addEventListener('click', () => {
        // Nur reinschauen darf das Willkommen nicht dauerhaft beenden: kein
        // persistentes „erledigt" – die Pause gilt für diese Sitzung, nach
        // einem echten Neustart läuft das Intro wieder. Wer wirklich eigene
        // Daten lädt, blockiert die Automatik ohnehin über den Datenbestand.
        cancelWelcomeDemo();
        ownDataDialog?.showModal();
    });
    // Demo-Streifen (überall sichtbar bei Beispieldaten): führt in denselben
    // geführten Upload wie im Willkommen.
    document.getElementById('btn-demo-own-data')?.addEventListener('click', () => {
        cancelWelcomeDemo();
        ownDataDialog?.showModal();
    });
    document.getElementById('btn-showcase-ob')?.addEventListener('click', () => cancelWelcomeDemo());
    // „Später" im Demo-Panel heißt nicht „nie": Schließt sich die Demo-Auswahl
    // ohne gestartete Vorführung und ohne Daten, wird die Willkommens-Automatik
    // wieder scharf – die Karte belebt sich kurz darauf doch noch von selbst.
    document.getElementById('showcase-dialog')?.addEventListener('close', () => {
        if (state.customers.length > 0) return;
        if (document.querySelector('.sc-shield')) return; // Vorführung startet gerade
        if (hasHandledWelcomeDemo()) return;
        welcomeDemoUserIntent = false;
        scheduleWelcomeDemo();
    });
    document.getElementById('btn-demo-restore')?.addEventListener('click', restoreDemoAfterClear);
    ownDataDialog?.querySelector('.dialog-close')?.addEventListener('click', () => ownDataDialog.close());

    const fileInput = document.getElementById('file-input');
    const openFilePicker = () => {
        if (!hasComplianceOptIn()) {
            showComplianceToast();
            return;
        }
        if (ownDataDialog?.open) ownDataDialog.close();
        fileInput.click();
    };
    document.getElementById('btn-upload').addEventListener('click', openFilePicker);
    // Bei Beispieldaten führt „Eigene Daten laden" in den geführten Dialog
    // (Excel oder verschlüsselte Datei) statt direkt in den Datei-Picker.
    document.getElementById('btn-upload-more')?.addEventListener('click', () => {
        if (isDemoDataset(state.customers)) { cancelWelcomeDemo(); ownDataDialog?.showModal(); return; }
        openFilePicker();
    });
    document.getElementById('btn-safe-receive-ob')?.addEventListener('click', () => {
        if (ownDataDialog?.open) ownDataDialog.close();
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
        fileInput.value = '';
    });

    const downloadTemplate = async () => (await excel()).downloadTemplate();
    document.getElementById('btn-template').addEventListener('click', downloadTemplate);
    document.getElementById('btn-template-2')?.addEventListener('click', downloadTemplate);

    resultDialog = document.getElementById('import-result-dialog');
    resultDialog.querySelector('.dialog-close').addEventListener('click', () => resultDialog.close());
    document.getElementById('import-result-ok').addEventListener('click', () => resultDialog.close());
    document.getElementById('import-error-download').addEventListener('click', async () => {
        if (lastErrors.length) (await excel()).exportErrors(lastErrors, lastFileBase);
    });

    // Drag & Drop auf die gesamte App
    const appEl = document.body;
    let dragDepth = 0;
    appEl.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragDepth++;
        document.getElementById('dropzone').classList.add('active');
    });
    appEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (--dragDepth <= 0) {
            dragDepth = 0;
            document.getElementById('dropzone').classList.remove('active');
        }
    });
    appEl.addEventListener('dragover', (e) => e.preventDefault());
    appEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDepth = 0;
        document.getElementById('dropzone').classList.remove('active');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (!hasComplianceOptIn()) {
            showComplianceToast();
            return;
        }
        handleFile(file);
    });

    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    document.getElementById('mapping-confirm').addEventListener('click', confirmImport);

    on('app:ready', () => {
        syncDemoRestoreOffer();
        // Migration für bereits leere Installationen: Frühere Versionen
        // merkten das Löschen, ließen das Willkommen aber dauerhaft erledigt.
        if (state.customers.length === 0 && hasClearedDataset()) {
            resetWelcomeDemoAfterDataClear();
        }
        scheduleWelcomeDemo();
    });
    on('customers:changed', syncDemoRestoreOffer);
    on('dataset:cleared', () => {
        // Zurücksetzen ist ein Neustart: Das Intro beginnt erneut von der leeren
        // Deutschlandkarte, die Beispielkunden erscheinen gleich wieder (inkl.
        // Entdeck-Hinweis auf der Karte). Wer stattdessen sofort eigene Daten
        // lädt, stoppt das automatisch (Nutzerabsicht/Dialog blockieren die Demo).
        welcomeDemoUserIntent = false;
        if (welcomeDemoTimer) clearTimeout(welcomeDemoTimer);
        welcomeDemoTimer = null;
        markDatasetCleared();
        resetWelcomeDemoAfterDataClear();
        syncDemoRestoreOffer();
        previewStatus({
            title: 'Zurückgesetzt – Willkommen zurück.',
            detail: 'Die Beispielkunden erscheinen gleich wieder auf der Karte.'
        });
        scheduleWelcomeDemo();
    });
}

function syncDemoRestoreOffer() {
    const visible = state.customers.length === 0 && hasClearedDataset();
    const button = document.getElementById('btn-demo-restore');
    const sub = document.getElementById('demo-restore-sub');
    if (button) button.hidden = !visible;
    if (sub) sub.hidden = !visible;
}

async function restoreDemoAfterClear() {
    const button = document.getElementById('btn-demo-restore');
    cancelWelcomeDemo({ handled: true });
    if (button) button.disabled = true;
    try {
        await loadDemo({ source: 'restore', confirmReplacement: false, announce: true });
    } finally {
        if (button) button.disabled = false;
        syncDemoRestoreOffer();
    }
}

function hasComplianceOptIn() {
    return [...document.querySelectorAll('[data-compliance-optin]')].some((input) => input.checked);
}

function showComplianceToast() {
    if (state.customers.length === 0 && ownDataDialog && !ownDataDialog.open) ownDataDialog.showModal();
    // Die Checkbox zusätzlich direkt am Ort hervorheben, statt nur per Toast.
    document.querySelectorAll('.compliance-optin').forEach((el) => {
        el.classList.remove('attention');
        void el.offsetWidth; // Animation bei erneutem Klick neu starten
        el.classList.add('attention');
    });
    showToast('Bitte bestätigen Sie zuerst, dass Sie zur Verarbeitung der Daten berechtigt sind.', 'info', 6000);
}

async function handleFile(file) {
    const isExcel = /\.(xlsx|xls|csv|ods)$/i.test(file.name);
    if (!isExcel) {
        showToast('Bitte eine Excel- oder CSV-Datei wählen (.xlsx, .xls, .csv).', 'error');
        return;
    }
    try {
        const { readWorkbook } = await excel();
        const { headers, rows } = await readWorkbook(file);
        parsed = { headers, rows, fileName: file.name };
        await showMappingStep();
    } catch (error) {
        showToast(`Datei konnte nicht gelesen werden: ${error.message}`, 'error');
    }
}

async function showMappingStep() {
    const { FIELDS, autoDetectMapping } = await excel();
    const { headers, rows, fileName } = parsed;
    const mapping = autoDetectMapping(headers);

    document.getElementById('mapping-file-info').textContent =
        `${fileName} – ${rows.length} Zeilen, ${headers.length} Spalten`;

    const tbody = document.getElementById('mapping-rows');
    tbody.innerHTML = FIELDS.map((field) => {
        const options = ['<option value="">– nicht vorhanden –</option>']
            .concat(headers.map((h) => {
                const selected = mapping[field.key] === h ? ' selected' : '';
                return `<option value="${escapeHtml(h)}"${selected}>${escapeHtml(h)}</option>`;
            })).join('');
        const badge = field.required ? ' <span class="req">Pflicht</span>' : '';
        return `<tr>
            <td>${field.label}${badge}</td>
            <td><select data-field="${field.key}">${options}</select></td>
            <td class="preview" data-preview="${field.key}"></td>
        </tr>`;
    }).join('');

    const updatePreview = () => {
        tbody.querySelectorAll('select').forEach((sel) => {
            const cell = tbody.querySelector(`[data-preview="${sel.dataset.field}"]`);
            const header = sel.value;
            if (!header) { cell.textContent = ''; return; }
            const samples = rows.slice(0, 3).map((r) => r[header]).filter((v) => v !== '');
            cell.textContent = samples.slice(0, 2).join(' · ');
        });
    };
    tbody.querySelectorAll('select').forEach((sel) => sel.addEventListener('change', updatePreview));
    updatePreview();

    dialog.showModal();
}

async function confirmImport() {
    const mapping = {};
    document.querySelectorAll('#mapping-rows select').forEach((sel) => {
        mapping[sel.dataset.field] = sel.value || null;
    });

    const contactOnly = !mapping.name && !mapping.gebiet && mapping.nummer && (mapping.ansprechpartner || mapping.telefon || mapping.email);
    if (!mapping.name && !mapping.gebiet && !contactOnly) {
        showToast('Bitte die Spalte „Kundenname" (oder für reine Flächenzeilen „Gebiet") zuordnen.', 'error');
        return;
    }
    if (mapping.name && !mapping.plz && !(mapping.lat && mapping.lng)) {
        showToast('Ohne PLZ (oder Koordinaten) können Kunden nicht auf der Karte verortet werden.', 'error');
        return;
    }

    const { parseRows, attachContacts } = await excel();
    const { customers, areaRows, contactRows, errors, skipped } = parseRows(parsed.rows, mapping);

    lastFileBase = (parsed.fileName || 'TourFuchs').replace(/\.[^.]+$/, '');

    if (customers.length === 0 && areaRows.length === 0 && contactRows.length === 0) {
        dialog.close();
        lastErrors = errors;
        if (errors.length) {
            showImportResult({ customerCount: 0, contactCount: 0, areaCount: 0, skipped, errors });
        } else {
            showToast('Keine gültigen Zeilen im Import gefunden.', 'error');
        }
        return;
    }

    const replacedExisting = customers.length > 0 && hasExistingDataset();
    if (customers.length > 0 && !confirmDatasetReplacement({
        incomingCount: customers.length,
        sourceLabel: 'Die ausgewählte Kundenliste'
    })) {
        showToast('Import abgebrochen. Die bisherigen Daten bleiben vollständig erhalten.', 'info', 5000);
        return;
    }

    dialog.close();
    let areaCount = 0;

    if (customers.length > 0) {
        await geocodeByPlz(customers);
        // PLZ nicht gefunden -> als Hinweis in die Fehlerliste (Kunde wird trotzdem importiert)
        for (const c of customers) {
            if (c.plz && c.geo === 'none') {
                errors.push({ Zeile: c._sheetRow, Typ: 'Hinweis', Grund: `PLZ ${c.plz} nicht gefunden – Kunde nicht auf der Karte`, ...(c._raw || {}) });
            }
            delete c._sheetRow; delete c._raw;
        }
        if (contactRows.length) attachContacts(customers, contactRows, errors);
        removeDemoContracts();
        removeDemoServiceVisits();
        replaceCustomers(customers, { fileName: parsed.fileName });
        areaCount = await resolveAreas(areaRows, errors);
        if (areaCount > 0) emit('customers:changed');
        fitToCustomers();
    } else {
        // Reine Kontakt- und Gebietsdateien ergänzen bewusst den aktuellen
        // Kundenbestand; sie sind ohne diesen Bestand nicht eigenständig nutzbar.
        areaCount = await resolveAreas(areaRows, errors);
        if (contactRows.length > 0) {
            const { matched } = attachContacts(state.customers, contactRows, errors);
            setCustomers(state.customers, { fileName: state.fileName, importedAt: state.importedAt });
            showToast(`${matched} Kontakt(e) mit bestehenden Kunden verknüpft.`, matched ? 'success' : 'info', 6000);
        } else if (areaCount > 0) {
            emit('customers:changed');
        }
    }
    await saveDataset(datasetSnapshot());
    markShowcaseImportCompleted();

    lastErrors = errors;
    showImportResult({ customerCount: customers.length, contactCount: contactRows.length, areaCount, skipped, errors, replacedExisting });

    // Eigene Kundendaten importiert -> zum Verschlüsseln führen (nach dem
    // Ergebnis-Dialog, falls dieser wegen Fehlern offen ist).
    if (customers.length > 0) {
        const offerVault = () => emit('data:imported', { count: customers.length });
        if (resultDialog?.open) resultDialog.addEventListener('close', offerVault, { once: true });
        else offerVault();
    }
}

/**
 * Flächenzeilen zu Gebietszuordnungen auflösen. „Gebiet" ist entweder ein
 * Landkreis-Name (→ Ebene Landkreise) oder eine PLZ / PLZ-Präfix (Ziffern →
 * Ebene nach Länge: 1/2/3/5). Widersprüche und unbekannte Gebiete landen in
 * der Fehlerliste. @returns Anzahl erfolgreich zugeordneter Gebiete
 */
async function resolveAreas(areaRows, errors) {
    if (!areaRows.length) return 0;
    const cache = {};
    const getGeo = async (lvl) => (cache[lvl] ||= await loadLevel(lvl));
    const assigned = new Map(); // 'level:key' -> { bezirk, vb, sheetRow, name }
    const plzLevel = { 1: 'plz1', 2: 'plz2', 3: 'plz3', 5: 'plz5' };
    const errRow = (sheetRow, grund, raw) => errors.push({ Zeile: sheetRow, Typ: 'Fehler', Grund: grund, ...raw });
    let count = 0;

    for (const ar of areaRows) {
        const g = String(ar.gebiet).trim();
        let level, key, name;
        try {
            if (/^\d+$/.test(g)) {
                const lvl = plzLevel[g.length];
                if (!lvl) { errRow(ar.sheetRow, `PLZ „${g}" hat ${g.length} Stellen – unterstützt sind 1, 2, 3 oder 5`, ar.raw); continue; }
                const geo = await getGeo(lvl);
                const feat = geo.features.find((f) => String(f.properties.plz) === g);
                if (!feat) { errRow(ar.sheetRow, `PLZ-Gebiet „${g}" nicht gefunden`, ar.raw); continue; }
                level = lvl; key = regionKey(lvl, feat); name = regionName(lvl, feat);
            } else {
                const geo = await getGeo('kreise');
                const gl = g.toLowerCase();
                const feat = geo.features.find((f) => (f.properties.gen || '').toLowerCase() === gl)
                    || geo.features.find((f) => regionName('kreise', f).toLowerCase().includes(gl));
                if (!feat) { errRow(ar.sheetRow, `Landkreis „${g}" nicht gefunden`, ar.raw); continue; }
                level = 'kreise'; key = regionKey('kreise', feat); name = regionName('kreise', feat);
            }
        } catch (e) {
            errRow(ar.sheetRow, `Gebietsdaten konnten nicht geladen werden: ${e.message}`, ar.raw); continue;
        }

        const rk = `${level}:${key}`;
        const prev = assigned.get(rk);
        if (prev && ((ar.bezirk && prev.bezirk && ar.bezirk !== prev.bezirk) || (ar.vb && prev.vb && ar.vb !== prev.vb))) {
            errRow(ar.sheetRow, `Gebiet „${name}" widersprüchlich zugeordnet (bereits Zeile ${prev.sheetRow}: ${prev.bezirk || prev.vb})`, ar.raw);
            continue;
        }
        assigned.set(rk, { bezirk: ar.bezirk, vb: ar.vb, sheetRow: ar.sheetRow, name });
        if (ar.bezirk) setTerritory(level, key, 'bezirk', ar.bezirk, name);
        if (ar.vb) setTerritory(level, key, 'vb', ar.vb, name);
        count++;
    }
    return count;
}

function showImportResult({ customerCount, contactCount = 0, areaCount, skipped, errors, replacedExisting = false }) {
    const fehler = errors.filter((e) => e.Typ === 'Fehler').length;
    const hinweise = errors.filter((e) => e.Typ === 'Hinweis').length;

    if (errors.length === 0) {
        const parts = [];
        if (customerCount) parts.push(`${customerCount} Kunden`);
        if (contactCount) parts.push(`${contactCount} Kontakte`);
        if (areaCount) parts.push(`${areaCount} Gebiete`);
        const replacement = replacedExisting ? ' Die bisherige Kundenliste wurde vollständig ersetzt.' : '';
        showToast(`${parts.join(', ') || 'Daten'} importiert.${replacement}`, 'success', 6000);
        return;
    }
    document.getElementById('import-result-body').innerHTML = `
        <div class="stat-grid">
            <div class="stat"><b>${customerCount}</b><span>Kunden</span></div>
            <div class="stat"><b>${contactCount}</b><span>Kontakte</span></div>
            <div class="stat"><b>${areaCount}</b><span>Gebiete</span></div>
            <div class="stat"><b>${fehler}</b><span>Fehler</span></div>
            <div class="stat"><b>${hinweise}</b><span>Hinweise</span></div>
        </div>
        <p class="muted small">Gültige Zeilen wurden importiert. ${replacedExisting ? 'Die bisherige Kundenliste wurde vollständig ersetzt. ' : ''}${fehler ? `${fehler} Zeile(n) mit Fehlern wurden nicht übernommen. ` : ''}${hinweise ? `${hinweise} Hinweis(e) (z. B. unbekannte PLZ). ` : ''}Laden Sie die Liste herunter, um die Zeilen zu prüfen und zu korrigieren.</p>
    `;
    resultDialog.showModal();
}

// Die Begrüßung verspricht nur, was auch passiert: Solange die Automatik
// scharf ist, kündigt sie die Beispielkunden an – ist sie pausiert, lädt die
// Zeile stattdessen aktiv zum Selbst-Starten ein.
const AUTO_NOTE_ARMED = 'Schau dir zuerst an, was möglich ist. Die Beispielkunden erscheinen gleich automatisch auf der Deutschlandkarte.';
const AUTO_NOTE_PAUSED = 'Schau dir zuerst an, was möglich ist – eine Live-Demo bringt die Beispielkunden jederzeit auf die Karte.';

function setAutoNote(text) {
    const note = document.getElementById('ob-auto-note');
    if (note) note.textContent = text;
}

function previewStatus({ title, detail, stateName = '' }) {
    const status = document.getElementById('demo-preview-status');
    if (!status) return;
    status.classList.toggle('is-loading', stateName === 'loading');
    status.classList.toggle('is-paused', stateName === 'paused');
    const copy = status.querySelector('span:last-child');
    if (copy) copy.innerHTML = `<b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small>`;
}

function cancelWelcomeDemo({ handled = false } = {}) {
    welcomeDemoUserIntent = true;
    if (welcomeDemoTimer) clearTimeout(welcomeDemoTimer);
    welcomeDemoTimer = null;
    if (handled) markWelcomeDemoHandled();
    setAutoNote(AUTO_NOTE_PAUSED);
    previewStatus({
        title: 'Automatische Beispieldaten pausiert.',
        detail: 'Dein gewählter Einstieg hat jetzt Vorrang.',
        stateName: 'paused'
    });
}

function welcomeDemoBlockers() {
    return {
        handled: hasHandledWelcomeDemo(),
        hasCustomers: state.customers.length > 0,
        locked: vaultEnabled(),
        userIntent: welcomeDemoUserIntent,
        blockingDialogOpen: Boolean(document.querySelector('dialog[open]')),
        documentHidden: document.hidden,
        insideMobilePreview
    };
}

function scheduleWelcomeDemo() {
    if (!canAutoLoadWelcomeDemo(welcomeDemoBlockers())) return;
    setAutoNote(AUTO_NOTE_ARMED);
    previewStatus({
        title: 'Die Deutschlandkarte ist bereit.',
        detail: 'Beispielkunden erscheinen gleich automatisch.'
    });
    welcomeDemoTimer = setTimeout(async () => {
        welcomeDemoTimer = null;
        if (!canAutoLoadWelcomeDemo(welcomeDemoBlockers())) return;
        previewStatus({
            title: 'Beispielkunden kommen auf die Karte …',
            detail: 'Lokal erzeugt, unverbindlich und jederzeit ersetzbar.',
            stateName: 'loading'
        });
        document.body.classList.add('demo-data-arriving');
        try {
            const loaded = await loadDemo({ source: 'welcome', confirmReplacement: false, announce: false });
            if (loaded) {
                emit('demo:auto-loaded');
                showToast('Beispielkunden sind da. Starte jetzt eine Live-Demo oder erkunde die Karte selbst.', 'success', 5200);
            }
        } catch (error) {
            console.warn('Automatische Beispieldaten konnten nicht geladen werden:', error);
            previewStatus({
                title: 'Die Karte bleibt startklar.',
                detail: 'Eine Live-Demo lädt die Beispieldaten bei Bedarf.',
                stateName: 'paused'
            });
        } finally {
            setTimeout(() => document.body.classList.remove('demo-data-arriving'), 1800);
        }
    }, welcomeDemoDelayMs({ mobile: window.matchMedia('(max-width: 768px)').matches }));
}

/** Lädt sichere Beispieldaten für Einstieg oder Live-Demo. */
export function loadDemo({ source = 'manual', confirmReplacement = true, announce = true } = {}) {
    if (demoLoadPromise) return demoLoadPromise;
    if (source === 'welcome' && state.customers.length > 0) return Promise.resolve(false);
    demoLoadPromise = performDemoLoad({ confirmReplacement, announce })
        .finally(() => { demoLoadPromise = null; });
    return demoLoadPromise;
}

async function performDemoLoad({ confirmReplacement, announce }) {
    // Beispieldaten sind nicht schützenswert: ein evtl. aktiver Tresor wird
    // deaktiviert, damit die Demo unverschlüsselt und ohne PIN-Sperre läuft.
    const { demoCustomers } = await excel();
    const customers = await demoCustomers();
    const disablesVault = vaultEnabled();
    if (confirmReplacement && !confirmDatasetReplacement({
        incomingCount: customers.length,
        sourceLabel: 'Die Beispieldaten',
        disablesVault,
        replacesContracts: true
    })) return false;
    if (disablesVault) removeVaultMeta();
    clearServiceContracts({ dirty: false });
    clearServiceVisits({ dirty: false });
    await applyCustomers(customers, 'Demo-Daten');
    const demoNow = new Date();
    const serviceContracts = createDemoServiceContracts(customers, demoNow);
    setServiceContracts(serviceContracts, {
        DEMO: createDemoServiceContractSourceMeta(serviceContracts, demoNow)
    });
    const serviceVisits = createDemoServiceVisits(customers, serviceContracts, demoNow);
    setServiceVisits(serviceVisits, {
        DEMO: createDemoServiceVisitSourceMeta(serviceVisits, demoNow)
    });
    await saveDataset(datasetSnapshot());
    markWelcomeDemoHandled();
    emit('demo:loaded');
    if (announce) {
        showToast('Demo geladen – tippe auf einen Kundenstapel oder starte eine Live-Demo. Eigene Daten kannst du jederzeit laden.', 'success', 6000);
    }
    return true;
}

function removeDemoContracts() {
    if (!state.serviceContractSources?.DEMO) return;
    const sources = { ...(state.serviceContractSources || {}) };
    delete sources.DEMO;
    setServiceContracts(
        state.serviceContracts.filter((contract) => contract.sourceSystem !== 'DEMO'),
        sources
    );
}

function removeDemoServiceVisits() {
    if (!state.serviceVisitSources?.DEMO) return;
    const sources = { ...(state.serviceVisitSources || {}) };
    delete sources.DEMO;
    setServiceVisits(
        state.serviceVisits.filter((visit) => visit.sourceSystem !== 'DEMO'),
        sources
    );
}

async function applyCustomers(customers, fileName) {
    const { located, missing } = await geocodeByPlz(customers);
    replaceCustomers(customers, { fileName });
    await saveDataset(datasetSnapshot());
    fitToCustomers();
    emit('toast', {
        type: 'success',
        text: `${customers.length} Kunden importiert, ${located + customers.filter((c) => c.geo === 'exakt').length} auf der Karte verortet.`
    });
    if (missing.length > 0) {
        showToast(`Unbekannte PLZ: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`, 'error', 7000);
    }
}

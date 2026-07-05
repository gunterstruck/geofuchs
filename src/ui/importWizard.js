/**
 * Import-Assistent
 * Schritt 1: Datei wählen (oder Drag & Drop)
 * Schritt 2: Spalten-Zuordnung prüfen/anpassen (mit Vorschau)
 * Schritt 3: Import + Verortung über PLZ
 */

import { geocodeByPlz } from '../services/geocode.js';
import { setCustomers, emit, datasetSnapshot, setTerritory } from '../core/state.js';
import { loadLevel, regionName, regionKey } from '../services/geodata.js';
import { saveDataset } from '../services/storage.js';
import { showToast } from './toast.js';
import { fitToCustomers } from '../features/map.js';

let dialog = null;
let resultDialog = null;
let parsed = null; // { headers, rows, fileName }
let lastErrors = [];
let lastFileBase = 'geofuchs';

// SheetJS (xlsx) ist groß – erst laden, wenn wirklich importiert/exportiert wird
const excel = () => import('../services/excel.js');

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

export function initImportWizard() {
    dialog = document.getElementById('import-dialog');

    const fileInput = document.getElementById('file-input');
    const openFilePicker = () => fileInput.click();
    document.getElementById('btn-upload').addEventListener('click', openFilePicker);
    document.getElementById('btn-upload-more')?.addEventListener('click', openFilePicker);
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
        fileInput.value = '';
    });

    const downloadTemplate = async () => (await excel()).downloadTemplate();
    document.getElementById('btn-template').addEventListener('click', downloadTemplate);
    document.getElementById('btn-template-2')?.addEventListener('click', downloadTemplate);
    document.getElementById('btn-demo').addEventListener('click', loadDemo);

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
        if (file) handleFile(file);
    });

    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    document.getElementById('mapping-confirm').addEventListener('click', confirmImport);
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

    if (!mapping.name && !mapping.gebiet) {
        showToast('Bitte die Spalte „Kundenname" (oder für reine Flächenzeilen „Gebiet") zuordnen.', 'error');
        return;
    }
    if (mapping.name && !mapping.plz && !(mapping.lat && mapping.lng)) {
        showToast('Ohne PLZ (oder Koordinaten) können Kunden nicht auf der Karte verortet werden.', 'error');
        return;
    }
    if (mapping.name && !mapping.bezirk) {
        showToast('Bitte die Spalte „Betriebsbezirk" zuordnen – sie ist Pflicht.', 'error');
        return;
    }

    const { parseRows } = await excel();
    const { customers, areaRows, errors, skipped } = parseRows(parsed.rows, mapping);

    // Flächenzeilen (Gebietszuordnungen) auflösen – lädt Gebietsdaten bei Bedarf
    const areaCount = await resolveAreas(areaRows, errors);

    lastFileBase = (parsed.fileName || 'geofuchs').replace(/\.[^.]+$/, '');

    if (customers.length === 0 && areaCount === 0) {
        dialog.close();
        lastErrors = errors;
        if (errors.length) {
            showImportResult({ customerCount: 0, areaCount: 0, skipped, errors });
        } else {
            showToast('Keine gültigen Zeilen im Import gefunden.', 'error');
        }
        return;
    }

    dialog.close();

    if (customers.length > 0) {
        await geocodeByPlz(customers);
        // PLZ nicht gefunden -> als Hinweis in die Fehlerliste (Kunde wird trotzdem importiert)
        for (const c of customers) {
            if (c.plz && c.geo === 'none') {
                errors.push({ Zeile: c._sheetRow, Typ: 'Hinweis', Grund: `PLZ ${c.plz} nicht gefunden – Kunde nicht auf der Karte`, ...(c._raw || {}) });
            }
            delete c._sheetRow; delete c._raw;
        }
        setCustomers(customers, { fileName: parsed.fileName });
        fitToCustomers();
    } else {
        // Reiner Flächen-Import: Kunden unverändert lassen, nur neu einfärben
        emit('customers:changed');
    }
    await saveDataset(datasetSnapshot());

    lastErrors = errors;
    showImportResult({ customerCount: customers.length, areaCount, skipped, errors });
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

function showImportResult({ customerCount, areaCount, skipped, errors }) {
    const fehler = errors.filter((e) => e.Typ === 'Fehler').length;
    const hinweise = errors.filter((e) => e.Typ === 'Hinweis').length;

    if (errors.length === 0) {
        showToast(`${customerCount} Kunden${areaCount ? `, ${areaCount} Gebiete` : ''} importiert.`, 'success', 6000);
        return;
    }
    document.getElementById('import-result-body').innerHTML = `
        <div class="stat-grid">
            <div class="stat"><b>${customerCount}</b><span>Kunden</span></div>
            <div class="stat"><b>${areaCount}</b><span>Gebiete</span></div>
            <div class="stat"><b>${fehler}</b><span>Fehler</span></div>
            <div class="stat"><b>${hinweise}</b><span>Hinweise</span></div>
        </div>
        <p class="muted small">Gültige Zeilen wurden importiert. ${fehler ? `${fehler} Zeile(n) mit Fehlern wurden nicht übernommen. ` : ''}${hinweise ? `${hinweise} Hinweis(e) (z. B. unbekannte PLZ). ` : ''}Laden Sie die Liste herunter, um die Zeilen zu prüfen und zu korrigieren.</p>
    `;
    resultDialog.showModal();
}

async function loadDemo() {
    const { demoCustomers } = await excel();
    await applyCustomers(await demoCustomers(), 'Demo-Daten');
    emit('demo:loaded');
    showToast('Demo geladen – tippe auf einen Pin oder plane eine Tour. Eigene Daten? Lade jederzeit deine Excel-Liste.', 'success', 6000);
}

async function applyCustomers(customers, fileName) {
    const { located, missing } = await geocodeByPlz(customers);
    setCustomers(customers, { fileName });
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

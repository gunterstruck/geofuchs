/**
 * Import-Assistent
 * Schritt 1: Datei wählen (oder Drag & Drop)
 * Schritt 2: Spalten-Zuordnung prüfen/anpassen (mit Vorschau)
 * Schritt 3: Import + Verortung über PLZ
 */

import { geocodeByPlz } from '../services/geocode.js';
import { setCustomers, emit } from '../core/state.js';
import { saveDataset } from '../services/storage.js';
import { showToast } from './toast.js';
import { fitToCustomers } from '../features/map.js';

let dialog = null;
let parsed = null; // { headers, rows, fileName }

// SheetJS (xlsx) ist groß – erst laden, wenn wirklich importiert/exportiert wird
const excel = () => import('../services/excel.js');

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

export function initImportWizard() {
    dialog = document.getElementById('import-dialog');

    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-upload').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
        fileInput.value = '';
    });

    document.getElementById('btn-template').addEventListener('click', async () => (await excel()).downloadTemplate());
    document.getElementById('btn-demo').addEventListener('click', loadDemo);

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

    if (!mapping.name) {
        showToast('Bitte die Spalte mit dem Kundennamen zuordnen.', 'error');
        return;
    }
    if (!mapping.plz && !(mapping.lat && mapping.lng)) {
        showToast('Ohne PLZ (oder Koordinaten) können Kunden nicht auf der Karte verortet werden.', 'error');
        return;
    }
    if (!mapping.bezirk) {
        showToast('Bitte die Spalte „Betriebsbezirk" zuordnen – sie ist Pflicht.', 'error');
        return;
    }

    const { rowsToCustomers } = await excel();
    const { customers, skipped } = rowsToCustomers(parsed.rows, mapping);
    if (customers.length === 0) {
        showToast('Keine gültigen Kundenzeilen gefunden.', 'error');
        return;
    }

    dialog.close();
    await applyCustomers(customers, parsed.fileName);
    if (skipped > 0) showToast(`${skipped} Zeilen ohne Kundennamen übersprungen.`, 'info');
}

async function loadDemo() {
    const { demoCustomers } = await excel();
    await applyCustomers(demoCustomers(), 'Demo-Daten');
    showToast('Demo-Daten geladen – laden Sie Ihre eigene Excel-Liste hoch, wenn Sie so weit sind.', 'success', 6000);
}

async function applyCustomers(customers, fileName) {
    const { located, missing } = await geocodeByPlz(customers);
    setCustomers(customers, { fileName });
    await saveDataset({
        customers,
        fileName,
        importedAt: new Date().toISOString()
    });
    fitToCustomers();
    emit('toast', {
        type: 'success',
        text: `${customers.length} Kunden importiert, ${located + customers.filter((c) => c.geo === 'exakt').length} auf der Karte verortet.`
    });
    if (missing.length > 0) {
        showToast(`Unbekannte PLZ: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`, 'error', 7000);
    }
}

/**
 * Sicherer Umzug – UI (Etappe 2 „Tresor").
 * Desktop: Kundendaten verschlüsselt als Datei exportieren und den Schlüssel
 *          als QR-Code am Bildschirm zeigen (getrennte Kanäle).
 * Handy:   Datei wählen, Schlüssel per Kamera scannen (oder eintippen),
 *          entschlüsseln und danach zum Tresor-Setup führen.
 * Es findet keinerlei Netzwerkübertragung der Daten statt.
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { state, setCustomers, emit, datasetSnapshot } from '../core/state.js';
import { saveDataset } from '../services/storage.js';
import { isEnabled } from '../services/vault.js';
import { geocodeByPlz } from '../services/geocode.js';
import { fitToCustomers } from '../features/map.js';
import {
    createSafeTransfer, parseSafeContainer, parseKeyQr,
    keyMatchesContainer, decryptSafeTransfer, SAFE_FILE_EXT
} from '../features/safeTransfer.js';
import { openSetupDialog } from './lockVault.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let exportDialog = null;
let receiveDialog = null;
let videoStream = null;
let scanLoopId = 0;
let lastExport = null;     // { container, keyQr, count } zum erneuten Download
let pendingContainer = null; // im Empfang gewählte, noch nicht entschlüsselte Datei

export function initSafeTransfer() {
    exportDialog = document.getElementById('safe-export-dialog');
    receiveDialog = document.getElementById('safe-receive-dialog');
    if (!exportDialog || !receiveDialog) return;

    exportDialog.querySelector('.dialog-close').addEventListener('click', () => exportDialog.close());
    receiveDialog.querySelector('.dialog-close').addEventListener('click', () => receiveDialog.close());
    receiveDialog.addEventListener('close', stopCamera);

    document.getElementById('btn-safe-export')?.addEventListener('click', openExportDialog);
    document.getElementById('btn-safe-receive')?.addEventListener('click', openReceiveDialog);
    document.getElementById('btn-safe-receive-ob')?.addEventListener('click', openReceiveDialog);

    document.getElementById('safe-export-download')?.addEventListener('click', () => {
        if (lastExport) downloadContainer(lastExport.container);
    });
    document.getElementById('safe-file-input')?.addEventListener('change', onFileChosen);
    document.getElementById('safe-scan-photo')?.addEventListener('change', onScanPhoto);
    document.getElementById('safe-key-submit')?.addEventListener('click', onKeyEntered);
}

// ---- Export (Desktop) ----
async function openExportDialog() {
    const snap = datasetSnapshot();
    if (!snap.customers?.length) {
        showToast('Keine Daten zum Exportieren vorhanden.', 'info');
        return;
    }
    let bundle;
    try {
        bundle = await createSafeTransfer(snap);
    } catch (e) {
        console.warn(e);
        showToast('Export konnte nicht erstellt werden.', 'error');
        return;
    }
    lastExport = bundle;
    downloadContainer(bundle.container);   // durch Button-Klick ausgelöst -> Download erlaubt

    const canvas = document.getElementById('safe-export-canvas');
    try {
        // Kurzer Text, daher hohe Fehlerkorrektur (H) für robustes Scannen.
        await QRCode.toCanvas(canvas, bundle.keyQr, { errorCorrectionLevel: 'H', width: 300, margin: 2 });
    } catch {
        showToast('Schlüssel-QR konnte nicht erzeugt werden.', 'error');
        return;
    }
    document.getElementById('safe-export-info').innerHTML =
        `Verschlüsselte Datei mit <b>${bundle.count} Kunde${bundle.count === 1 ? '' : 'n'}</b> heruntergeladen. `
        + 'Bring sie aufs Handy (Mail, Cloud, USB) und scanne dort diesen QR-Schlüssel.';
    const keyText = document.getElementById('safe-export-keytext');
    if (keyText) keyText.value = bundle.keyQr;
    exportDialog.showModal();
}

function downloadContainer(container) {
    const blob = new Blob([JSON.stringify(container)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TourFuchs-Umzug-${new Date().toISOString().slice(0, 10)}${SAFE_FILE_EXT}`;
    a.click();
    URL.revokeObjectURL(url);
}

// ---- Empfang (Handy) ----
function openReceiveDialog() {
    pendingContainer = null;
    showStep('file');
    document.getElementById('safe-file-meta').hidden = true;
    const keyInput = document.getElementById('safe-key-input');
    if (keyInput) keyInput.value = '';
    receiveDialog.showModal();
}

function showStep(step) {
    document.getElementById('safe-step-file').hidden = step !== 'file';
    document.getElementById('safe-step-key').hidden = step !== 'key';
    if (step === 'key') startCamera();
    else stopCamera();
}

/**
 * Für die Live-Demo: den Schlüssel-Schritt zeigen (Scanner-Bereich, Foto-Fallback
 * und manuelles Eingabefeld) OHNE die Kamera zu starten – so gibt es keinen
 * Berechtigungs-Dialog. Die eingesetzten Beispielwerte werden beim nächsten
 * echten Öffnen wieder zurückgesetzt.
 */
export function showKeyStepForDemo() {
    if (!receiveDialog) receiveDialog = document.getElementById('safe-receive-dialog');
    if (!receiveDialog) return;
    if (!receiveDialog.open) receiveDialog.showModal();
    const meta = document.getElementById('safe-file-meta');
    if (meta) { meta.innerHTML = '🔒 Verschlüsselte Datei · <b>48 Kunden</b> · erstellt am 04.07.2026, 10:00'; meta.hidden = false; }
    document.getElementById('safe-step-file').hidden = true;
    document.getElementById('safe-step-key').hidden = false;
    const status = document.getElementById('safe-scan-status');
    if (status) status.textContent = 'Kamera auf den Schlüssel-QR am Desktop richten … (Vorschau)';
    const details = document.querySelector('#safe-step-key details');
    if (details) details.open = true;
    const input = document.getElementById('safe-key-input');
    if (input) input.value = 'TFK1:a1b2c3d4e5f6:s3hr-l4ngerSchluessel…';
    // Kamera bewusst NICHT starten (kein getUserMedia in der Demo).
}

async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text;
    try { text = await file.text(); } catch { showToast('Datei konnte nicht gelesen werden.', 'error'); return; }
    const container = parseSafeContainer(text);
    if (!container) {
        showToast('Das ist keine gültige TourFuchs-Umzugsdatei (.tfsafe).', 'error');
        return;
    }
    pendingContainer = container;
    const meta = document.getElementById('safe-file-meta');
    const created = container.createdAt
        ? new Date(container.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'unbekannt';
    meta.innerHTML = `🔒 Verschlüsselte Datei · <b>${container.count ?? '?'} Kunden</b> · erstellt am ${escapeHtml(created)}`;
    meta.hidden = false;
    showStep('key');
}

async function startCamera() {
    const statusEl = document.getElementById('safe-scan-status');
    const video = document.getElementById('safe-scan-video');
    if (!video) return;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = videoStream;
        await video.play();
        statusEl.textContent = 'Kamera auf den Schlüssel-QR am Desktop richten …';
        scanLoop(video);
    } catch {
        statusEl.textContent = 'Kamera nicht verfügbar – Schlüssel unten per Foto oder Eingabe übergeben.';
    }
}

function stopCamera() {
    scanLoopId++;
    if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
    }
    const video = document.getElementById('safe-scan-video');
    if (video) video.srcObject = null;
}

function scanLoop(video) {
    const loopId = ++scanLoopId;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
        if (loopId !== scanLoopId || !receiveDialog.open) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height);
            if (code?.data) { handleKeyText(code.data); return; }
        }
        setTimeout(tick, 220);
    };
    tick();
}

async function onScanPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) { showToast('Bild konnte nicht gelesen werden.', 'error'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height);
    if (!code?.data) { showToast('Kein Schlüssel-QR im Bild gefunden.', 'error'); return; }
    handleKeyText(code.data);
}

function onKeyEntered() {
    const val = document.getElementById('safe-key-input')?.value;
    if (!val?.trim()) return;
    handleKeyText(val.trim());
}

async function handleKeyText(text) {
    const parsed = parseKeyQr(text);
    if (!parsed) {
        showToast('Das ist kein TourFuchs-Schlüssel (TFK1:…).', 'error');
        return;
    }
    if (!pendingContainer) {
        showToast('Bitte zuerst die Umzugsdatei wählen.', 'error');
        return;
    }
    if (!keyMatchesContainer(pendingContainer, parsed)) {
        showToast('Dieser Schlüssel gehört nicht zu dieser Datei.', 'error', 6000);
        return;
    }
    stopCamera();
    let dataset;
    try {
        dataset = await decryptSafeTransfer(pendingContainer, parsed.keyB64);
    } catch {
        showToast('Entschlüsselung fehlgeschlagen – Schlüssel falsch oder Datei beschädigt.', 'error', 6000);
        return;
    }
    await applyImported(dataset);
}

async function applyImported(dataset) {
    const customers = Array.isArray(dataset?.customers) ? dataset.customers : [];
    await geocodeByPlz(customers); // Sicherheitsnetz für evtl. fehlende Koordinaten
    state.territories = dataset?.territories || {};
    setCustomers(customers, { fileName: dataset?.fileName, importedAt: dataset?.importedAt });
    emit('customers:changed');
    fitToCustomers();
    receiveDialog.close();

    if (isEnabled()) {
        // Auf diesem Gerät ist bereits ein Tresor aktiv -> direkt verschlüsselt sichern.
        await saveDataset(datasetSnapshot());
        showToast(`Daten empfangen (${customers.length} Kunden) und im Tresor gesichert.`, 'success', 6000);
        return;
    }
    // Kein Tresor aktiv -> Setup erzwingen, damit die Daten sofort geschützt sind.
    openSetupDialog({
        forced: true,
        title: 'Importierte Daten schützen',
        intro: 'Die empfangenen Kundendaten liegen jetzt auf diesem Gerät. Lege eine PIN fest, damit sie <b>AES-256-verschlüsselt</b> gespeichert und beim Öffnen der App per PIN entsperrt werden.',
        onDone: () => showToast(`Daten empfangen (${customers.length} Kunden) und mit dem Tresor gesichert.`, 'success', 6000),
        onDismiss: async () => {
            await saveDataset(datasetSnapshot());
            showToast('Daten empfangen. Achtung: ohne Tresor unverschlüsselt gespeichert – du kannst ihn jederzeit im Tab „Daten" aktivieren.', 'info', 8000);
        }
    });
}

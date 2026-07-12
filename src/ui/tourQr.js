/**
 * QR-Tour-Übergabe – UI.
 * Desktop: aktuelle Tour als QR-Code anzeigen (Canvas, lokal erzeugt).
 * Handy: QR per Kamera scannen (jsQR auf Videobildern, Foto-Fallback) und die
 * Tour übernehmen bzw. direkt navigieren / Termine erzeugen.
 * Es findet keinerlei Netzwerkübertragung statt.
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { state, emit, getCustomer } from '../core/state.js';
import { decodeTourPayload, matchStopsToCustomers, encodeTourUrl } from '../features/tourShare.js';
import { googleMapsLink } from '../features/tour.js';
import { downloadIcs } from '../features/tourExport.js';
import { combinePlanStart } from '../features/dayPlanner.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let shareDialog = null;
let scanDialog = null;
let videoStream = null;
let scanLoopId = 0;
let received = null; // dekodierte Tour aus dem letzten Scan

export function initTourQr() {
    shareDialog = document.getElementById('qr-share-dialog');
    scanDialog = document.getElementById('qr-scan-dialog');
    shareDialog.querySelector('.dialog-close').addEventListener('click', () => shareDialog.close());
    scanDialog.querySelector('.dialog-close').addEventListener('click', () => scanDialog.close());
    scanDialog.addEventListener('close', stopCamera);

    document.getElementById('btn-tour-scan').addEventListener('click', openScanDialog);
    document.getElementById('qr-scan-file').addEventListener('change', onScanFile);
    document.getElementById('qr-received-adopt').addEventListener('click', adoptReceivedTour);
    document.getElementById('qr-received-gmaps').addEventListener('click', () => {
        if (!received) return;
        const link = googleMapsLink(received.start, received.stops, received.roundTrip);
        if (link) window.open(link, '_blank', 'noopener');
    });
    document.getElementById('qr-received-ics').addEventListener('click', () => {
        if (!received) return;
        const pseudo = received.stops.map((s) => ({
            name: s.name, strasse: s.adresse, plz: '', ort: '', telefon: s.telefon,
            nummer: s.nummer, lat: s.lat, lng: s.lng
        }));
        downloadIcs(received.start, pseudo, {
            startTime: combinePlanStart(received.date, received.startTime),
            visitMinutes: received.visitMinutes,
            tourName: received.tourName
        });
        showToast('Kalender-Datei (.ics) erstellt.', 'success');
    });
}

/**
 * Vom Tour-Panel aufgerufen: die Tour als QR-Code (App-URL) anzeigen. Die URL
 * öffnet beim Scannen mit der normalen Handy-Kamera direkt die PWA/den Browser.
 * @param {string} encoded  Ergebnis von encodeTourPayload
 */
export async function openShareDialog(encoded, { stopCount, skipped = 0 } = {}) {
    const canvas = document.getElementById('qr-share-canvas');
    const url = encodeTourUrl(encoded, window.location.origin + window.location.pathname);
    try {
        // ECC „L": maximale Kapazität für die längere URL; Bildschirm→Kamera ist
        // ein sauberer Kanal, hohe Fehlerkorrektur ist hier nicht nötig.
        await QRCode.toCanvas(canvas, url, { errorCorrectionLevel: 'L', width: 380, margin: 2 });
    } catch {
        showToast('QR-Code konnte nicht erzeugt werden – Tour zu groß. Bitte Stopps reduzieren.', 'error', 6000);
        return;
    }
    document.getElementById('qr-share-info').textContent =
        `${stopCount} Stopp${stopCount === 1 ? '' : 's'} im Code` +
        (skipped > 0 ? ` · ${skipped} weitere passen nicht hinein` : '') +
        ' · mit der Handy-Kamera scannen';
    shareDialog.showModal();
}

/**
 * Beim App-Start aufgerufen: liegt eine Tour im URL-Fragment (#t=…), direkt den
 * Empfangs-Dialog öffnen. So genügt das Scannen des QR-Codes mit der Kamera.
 * @param {object} payload  bereits dekodierte Tour (aus decodeTourPayload)
 */
export function openReceivedFromUrl(payload) {
    if (!payload) return;
    received = payload;
    if (!scanDialog) scanDialog = document.getElementById('qr-scan-dialog');
    renderReceived();
    scanDialog.showModal();
}

function openScanDialog() {
    received = null;
    document.getElementById('qr-scan-result').hidden = true;
    document.getElementById('qr-scan-live').hidden = false;
    scanDialog.showModal();
    startCamera();
}

async function startCamera() {
    const statusEl = document.getElementById('qr-scan-status');
    const video = document.getElementById('qr-scan-video');
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, audio: false
        });
        video.srcObject = videoStream;
        await video.play();
        statusEl.textContent = 'Kamera auf den QR-Code am Desktop richten …';
        scanLoop(video);
    } catch {
        statusEl.textContent = 'Kamera nicht verfügbar – bitte unten ein Foto des QR-Codes wählen.';
    }
}

function stopCamera() {
    scanLoopId++;
    if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
    }
    const video = document.getElementById('qr-scan-video');
    if (video) video.srcObject = null;
}

function scanLoop(video) {
    const loopId = ++scanLoopId;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
        if (loopId !== scanLoopId || !scanDialog.open) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height);
            if (code?.data && tryHandlePayload(code.data)) return;
        }
        setTimeout(tick, 220);
    };
    tick();
}

async function onScanFile(e) {
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
    if (!code?.data || !tryHandlePayload(code.data)) {
        showToast('Kein TourFuchs-QR-Code im Bild gefunden.', 'error');
    }
}

function tryHandlePayload(text) {
    const payload = decodeTourPayload(text);
    if (!payload) return false;
    received = payload;
    stopCamera();
    renderReceived();
    return true;
}

function renderReceived() {
    document.getElementById('qr-scan-live').hidden = true;
    const result = document.getElementById('qr-scan-result');
    result.hidden = false;

    const dateText = received.date
        ? new Date(`${received.date}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'ohne Datum';
    document.getElementById('qr-scan-summary').innerHTML =
        `<b>${escapeHtml(received.tourName)}</b> · ${received.stops.length} Stopps · ${escapeHtml(dateText)}, `
        + `Start ${escapeHtml(received.startTime)} Uhr · ${received.visitMinutes} min je Besuch`;
    document.getElementById('qr-scan-stoplist').innerHTML = received.stops.map((s, i) =>
        `<div class="qr-stop-row"><b>${i + 1}.</b> ${escapeHtml(s.name)}${s.adresse ? ` <span class="muted small">${escapeHtml(s.adresse)}</span>` : ''}</div>`
    ).join('');

    const { matched, unmatched } = matchStopsToCustomers(received.stops, state.customers);
    const adopt = document.getElementById('qr-received-adopt');
    adopt.disabled = matched.length === 0;
    document.getElementById('qr-scan-matchinfo').textContent = matched.length === 0
        ? 'Keine Stopps in den lokalen Kundendaten gefunden – Navigation und Kalender funktionieren trotzdem direkt aus dem QR-Code.'
        : matched.length < received.stops.length
            ? `${matched.length} von ${received.stops.length} Stopps in den lokalen Kundendaten gefunden – nur diese können als Tour übernommen werden.`
            : 'Alle Stopps in den lokalen Kundendaten gefunden.';
}

function adoptReceivedTour() {
    if (!received) return;
    const { matched, unmatched } = matchStopsToCustomers(received.stops, state.customers);
    if (matched.length === 0) return;

    state.tour.bezirk = '__all__'; // Stopps können außerhalb des gewählten Bezirks liegen
    state.tour.start = { lat: received.start.lat, lng: received.start.lng, label: received.start.label || 'Übernommener Start' };
    state.tour.destination = null;
    state.tour.roundTrip = received.roundTrip;
    state.tour.stops = matched.map(({ customer }) => customer.id).filter((id) => getCustomer(id));

    const dateInput = document.getElementById('plan-date');
    const timeInput = document.getElementById('plan-time');
    const visitInput = document.getElementById('plan-visit-min');
    if (dateInput && received.date) dateInput.value = received.date;
    if (timeInput && received.startTime) timeInput.value = received.startTime;
    if (visitInput && received.visitMinutes) visitInput.value = received.visitMinutes;

    emit('tour:scope-changed');
    emit('tour:changed');
    scanDialog.close();
    showToast(unmatched.length === 0
        ? `Tour mit ${matched.length} Stopps übernommen.`
        : `${matched.length} Stopps übernommen, ${unmatched.length} nicht in den lokalen Daten gefunden.`,
        'success', 6000);
}

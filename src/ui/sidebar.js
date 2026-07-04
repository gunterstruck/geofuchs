/**
 * Sidebar: Tabs (Daten / Gebiete / Team / Tour), Datenstatus,
 * Gebietsebenen-Auswahl und Team-Filter (Vertriebsbeauftragte & Gruppen).
 */

import { CONFIG } from '../core/config.js';
import { state, on, emit, UNASSIGNED, visibleCustomers, setCustomers, activeDims, DIMENSIONS } from '../core/state.js';
import { geocodeExact } from '../services/geocode.js';
import { saveDataset, clearDataset, saveSettings } from '../services/storage.js';
import { STATUS_COLORS, STATUS_LABELS } from '../features/visits.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let geocodeHandle = null;

export function initSidebar() {
    // Tabs
    document.querySelectorAll('.tab-button').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.ui.activeTab = btn.dataset.tab;
            document.querySelectorAll('.tab-button').forEach((b) => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.tab-panel').forEach((p) =>
                p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`));
        });
    });

    // Sidebar-Toggle (mobil)
    const sidebar = document.getElementById('sidebar');
    const applySidebar = () => {
        sidebar.classList.toggle('open', state.ui.sidebarOpen);
        document.getElementById('sidebar-toggle').setAttribute('aria-expanded', String(state.ui.sidebarOpen));
    };
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        state.ui.sidebarOpen = !state.ui.sidebarOpen;
        applySidebar();
    });
    applySidebar();

    // Gebietsebene
    const levelSelect = document.getElementById('level-select');
    levelSelect.innerHTML = Object.entries(CONFIG.levels)
        .map(([key, def]) => `<option value="${key}"${key === state.level ? ' selected' : ''}>${def.label}</option>`)
        .join('');
    levelSelect.addEventListener('change', () => {
        state.level = levelSelect.value;
        emit('level:changed');
        persistSettings();
    });

    on('map:loading', (loading) => {
        document.getElementById('level-loading').style.display = loading ? 'inline-block' : 'none';
    });

    // Anzeige-/Farbmodus
    const colorSelect = document.getElementById('colormode-select');
    colorSelect.value = state.colorMode;
    colorSelect.addEventListener('change', () => {
        state.colorMode = colorSelect.value;
        renderLegend();
        emit('colormode:changed');
        persistSettings();
    });
    renderLegend();

    // Gebiets-Cockpit öffnen
    document.getElementById('btn-cockpit').addEventListener('click', () => {
        if (state.customers.length === 0) return showToast('Bitte zuerst Kundendaten laden.', 'info');
        emit('cockpit:open');
    });

    // Daten-Aktionen
    document.getElementById('btn-export').addEventListener('click', async () => {
        if (state.customers.length === 0) return showToast('Keine Kundendaten vorhanden.', 'info');
        const { exportCustomers } = await import('../services/excel.js');
        exportCustomers(state.customers);
    });
    document.getElementById('btn-clear').addEventListener('click', async () => {
        if (state.customers.length === 0) return;
        if (!confirm('Alle Kundendaten aus dem Browser löschen?')) return;
        await clearDataset();
        state.tour.start = null;
        state.tour.stops = [];
        state.fileName = null;
        setCustomers([]);
        emit('tour:changed');
        showToast('Kundendaten gelöscht.', 'success');
    });

    // Exakte Geocodierung (Nominatim)
    document.getElementById('btn-geocode').addEventListener('click', toggleExactGeocoding);

    on('customers:changed', () => { renderDataStatus(); renderTeamFilters(); renderLegend(); });
    on('filters:changed', renderDataStatus);
    renderDataStatus();
    renderTeamFilters();
}

function legendFromMap(entries) {
    return entries.length
        ? entries.map(([name, meta]) => `<span class="legend-item"><span class="dot" style="background:${meta.color}"></span>${escapeHtml(name)}</span>`).join('')
        : '<span class="muted small">Nach Datenimport sichtbar.</span>';
}

function renderLegend() {
    const el = document.getElementById('colormode-legend');
    const hint = document.getElementById('colormode-hint');
    if (!el) return;
    const mode = state.colorMode;

    const hints = {
        auto: 'Zoom bestimmt den Detailgrad: weit → Vertriebsgruppen, mittel → Betriebsbezirke (Flächen mit Umsatz), nah → einzelne Kunden.',
        rep: 'Kunden als Punkte, eingefärbt nach Vertriebsbeauftragtem.',
        bezirk: 'Gebiete flächig nach Betriebsbezirk eingefärbt, mit Name und Umsatzsumme.',
        gruppe: 'Gebiete flächig nach Vertriebsgruppe eingefärbt, mit Name und Umsatzsumme.',
        status: 'Kunden als Punkte, eingefärbt nach Besuchsstatus.'
    };
    if (hint) hint.textContent = hints[mode] ?? '';

    if (mode === 'status') {
        const items = [
            ['ok', STATUS_LABELS.ok], ['faellig', STATUS_LABELS.faellig],
            ['ueberfaellig', STATUS_LABELS.ueberfaellig], ['none', STATUS_LABELS.none]
        ];
        el.innerHTML = items.map(([k, label]) =>
            `<span class="legend-item"><span class="dot" style="background:${STATUS_COLORS[k]}"></span>${label}</span>`).join('');
    } else if (mode === 'bezirk' || mode === 'gruppe') {
        const dim = state.dims[mode];
        el.innerHTML = dim?.active
            ? legendFromMap([...dim.values.entries()].slice(0, 14))
            : `<span class="muted small">Keine Spalte „${mode === 'bezirk' ? 'Betriebsbezirk' : 'Vertriebsgruppe'}" in den Daten.</span>`;
    } else if (mode === 'rep') {
        el.innerHTML = legendFromMap([...state.reps.entries()].slice(0, 14));
    } else {
        // auto
        el.innerHTML = legendFromMap([...state.reps.entries()].slice(0, 14));
    }
}

function persistSettings() {
    const dimVisibility = {};
    for (const def of DIMENSIONS) {
        const dim = state.dims[def.id];
        if (dim) dimVisibility[def.id] = Object.fromEntries([...dim.values].map(([k, v]) => [k, v.visible]));
    }
    saveSettings({
        level: state.level,
        colorMode: state.colorMode,
        repVisibility: Object.fromEntries([...state.reps].map(([k, v]) => [k, v.visible])),
        dimVisibility,
        radiusKm: state.tour.radiusKm
    });
}

// ---- Daten-Tab ----

function renderDataStatus() {
    const el = document.getElementById('data-status');
    if (state.customers.length === 0) {
        el.innerHTML = '<p class="muted">Noch keine Daten geladen.<br>Laden Sie eine Excel-Liste hoch oder probieren Sie die Demo-Daten.</p>';
        document.getElementById('data-actions').style.display = 'none';
        return;
    }
    const total = state.customers.length;
    const located = state.customers.filter((c) => c.lat !== null).length;
    const exact = state.customers.filter((c) => c.geo === 'exakt').length;
    const visible = visibleCustomers().length;
    const gruppenCount = state.dims.gruppe?.active ? state.dims.gruppe.values.size : 0;
    el.innerHTML = `
        <div class="stat-grid">
            <div class="stat"><b>${total}</b><span>Kunden</span></div>
            <div class="stat"><b>${state.reps.size}</b><span>Vertriebler</span></div>
            <div class="stat"><b>${gruppenCount}</b><span>Gruppen</span></div>
            <div class="stat"><b>${visible}</b><span>sichtbar</span></div>
        </div>
        <p class="muted small">${escapeHtml(state.fileName ?? '')}</p>
        <p class="muted small">📍 ${located} verortet (davon ${exact} adressgenau)</p>
    `;
    document.getElementById('data-actions').style.display = 'block';
}

async function toggleExactGeocoding() {
    const btn = document.getElementById('btn-geocode');
    const progress = document.getElementById('geocode-progress');

    if (geocodeHandle) {
        geocodeHandle.cancel();
        return;
    }
    const candidates = state.customers.filter((c) => c.geo !== 'exakt' && c.strasse);
    if (candidates.length === 0) {
        showToast('Keine Kunden mit Straßenadresse zum Nachschärfen gefunden.', 'info');
        return;
    }
    if (!confirm(
        `${candidates.length} Adressen werden über OpenStreetMap (Nominatim) exakt geocodiert.\n` +
        'Das dauert ca. 1 Sekunde pro Adresse und benötigt Internet. Fortfahren?'
    )) return;

    btn.textContent = '⏸ Abbrechen';
    progress.style.display = 'block';

    geocodeHandle = geocodeExact(state.customers, (done, totalCount) => {
        progress.textContent = `Geocodiere… ${done}/${totalCount}`;
    });

    const result = await geocodeHandle.run;
    geocodeHandle = null;
    btn.textContent = '🎯 Adressen exakt verorten';
    progress.style.display = 'none';

    await saveDataset({ customers: state.customers, fileName: state.fileName, importedAt: state.importedAt });
    emit('customers:changed');
    showToast(
        result.cancelled
            ? `Abgebrochen – ${result.updated} Adressen exakt verortet.`
            : `${result.updated} Adressen exakt verortet${result.failed ? `, ${result.failed} nicht gefunden` : ''}.`,
        'success', 6000
    );
}

// ---- Team-Tab (Filter) ----

/** Kunden je Feldwert zählen */
function countBy(field) {
    const counts = new Map();
    for (const c of state.customers) {
        const key = String(c[field] ?? '').trim() || UNASSIGNED;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

function renderTeamFilters() {
    const repsEl = document.getElementById('rep-filters');
    const dimsEl = document.getElementById('dim-filters');

    if (state.reps.size === 0) {
        repsEl.innerHTML = '<p class="muted">Keine Daten geladen.</p>';
        dimsEl.innerHTML = '';
        return;
    }

    // Vertriebsbeauftragte (mit Farbe)
    const repCounts = countBy('vb');
    repsEl.innerHTML = [...state.reps.entries()].map(([name, rep]) => `
        <label class="filter-row">
            <input type="checkbox" data-rep="${escapeHtml(name)}" ${rep.visible ? 'checked' : ''}>
            <span class="dot" style="background:${rep.color}"></span>
            <span class="filter-name">${escapeHtml(name)}</span>
            <span class="count">${repCounts.get(name) ?? 0}</span>
        </label>`).join('') + `
        <div class="filter-bulk">
            <button type="button" data-bulk-rep="1">Alle</button>
            <button type="button" data-bulk-rep="0">Keine</button>
        </div>`;

    repsEl.querySelectorAll('input[data-rep]').forEach((cb) => {
        cb.addEventListener('change', () => {
            state.reps.get(cb.dataset.rep).visible = cb.checked;
            emit('filters:changed');
            persistSettings();
        });
    });
    repsEl.querySelectorAll('[data-bulk-rep]').forEach((btn) => btn.addEventListener('click', () => {
        const value = btn.dataset.bulkRep === '1';
        state.reps.forEach((v) => { v.visible = value; });
        repsEl.querySelectorAll('input[data-rep]').forEach((cb) => { cb.checked = value; });
        emit('filters:changed');
        persistSettings();
    }));

    // Vertriebshierarchie (nur aktive Ebenen: Channel -> Gruppe -> Bezirk)
    const dims = activeDims();
    if (dims.length === 0) {
        dimsEl.innerHTML = '<p class="muted small">Keine Hierarchie-Ebenen in den Daten. Ergänzen Sie in der Excel-Liste optional die Spalten Vertriebschannel, Vertriebsgruppe oder Betriebsbezirk.</p>';
        return;
    }

    dimsEl.innerHTML = dims.map((dim) => {
        const def = DIMENSIONS.find((d) => d.field === dim.field);
        const counts = countBy(dim.field);
        const rows = [...dim.values.entries()].map(([name, v]) => `
            <label class="filter-row">
                <input type="checkbox" data-dim="${def.id}" data-value="${escapeHtml(name)}" ${v.visible ? 'checked' : ''}>
                <span class="filter-name">${escapeHtml(name)}</span>
                <span class="count">${counts.get(name) ?? 0}</span>
            </label>`).join('');
        return `<div class="dim-block">
            <h3>${escapeHtml(dim.label)}</h3>
            ${rows}
            <div class="filter-bulk">
                <button type="button" data-bulk-dim="${def.id}" data-on="1">Alle</button>
                <button type="button" data-bulk-dim="${def.id}" data-on="0">Keine</button>
            </div>
        </div>`;
    }).join('');

    dimsEl.querySelectorAll('input[data-dim]').forEach((cb) => {
        cb.addEventListener('change', () => {
            const entry = state.dims[cb.dataset.dim]?.values.get(cb.dataset.value);
            if (entry) entry.visible = cb.checked;
            emit('filters:changed');
            persistSettings();
        });
    });
    dimsEl.querySelectorAll('[data-bulk-dim]').forEach((btn) => btn.addEventListener('click', () => {
        const dim = state.dims[btn.dataset.bulkDim];
        const value = btn.dataset.on === '1';
        dim.values.forEach((v) => { v.visible = value; });
        dimsEl.querySelectorAll(`input[data-dim="${btn.dataset.bulkDim}"]`).forEach((cb) => { cb.checked = value; });
        emit('filters:changed');
        persistSettings();
    }));
}

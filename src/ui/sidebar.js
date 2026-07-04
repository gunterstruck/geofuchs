/**
 * Sidebar: Tabs (Daten / Gebiete / Team / Tour), Datenstatus,
 * Gebietsebenen-Auswahl und Team-Filter (Vertriebsbeauftragte & Gruppen).
 */

import { CONFIG } from '../core/config.js';
import { state, on, emit, UNASSIGNED, visibleCustomers, setCustomers } from '../core/state.js';
import { geocodeExact } from '../services/geocode.js';
import { saveDataset, clearDataset, saveSettings } from '../services/storage.js';
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

    on('customers:changed', () => { renderDataStatus(); renderTeamFilters(); });
    on('filters:changed', renderDataStatus);
    renderDataStatus();
    renderTeamFilters();
}

function persistSettings() {
    saveSettings({
        level: state.level,
        repVisibility: Object.fromEntries([...state.reps].map(([k, v]) => [k, v.visible])),
        groupVisibility: Object.fromEntries([...state.groups].map(([k, v]) => [k, v.visible])),
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
    el.innerHTML = `
        <div class="stat-grid">
            <div class="stat"><b>${total}</b><span>Kunden</span></div>
            <div class="stat"><b>${state.reps.size}</b><span>Vertriebler</span></div>
            <div class="stat"><b>${state.groups.size}</b><span>Gruppen</span></div>
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

function renderTeamFilters() {
    const repsEl = document.getElementById('rep-filters');
    const groupsEl = document.getElementById('group-filters');

    if (state.reps.size === 0) {
        repsEl.innerHTML = '<p class="muted">Keine Daten geladen.</p>';
        groupsEl.innerHTML = '';
        return;
    }

    const counts = new Map();
    const groupCounts = new Map();
    for (const c of state.customers) {
        const vb = c.vb || UNASSIGNED;
        const grp = c.gruppe || UNASSIGNED;
        counts.set(vb, (counts.get(vb) ?? 0) + 1);
        groupCounts.set(grp, (groupCounts.get(grp) ?? 0) + 1);
    }

    repsEl.innerHTML = [...state.reps.entries()].map(([name, rep]) => `
        <label class="filter-row">
            <input type="checkbox" data-rep="${escapeHtml(name)}" ${rep.visible ? 'checked' : ''}>
            <span class="dot" style="background:${rep.color}"></span>
            <span class="filter-name">${escapeHtml(name)}</span>
            <span class="count">${counts.get(name) ?? 0}</span>
        </label>
    `).join('') + `
        <div class="filter-bulk">
            <button type="button" id="reps-all">Alle</button>
            <button type="button" id="reps-none">Keine</button>
        </div>`;

    groupsEl.innerHTML = [...state.groups.entries()].map(([name, grp]) => `
        <label class="filter-row">
            <input type="checkbox" data-group="${escapeHtml(name)}" ${grp.visible ? 'checked' : ''}>
            <span class="filter-name">${escapeHtml(name)}</span>
            <span class="count">${groupCounts.get(name) ?? 0}</span>
        </label>
    `).join('') + `
        <div class="filter-bulk">
            <button type="button" id="groups-all">Alle</button>
            <button type="button" id="groups-none">Keine</button>
        </div>`;

    repsEl.querySelectorAll('input[data-rep]').forEach((cb) => {
        cb.addEventListener('change', () => {
            state.reps.get(cb.dataset.rep).visible = cb.checked;
            emit('filters:changed');
            persistSettings();
        });
    });
    groupsEl.querySelectorAll('input[data-group]').forEach((cb) => {
        cb.addEventListener('change', () => {
            state.groups.get(cb.dataset.group).visible = cb.checked;
            emit('filters:changed');
            persistSettings();
        });
    });

    const setAll = (map, value, selector, root) => {
        map.forEach((v) => { v.visible = value; });
        root.querySelectorAll(selector).forEach((cb) => { cb.checked = value; });
        emit('filters:changed');
        persistSettings();
    };
    document.getElementById('reps-all').addEventListener('click', () => setAll(state.reps, true, 'input[data-rep]', repsEl));
    document.getElementById('reps-none').addEventListener('click', () => setAll(state.reps, false, 'input[data-rep]', repsEl));
    document.getElementById('groups-all').addEventListener('click', () => setAll(state.groups, true, 'input[data-group]', groupsEl));
    document.getElementById('groups-none').addEventListener('click', () => setAll(state.groups, false, 'input[data-group]', groupsEl));
}

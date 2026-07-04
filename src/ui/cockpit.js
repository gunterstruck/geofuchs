/**
 * Gebiets-Cockpit
 * - Kennzahlen je Vertriebsbeauftragtem (Kunden, Umsatz, Auslastungsbalken)
 * - Was-wäre-wenn: Gebiete (Landkreise oder PLZ) gefiltert auswählen und die
 *   darin enthaltenen (gefilterten) Kunden testweise einem anderen
 *   Vertriebsbeauftragten zuweisen; Live-Deltas; Übernahme in die echten Daten.
 *
 * Filter reduzieren die Gebietsliste (Ebene, Such-/PLZ-Präfix, aktueller VB,
 * Vertriebshierarchie). So lassen sich z. B. gezielt „alle PLZ 52xxx" oder
 * „nur Betriebsbezirk Ost" auf einen anderen VB umbuchen.
 *
 * Die Simulation arbeitet mit einem Overlay (Kunden-ID -> neuer VB) und lässt
 * die eigentlichen Kundendaten unangetastet, bis „Übernehmen" gedrückt wird.
 */

import { CONFIG } from '../core/config.js';
import { state, emit, on, repColor, setCustomers, getCustomer, activeDims, DIMENSIONS, UNASSIGNED } from '../core/state.js';
import { loadLevel } from '../services/geodata.js';
import { regionMembership } from '../features/territory.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const MAX_ROWS = 400;

let dialog = null;
let overrides = new Map();     // customerId -> neuer VB
let opsLog = [];               // [{ desc, count, toRep }]
let membership = [];           // [{ key, name, customerIds }] der aktiven Ebene
let selected = new Set();      // ausgewählte regionKeys

const filters = { search: '', vb: '', dim: {} };

export function initCockpit() {
    dialog = document.getElementById('cockpit-dialog');
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());

    document.getElementById('sim-level').addEventListener('change', onLevelChange);
    document.getElementById('sim-search').addEventListener('input', (e) => { filters.search = e.target.value; renderRegionList(); });
    document.getElementById('sim-filter-vb').addEventListener('change', (e) => { filters.vb = e.target.value; renderRegionList(); });
    document.getElementById('sim-select-all').addEventListener('change', toggleSelectAll);
    document.getElementById('sim-apply').addEventListener('click', assignSelected);
    document.getElementById('sim-reset').addEventListener('click', resetSimulation);
    document.getElementById('sim-commit').addEventListener('click', commitSimulation);

    on('cockpit:open', open);
}

async function open() {
    overrides = new Map();
    opsLog = [];
    selected = new Set();
    filters.search = '';
    filters.vb = '';
    filters.dim = {};
    document.getElementById('sim-search').value = '';
    renderLevelSelect();
    renderFilterControls();
    await loadMembership();
    renderAll();
    dialog.showModal();
}

function renderLevelSelect() {
    const sel = document.getElementById('sim-level');
    sel.innerHTML = Object.entries(CONFIG.levels)
        .filter(([key]) => key !== 'none')
        .map(([key, def]) => `<option value="${key}"${key === state.level ? ' selected' : ''}>${def.label}</option>`)
        .join('');
}

async function onLevelChange(e) {
    state.level = e.target.value;
    // Karte und Sidebar-Auswahl mitziehen
    const mainSel = document.getElementById('level-select');
    if (mainSel) mainSel.value = state.level;
    emit('level:changed');
    selected = new Set();
    document.getElementById('sim-select-all').checked = false;
    await loadMembership();
    renderRegionList();
}

async function loadMembership() {
    const info = document.getElementById('sim-region-info');
    if (state.level === 'none' || !CONFIG.levels[state.level]?.file) {
        membership = [];
        info.textContent = 'Bitte eine Gebietsebene wählen.';
        return;
    }
    try {
        const geojson = await loadLevel(state.level);
        membership = geojson ? regionMembership(state.level, geojson, state.customers) : [];
    } catch (error) {
        membership = [];
        info.textContent = `Gebietsdaten konnten nicht geladen werden: ${error.message}`;
    }
}

// ---- Filterlogik ----

function searchDigits() {
    const t = filters.search.trim();
    return /^\d+$/.test(t) ? t : '';
}

function customerMatches(c) {
    if (filters.vb && (c.vb || UNASSIGNED) !== filters.vb) return false;
    for (const def of DIMENSIONS) {
        const val = filters.dim[def.id];
        if (val && (String(c[def.field] ?? '').trim() || UNASSIGNED) !== val) return false;
    }
    const digits = searchDigits();
    if (digits && !String(c.plz ?? '').startsWith(digits)) return false;
    return true;
}

/** Gefilterte Kunden-IDs eines Gebiets */
function filteredIds(region) {
    return region.customerIds.filter((id) => {
        const c = getCustomer(id);
        return c && customerMatches(c);
    });
}

/** Sichtbare Gebiete inkl. gefilterter Kunden und dominantem VB */
function visibleRegions() {
    const digits = searchDigits();
    const text = digits ? '' : filters.search.trim().toLowerCase();
    const result = [];
    for (const region of membership) {
        if (text && !region.name.toLowerCase().includes(text)) continue;
        const ids = filteredIds(region);
        if (ids.length === 0) continue;
        result.push({ region, ids, dom: dominantOf(ids) });
    }
    return result;
}

function dominantOf(ids) {
    const counts = new Map();
    for (const id of ids) {
        const c = getCustomer(id);
        const rep = c ? effectiveRep(c) : UNASSIGNED;
        counts.set(rep, (counts.get(rep) ?? 0) + 1);
    }
    let dom = UNASSIGNED, best = 0;
    for (const [rep, n] of counts) if (n > best) { dom = rep; best = n; }
    return dom;
}

/** Effektiver VB unter Berücksichtigung der Simulation */
function effectiveRep(customer) {
    return overrides.get(customer.id) ?? (customer.vb || UNASSIGNED);
}

// ---- Kennzahlen ----

function computeStats(useOverrides) {
    const stats = new Map();
    for (const c of state.customers) {
        const rep = useOverrides ? effectiveRep(c) : (c.vb || UNASSIGNED);
        if (!stats.has(rep)) stats.set(rep, { count: 0, umsatz: 0 });
        const s = stats.get(rep);
        s.count++;
        s.umsatz += c.umsatz || 0;
    }
    return stats;
}

function renderAll() {
    renderTable();
    renderRepSelects();
    renderRegionList();
    renderChanges();
}

function renderTable() {
    const base = computeStats(false);
    const sim = computeStats(true);
    const hasSim = overrides.size > 0;

    const reps = [...new Set([...base.keys(), ...sim.keys()])]
        .sort((a, b) => (sim.get(b)?.count ?? 0) - (sim.get(a)?.count ?? 0));

    const totalCount = state.customers.length || 1;
    const maxCount = Math.max(1, ...reps.map((r) => sim.get(r)?.count ?? 0));

    const fmtEur = (n) => n ? `${Math.round(n).toLocaleString('de-DE')} €` : '–';
    const delta = (now, before, suffix = '') => {
        const d = now - before;
        if (!hasSim || d === 0) return '';
        const cls = d > 0 ? 'up' : 'down';
        return ` <span class="delta ${cls}">${d > 0 ? '+' : ''}${suffix === '€' ? Math.round(d).toLocaleString('de-DE') + ' €' : d}${suffix && suffix !== '€' ? suffix : ''}</span>`;
    };

    document.getElementById('cockpit-rows').innerHTML = reps.map((rep) => {
        const b = base.get(rep) ?? { count: 0, umsatz: 0 };
        const s = sim.get(rep) ?? { count: 0, umsatz: 0 };
        const share = Math.round((s.count / totalCount) * 100);
        const barW = Math.round((s.count / maxCount) * 100);
        return `<tr>
            <td><span class="dot" style="background:${repColor(rep)}"></span>${escapeHtml(rep)}</td>
            <td class="num">${s.count}${delta(s.count, b.count)}</td>
            <td class="num">${fmtEur(s.umsatz)}${delta(s.umsatz, b.umsatz, '€')}</td>
            <td class="bar-cell">
                <div class="bar-track"><div class="bar-fill" style="width:${barW}%;background:${repColor(rep)}"></div></div>
                <span class="share">${share}%</span>
            </td>
        </tr>`;
    }).join('');

    const counts = reps.filter((r) => r !== UNASSIGNED).map((r) => sim.get(r)?.count ?? 0).filter((n) => n > 0);
    const summaryEl = document.getElementById('cockpit-summary');
    if (counts.length >= 2) {
        const max = Math.max(...counts);
        const min = Math.min(...counts);
        const ratio = (max / min).toFixed(1);
        const balanced = max / min <= 1.5;
        summaryEl.innerHTML = `<div class="balance-note ${balanced ? 'ok' : 'warn'}">
            ${balanced ? '✅ Gebiete gut ausbalanciert' : '⚠️ Ungleiche Verteilung'} –
            größtes Gebiet hat das ${ratio}-fache des kleinsten (${max} vs. ${min} Kunden).
        </div>`;
    } else {
        summaryEl.innerHTML = '';
    }
}

// ---- Filter-Steuerung ----

function renderFilterControls() {
    const vbSel = document.getElementById('sim-filter-vb');
    const reps = [...new Set(state.customers.map((c) => c.vb || UNASSIGNED))].sort((a, b) => a.localeCompare(b, 'de'));
    vbSel.innerHTML = '<option value="">alle</option>' + reps.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');

    // Hierarchie-Filter (nur aktive Ebenen)
    const dimWrap = document.getElementById('sim-dim-filters');
    const dims = activeDims();
    dimWrap.innerHTML = dims.map((dim) => {
        const def = DIMENSIONS.find((d) => d.field === dim.field);
        const opts = ['<option value="">alle</option>']
            .concat([...dim.values.keys()].map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)).join('');
        return `<label class="sim-field">${escapeHtml(dim.label)}
            <select data-dimfilter="${def.id}">${opts}</select>
        </label>`;
    }).join('');
    dimWrap.querySelectorAll('select[data-dimfilter]').forEach((sel) => {
        sel.addEventListener('change', () => {
            filters.dim[sel.dataset.dimfilter] = sel.value;
            renderRegionList();
        });
    });
}

function renderRepSelects() {
    const repSel = document.getElementById('sim-rep');
    const reps = [...new Set(state.customers.map((c) => c.vb || UNASSIGNED))].sort((a, b) => a.localeCompare(b, 'de'));
    const current = repSel.value;
    repSel.innerHTML = reps.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    if (reps.includes(current)) repSel.value = current;
}

function renderRegionList() {
    const listEl = document.getElementById('sim-region-list');
    const infoEl = document.getElementById('sim-region-info');
    const visible = visibleRegions();

    const totalCust = visible.reduce((sum, v) => sum + v.ids.length, 0);
    infoEl.textContent = `${visible.length} Gebiet${visible.length === 1 ? '' : 'e'} · ${totalCust} Kunden gefiltert`;

    document.getElementById('sim-apply').disabled = visible.length === 0;
    document.getElementById('sim-select-all').checked = visible.length > 0 && visible.every((v) => selected.has(v.region.key));

    if (visible.length === 0) {
        listEl.innerHTML = '<p class="muted small">Keine Gebiete für die aktuellen Filter.</p>';
        return;
    }

    const shown = visible.slice(0, MAX_ROWS);
    listEl.innerHTML = shown.map(({ region, ids, dom }) => `
        <label class="sim-region-row">
            <input type="checkbox" data-region="${escapeHtml(region.key)}" ${selected.has(region.key) ? 'checked' : ''}>
            <span class="sim-region-name">${escapeHtml(region.name)}</span>
            <span class="sim-region-meta"><span class="dot" style="background:${repColor(dom)}"></span>${escapeHtml(dom)} · ${ids.length}</span>
        </label>
    `).join('') + (visible.length > MAX_ROWS
        ? `<p class="muted small">… ${visible.length - MAX_ROWS} weitere – bitte Filter verfeinern.</p>` : '');

    listEl.querySelectorAll('input[data-region]').forEach((cb) => {
        cb.addEventListener('change', () => {
            if (cb.checked) selected.add(cb.dataset.region);
            else selected.delete(cb.dataset.region);
            document.getElementById('sim-select-all').checked = shown.every((v) => selected.has(v.region.key));
        });
    });
}

function toggleSelectAll(e) {
    const visible = visibleRegions().slice(0, MAX_ROWS);
    if (e.target.checked) visible.forEach((v) => selected.add(v.region.key));
    else visible.forEach((v) => selected.delete(v.region.key));
    renderRegionList();
}

function assignSelected() {
    const toRep = document.getElementById('sim-rep').value;
    if (!toRep) return;
    const visible = visibleRegions();
    const chosen = visible.filter((v) => selected.has(v.region.key));
    if (chosen.length === 0) {
        showToast('Bitte mindestens ein Gebiet auswählen.', 'info');
        return;
    }

    let moved = 0;
    for (const { ids } of chosen) {
        for (const id of ids) {
            const c = getCustomer(id);
            if (c && (c.vb || UNASSIGNED) !== toRep) { overrides.set(id, toRep); moved++; }
        }
    }

    // Kurzbeschreibung mit aktiven Filtern
    const parts = [];
    if (filters.vb) parts.push(`VB ${filters.vb}`);
    for (const def of DIMENSIONS) if (filters.dim[def.id]) parts.push(filters.dim[def.id]);
    if (searchDigits()) parts.push(`PLZ ${searchDigits()}xxx`);
    const scope = parts.length ? ` (${parts.join(', ')})` : '';
    opsLog.push({ desc: `${chosen.length} Gebiet${chosen.length === 1 ? '' : 'e'}${scope}`, count: moved, toRep });

    selected = new Set();
    document.getElementById('sim-select-all').checked = false;
    renderAll();
    showToast(moved > 0 ? `${moved} Kunden → ${toRep} (Simulation)` : 'Keine Änderung – Kunden gehören bereits zu diesem VB.', moved > 0 ? 'success' : 'info');
}

function resetSimulation() {
    overrides = new Map();
    opsLog = [];
    selected = new Set();
    document.getElementById('sim-select-all').checked = false;
    renderAll();
}

function renderChanges() {
    const el = document.getElementById('sim-changes');
    document.getElementById('sim-commit').disabled = overrides.size === 0;
    if (overrides.size === 0) { el.innerHTML = ''; return; }

    // Zusammenfassung je Ziel-VB
    const byRep = new Map();
    for (const rep of overrides.values()) byRep.set(rep, (byRep.get(rep) ?? 0) + 1);
    const summary = [...byRep.entries()].map(([rep, n]) =>
        `<span class="legend-item"><span class="dot" style="background:${repColor(rep)}"></span>${escapeHtml(rep)}: <b>+${n}</b></span>`).join('');

    el.innerHTML = `<p class="muted small">${overrides.size} Kunden neu zugewiesen:</p>
        <div class="legend">${summary}</div>` +
        opsLog.map((op) => `
            <div class="change-row">
                <span>${escapeHtml(op.desc)}</span>
                <span class="muted small">${op.count} Kd. → <b>${escapeHtml(op.toRep)}</b></span>
            </div>`).join('');
}

function commitSimulation() {
    if (overrides.size === 0) return;
    const n = overrides.size;
    if (!confirm(`${n} Kunden dauerhaft dem simulierten Vertriebsbeauftragten zuweisen?\nDie Gebietszuordnung ändert damit Ihre Kundendaten.`)) return;

    for (const c of state.customers) {
        if (overrides.has(c.id)) c.vb = overrides.get(c.id);
    }
    setCustomers(state.customers, { fileName: state.fileName, importedAt: state.importedAt });
    emit('dataset:dirty');

    dialog.close();
    showToast(`${n} Kunden neu zugewiesen und gespeichert.`, 'success', 6000);
}

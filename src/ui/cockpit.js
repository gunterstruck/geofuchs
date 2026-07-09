/**
 * Gebiets-Cockpit
 * - Kennzahlen je Vertriebsbezirk (Kunden, Umsatz, Auslastungsbalken)
 * - Was-wäre-wenn: Gebiete (Landkreise oder PLZ) gefiltert auswählen und die
 *   darin enthaltenen (gefilterten) Kunden testweise einem anderen
 *   Vertriebsbezirken oder Gruppen zuweisen; Live-Deltas; Übernahme in die echten Daten.
 *
 * Filter reduzieren die Gebietsliste (Ebene, Such-/PLZ-Präfix,
 * Vertriebshierarchie). So lassen sich z. B. gezielt „alle PLZ 52xxx" oder
 * „nur Vertriebsbezirk Ost" auf einen anderen Bezirk umbuchen.
 *
 * Die Simulation arbeitet mit einem Overlay (Kunden-ID -> neuer Zielwert) und lässt
 * die eigentlichen Kundendaten unangetastet, bis „Übernehmen" gedrückt wird.
 */

import { CONFIG } from '../core/config.js';
import { state, emit, on, attrColor, setCustomers, setTerritory, getTerritory, getCustomer, DIMENSIONS, UNASSIGNED } from '../core/state.js';
import { loadLevel, regionName, regionKey } from '../services/geodata.js';
import { regionMembership } from '../features/territory.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const MAX_ROWS = 400;
const KPI_COLLAPSED_LIMIT = 6;

let dialog = null;
let overrides = new Map();     // customerId -> neuer Zielwert (für assignAttr)
let pendingTerr = new Map();   // territoryId -> { value, name } (für assignAttr)
let opsLog = [];               // [{ desc, count, revenue, toRep, territoryIds }]
let membership = [];           // [{ key, name, customerIds }] mit Kunden
let allRegions = [];           // ALLE Gebiete der Ebene (auch ohne Kunden)
let selected = new Set();      // ausgewählte regionKeys
let assignAttr = 'bezirk';     // Zuweisungs-Ziel: Gebietsebene (bezirk | gruppe | channel)
let includeEmpty = false;      // Gebiete ohne Kunden einbeziehen
let kpiSearch = '';            // Kennzahlen-Filter
let kpiSort = 'umsatz';        // Kennzahlen-Sortierung
let showAllKpis = false;       // kompakte Top/Flop-Ansicht im Cockpit
let groupScope = '';           // Vertriebsgruppe-Fokus im Cockpit
let simulationMapActive = false;
let simulationMapMode = 'changes';
let undoStack = [];

const filters = { search: '', dim: {} };

// ---- Zuweisungs-Attribut (Vertriebsbezirk / Gruppe / …) ----
function assignableDims() {
    return ['bezirk', 'gruppe', 'channel']
        .map((id) => state.dims[id]?.active ? { id, label: state.dims[id].label } : null)
        .filter(Boolean);
}

function attrLabel(attr) {
    return state.dims[attr]?.label ?? attr;
}
function attrValueOf(customer) {
    return String(customer[assignAttr] ?? '').trim() || UNASSIGNED;
}
function effectiveValue(customer) {
    return overrides.get(customer.id) ?? attrValueOf(customer);
}
function valueColor(value) {
    return attrColor(assignAttr, value);
}
function targetValues() {
    return [...new Set(scopedCustomers().map(attrValueOf))].filter((v) => v !== UNASSIGNED)
        .sort((a, b) => a.localeCompare(b, 'de'));
}

function groupValueOf(customer) {
    return String(customer?.gruppe ?? '').trim() || UNASSIGNED;
}

function groupOptions() {
    const values = state.dims.gruppe?.active
        ? [...state.dims.gruppe.values.keys()]
        : [...new Set(state.customers.map(groupValueOf))];
    return values.filter((v) => v !== UNASSIGNED).sort((a, b) => a.localeCompare(b, 'de'));
}

function inGroupScope(customer) {
    return !groupScope || groupValueOf(customer) === groupScope;
}

function scopedCustomers() {
    return state.customers.filter(inGroupScope);
}

function formatRevenue(value) {
    return `${Math.round(value || 0).toLocaleString('de-DE')} €`;
}

function resetSimulationState() {
    overrides = new Map();
    pendingTerr = new Map();
    opsLog = [];
    undoStack = [];
    selected = new Set();
    const selectAll = document.getElementById('sim-select-all');
    if (selectAll) selectAll.checked = false;
}

function snapshotSimulation() {
    return {
        overrides: new Map(overrides),
        pendingTerr: new Map([...pendingTerr].map(([id, info]) => [
            id,
            { ...info, customerIds: [...(info.customerIds || [])] }
        ])),
        opsLog: opsLog.map((op) => ({ ...op, territoryIds: [...(op.territoryIds || [])] }))
    };
}

function undoSimulationStep() {
    const previous = undoStack.pop();
    if (!previous) return;
    overrides = previous.overrides;
    pendingTerr = previous.pendingTerr;
    opsLog = previous.opsLog;
    selected = new Set();
    document.getElementById('sim-select-all').checked = false;
    renderAll();
    showToast('Letzten Simulationsschritt zurückgenommen.', 'info');
}

function simulationTotals() {
    const customers = [...overrides.keys()].map((id) => getCustomer(id)).filter(Boolean);
    return {
        regions: pendingTerr.size,
        customers: customers.length,
        revenue: customers.reduce((sum, customer) => sum + (customer.umsatz || 0), 0)
    };
}

function simulationPayload(active = true) {
    return {
        active,
        mode: simulationMapMode,
        level: state.level,
        attr: assignAttr,
        territories: new Map(pendingTerr),
        overrides: new Map(overrides)
    };
}

function updateSimulationMapBar() {
    const bar = document.getElementById('simulation-map-bar');
    bar.hidden = !simulationMapActive;
    if (!simulationMapActive) return;
    const totals = simulationTotals();
    document.getElementById('simulation-map-summary').textContent =
        `${totals.regions} Gebiet${totals.regions === 1 ? '' : 'e'} · ${totals.customers} Kunden · ${formatRevenue(totals.revenue)}`;
    bar.querySelectorAll('[data-simulation-view]').forEach((button) => {
        button.classList.toggle('active', button.dataset.simulationView === simulationMapMode);
    });
}

function showSimulationMap() {
    if (pendingTerr.size === 0 && overrides.size === 0) {
        dialog.close();
        return;
    }
    simulationMapActive = true;
    simulationMapMode = 'changes';
    dialog.close();
    updateSimulationMapBar();
    emit('simulation:preview', simulationPayload());
}

function hideSimulationMap() {
    simulationMapActive = false;
    updateSimulationMapBar();
    emit('simulation:preview', { active: false });
}

function editSimulation() {
    hideSimulationMap();
    renderAll();
    dialog.showModal();
    dialog.scrollTop = Math.max(0, dialog.scrollHeight - dialog.clientHeight);
}

export function initCockpit() {
    dialog = document.getElementById('cockpit-dialog');
    document.getElementById('cockpit-to-map').addEventListener('click', showSimulationMap);

    document.getElementById('sim-level').addEventListener('change', onLevelChange);
    document.getElementById('sim-search').addEventListener('input', (e) => { filters.search = e.target.value; renderRegionList(); });
    document.getElementById('sim-select-all').addEventListener('change', toggleSelectAll);
    document.getElementById('sim-include-empty').addEventListener('change', (e) => {
        includeEmpty = e.target.checked;
        selected = new Set();
        renderRegionList();
    });
    document.getElementById('sim-apply').addEventListener('click', assignSelected);
    document.getElementById('sim-undo').addEventListener('click', undoSimulationStep);
    document.getElementById('sim-reset').addEventListener('click', resetSimulation);
    document.getElementById('sim-commit').addEventListener('click', commitSimulation);
    document.getElementById('simulation-map-edit').addEventListener('click', editSimulation);
    document.getElementById('simulation-map-discard').addEventListener('click', () => {
        if (!confirm('Simulation vollständig verwerfen? Die echten Kundendaten bleiben unverändert.')) return;
        hideSimulationMap();
        resetSimulationState();
        renderAll();
        showToast('Simulation verworfen.', 'info');
    });
    document.getElementById('simulation-map-commit').addEventListener('click', commitSimulation);
    document.querySelectorAll('[data-simulation-view]').forEach((button) => {
        button.addEventListener('click', () => {
            simulationMapMode = button.dataset.simulationView;
            updateSimulationMapBar();
            emit('simulation:preview', simulationPayload());
        });
    });
    document.getElementById('cockpit-kpi-search').addEventListener('input', (e) => {
        kpiSearch = e.target.value;
        showAllKpis = Boolean(kpiSearch.trim());
        renderTable();
    });
    document.getElementById('cockpit-kpi-sort').addEventListener('change', (e) => { kpiSort = e.target.value; renderTable(); });
    document.getElementById('cockpit-kpi-toggle').addEventListener('click', () => {
        showAllKpis = !showAllKpis;
        renderTable();
    });
document.getElementById('cockpit-group-scope').addEventListener('change', (e) => {
    groupScope = e.target.value;
    filters.dim.gruppe = '';
    resetSimulationState();
    renderGroupSelect();
    renderAssignAttrSelect();
    renderFilterControls();
    renderAll();
});
    document.getElementById('sim-assign-attr').addEventListener('change', (e) => {
        assignAttr = e.target.value;
        // Zuweisungs-Ziel gewechselt -> laufende Simulation verwerfen
        resetSimulationState();
        renderAll();
    });

    on('cockpit:open', open);
}

async function open() {
    if (pendingTerr.size > 0 || overrides.size > 0) {
        hideSimulationMap();
        renderAll();
        dialog.showModal();
        return;
    }
    resetSimulationState();
    assignAttr = state.dims.bezirk?.active ? 'bezirk' : (assignableDims()[0]?.id ?? 'bezirk');
    includeEmpty = false;
    kpiSearch = '';
    kpiSort = 'umsatz';
    showAllKpis = false;
    groupScope = '';
    filters.search = '';
    filters.dim = {};
    document.getElementById('sim-search').value = '';
    document.getElementById('cockpit-kpi-search').value = '';
    document.getElementById('cockpit-kpi-sort').value = 'umsatz';
    document.getElementById('sim-include-empty').checked = false;
    renderGroupSelect();
    renderLevelSelect();
    renderAssignAttrSelect();
    renderFilterControls();
    await loadMembership();
    renderAll();
    dialog.showModal();
    dialog.scrollTop = 0;
}

function renderAssignAttrSelect() {
    const sel = document.getElementById('sim-assign-attr');
    let options = assignableDims();
    if (groupScope) options = options.filter((o) => o.id !== 'gruppe');
    if (!options.some((o) => o.id === assignAttr)) assignAttr = options[0]?.id ?? 'bezirk';
    sel.innerHTML = options.map((o) => `<option value="${o.id}"${o.id === assignAttr ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
}

function renderGroupSelect() {
    const sel = document.getElementById('cockpit-group-scope');
    const groups = groupOptions();
    sel.innerHTML = '<option value="">Alle Gruppen</option>' +
        groups.map((g) => `<option value="${escapeHtml(g)}"${g === groupScope ? ' selected' : ''}>${escapeHtml(g)}</option>`).join('');
    sel.disabled = groups.length === 0;
    const note = document.getElementById('cockpit-scope-note');
    if (note) {
        note.textContent = groupScope
            ? `Analyse und Simulation sind auf „${groupScope}" begrenzt.`
            : 'Alle Vertriebsgruppen im Vergleich.';
    }
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
        allRegions = [];
        info.textContent = 'Bitte eine Gebietsebene wählen.';
        return;
    }
    try {
        const geojson = await loadLevel(state.level);
        membership = geojson ? regionMembership(state.level, geojson, state.customers) : [];
        // Alle Gebiete der Ebene (auch ohne Kunden) für „Gebiete ohne Kunden einbeziehen"
        const byKey = new Map(membership.map((r) => [r.key, r]));
        allRegions = geojson ? geojson.features.map((f) => {
            const key = regionKey(state.level, f);
            return byKey.get(key) ?? { key, name: regionName(state.level, f), customerIds: [] };
        }) : [];
    } catch (error) {
        membership = [];
        allRegions = [];
        info.textContent = `Gebietsdaten konnten nicht geladen werden: ${error.message}`;
    }
}

// ---- Filterlogik ----

function searchDigits() {
    const t = filters.search.trim();
    return /^\d+$/.test(t) ? t : '';
}

function customerMatches(c) {
    if (!inGroupScope(c)) return false;
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

function regionPlz(region) {
    return region.key.startsWith('plz-') ? region.key.slice(4) : '';
}

/** Sichtbare Gebiete inkl. gefilterter Kunden und dominantem Wert */
function visibleRegions() {
    const digits = searchDigits();
    const text = digits ? '' : filters.search.trim().toLowerCase();
    const source = includeEmpty ? allRegions : membership;
    const result = [];
    for (const region of source) {
        if (text && !region.name.toLowerCase().includes(text)) continue;
        const empty = region.customerIds.length === 0;

        if (empty) {
            if (!includeEmpty) continue;
            if (digits && !regionPlz(region).startsWith(digits)) continue;
            const terr = getTerritory(state.level, region.key);
            if (groupScope && ((terr && terr.gruppe) || UNASSIGNED) !== groupScope) continue;
            result.push({ region, ids: [], dom: (terr && terr[assignAttr]) || '—', empty: true });
        } else {
            const ids = filteredIds(region);
            if (ids.length === 0) continue;
            result.push({ region, ids, dom: dominantOf(ids), empty: false });
        }
    }
    return result;
}

function dominantOf(ids) {
    const counts = new Map();
    for (const id of ids) {
        const c = getCustomer(id);
        const v = c ? effectiveValue(c) : UNASSIGNED;
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let dom = UNASSIGNED, best = 0;
    for (const [v, n] of counts) if (n > best) { dom = v; best = n; }
    return dom;
}

// ---- Kennzahlen (nach assignAttr gruppiert) ----

function computeStats(useOverrides) {
    const stats = new Map();
    for (const c of scopedCustomers()) {
        const key = useOverrides ? effectiveValue(c) : attrValueOf(c);
        if (!stats.has(key)) stats.set(key, { count: 0, umsatz: 0 });
        const s = stats.get(key);
        s.count++;
        s.umsatz += c.umsatz || 0;
    }
    return stats;
}

function renderAll() {
    renderTable();
    renderTargetSelect();
    renderRegionList();
    renderChanges();
}

function renderTable() {
    const headEl = document.getElementById('cockpit-attr-head');
    if (headEl) headEl.textContent = attrLabel(assignAttr);

    const base = computeStats(false);
    const sim = computeStats(true);
    const hasSim = overrides.size > 0;

    const allKeys = [...new Set([...base.keys(), ...sim.keys()])];
    const maxCount = Math.max(1, ...allKeys.map((k) => sim.get(k)?.count ?? 0));
    const maxRevenue = Math.max(1, ...allKeys.map((k) => sim.get(k)?.umsatz ?? 0));

    // Suche + Sortierung (wichtig bei vielen Einträgen, z. B. 40 Bezirke)
    const sortFns = {
        count: (a, b) => (sim.get(b)?.count ?? 0) - (sim.get(a)?.count ?? 0),
        umsatz: (a, b) => (sim.get(b)?.umsatz ?? 0) - (sim.get(a)?.umsatz ?? 0),
        name: (a, b) => a.localeCompare(b, 'de')
    };
    const q = kpiSearch.trim().toLowerCase();
    let keys = allKeys.filter((k) => !q || k.toLowerCase().includes(q));
    keys.sort(sortFns[kpiSort] || sortFns.count);
    const filteredCount = keys.length;
    const canCollapse = !q && filteredCount > KPI_COLLAPSED_LIMIT && kpiSort !== 'name';
    let flopStartKey = null;
    if (canCollapse && !showAllKpis) {
        const top = keys.slice(0, 3);
        const flop = keys.slice(-3).reverse();
        keys = [...new Set([...top, ...flop])];
        flopStartKey = flop[0] ?? null;
    }

    const countEl = document.getElementById('cockpit-kpi-count');
    if (countEl) {
        const unit = attrLabel(assignAttr);
        countEl.textContent = q
            ? `${keys.length} von ${allKeys.length} ${unit}`
            : canCollapse && !showAllKpis ? `Top & Flop 3 von ${allKeys.length} ${unit}` : `${allKeys.length} ${unit}`;
    }

    const toggle = document.getElementById('cockpit-kpi-toggle');
    if (toggle) {
        toggle.hidden = Boolean(q) || filteredCount <= KPI_COLLAPSED_LIMIT || kpiSort === 'name';
        toggle.textContent = showAllKpis ? 'Top & Flop' : 'Alle anzeigen';
    }

    const fmtEur = (n) => n ? `${Math.round(n).toLocaleString('de-DE')} €` : '–';
    const delta = (now, before, suffix = '') => {
        const d = now - before;
        if (!hasSim || d === 0) return '';
        const cls = d > 0 ? 'up' : 'down';
        return ` <span class="delta ${cls}">${d > 0 ? '+' : ''}${suffix === '€' ? Math.round(d).toLocaleString('de-DE') + ' €' : d}${suffix && suffix !== '€' ? suffix : ''}</span>`;
    };

    document.getElementById('cockpit-rows').innerHTML = keys.map((key) => {
        const b = base.get(key) ?? { count: 0, umsatz: 0 };
        const s = sim.get(key) ?? { count: 0, umsatz: 0 };
        const metric = kpiSort === 'umsatz' ? s.umsatz : s.count;
        const metricMax = kpiSort === 'umsatz' ? maxRevenue : maxCount;
        const barW = Math.round((metric / metricMax) * 100);
        const rowClass = key === flopStartKey ? ' class="flop-start"' : '';
        return `<tr${rowClass}>
            <td><span class="dot" style="background:${valueColor(key)}"></span>${escapeHtml(key)}</td>
            <td class="num">${s.count}${delta(s.count, b.count)}</td>
            <td class="num">${fmtEur(s.umsatz)}${delta(s.umsatz, b.umsatz, '€')}</td>
            <td class="bar-cell">
                <div class="bar-track"><div class="bar-fill" style="width:${barW}%;background:${valueColor(key)}"></div></div>
                <span class="share" title="Relativ zum stärksten sichtbaren Wert">${barW}%</span>
            </td>
        </tr>`;
    }).join('');

    renderFairness(sim, allKeys, fmtEur);
}

/**
 * Fairness-Kennzahl: wie ausgewogen sind Kunden und Umsatz über die Einheiten
 * (Vertriebsbezirk bzw. Gruppe) verteilt? Zeigt jeweils größte/kleinste Einheit und
 * den Faktor dazwischen; „ausgewogen" bis Faktor 1,5.
 */
function renderFairness(sim, allKeys, fmtEur) {
    const summaryEl = document.getElementById('cockpit-summary');
    const units = allKeys.filter((k) => k !== UNASSIGNED)
        .map((k) => ({ key: k, count: sim.get(k)?.count ?? 0, umsatz: sim.get(k)?.umsatz ?? 0 }))
        .filter((u) => u.count > 0);
    if (units.length < 2) { summaryEl.innerHTML = ''; return; }

    const byCount = [...units].sort((a, b) => a.count - b.count);
    const cMin = byCount[0], cMax = byCount[byCount.length - 1];
    const cRatio = cMax.count / Math.max(1, cMin.count);
    const balanced = cRatio <= 1.5;

    let top = cMax;
    let weak = cMin;
    let topValue = `${cMax.count} Kunden`;
    let weakValue = `${cMin.count} Kunden`;
    const withRev = units.filter((u) => u.umsatz > 0);
    if (withRev.length >= 2) {
        const byRev = [...withRev].sort((a, b) => a.umsatz - b.umsatz);
        const rMin = byRev[0], rMax = byRev[byRev.length - 1];
        top = rMax;
        weak = rMin;
        topValue = fmtEur(rMax.umsatz);
        weakValue = fmtEur(rMin.umsatz);
    }

    summaryEl.innerHTML = `<div class="cockpit-kpi-cards">
        <div class="cockpit-kpi-card ${balanced ? 'ok' : 'warn'}">
            <span class="kpi-icon">${balanced ? '✓' : '!'}</span>
            <span class="kpi-label">Status</span>
            <b class="kpi-value">${balanced ? 'Ausgewogen' : 'Ungleich verteilt'}</b>
            <small class="kpi-subline">Kunden-Faktor ${cRatio.toFixed(1)}× über ${units.length} ${escapeHtml(attrLabel(assignAttr))}</small>
        </div>
        <div class="cockpit-kpi-card">
            <span class="kpi-icon">↑</span>
            <span class="kpi-label">Top-Bezirk</span>
            <b class="kpi-value">${escapeHtml(topValue)}</b>
            <small class="kpi-subline">${escapeHtml(top.key)}</small>
        </div>
        <div class="cockpit-kpi-card">
            <span class="kpi-icon">↓</span>
            <span class="kpi-label">Schwächster Bezirk</span>
            <b class="kpi-value">${escapeHtml(weakValue)}</b>
            <small class="kpi-subline">${escapeHtml(weak.key)}</small>
        </div>
    </div>`;
}

// ---- Filter-Steuerung ----

function renderFilterControls() {
    // Hierarchie-Filter (nur aktive Gebietsebenen)
    const dimWrap = document.getElementById('sim-dim-filters');
    const dims = assignableDims().filter((dim) => dim.id !== 'gruppe' || !groupScope);
    dimWrap.innerHTML = dims.map((dim) => {
        const def = DIMENSIONS.find((d) => d.id === dim.id);
        const values = state.dims[dim.id]?.values ?? new Map();
        const opts = ['<option value="">alle</option>']
            .concat([...values.keys()].map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)).join('');
        return `<label class="sim-field">${escapeHtml(dim.label)}
            <select data-dimfilter="${def.id}">${opts}</select>
        </label>`;
    }).join('');
    dimWrap.querySelectorAll('select[data-dimfilter]').forEach((sel) => {
        sel.addEventListener('change', () => {
            filters.dim[sel.dataset.dimfilter] = sel.value;
            renderTargetSelect();
            renderRegionList();
        });
    });
}

function renderTargetSelect() {
    const sel = document.getElementById('sim-rep');
    const values = targetValues();
    const current = sel.value;
    sel.innerHTML = values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (values.includes(current)) sel.value = current;
}

function renderRegionList() {
    const listEl = document.getElementById('sim-region-list');
    const infoEl = document.getElementById('sim-region-info');
    const visible = visibleRegions();

    const totalCust = visible.reduce((sum, v) => sum + v.ids.length, 0);
    const emptyCount = visible.filter((v) => v.empty).length;
    const groupText = groupScope ? ` · Gruppe: ${groupScope}` : '';
    infoEl.textContent = `${visible.length} Gebiet${visible.length === 1 ? '' : 'e'} · ${totalCust} Kunden gefiltert${groupText}${emptyCount ? ` · ${emptyCount} ohne Kunden` : ''}`;

    document.getElementById('sim-apply').disabled = visible.length === 0;
    document.getElementById('sim-select-all').checked = visible.length > 0 && visible.every((v) => selected.has(v.region.key));

    if (visible.length === 0) {
        const suffix = includeEmpty ? '' : ' Aktivieren Sie „Auch Gebiete ohne Kunden einbeziehen", um leere Gebiete zuzuordnen.';
        let msg;
        if (!includeEmpty && membership.length === 0) {
            msg = 'Auf dieser Ebene sind keine Kunden verortet.' + suffix;
        } else if (searchDigits()) {
            msg = `Keine Gebiete „${escapeHtml(searchDigits())}xxx".` + suffix;
        } else if (filters.search.trim()) {
            msg = `Kein Gebiet passt zu „${escapeHtml(filters.search.trim())}".` + suffix;
        } else {
            msg = 'Keine Gebiete für die aktuellen Filter.' + suffix;
        }
        listEl.innerHTML = `<p class="muted small">${msg}</p>`;
        return;
    }

    const shown = visible.slice(0, MAX_ROWS);
    const regionRevenue = (ids) => ids.reduce((sum, id) => sum + (getCustomer(id)?.umsatz || 0), 0);
    listEl.innerHTML = shown.map(({ region, ids, dom, empty }) => `
        <label class="sim-region-row${empty ? ' is-empty' : ''}">
            <input type="checkbox" data-region="${escapeHtml(region.key)}" ${selected.has(region.key) ? 'checked' : ''}>
            <span class="sim-region-name">${escapeHtml(region.name)}${empty ? ' <span class="muted small">(leer)</span>' : ''}</span>
            <span class="sim-region-meta">
                <span class="sim-region-owner"><span class="dot" style="background:${valueColor(dom)}"></span>${escapeHtml(dom)}${empty ? '' : ` · ${ids.length}`}</span>
                ${empty ? '' : `<span class="sim-region-revenue">${formatRevenue(regionRevenue(ids))} Umsatz</span>`}
            </span>
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
    const target = document.getElementById('sim-rep').value;
    if (!target) { showToast('Kein Ziel verfügbar – bitte Daten prüfen.', 'info'); return; }
    const visible = visibleRegions();
    const chosen = visible.filter((v) => selected.has(v.region.key));
    if (chosen.length === 0) {
        showToast('Bitte mindestens ein Gebiet auswählen.', 'info');
        return;
    }

    undoStack.push(snapshotSimulation());
    if (undoStack.length > 30) undoStack.shift();

    let moved = 0;
    let movedRevenue = 0;
    for (const { region, ids } of chosen) {
        const territoryId = `${state.level}:${region.key}`;
        const previous = pendingTerr.get(territoryId);
        for (const id of previous?.customerIds || []) overrides.delete(id);
        const movedIds = [];
        // Kunden im Gebiet umbuchen
        for (const id of ids) {
            const c = getCustomer(id);
            if (c && attrValueOf(c) !== target) {
                overrides.set(id, target);
                movedIds.push(id);
                moved++;
                movedRevenue += c.umsatz || 0;
            }
        }
        // Gebietszuordnung (auch für leere Gebiete) merken
        pendingTerr.set(territoryId, {
            value: target,
            group: groupScope || null,
            name: region.name,
            level: state.level,
            key: region.key,
            customerIds: movedIds
        });
    }

    // Kurzbeschreibung mit aktiven Filtern
    const parts = [];
    if (groupScope) parts.push(groupScope);
    for (const def of DIMENSIONS) if (filters.dim[def.id]) parts.push(filters.dim[def.id]);
    if (searchDigits()) parts.push(`PLZ ${searchDigits()}xxx`);
    const scope = parts.length ? ` (${parts.join(', ')})` : '';
    const territoryIds = chosen.map(({ region }) => `${state.level}:${region.key}`);
    const changedIds = new Set(territoryIds);
    opsLog = opsLog.filter((op) => !(op.territoryIds || []).some((id) => changedIds.has(id)));
    opsLog.push({
        desc: `${chosen.length} Gebiet${chosen.length === 1 ? '' : 'e'}${scope}`,
        count: moved,
        revenue: movedRevenue,
        toRep: target,
        territoryIds
    });

    selected = new Set();
    document.getElementById('sim-select-all').checked = false;
    renderAll();
    showToast(`${chosen.length} Gebiet${chosen.length === 1 ? '' : 'e'} → ${target}${moved ? `, ${moved} Kunden umgebucht` : ''} (Simulation)`, 'success');
}

function resetSimulation() {
    hideSimulationMap();
    overrides = new Map();
    pendingTerr = new Map();
    opsLog = [];
    undoStack = [];
    selected = new Set();
    document.getElementById('sim-select-all').checked = false;
    renderAll();
}

function renderChanges() {
    const el = document.getElementById('sim-changes');
    const nothing = overrides.size === 0 && pendingTerr.size === 0;
    document.getElementById('sim-commit').disabled = nothing;
    document.getElementById('sim-undo').disabled = undoStack.length === 0;
    const mapButton = document.getElementById('cockpit-to-map');
    mapButton.textContent = nothing ? 'Zur Karte' : 'Simulation auf Karte prüfen';
    mapButton.classList.toggle('simulation-ready', !nothing);
    if (nothing) { el.innerHTML = ''; return; }

    const movedCustomers = [...overrides.keys()]
        .map((id) => getCustomer(id))
        .filter(Boolean);
    const totalRevenue = movedCustomers.reduce((sum, customer) => sum + (customer.umsatz || 0), 0);

    // Zusammenfassung je Ziel (Gebiete und aktuell umgebuchte Kunden)
    const byTarget = new Map();
    for (const { value } of pendingTerr.values()) {
        const entry = byTarget.get(value) ?? { regions: 0, customers: 0, revenue: 0 };
        entry.regions++;
        byTarget.set(value, entry);
    }
    for (const customer of movedCustomers) {
        const value = overrides.get(customer.id);
        const entry = byTarget.get(value) ?? { regions: 0, customers: 0, revenue: 0 };
        entry.customers++;
        entry.revenue += customer.umsatz || 0;
        byTarget.set(value, entry);
    }
    const summary = [...byTarget.entries()].map(([value, data]) =>
        `<span class="legend-item"><span class="dot" style="background:${valueColor(value)}"></span>${escapeHtml(value)}:
            <b>${data.regions} Gebiet${data.regions === 1 ? '' : 'e'}</b>
            ${data.customers ? ` · ${data.customers} Kd. · ${formatRevenue(data.revenue)}` : ''}
        </span>`).join('');

    el.innerHTML = `<p class="muted small">${pendingTerr.size} Gebiet${pendingTerr.size === 1 ? '' : 'e'} zugeordnet${overrides.size ? `, ${overrides.size} Kunden mit <b>${formatRevenue(totalRevenue)}</b> Umsatz umgebucht` : ''}:</p>
        <div class="legend">${summary}</div>` +
        opsLog.map((op) => `
            <div class="change-row">
                <span>${escapeHtml(op.desc)}</span>
                <span class="change-row-result">${op.count ? `${op.count} Kd. · ${formatRevenue(op.revenue)} ` : ''}→ <b>${escapeHtml(op.toRep)}</b></span>
            </div>`).join('');
}

function commitSimulation() {
    if (overrides.size === 0 && pendingTerr.size === 0) return;
    const label = attrLabel(assignAttr).replace(/\(.*\)/, '').trim();
    if (!confirm(`${pendingTerr.size} Gebiet(e) und ${overrides.size} Kunden dauerhaft „${label}" zuweisen?\nDies aktualisiert Ihre Gebietszuordnungen${overrides.size ? ` und das Feld „${label}" der betroffenen Kunden` : ''}.`)) return;

    const regionCount = pendingTerr.size;
    const customerCount = overrides.size;
    for (const c of state.customers) {
        if (overrides.has(c.id)) c[assignAttr] = overrides.get(c.id);
    }
    for (const info of pendingTerr.values()) {
        setTerritory(info.level, info.key, assignAttr, info.value, info.name);
        if (info.group && assignAttr !== 'gruppe') setTerritory(info.level, info.key, 'gruppe', info.group, info.name);
    }
    setCustomers(state.customers, { fileName: state.fileName, importedAt: state.importedAt });
    emit('dataset:dirty');

    hideSimulationMap();
    resetSimulationState();
    dialog.close();
    showToast(`${regionCount} Gebiet(e)${customerCount ? ` und ${customerCount} Kunden` : ''} zugewiesen und gespeichert.`, 'success', 6000);
}

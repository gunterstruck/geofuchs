/**
 * Gebiets-Cockpit
 * - Kennzahlen je Vertriebsbeauftragtem (Kunden, Umsatz, Auslastungsbalken)
 * - Was-wäre-wenn: ein Gebiet der aktiven Ebene testweise einem anderen
 *   Vertriebsbeauftragten zuweisen; Live-Deltas; Übernahme in die echten Daten.
 *
 * Die Simulation arbeitet mit einem Overlay (Kunden-ID -> neuer VB) und lässt
 * die eigentlichen Kundendaten unangetastet, bis „Übernehmen" gedrückt wird.
 */

import { state, emit, on, repColor, setCustomers, UNASSIGNED } from '../core/state.js';
import { loadLevel } from '../services/geodata.js';
import { regionMembership } from '../features/territory.js';
import { showToast } from './toast.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let dialog = null;
let overrides = new Map();     // customerId -> neuer VB
let assignedRegions = [];      // [{ key, name, fromLabel, toRep }]
let membership = [];           // regionMembership der aktiven Ebene

export function initCockpit() {
    dialog = document.getElementById('cockpit-dialog');
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    document.getElementById('sim-apply').addEventListener('click', applySimulation);
    document.getElementById('sim-reset').addEventListener('click', resetSimulation);
    document.getElementById('sim-commit').addEventListener('click', commitSimulation);
    on('cockpit:open', open);
}

async function open() {
    overrides = new Map();
    assignedRegions = [];
    await loadMembership();
    renderAll();
    dialog.showModal();
}

async function loadMembership() {
    const info = document.getElementById('cockpit-sim-info');
    const level = state.level;
    if (level === 'none') {
        membership = [];
        info.textContent = 'Für die Gebietszuweisung bitte im Tab „Gebiete" eine Ebene (Landkreise oder PLZ) wählen.';
        return;
    }
    try {
        const geojson = await loadLevel(level);
        membership = geojson ? regionMembership(level, geojson, state.customers) : [];
        info.textContent = `Ebene: ${state.customers.length} Kunden in ${membership.length} Gebieten mit Kunden.`;
    } catch (error) {
        membership = [];
        info.textContent = `Gebietsdaten konnten nicht geladen werden: ${error.message}`;
    }
}

/** Effektiver VB unter Berücksichtigung der Simulation */
function effectiveRep(customer) {
    return overrides.get(customer.id) ?? (customer.vb || UNASSIGNED);
}

/** Kennzahlen je VB berechnen (Basis oder simuliert) */
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
    renderControls();
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

    // Balance-Hinweis (Verhältnis größtes/kleinstes Gebiet nach Kundenzahl)
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

function renderControls() {
    const regionSel = document.getElementById('sim-region');
    const repSel = document.getElementById('sim-rep');

    if (membership.length === 0) {
        regionSel.innerHTML = '<option value="">– keine Gebiete –</option>';
        repSel.innerHTML = '';
        document.getElementById('sim-apply').disabled = true;
        return;
    }
    document.getElementById('sim-apply').disabled = false;

    regionSel.innerHTML = membership.map((r) => {
        // aktuell dominanter (effektiver) VB des Gebiets
        const counts = new Map();
        for (const id of r.customerIds) {
            const c = state.customers.find((x) => x.id === id);
            const rep = c ? effectiveRep(c) : UNASSIGNED;
            counts.set(rep, (counts.get(rep) ?? 0) + 1);
        }
        let dom = UNASSIGNED, best = 0;
        for (const [rep, n] of counts) if (n > best) { dom = rep; best = n; }
        return `<option value="${escapeHtml(r.key)}" data-dom="${escapeHtml(dom)}">${escapeHtml(r.name)} (${r.customerIds.length} Kd., akt. ${escapeHtml(dom)})</option>`;
    }).join('');

    const reps = [...new Set(state.customers.map((c) => c.vb || UNASSIGNED))]
        .sort((a, b) => a.localeCompare(b, 'de'));
    repSel.innerHTML = reps.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
}

function applySimulation() {
    const regionSel = document.getElementById('sim-region');
    const key = regionSel.value;
    const toRep = document.getElementById('sim-rep').value;
    const region = membership.find((r) => r.key === key);
    if (!region || !toRep) return;

    const fromLabel = regionSel.selectedOptions[0]?.dataset.dom ?? '';
    for (const id of region.customerIds) overrides.set(id, toRep);

    assignedRegions = assignedRegions.filter((a) => a.key !== key);
    assignedRegions.push({ key, name: region.name, fromLabel, toRep });

    renderAll();
    showToast(`Simulation: „${region.name}" → ${toRep}`, 'info');
}

function resetSimulation() {
    overrides = new Map();
    assignedRegions = [];
    renderAll();
}

function renderChanges() {
    const el = document.getElementById('sim-changes');
    document.getElementById('sim-commit').disabled = overrides.size === 0;
    if (assignedRegions.length === 0) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = `<p class="muted small">${overrides.size} Kunden in ${assignedRegions.length} Gebieten neu zugewiesen:</p>` +
        assignedRegions.map((a) => `
            <div class="change-row">
                <span>${escapeHtml(a.name)}</span>
                <span class="muted small">${escapeHtml(a.fromLabel)} → <b>${escapeHtml(a.toRep)}</b></span>
            </div>`).join('');
}

function commitSimulation() {
    if (overrides.size === 0) return;
    const n = overrides.size;
    if (!confirm(`${n} Kunden dauerhaft dem simulierten Vertriebsbeauftragten zuweisen?\nDie Gebietszuordnung ändert damit Ihre Kundendaten.`)) return;

    for (const c of state.customers) {
        if (overrides.has(c.id)) c.vb = overrides.get(c.id);
    }
    // Reps/Farben aus den geänderten Daten neu ableiten und persistieren
    setCustomers(state.customers, { fileName: state.fileName, importedAt: state.importedAt });
    emit('dataset:dirty');

    dialog.close();
    showToast(`${n} Kunden neu zugewiesen und gespeichert.`, 'success', 6000);
}

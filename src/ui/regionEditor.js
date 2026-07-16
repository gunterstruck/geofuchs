/**
 * Gebiets-Editor
 * Öffnet sich aus dem Karten-Popup eines Gebiets (Landkreis/PLZ) und erlaubt,
 * die Kunden dieses Gebiets gezielt umzuordnen:
 *  - einzelne Kunden per Checkbox aus-/abwählen (z. B. nur die „blauen")
 *  - Suche/Filter innerhalb des Gebiets
 *  - Auswahl einem Vertriebsbezirk oder einer Gruppe zuweisen
 *  - optional die ganze Fläche (Gebietszuordnung) mit umschlüsseln
 *  - Rückgängig (Undo) der letzten Änderungen
 *
 * Änderungen wirken sofort (und werden gespeichert), damit man das Ergebnis
 * direkt auf der Karte sieht.
 */

import { state, emit, on, getCustomer, setCustomers, setTerritory, getTerritory, attrColor, datasetSnapshot, UNASSIGNED } from '../core/state.js';
import { pointInFeature } from '../services/geodata.js';
import { saveDataset } from '../services/storage.js';
import { showToast } from './toast.js';
import { desktopPlanningAvailable, mobilePlanningMediaQuery } from './planningViewport.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let dialog = null;
let ctx = null;              // { level, key, name, feature }
let selected = new Set();    // ausgewählte Kunden-IDs
let search = '';
let assignAttr = 'bezirk';   // 'bezirk' | 'gruppe'; Channel bleibt reine optionale Filterdimension
let territorySelected = false; // „Ganze Fläche" (Gebietszuordnung) mit zuweisen
const undoStack = [];        // [{ label, changes:[{id,attr,old}], territory }]
const mobilePlanningQuery = mobilePlanningMediaQuery();

function closeUnavailableEditor() {
    if (!dialog?.open) return;
    dialog.close();
    showToast('Der Gebiets-Editor wurde geschlossen. Bearbeitung ist am Desktop im Profi-Modus verfügbar.', 'info');
}

export function initRegionEditor() {
    dialog = document.getElementById('region-edit-dialog');
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    document.getElementById('re-close').addEventListener('click', () => dialog.close());
    document.getElementById('re-assign-attr').addEventListener('change', (e) => { assignAttr = e.target.value; render(); });
    document.getElementById('re-search').addEventListener('input', (e) => { search = e.target.value; renderList(); });
    document.getElementById('re-select-all').addEventListener('change', toggleSelectAll);
    document.getElementById('re-apply').addEventListener('click', applyAssign);
    document.getElementById('re-undo').addEventListener('click', undo);
    mobilePlanningQuery.addEventListener('change', (event) => {
        if (event.matches) closeUnavailableEditor();
    });
    on('depth:changed', () => {
        if (state.ui.depth !== 'profi') closeUnavailableEditor();
    });
}

/** Kunden in einem Gebiet ermitteln (unabhängig von Team-Filtern) */
function customersInRegion() {
    const { level, key, feature } = ctx;
    if (level.startsWith('plz')) {
        const len = parseInt(level.slice(3), 10);
        const prefix = key.startsWith('plz-') ? key.slice(4) : '';
        return state.customers.filter((c) => c.plz && c.plz.slice(0, len) === prefix);
    }
    return state.customers.filter((c) => c.lat !== null && c.lng !== null && feature && pointInFeature(c.lng, c.lat, feature));
}

export function openRegionEditor(context) {
    if (!desktopPlanningAvailable() || state.ui.depth !== 'profi') {
        const text = desktopPlanningAvailable()
            ? 'Der Gebiets-Editor ist im Profi-Modus verfügbar.'
            : 'Der Gebiets-Editor ist am Desktop im Profi-Modus verfügbar.';
        showToast(text, 'info');
        return;
    }
    if (assignableDims().length === 0) {
        showToast('Für die Bearbeitung braucht der Datensatz mindestens Vertriebsbezirk oder Vertriebsgruppe.', 'info');
        return;
    }
    ctx = context;
    const customers = customersInRegion();
    selected = new Set(customers.map((c) => c.id));
    search = '';
    // Ohne Kunden ist die Flächenzuordnung das Naheliegende -> vorausgewählt
    territorySelected = customers.length === 0;
    // Standard-Ziel: Vertriebsbezirk (sofern vorhanden), sonst nächste Gebietsebene
    assignAttr = state.dims.bezirk?.active ? 'bezirk' : (assignableDims()[0]?.id ?? 'bezirk');
    document.getElementById('re-search').value = '';
    renderAttrSelect();
    render();
    dialog.showModal();
}

function attrLabel(attr) {
    return state.dims[attr]?.label ?? attr;
}
function valueOf(c) {
    return String(c[assignAttr] ?? '').trim() || UNASSIGNED;
}
function targetValues() {
    return state.dims[assignAttr]?.active ? [...state.dims[assignAttr].values.keys()].filter((v) => v !== UNASSIGNED) : [];
}

function assignableDims() {
    const primary = ['bezirk', 'gruppe']
        .map((id) => state.dims[id]?.active ? { id, label: state.dims[id].label } : null)
        .filter(Boolean);
    const hasLegacyAssignments = Object.values(state.territories)
        .some((territory) => Object.prototype.hasOwnProperty.call(territory, 'channel'));
    if (state.dims.channel?.active && (primary.length === 0 || hasLegacyAssignments)) {
        primary.push({ id: 'channel', label: state.dims.channel.label });
    }
    return primary;
}

function renderAttrSelect() {
    const sel = document.getElementById('re-assign-attr');
    const options = assignableDims();
    sel.innerHTML = options.map((o) => `<option value="${o.id}"${o.id === assignAttr ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
}

function render() {
    document.getElementById('re-title').textContent = ctx.name;
    renderTargetSelect();
    renderTerritoryRow();
    renderList();
    document.getElementById('re-undo').disabled = undoStack.length === 0;
    document.getElementById('re-undo').textContent = undoStack.length
        ? `↩ Rückgängig (${undoStack.length})` : '↩ Rückgängig';
}

/** Feste Zeile ganz oben: die ganze Fläche zuordnen (auch ohne Kunden) */
function renderTerritoryRow() {
    const el = document.getElementById('re-territory');
    const terr = getTerritory(ctx.level, ctx.key) || {};
    const current = terr[assignAttr];
    const chip = current
        ? `<span class="re-chip"><span class="dot" style="background:${attrColor(assignAttr, current)}"></span>${escapeHtml(current)}</span>`
        : '<span class="re-chip muted">nicht zugeordnet</span>';
    el.innerHTML = `<label class="re-row re-territory-row">
        <input type="checkbox" id="re-territory-check" ${territorySelected ? 'checked' : ''}>
        <span class="re-name">🗺️ Ganze Fläche zuordnen<br><span class="muted small">wirkt auch ohne Kunden – ordnet das ganze Gebiet dem Ziel zu</span></span>
        ${chip}
    </label>`;
    el.querySelector('#re-territory-check').addEventListener('change', (e) => { territorySelected = e.target.checked; });
}

function renderTargetSelect() {
    const sel = document.getElementById('re-target');
    const values = targetValues();
    const current = sel.value;
    sel.innerHTML = values.length
        ? values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')
        : '<option value="">– keine Werte vorhanden –</option>';
    if (values.includes(current)) sel.value = current;
    document.getElementById('re-apply').disabled = values.length === 0;
}

function renderList() {
    const listEl = document.getElementById('re-list');
    const all = customersInRegion();
    const q = search.trim().toLowerCase();
    const shown = q ? all.filter((c) =>
        c.name.toLowerCase().includes(q) || (c.ort || '').toLowerCase().includes(q) || (c.plz || '').startsWith(q)) : all;

    document.getElementById('re-count').textContent =
        `${all.length} Kunde${all.length === 1 ? '' : 'n'} im Gebiet${q ? ` · ${shown.length} gefiltert` : ''} · ${selected.size} ausgewählt`;

    if (all.length === 0) {
        listEl.innerHTML = '<p class="muted small">Keine (verorteten) Kunden in diesem Gebiet. Über die Zeile „🗺️ Ganze Fläche zuordnen" oben lässt sich das Gebiet dennoch einem Ziel zuweisen.</p>';
        document.getElementById('re-select-all').checked = false;
        return;
    }

    listEl.innerHTML = shown.map((c) => {
        const val = valueOf(c);
        return `<label class="re-row">
            <input type="checkbox" data-id="${escapeHtml(c.id)}" ${selected.has(c.id) ? 'checked' : ''}>
            <span class="re-name">${escapeHtml(c.name)}<br><span class="muted small">${escapeHtml(c.plz)} ${escapeHtml(c.ort || '')}</span></span>
            <span class="re-chip"><span class="dot" style="background:${attrColor(assignAttr, val)}"></span>${escapeHtml(val)}</span>
        </label>`;
    }).join('');

    document.getElementById('re-select-all').checked = shown.length > 0 && shown.every((c) => selected.has(c.id));

    listEl.querySelectorAll('input[data-id]').forEach((cb) => {
        cb.addEventListener('change', () => {
            if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
            renderList();
        });
    });
}

function toggleSelectAll(e) {
    const q = search.trim().toLowerCase();
    const all = customersInRegion();
    const shown = q ? all.filter((c) =>
        c.name.toLowerCase().includes(q) || (c.ort || '').toLowerCase().includes(q) || (c.plz || '').startsWith(q)) : all;
    if (e.target.checked) shown.forEach((c) => selected.add(c.id));
    else shown.forEach((c) => selected.delete(c.id));
    renderList();
}

function persistAndRefresh() {
    // Reps/Dims neu ableiten, Karte aktualisieren, speichern
    setCustomers(state.customers, { fileName: state.fileName, importedAt: state.importedAt });
    emit('dataset:dirty');
    saveDataset(datasetSnapshot());
}

function applyAssign() {
    const attr = assignAttr;
    const target = document.getElementById('re-target').value;
    if (!target) { showToast('Kein Ziel verfügbar.', 'info'); return; }

    const changes = [];
    for (const id of selected) {
        const c = getCustomer(id);
        if (!c) continue;
        if ((String(c[attr] ?? '').trim() || UNASSIGNED) !== target) {
            changes.push({ id, attr, old: c[attr] ?? '' });
            c[attr] = target;
        }
    }

    let territory = null;
    if (territorySelected) {
        const old = getTerritory(ctx.level, ctx.key)?.[attr] ?? '';
        if (old !== target) {
            territory = { level: ctx.level, key: ctx.key, attr, old };
            setTerritory(ctx.level, ctx.key, attr, target, ctx.name);
        }
    }

    if (changes.length === 0 && !territory) {
        showToast(`Keine Änderung – bereits „${target}".`, 'info');
        return;
    }

    undoStack.push({ label: `${changes.length} → ${target}`, changes, territory });
    persistAndRefresh();
    render();
    showToast(`${changes.length} Kunde(n)${territory ? ' + ganze Fläche' : ''} → ${target}`, 'success');
}

function undo() {
    const e = undoStack.pop();
    if (!e) return;
    for (const ch of e.changes) {
        const c = getCustomer(ch.id);
        if (c) c[ch.attr] = ch.old;
    }
    if (e.territory) setTerritory(e.territory.level, e.territory.key, e.territory.attr, e.territory.old, ctx?.name);
    persistAndRefresh();
    render();
    showToast('Änderung rückgängig gemacht.', 'success');
}

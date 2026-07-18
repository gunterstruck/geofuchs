/** Operatives Service-Cockpit: Einsatzimport, Datenqualität und Handlungsbedarf. */

import '../styles/serviceVisits.css';

import {
    state,
    replaceServiceVisitSources,
    setServiceVisits,
    clearServiceVisits,
    datasetSnapshot,
    on,
    emit
} from '../core/state.js';
import { saveDataset } from '../services/storage.js';
import {
    SERVICE_VISIT_FIELDS,
    autoDetectServiceVisitMapping,
    parseServiceVisitRows,
    isOpenServiceVisit,
    serviceVisitWindow,
    serviceVisitReplacementRisks
} from '../features/serviceVisits.js';
import { normalizeCustomerNumber, isPlanningRelevantServiceContract } from '../features/serviceContracts.js';
import { ZANOBO_DEFAULT_BASE, setZanoboBaseUrl, zanoboBaseUrl, zanoboMachineUrl } from '../services/zanobo.js';
import { flyToCustomer } from '../features/map.js';

const el = (id) => document.getElementById(id);
const visits = () => Array.isArray(state.serviceVisits) ? state.serviceVisits : [];
const sources = () => state.serviceVisitSources && typeof state.serviceVisitSources === 'object'
    ? state.serviceVisitSources
    : {};

let initialized = false;
let pendingWorkbook = null;
let lastImportIssues = [];

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('de-DE');
}

function customerIndex() {
    const index = new Map();
    for (const customer of state.customers || []) {
        const number = normalizeCustomerNumber(customer?.nummer);
        if (!number) continue;
        if (!index.has(number)) index.set(number, []);
        index.get(number).push(customer);
    }
    return index;
}

function customerForVisit(visit, index = customerIndex()) {
    const matches = index.get(normalizeCustomerNumber(visit?.customerNumber)) || [];
    return matches.length === 1 ? matches[0] : null;
}

function hasActiveContract(visit) {
    const number = normalizeCustomerNumber(visit?.customerNumber);
    return (state.serviceContracts || []).some((contract) => (
        normalizeCustomerNumber(contract?.customerNumber) === number
        && isPlanningRelevantServiceContract(contract)
    ));
}

function sourceKey(visit) {
    return String(visit?.sourceSystem || visit?.sourceKey || 'Excel-Import').trim().toLocaleUpperCase('de-DE');
}

function ageDays(value, now = new Date()) {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor((now.getTime() - date.getTime()) / 86400000);
}

function relevantVisits(scope = state.ui.serviceCustomerScope) {
    const open = visits().filter(isOpenServiceVisit);
    if (scope === 'now' || scope === 'week') return open.filter((visit) => serviceVisitWindow(visit, scope));
    return open;
}

function unmatchedVisits(all = visits(), index = customerIndex()) {
    return all.filter((visit) => !customerForVisit(visit, index));
}

function renderSourceSummary() {
    const target = el('service-visit-source-summary');
    const health = el('service-visit-source-health');
    const details = el('service-visit-data-sources');
    if (!target || !health) return;
    const entries = Object.entries(sources());
    if (!entries.length) {
        target.innerHTML = '<div class="service-visit-empty"><b>Noch keine Einsatzliste</b><br>Für „Jetzt" und „Diese Woche" wird ein aktueller Einsatzabzug benötigt.</div>';
        health.textContent = 'Einsätze fehlen';
        if (details) details.open = true;
        return;
    }
    const stale = entries.some(([, meta]) => ageDays(meta?.dataAsOf) > 1 || ageDays(meta?.dataAsOf) === null);
    const index = customerIndex();
    target.innerHTML = `<div class="contract-source-grid">${entries.map(([name, meta]) => {
        const sourceVisits = visits().filter((visit) => sourceKey(visit) === name.toLocaleUpperCase('de-DE'));
        const unmatched = sourceVisits.filter((visit) => !customerForVisit(visit, index)).length;
        const age = ageDays(meta?.dataAsOf);
        const ageText = age === null ? 'Datenstand fehlt' : age <= 1 ? `Stand ${formatDate(meta.dataAsOf)}` : `Stand ${formatDate(meta.dataAsOf)} · ${age} Tage alt`;
        return `<article class="contract-source-card${unmatched || age > 1 ? ' has-warning' : ''}">
            <div class="contract-source-head"><b>${escapeHtml(name)}</b><span class="contract-source-age ${age > 1 || age === null ? 'stale' : 'ok'}">${escapeHtml(ageText)}</span></div>
            <p>${sourceVisits.length} Einsätze${unmatched ? ` · ${unmatched} nicht zugeordnet` : ''}</p>
            <small>${escapeHtml(meta?.fileName || '')}</small>
        </article>`;
    }).join('')}</div>`;
    health.textContent = stale ? 'Einsatzstand prüfen' : 'Einsätze aktuell';
    if (details) details.open = stale;
}

function renderKpis() {
    const target = el('service-visit-kpis');
    if (!target) return;
    const now = visits().filter((visit) => serviceVisitWindow(visit, 'now')).length;
    const week = visits().filter((visit) => serviceVisitWindow(visit, 'week')).length;
    const unassigned = unmatchedVisits().length;
    target.innerHTML = `
        <button type="button" class="service-visit-kpi danger" data-service-visit-scope="now"><b>${now}</b><span>jetzt einplanen</span></button>
        <button type="button" class="service-visit-kpi warn" data-service-visit-scope="week"><b>${week}</b><span>bis Sonntag</span></button>
        <div class="service-visit-kpi ${unassigned ? 'info' : ''}"><b>${unassigned}</b><span>nicht eindeutig zugeordnet</span></div>`;
}

function renderAssigneeOptions() {
    const values = [...new Set(visits().map((visit) => String(visit?.assignedTo || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'de'));
    for (const id of ['service-visit-assignee', 'service-plan-assignee']) {
        const select = el(id);
        if (!select) continue;
        const current = select.value;
        const first = id === 'service-plan-assignee' ? 'Alle offenen Einsätze' : 'Alle';
        select.innerHTML = `<option value="">${first}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
        if (values.includes(current)) select.value = current;
    }
}

function priorityClass(priority) {
    return String(priority || '').toLowerCase();
}

function urgency(visit) {
    if (serviceVisitWindow(visit, 'now')) {
        const overdue = String(visit.dueDate || '') < new Date().toISOString().slice(0, 10);
        return { label: overdue ? 'Überfällig' : visit.priority === 'KRITISCH' ? 'Kritisch' : 'Heute', className: overdue ? 'danger' : 'warn' };
    }
    if (serviceVisitWindow(visit, 'week')) return { label: 'Diese Woche', className: 'warn' };
    return { label: `Fällig ${formatDate(visit.dueDate)}`, className: '' };
}

function safeUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
}

function visitCardHtml(visit, index) {
    const customer = customerForVisit(visit, index);
    const urgent = urgency(visit);
    const url = safeUrl(visit.sourceUrl);
    const facts = [
        visit.workOrderId && `Auftrag ${visit.workOrderId}`,
        `${visit.durationMin} Min.`,
        visit.timeWindowStart && visit.timeWindowEnd && `${visit.timeWindowStart.replace('T', ' ')}–${visit.timeWindowEnd.replace('T', ' ')}`,
        visit.requiredSkills?.length && `Qualifikation ${visit.requiredSkills.join(', ')}`,
        visit.assignedTo
    ].filter(Boolean);
    const name = customer?.name || `Kundennummer ${visit.customerNumber || 'fehlt'}`;
    return `<article class="service-visit-item priority-${priorityClass(visit.priority)}">
        <div class="service-visit-item-head"><div><b>${escapeHtml(name)}</b><small>Nr. ${escapeHtml(visit.customerNumber || '—')}</small></div>
            <span class="service-visit-badge ${urgent.className}">${escapeHtml(urgent.label)}</span></div>
        <h3>${escapeHtml(visit.reason || 'Serviceeinsatz')}</h3>
        <div class="service-visit-facts">${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join('')}</div>
        ${!customer ? '<span class="service-visit-match-warning">Nicht eindeutig dem Kundenstamm zugeordnet</span>' : ''}
        ${customer && !hasActiveContract(visit) ? '<span class="service-visit-match-warning">Ohne aktiven Servicevertrag</span>' : ''}
        ${visit.note ? `<small>${escapeHtml(visit.note)}</small>` : ''}
        <div class="service-visit-actions">
            <button type="button" data-service-visit-action="map" data-service-visit-id="${escapeHtml(visit.id)}"${customer?.lat === null || !customer ? ' disabled' : ''}>Auf Karte</button>
            ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Original öffnen</a>` : ''}
            ${zanoboMachineUrl(visit.assetId) ? `<a class="zanobo-link" href="${escapeHtml(zanoboMachineUrl(visit.assetId))}" target="_blank" rel="noopener noreferrer" title="Zanobo vergleicht das Betriebsgeräusch mit der Referenz der Anlage – Orientierung, keine Diagnose.">🔊 Maschine anhören (Zanobo)</a>` : ''}
        </div>
    </article>`;
}

function renderList() {
    const target = el('service-visit-list');
    if (!target) return;
    const assignee = String(el('service-visit-assignee')?.value || '').trim();
    const search = String(el('service-visit-search')?.value || '').trim().toLowerCase();
    const index = customerIndex();
    const filtered = relevantVisits().filter((visit) => {
        if (assignee && visit.assignedTo !== assignee) return false;
        if (!search) return true;
        const customer = customerForVisit(visit, index);
        return [customer?.name, visit.customerNumber, visit.workOrderId, visit.reason, visit.assetId, visit.assignedTo]
            .some((value) => String(value || '').toLowerCase().includes(search));
    }).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))
        || ['KRITISCH', 'HOCH', 'MITTEL', 'NIEDRIG'].indexOf(a.priority) - ['KRITISCH', 'HOCH', 'MITTEL', 'NIEDRIG'].indexOf(b.priority)
        || String(a.id).localeCompare(String(b.id)));
    target.innerHTML = filtered.length
        ? `<div class="contract-result-count">${filtered.length} offene Einsätze</div>${filtered.slice(0, 40).map((visit) => visitCardHtml(visit, index)).join('')}`
        : '<div class="service-visit-empty"><b>Aktuell kein planbarer Handlungsbedarf</b><br>Filter ändern oder einen neueren Einsatzabzug importieren.</div>';
}

function renderDayStart() {
    const button = el('btn-plan-service-day');
    const summary = el('service-day-start-summary');
    if (!button || !summary) return;
    const index = customerIndex();
    const urgent = visits().filter((visit) => serviceVisitWindow(visit, 'now'));
    const customers = new Map();
    let withoutPosition = 0;
    for (const visit of urgent) {
        const customer = customerForVisit(visit, index);
        if (!customer) continue;
        customers.set(customer.id, customer);
        if (customer.lat === null || customer.lng === null) withoutPosition++;
    }
    const located = [...customers.values()].filter((customer) => customer.lat !== null && customer.lng !== null).length;
    button.disabled = located === 0;
    summary.textContent = urgent.length
        ? `${urgent.length} dringende Einsätze bei ${customers.size} Kunden · ${located} verortet${withoutPosition ? ` · ${withoutPosition} ohne Kartenposition` : ''}`
        : 'Aktuell kein dringender Einsatz. „Diese Woche" zeigt den nächsten Planungshorizont.';
}

function renderAll() {
    renderSourceSummary();
    renderKpis();
    renderAssigneeOptions();
    renderList();
    renderDayStart();
    const clear = el('btn-service-visit-clear');
    if (clear) clear.disabled = visits().length === 0 && Object.keys(sources()).length === 0;
}

function renderMapping() {
    const target = el('service-visit-mapping-rows');
    if (!target || !pendingWorkbook) return;
    const mapping = autoDetectServiceVisitMapping(pendingWorkbook.headers);
    target.innerHTML = SERVICE_VISIT_FIELDS.map((field) => {
        const options = ['<option value="">– nicht vorhanden –</option>']
            .concat(pendingWorkbook.headers.map((header) => `<option value="${escapeHtml(header)}"${mapping[field.key] === header ? ' selected' : ''}>${escapeHtml(header)}</option>`)).join('');
        return `<tr><td>${escapeHtml(field.label)}${field.required ? ' <span class="req">Pflicht</span>' : ''}</td>
            <td><select data-service-visit-field="${escapeHtml(field.key)}">${options}</select></td>
            <td class="preview" data-service-visit-preview="${escapeHtml(field.key)}"></td></tr>`;
    }).join('');
    const preview = () => target.querySelectorAll('select[data-service-visit-field]').forEach((select) => {
        const cell = target.querySelector(`[data-service-visit-preview="${select.dataset.serviceVisitField}"]`);
        if (cell) cell.textContent = select.value
            ? pendingWorkbook.rows.slice(0, 3).map((row) => row[select.value]).filter((value) => String(value || '').trim()).slice(0, 2).join(' · ')
            : '';
    });
    target.querySelectorAll('select').forEach((select) => select.addEventListener('change', preview));
    preview();
}

async function handleFile(file) {
    if (!file || !/\.(xlsx|xls|csv|ods)$/i.test(file.name)) {
        emit('toast', { type: 'error', text: 'Bitte eine Excel- oder CSV-Datei wählen (.xlsx, .xls, .csv, .ods).' });
        return;
    }
    try {
        const { readWorkbook } = await import('../services/excel.js');
        const workbook = await readWorkbook(file);
        pendingWorkbook = { ...workbook, fileName: file.name };
        lastImportIssues = [];
        el('service-visit-import-feedback').innerHTML = '';
        el('service-visit-mapping-file-info').textContent = `${file.name} – ${workbook.rows.length} Zeilen, ${workbook.headers.length} Spalten`;
        renderMapping();
        const dialog = el('service-visit-import-dialog');
        if (dialog && !dialog.open) dialog.showModal?.();
    } catch (error) {
        emit('toast', { type: 'error', text: `Einsatzdatei konnte nicht gelesen werden: ${error.message}` });
    }
}

function mappingFromDialog() {
    const mapping = {};
    el('service-visit-mapping-rows')?.querySelectorAll('select[data-service-visit-field]').forEach((select) => {
        mapping[select.dataset.serviceVisitField] = select.value || null;
    });
    return mapping;
}

function sourceMetadata(all, fileName) {
    const importedAt = new Date().toISOString();
    const grouped = new Map();
    for (const visit of all) {
        const source = sourceKey(visit);
        if (!grouped.has(source)) grouped.set(source, []);
        grouped.get(source).push(visit);
    }
    return Object.fromEntries([...grouped].map(([source, items]) => {
        const dates = items.map((visit) => visit.dataAsOf).filter(Boolean).sort();
        return [source, { sourceSystem: source, fileName, importedAt, count: items.length, dataAsOf: dates[0] || '', mixedDataAsOf: new Set(dates).size > 1 }];
    }));
}

function setImportFeedback(kind, title, issues = []) {
    const target = el('service-visit-import-feedback');
    if (!target) return;
    target.className = `contract-import-feedback ${kind}`;
    target.innerHTML = `<b>${escapeHtml(title)}</b>${issues.length ? `<ul>${issues.slice(0, 6).map((item) => `<li>Zeile ${item.Zeile || '—'}: ${escapeHtml(item.message || item.Grund || '')}</li>`).join('')}</ul>` : ''}`;
}

function showIssueButton(show) {
    for (const id of ['service-visit-import-errors', 'btn-service-visit-issues']) {
        const button = el(id); if (button) button.hidden = !show;
    }
}

async function confirmImport() {
    if (!pendingWorkbook) return;
    const button = el('service-visit-mapping-confirm');
    if (button) button.disabled = true;
    try {
        const result = parseServiceVisitRows(pendingWorkbook.rows, mappingFromDialog(), { fileName: pendingWorkbook.fileName });
        const parsed = result.visits || [];
        if (result.errors?.length || !parsed.length) {
            lastImportIssues = [...(result.errors || []), ...(result.warnings || [])];
            setImportFeedback('error', 'Import nicht übernommen – die bisherigen Einsatzdaten bleiben erhalten.', lastImportIssues.length ? lastImportIssues : [{ message: 'Keine gültigen Einsatzzeilen.' }]);
            showIssueButton(true);
            return;
        }
        const index = customerIndex();
        const unmatched = parsed.filter((visit) => !customerForVisit(visit, index)).map((visit) => ({
            Typ: 'Hinweis', type: 'Hinweis', sourceSystem: sourceKey(visit), workOrderId: visit.workOrderId,
            customerNumber: visit.customerNumber, message: `Kundennummer „${visit.customerNumber}" ist im Kundenstamm nicht eindeutig vorhanden.`
        }));
        lastImportIssues = [...(result.warnings || []), ...unmatched];
        showIssueButton(lastImportIssues.length > 0);
        const meta = sourceMetadata(parsed, pendingWorkbook.fileName);
        const risks = serviceVisitReplacementRisks(visits(), parsed, sources(), meta);
        if (risks.length) {
            const lines = risks.map((risk) => risk.type === 'count-drop'
                ? `${risk.sourceSystem}: ${risk.existingCount} bisherige → ${risk.incomingCount} neue Einsätze`
                : `${risk.sourceSystem}: Datenstand ${formatDate(risk.incomingDate)} ist älter als ${formatDate(risk.existingDate)}`);
            if (!window.confirm(`Der Einsatzimport wirkt kleiner oder älter.\n\n${lines.join('\n')}\n\nNur fortfahren, wenn dies der vollständige beabsichtigte Snapshot ist.`)) {
                setImportFeedback('warning', 'Import abgebrochen – der bisherige Einsatzbestand bleibt unverändert.');
                return;
            }
        }
        const previousVisits = [...visits()];
        const previousSources = { ...sources() };
        replaceServiceVisitSources(parsed, meta);
        if (!(await saveDataset(datasetSnapshot()))) {
            setServiceVisits(previousVisits, previousSources);
            throw new Error('Die Einsatzdaten konnten nicht lokal gespeichert werden. Der bisherige Stand wurde wiederhergestellt.');
        }
        const dialog = el('service-visit-import-dialog');
        dialog?.close?.();
        state.ui.serviceCustomerScope = 'now';
        emit('service-customer-scope:changed', 'now');
        emit('data:imported', { type: 'service-visits', count: parsed.length });
        emit('toast', { type: lastImportIssues.length ? 'info' : 'success', text: `${parsed.length} Serviceeinsätze importiert${unmatched.length ? ` · ${unmatched.length} nicht zugeordnet` : ''}.` });
        renderAll();
    } catch (error) {
        lastImportIssues = [{ type: 'Fehler', message: error.message }];
        setImportFeedback('error', 'Import nicht übernommen – die bisherigen Einsatzdaten bleiben erhalten.', lastImportIssues);
        showIssueButton(true);
    } finally {
        if (button) button.disabled = false;
    }
}

async function exportIssues() {
    if (!lastImportIssues.length) return;
    const { exportErrors } = await import('../services/excel.js');
    exportErrors(lastImportIssues, 'serviceeinsaetze');
}

function downloadStatic(path, fileName) {
    const anchor = document.createElement('a');
    anchor.href = new URL(path, document.baseURI).href;
    anchor.download = fileName;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
}

async function clearAllVisits() {
    if (!visits().length && !Object.keys(sources()).length) return;
    if (!window.confirm('Alle importierten Serviceeinsätze löschen? Kunden und Verträge bleiben erhalten.')) return;
    const previousVisits = [...visits()]; const previousSources = { ...sources() };
    clearServiceVisits({ dirty: false });
    if (!(await saveDataset(datasetSnapshot()))) {
        setServiceVisits(previousVisits, previousSources);
        emit('toast', { type: 'error', text: 'Einsatzdaten konnten nicht gelöscht werden.' });
        return;
    }
    renderAll();
    emit('toast', { type: 'success', text: 'Einsatzdaten gelöscht. Kunden und Verträge bleiben erhalten.' });
}

function openTourPlanning() {
    const urgent = visits().filter((visit) => serviceVisitWindow(visit, 'now'));
    const planningVisits = urgent.length ? urgent : visits().filter((visit) => serviceVisitWindow(visit, 'week'));
    const index = customerIndex();
    const located = [...new Map(planningVisits.map((visit) => {
        const customer = customerForVisit(visit, index);
        return customer && Number.isFinite(customer.lat) && Number.isFinite(customer.lng)
            ? [customer.id, customer]
            : null;
    }).filter(Boolean)).values()];
    if (located.length) {
        const districts = new Map();
        for (const customer of located) {
            const district = String(customer.bezirk || '').trim() || '__all__';
            if (!districts.has(district)) districts.set(district, []);
            districts.get(district).push(customer);
        }
        const [bestDistrict, bestCustomers] = [...districts.entries()].sort((a, b) => (
            b[1].length - a[1].length || a[0].localeCompare(b[0], 'de')
        ))[0];
        state.tour.bezirk = bestDistrict;
        state.ui.serviceCustomerScope = urgent.length ? 'now' : 'week';
        emit('service-customer-scope:changed', state.ui.serviceCustomerScope);

        const demoOnly = planningVisits.length > 0 && planningVisits.every((visit) => sourceKey(visit) === 'DEMO');
        if (demoOnly && !state.tour.start) {
            const center = bestCustomers.reduce((sum, customer) => ({
                lat: sum.lat + customer.lat / bestCustomers.length,
                lng: sum.lng + customer.lng / bestCustomers.length
            }), { lat: 0, lng: 0 });
            state.tour.start = {
                ...center,
                label: `Demo-Ausgangspunkt · ${bestDistrict === '__all__' ? 'Servicegebiet' : bestDistrict}`,
                demo: true,
                dataOrigin: 'demo'
            };
            emit('toast', {
                type: 'success',
                text: `Demo vorbereitet: ${bestCustomers.length} dringende Servicekunden im Schwerpunkt ${bestDistrict === '__all__' ? 'des Gebiets' : bestDistrict}.`
            });
        }
        emit('tour:scope-changed');
        emit('tour:changed');
    }
    document.querySelector('.tab-button[data-tab="tour"]')?.click();
    emit('service-day:focus');
}

function openCustomerVisits(payload = {}) {
    const customerNumber = normalizeCustomerNumber(payload?.customerNumber ?? payload?.kundennummer);
    const customer = state.customers.find((item) => normalizeCustomerNumber(item?.nummer) === customerNumber);
    const search = el('service-visit-search');
    if (search) search.value = customer?.name || customerNumber;
    document.querySelector('.tab-button[data-tab="einsaetze"]')?.click();
    renderList();
}

export function initServiceVisitPlanner() {
    if (initialized) return;
    initialized = true;
    const input = el('service-visit-file-input');
    el('btn-service-visit-import')?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', () => { handleFile(input.files?.[0]); input.value = ''; });
    el('btn-service-visit-template')?.addEventListener('click', () => downloadStatic('./templates/tourfuchs-serviceeinsaetze-vorlage.xlsx', 'tourfuchs-serviceeinsaetze-vorlage.xlsx'));
    el('btn-service-visit-csv')?.addEventListener('click', () => downloadStatic('./templates/tourfuchs-serviceeinsaetze-beispiel.csv', 'tourfuchs-serviceeinsaetze-beispiel.csv'));
    el('btn-service-visit-clear')?.addEventListener('click', clearAllVisits);
    el('service-visit-mapping-confirm')?.addEventListener('click', confirmImport);
    el('service-visit-import-errors')?.addEventListener('click', exportIssues);
    el('btn-service-visit-issues')?.addEventListener('click', exportIssues);
    el('service-visit-import-dialog')?.querySelector('.dialog-close')?.addEventListener('click', () => el('service-visit-import-dialog')?.close?.());
    el('service-visit-assignee')?.addEventListener('change', renderList);
    el('service-visit-search')?.addEventListener('input', renderList);
    // Zanobo-Instanz: leer = öffentliche Instanz; eigene URL für Firmen-Hosting.
    const zanoboInput = el('zanobo-base-url');
    if (zanoboInput) {
        const stored = zanoboBaseUrl();
        zanoboInput.value = stored === ZANOBO_DEFAULT_BASE ? '' : stored;
        zanoboInput.addEventListener('change', () => {
            const saved = setZanoboBaseUrl(zanoboInput.value);
            if (saved === null) {
                emit('toast', { type: 'error', text: 'Bitte eine vollständige http(s)-Adresse für Zanobo eintragen – oder das Feld leeren für die öffentliche Instanz.' });
                return;
            }
            zanoboInput.value = saved === ZANOBO_DEFAULT_BASE ? '' : saved;
            renderList();
        });
    }
    el('btn-plan-service-day')?.addEventListener('click', openTourPlanning);
    el('service-visit-kpis')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-service-visit-scope]');
        if (!button) return;
        state.ui.serviceCustomerScope = button.dataset.serviceVisitScope;
        emit('service-customer-scope:changed', state.ui.serviceCustomerScope);
    });
    el('service-visit-list')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-service-visit-action="map"]');
        if (!button) return;
        const visit = visits().find((item) => item.id === button.dataset.serviceVisitId);
        const customer = visit && customerForVisit(visit);
        if (customer) flyToCustomer(customer);
    });
    on('service-visits:changed', renderAll);
    on('customers:changed', renderAll);
    on('service-contracts:changed', renderAll);
    on('service-customer-scope:changed', renderAll);
    on('service-visits:open', openCustomerVisits);
    on('app:ready', renderAll);
    renderAll();
}

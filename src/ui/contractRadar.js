/**
 * Service-Vertragsradar
 *
 * Verantwortet den getrennten Excel-/CSV-Import, die Quellenübersicht und die
 * erklärbare Radar-Ansicht. Vertragsdaten werden ausschließlich über die
 * Kundennummer mit dem Kundenstamm verbunden; Namen werden nie unscharf
 * abgeglichen.
 */

import '../styles/contracts.css';

import {
    state,
    setServiceContracts,
    replaceServiceContractSources,
    clearServiceContracts,
    datasetSnapshot,
    on,
    emit
} from '../core/state.js';
import { readWorkbook } from '../services/excel.js';
import { saveDataset } from '../services/storage.js';
import {
    SERVICE_CONTRACT_FIELDS,
    autoDetectServiceContractMapping,
    parseServiceContractRows,
    normalizeCustomerNumber,
    serviceContractActionDays,
    serviceContractReplacementRisks
} from '../features/serviceContracts.js';
import { flyToCustomer } from '../features/map.js';
import { applyMode } from './sidebar.js';
import { mobilePlanningMediaQuery } from './planningViewport.js';

const STALE_SOURCE_DAYS = 30;
const DEFAULT_WINDOW = '90';
const WINDOW_OPTIONS = [
    ['overdue', 'Überfällig'],
    ['bucket30', 'Heute bis 30 Tage'],
    ['bucket90', '31 bis 90 Tage'],
    ['30', '30 Tage'],
    ['60', '60 Tage'],
    ['90', '90 Tage'],
    ['180', '180 Tage'],
    ['all', 'Alle Verträge'],
    ['missing', 'Frist fehlt']
];

let initialized = false;
let pendingWorkbook = null;
let lastImportIssues = [];
let dialogCustomerNumber = '';
let mobileQuery = null;

const el = (id) => document.getElementById(id);
const contracts = () => Array.isArray(state.serviceContracts) ? state.serviceContracts : [];
const sources = () => state.serviceContractSources && typeof state.serviceContractSources === 'object'
    ? state.serviceContractSources
    : {};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
}

function safeHttpUrl(value) {
    const text = String(value ?? '').trim();
    if (!/^https?:\/\//i.test(text)) return '';
    try {
        const url = new URL(text, window.location.href);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch {
        return '';
    }
}

function parseDate(value) {
    if (!value) return null;
    const text = String(value).trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const german = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (german) {
        const date = new Date(Number(german[3]), Number(german[2]) - 1, Number(german[1]), 12);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat('de-DE').format(date) : '—';
}

function dateIso(value) {
    const date = parseDate(value);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function daysFromToday(value) {
    const date = parseDate(value);
    if (!date) return null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    date.setHours(12, 0, 0, 0);
    return Math.round((date - today) / 86400000);
}

function daysSince(value) {
    const days = daysFromToday(value);
    return days === null ? null : Math.max(0, -days);
}

function asNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value ?? '')
        .replace(/[^\d,.-]/g, '')
        .replace(/\.(?=\d{3}(?:\D|$))/g, '')
        .replace(',', '.');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
}

function formatMoney(value, currency = 'EUR') {
    const number = asNumber(value);
    if (!number) return '—';
    try {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency', currency: String(currency || 'EUR').toUpperCase(),
            maximumFractionDigits: 0
        }).format(number);
    } catch {
        return `${Math.round(number).toLocaleString('de-DE')} €`;
    }
}

function normalizedNumber(value) {
    try { return normalizeCustomerNumber(value); } catch { return String(value ?? '').trim(); }
}

/** Nur eindeutige Kundennummern sind ein gültiger Match. */
function customerIndex() {
    const index = new Map();
    for (const customer of state.customers || []) {
        const number = normalizedNumber(customer.nummer);
        if (!number) continue;
        if (index.has(number)) index.set(number, null);
        else index.set(number, customer);
    }
    return index;
}

function customerForNumber(number, index = customerIndex()) {
    return index.get(normalizedNumber(number)) || null;
}

function customerForContract(contract, index = customerIndex()) {
    return customerForNumber(contract.customerNumber, index);
}

function isInactiveContract(contract) {
    const status = String(contract.status ?? '').trim().toLowerCase();
    return ['gekündigt', 'gekuendigt', 'beendet', 'storniert', 'inaktiv', 'abgelaufen', 'cancelled', 'canceled', 'terminated', 'expired']
        .some((word) => status.includes(word));
}

/** Erzeugt den UI-Status aus der expliziten Handlungsfrist. */
function urgencyInfo(contract) {
    const days = serviceContractActionDays(contract, new Date());

    if (isInactiveContract(contract)) {
        return { key: 'inactive', days: null, label: 'Nicht aktiv' };
    }
    if (days === null) {
        return { key: 'missing', days: null, label: 'Frist fehlt' };
    }
    if (days < 0) {
        return { key: 'overdue', days, label: `${Math.abs(days)} T. überfällig` };
    }
    if (days === 0) return { key: 'due30', days, label: 'Heute handeln' };
    if (days <= 30) return { key: 'due30', days, label: `In ${days} Tagen` };
    if (days <= 60) return { key: 'due60', days, label: `In ${days} Tagen` };
    if (days <= 90) return { key: 'due90', days, label: `In ${days} Tagen` };
    if (days <= 180) return { key: 'due180', days, label: `In ${days} Tagen` };
    return { key: 'later', days, label: `In ${days} Tagen` };
}

function sourceKey(contract) {
    return String(contract.sourceSystem ?? '').trim() || 'Excel-Import';
}

function contractManager(contract) {
    return String(contract.manager ?? contract.owner ?? '').trim();
}

function dateRange(values) {
    const dates = [...new Set(values.map(dateIso).filter(Boolean))].sort();
    return {
        oldest: dates[0] || '',
        latest: dates.at(-1) || '',
        mixed: dates.length > 1
    };
}

function issueType(issue) {
    return String(issue?.type ?? issue?.Typ ?? issue?.severity ?? '').trim().toLowerCase();
}

function isWarning(issue) {
    const type = issueType(issue);
    return type === 'warning' || type === 'warn' || type === 'hinweis' || type === 'info';
}

function issueMessage(issue) {
    return String(issue?.message ?? issue?.Grund ?? issue?.reason ?? 'Unbekannter Importfehler');
}

function exportIssueRows(issues) {
    return issues.map((issue) => ({
        Zeile: issue?.row ?? issue?.Zeile ?? issue?.sheetRow ?? '—',
        Typ: isWarning(issue) ? 'Hinweis' : 'Fehler',
        Grund: issueMessage(issue),
        Kundennummer: issue?.customerNumber ?? issue?.Kundennummer ?? '',
        Vertragsnummer: issue?.contractId ?? issue?.Vertragsnummer ?? ''
    }));
}

function setImportFeedback(kind, message, details = []) {
    const target = el('contract-import-feedback');
    if (!target) return;
    target.hidden = false;
    target.className = `contract-import-feedback ${kind}`;
    target.innerHTML = `<b>${escapeHtml(message)}</b>${details.length ? `<ul>${details.slice(0, 5)
        .map((entry) => `<li>${escapeHtml(issueMessage(entry))}</li>`).join('')}</ul>` : ''}`;
}

function showIssueDownloads(show) {
    ['contract-import-errors', 'btn-contract-issues'].forEach((id) => {
        const button = el(id);
        if (button) button.hidden = !show;
    });
}

function clearImportFeedback() {
    const feedback = el('contract-import-feedback');
    if (feedback) {
        feedback.hidden = true;
        feedback.textContent = '';
        feedback.className = 'contract-import-feedback';
    }
    showIssueDownloads(false);
}

function staleSourceHtml(meta) {
    const dataAsOf = meta?.dataAsOf;
    const age = daysSince(dataAsOf);
    if (!dataAsOf) return '<span class="contract-source-age warn">Datenstand fehlt</span>';
    const range = meta?.mixedDataAsOf && meta?.dataAsOfLatest
        ? `${formatDate(dataAsOf)}–${formatDate(meta.dataAsOfLatest)}`
        : formatDate(dataAsOf);
    if (age !== null && age > STALE_SOURCE_DAYS) {
        return `<span class="contract-source-age stale">Stand ${escapeHtml(range)} · ältester ${age} Tage</span>`;
    }
    return `<span class="contract-source-age ${meta?.mixedDataAsOf ? 'warn' : 'ok'}">Stand ${escapeHtml(range)}${meta?.mixedDataAsOf ? ' · gemischt' : ''}</span>`;
}

function renderSources() {
    const target = el('contract-source-summary');
    if (!target) return;
    const entries = Object.entries(sources());
    const index = customerIndex();
    if (!entries.length) {
        target.innerHTML = `<div class="contract-empty compact">
            <b>Noch keine Vertragsdaten</b>
            <span>Laden Sie einen aktuellen SAP-/Service-Abzug. Kundendaten und Touren bleiben dabei unverändert.</span>
        </div>`;
        return;
    }

    target.innerHTML = `<div class="contract-source-grid">${entries.map(([name, meta]) => {
        const sourceContracts = contracts().filter((contract) => sourceKey(contract) === name);
        const count = sourceContracts.length;
        // Der Kundenstamm kann separat neu importiert werden. Zuordnungszahlen
        // deshalb immer aus dem aktuellen Stand berechnen, nie einfrieren.
        const unmatched = sourceContracts.filter((contract) => !customerForContract(contract, index)).length;
        const warnings = Number(meta?.warnings ?? 0) || 0;
        const fileName = meta?.fileName ? `<span title="${escapeHtml(meta.fileName)}">${escapeHtml(meta.fileName)}</span>` : '';
        return `<article class="contract-source-card${unmatched ? ' has-warning' : ''}">
            <div class="contract-source-head"><b>${escapeHtml(name)}</b>${staleSourceHtml(meta)}</div>
            ${fileName}
            <small>${count} Verträge${unmatched ? ` · <strong>${unmatched} nicht zugeordnet</strong>` : ''}${warnings ? ` · ${warnings} Hinweise` : ''}</small>
            <small>Importiert ${escapeHtml(formatDate(meta?.importedAt))}</small>
        </article>`;
    }).join('')}</div>`;
}

function summaryFor(all) {
    const info = all.map((contract) => ({ contract, urgency: urgencyInfo(contract) }));
    const overdue = info.filter(({ urgency }) => urgency.key === 'overdue').length;
    const due30 = info.filter(({ urgency }) => urgency.key === 'due30').length;
    const due90 = info.filter(({ urgency }) => ['due60', 'due90'].includes(urgency.key)).length;
    const missing = info.filter(({ urgency }) => urgency.key === 'missing').length;
    const valuesByCurrency = new Map();
    info.filter(({ urgency }) => urgency.days !== null && urgency.days <= 90 && urgency.key !== 'inactive')
        .forEach(({ contract }) => {
            const value = asNumber(contract.annualValue);
            if (!value) return;
            const currency = String(contract.currency || 'EUR').trim().toUpperCase();
            valuesByCurrency.set(currency, (valuesByCurrency.get(currency) || 0) + value);
        });
    const currencies = [...valuesByCurrency.keys()];
    const value90Currency = currencies.length === 1 ? currencies[0] : 'EUR';
    const value90 = currencies.length === 1 ? valuesByCurrency.get(value90Currency) : 0;
    return { overdue, due30, due90, missing, value90, value90Currency, value90Mixed: currencies.length > 1 };
}

function renderKpis() {
    const target = el('contract-kpis');
    if (!target) return;
    const summary = summaryFor(contracts());
    target.innerHTML = `<div class="contract-kpi-grid">
        <button type="button" class="contract-kpi danger" data-contract-window="overdue">
            <span>Frist überschritten</span><b>${summary.overdue}</b><small>sofort prüfen</small>
        </button>
        <button type="button" class="contract-kpi warn" data-contract-window="bucket30">
            <span>Nächste 30 Tage</span><b>${summary.due30}</b><small>Handlungsfrist</small>
        </button>
        <button type="button" class="contract-kpi attention" data-contract-window="bucket90">
            <span>31–90 Tage</span><b>${summary.due90}</b><small>vorbereiten</small>
        </button>
        <button type="button" class="contract-kpi" data-contract-window="90">
            <span>Wert ≤ 90 Tage</span><b>${summary.value90Mixed ? 'Mehrere Währungen' : escapeHtml(formatMoney(summary.value90, summary.value90Currency))}</b><small>${summary.value90Mixed ? 'bewusst nicht addiert' : (summary.missing ? `${summary.missing} ohne Frist` : 'mit Handlungsbedarf')}</small>
        </button>
    </div>`;
}

function ensureWindowOptions() {
    const select = el('contract-window');
    if (!select) return;
    const current = select.value || DEFAULT_WINDOW;
    select.innerHTML = WINDOW_OPTIONS.map(([value, label]) =>
        `<option value="${value}">${escapeHtml(label)}</option>`).join('');
    select.value = WINDOW_OPTIONS.some(([value]) => value === current) ? current : DEFAULT_WINDOW;
}

function renderManagerFilter() {
    const select = el('contract-manager');
    if (!select) return;
    const current = select.value;
    const managers = [...new Set(contracts().map(contractManager).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'de'));
    select.innerHTML = '<option value="">Alle Contract Manager</option>' + managers
        .map((manager) => `<option value="${escapeHtml(manager)}">${escapeHtml(manager)}</option>`).join('');
    if (managers.includes(current)) select.value = current;
}

function filteredContracts(customerNumber = '') {
    const exactCustomer = normalizedNumber(customerNumber);
    // Der Kunden-Drill-down wird modal geöffnet; die Filter der Sidebar sind
    // dann nicht bedienbar. Deshalb zeigt er bewusst alle Verträge des Kunden.
    const search = exactCustomer ? '' : String(el('contract-search')?.value ?? '').trim().toLowerCase();
    const manager = exactCustomer ? '' : String(el('contract-manager')?.value ?? '').trim();
    const windowValue = exactCustomer ? 'all' : String(el('contract-window')?.value || DEFAULT_WINDOW);
    const index = customerIndex();

    return contracts().filter((contract) => {
        if (exactCustomer && normalizedNumber(contract.customerNumber) !== exactCustomer) return false;
        if (manager && contractManager(contract) !== manager) return false;
        const urgency = urgencyInfo(contract);
        if (windowValue === 'missing' && urgency.key !== 'missing') return false;
        if (windowValue === 'overdue' && urgency.key !== 'overdue') return false;
        if (windowValue === 'bucket30' && urgency.key !== 'due30') return false;
        if (windowValue === 'bucket90' && !['due60', 'due90'].includes(urgency.key)) return false;
        if (!['all', 'missing', 'overdue', 'bucket30', 'bucket90'].includes(windowValue)) {
            const limit = Number(windowValue);
            if (urgency.days === null || urgency.days > limit || urgency.key === 'inactive') return false;
        }
        if (!search) return true;
        const customer = customerForContract(contract, index);
        return [
            customer?.name, contract.customerNumber, contract.contractId, contract.title,
            contract.type, contract.status, contractManager(contract), contract.sourceSystem,
            contract.scope, contract.note
        ].some((value) => String(value ?? '').toLowerCase().includes(search));
    }).sort((a, b) => {
        const aInfo = urgencyInfo(a);
        const bInfo = urgencyInfo(b);
        const aDays = aInfo.days === null ? Number.POSITIVE_INFINITY : aInfo.days;
        const bDays = bInfo.days === null ? Number.POSITIVE_INFINITY : bInfo.days;
        if (aDays !== bDays) return aDays - bDays;
        const aCustomer = customerForContract(a, index)?.name || a.customerNumber || '';
        const bCustomer = customerForContract(b, index)?.name || b.customerNumber || '';
        return String(aCustomer).localeCompare(String(bCustomer), 'de');
    });
}

function urgencyClass(key) {
    return ['overdue', 'due30', 'due60', 'due90', 'due180', 'later', 'missing', 'inactive'].includes(key)
        ? key
        : 'missing';
}

function contractFacts(contract) {
    const facts = [];
    if (contract.endDate) facts.push(`Ende ${formatDate(contract.endDate)}`);
    const cancellationDeadline = contract.cancellationDeadline ?? contract.cancellationDate;
    if (cancellationDeadline) facts.push(`Kündigen bis ${formatDate(cancellationDeadline)}`);
    if (contract.autoRenewal) facts.push(`Auto-Verlängerung${contract.renewalMonths ? ` um ${escapeHtml(contract.renewalMonths)} Mon.` : ''}`);
    if (contract.unlimited) facts.push('Unbefristet');
    if (contract.noticeDays !== null && contract.noticeDays !== undefined) facts.push(`Kündigungsfrist ${escapeHtml(contract.noticeDays)} Tage`);
    if (contract.maintenanceIntervalMonths) facts.push(`Wartung alle ${escapeHtml(contract.maintenanceIntervalMonths)} Mon.`);
    if (contract.criticality) facts.push(`Kritikalität: ${escapeHtml(contract.criticality)}`);
    if (contractManager(contract)) facts.push(`Manager: ${escapeHtml(contractManager(contract))}`);
    return facts.join(' · ');
}

function contractCardHtml(contract, { full = false, index = customerIndex() } = {}) {
    const customer = customerForContract(contract, index);
    const urgency = urgencyInfo(contract);
    const number = normalizedNumber(contract.customerNumber);
    const url = safeHttpUrl(contract.sourceUrl);
    const customerName = customer?.name || `Kundennummer ${contract.customerNumber || 'fehlt'}`;
    const match = customer
        ? ''
        : '<span class="contract-match-warning">Nicht dem Kundenstamm zugeordnet</span>';
    const mapAction = customer
        ? `<button type="button" class="ghost contract-map-action" data-contract-action="map" data-customer-number="${escapeHtml(number)}">Auf Karte</button>`
        : '<button type="button" class="ghost contract-map-action" disabled>Keine Kartenposition</button>';
    const sourceAction = url
        ? `<a class="contract-source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Original öffnen</a>`
        : '';
    const sla = [
        contract.slaResponseHours ? `Reaktion ${escapeHtml(contract.slaResponseHours)} Std.` : '',
        contract.slaResolutionHours ? `Lösung ${escapeHtml(contract.slaResolutionHours)} Std.` : '',
        contract.slaTimeBasis ? escapeHtml(contract.slaTimeBasis) : '',
        contract.sla ? escapeHtml(contract.sla) : ''
    ].filter(Boolean).join(' · ');
    const managerDetails = [
        contract.managerId ? `ID ${escapeHtml(contract.managerId)}` : '',
        contract.managerEmail ? escapeHtml(contract.managerEmail) : ''
    ].filter(Boolean).join(' · ');
    const objectDetails = [
        contract.siteId ? `Standort ${escapeHtml(contract.siteId)}` : '',
        contract.sourceCustomerId ? `Quell-Kunde ${escapeHtml(contract.sourceCustomerId)}` : '',
        Array.isArray(contract.assetIds) && contract.assetIds.length
            ? `Anlagen ${contract.assetIds.map(escapeHtml).join(', ')}`
            : ''
    ].filter(Boolean).join(' · ');

    return `<article class="contract-radar-item ${urgencyClass(urgency.key)}">
        <div class="contract-item-head">
            <div><b>${escapeHtml(customerName)}</b><small>Nr. ${escapeHtml(contract.customerNumber || '—')}</small></div>
            <span class="contract-urgency ${urgencyClass(urgency.key)}">${escapeHtml(urgency.label)}</span>
        </div>
        ${match}
        <h3>${escapeHtml(contract.title || contract.type || 'Servicevertrag')}</h3>
        <p class="contract-id">${escapeHtml(contract.contractId || 'Ohne Vertragsnummer')} · ${escapeHtml(contract.status || 'Status fehlt')}</p>
        <div class="contract-item-metrics">
            <span><small>Handeln bis</small><b>${escapeHtml(formatDate(contract.actionBy))}</b></span>
            <span><small>Jahreswert</small><b>${escapeHtml(formatMoney(contract.annualValue, contract.currency))}</b></span>
        </div>
        ${contractFacts(contract) ? `<p class="contract-facts">${contractFacts(contract)}</p>` : ''}
        ${full && contract.scope ? `<div class="contract-detail"><small>Leistungsumfang</small><p>${escapeHtml(contract.scope)}</p></div>` : ''}
        ${full && sla ? `<div class="contract-detail"><small>SLA</small><p>${sla}</p></div>` : ''}
        ${full && managerDetails ? `<div class="contract-detail"><small>Vertragsmanagement</small><p>${managerDetails}</p></div>` : ''}
        ${full && objectDetails ? `<div class="contract-detail"><small>Standort und Anlagen</small><p>${objectDetails}</p></div>` : ''}
        ${full && contract.note ? `<div class="contract-detail"><small>Hinweis</small><p>${escapeHtml(contract.note)}</p></div>` : ''}
        <footer>${mapAction}${sourceAction}</footer>
    </article>`;
}

function emptyListHtml(allCount) {
    const sourceEntries = Object.values(sources());
    const unmatched = sourceEntries.reduce((sum, meta) => sum + (Number(meta?.unmatched) || 0), 0);
    if (!allCount && unmatched) {
        return `<div class="contract-empty warning"><b>Keine Verträge zugeordnet</b>
            <span>${unmatched} Vertragszeilen passen zu keiner eindeutigen Kundennummer. Prüfen Sie Kunden- und Vertragsdatei.</span></div>`;
    }
    if (!allCount) {
        return `<div class="contract-empty"><b>Noch keine Vertragsdaten</b>
            <span>Importieren Sie eine Servicevertrags-Datei oder laden Sie die Vorlage herunter.</span></div>`;
    }
    return `<div class="contract-empty"><b>Keine Verträge für diesen Filter</b>
        <span>Zeitraum, Suche oder Contract Manager schränken die Treffer ein.</span>
        <button type="button" class="ghost" data-contract-action="reset">Filter zurücksetzen</button></div>`;
}

function renderCompactList() {
    const target = el('contract-radar-list');
    if (!target) return;
    const filtered = filteredContracts();
    if (!filtered.length) {
        target.innerHTML = emptyListHtml(contracts().length);
        return;
    }
    const shown = filtered.slice(0, 40);
    const index = customerIndex();
    target.innerHTML = `<div class="contract-result-count">${shown.length === filtered.length ? filtered.length : `${shown.length} von ${filtered.length}`} Verträge</div>
        ${shown.map((contract) => contractCardHtml(contract, { index })).join('')}
        ${filtered.length > shown.length ? '<button type="button" class="ghost contract-more" data-contract-action="open">Alle im Radar öffnen</button>' : ''}`;
}

function renderRadarDialog() {
    const target = el('contract-radar-body');
    if (!target) return;
    const filtered = filteredContracts(dialogCustomerNumber);
    const exactCustomer = dialogCustomerNumber && customerForNumber(dialogCustomerNumber);
    const scope = dialogCustomerNumber
        ? `<div class="contract-dialog-scope"><span>Gefiltert auf</span><b>${escapeHtml(exactCustomer?.name || dialogCustomerNumber)}</b>
            <button type="button" class="ghost" data-contract-action="show-all">Alle Verträge</button></div>`
        : '';
    const sourceWarning = Object.values(sources()).some((meta) => {
        const age = daysSince(meta?.dataAsOf);
        return !meta?.dataAsOf || (age !== null && age > STALE_SOURCE_DAYS);
    }) ? '<p class="contract-freshness-warning">Mindestens eine Quelle ist älter als 30 Tage oder besitzt keinen Datenstand. Vor Entscheidungen bitte aktualisieren.</p>' : '';
    const index = customerIndex();
    target.innerHTML = `${scope}${sourceWarning}
        <div class="contract-dialog-summary"><b>${filtered.length}</b><span>sichtbare Verträge</span></div>
        <div class="contract-dialog-list">${filtered.length
            ? filtered.map((contract) => contractCardHtml(contract, { full: true, index })).join('')
            : emptyListHtml(contracts().length)}</div>`;
}

function renderAll() {
    renderSources();
    renderKpis();
    ensureWindowOptions();
    renderManagerFilter();
    renderCompactList();
    if (el('contract-radar-dialog')?.open) renderRadarDialog();
    const clear = el('btn-contract-clear');
    if (clear) clear.disabled = contracts().length === 0 && Object.keys(sources()).length === 0;
    const open = el('btn-contract-open');
    if (open) open.disabled = contracts().length === 0;
}

function closeRadar() {
    const dialog = el('contract-radar-dialog');
    if (!dialog?.open) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
}

export function openContractRadar(payload = {}) {
    if (state.ui?.depth !== 'profi') {
        emit('toast', { type: 'info', text: 'Das Vertragsradar steht im Profi-Modus zur Verfügung.' });
        return false;
    }
    if (mobileQuery?.matches || window.innerWidth <= 768) {
        emit('toast', { type: 'info', text: 'Das vollständige Vertragsradar steht auf dem Desktop zur Verfügung.' });
        return false;
    }
    dialogCustomerNumber = normalizedNumber(
        typeof payload === 'string' ? payload : payload?.customerNumber ?? payload?.kundennummer ?? ''
    );
    applyMode('service', true);
    renderRadarDialog();
    const dialog = el('contract-radar-dialog');
    if (!dialog) return false;
    if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }
    return true;
}

function renderMapping() {
    const target = el('contract-mapping-rows');
    if (!target || !pendingWorkbook) return;
    const mapping = autoDetectServiceContractMapping(pendingWorkbook.headers);
    const fields = Array.isArray(SERVICE_CONTRACT_FIELDS) ? SERVICE_CONTRACT_FIELDS : [];
    target.innerHTML = fields.map((field) => {
        const options = ['<option value="">– nicht vorhanden –</option>']
            .concat(pendingWorkbook.headers.map((header) => `<option value="${escapeHtml(header)}"${mapping[field.key] === header ? ' selected' : ''}>${escapeHtml(header)}</option>`))
            .join('');
        return `<tr><td>${escapeHtml(field.label || field.key)}${field.required ? ' <span class="req">Pflicht</span>' : ''}</td>
            <td><select data-contract-field="${escapeHtml(field.key)}">${options}</select></td>
            <td class="preview" data-contract-preview="${escapeHtml(field.key)}"></td></tr>`;
    }).join('');

    const updatePreview = () => {
        target.querySelectorAll('select[data-contract-field]').forEach((select) => {
            const preview = target.querySelector(`[data-contract-preview="${select.dataset.contractField}"]`);
            const header = select.value;
            if (preview) preview.textContent = header
                ? pendingWorkbook.rows.slice(0, 3).map((row) => row[header]).filter((value) => String(value ?? '').trim()).slice(0, 2).join(' · ')
                : '';
        });
    };
    target.querySelectorAll('select').forEach((select) => select.addEventListener('change', updatePreview));
    updatePreview();
}

async function handleContractFile(file) {
    if (!file || !/\.(xlsx|xls|csv|ods)$/i.test(file.name)) {
        emit('toast', { type: 'error', text: 'Bitte eine Excel- oder CSV-Datei wählen (.xlsx, .xls, .csv, .ods).' });
        return;
    }
    try {
        const workbook = await readWorkbook(file);
        pendingWorkbook = { ...workbook, fileName: file.name };
        lastImportIssues = [];
        clearImportFeedback();
        const info = el('contract-mapping-file-info');
        if (info) info.textContent = `${file.name} – ${workbook.rows.length} Zeilen, ${workbook.headers.length} Spalten`;
        renderMapping();
        const dialog = el('contract-import-dialog');
        if (dialog && !dialog.open) {
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        }
    } catch (error) {
        emit('toast', { type: 'error', text: `Vertragsdatei konnte nicht gelesen werden: ${error.message}` });
    }
}

function mappingFromDialog() {
    const mapping = {};
    el('contract-mapping-rows')?.querySelectorAll('select[data-contract-field]').forEach((select) => {
        mapping[select.dataset.contractField] = select.value || null;
    });
    return mapping;
}

function unmatchedIssuesFor(all) {
    const index = customerIndex();
    return all.filter((contract) => !customerForContract(contract, index)).map((contract) => ({
        type: 'Hinweis',
        sourceSystem: sourceKey(contract),
        contractIdentity: contract.id || `${sourceKey(contract)}::${contract.contractId}`,
        customerNumber: contract.customerNumber,
        contractId: contract.contractId,
        message: `Kundennummer „${contract.customerNumber || 'leer'}“ ist im Kundenstamm nicht eindeutig vorhanden.`
    }));
}

function sourceMetadata(all, parserWarnings, unmatchedIssues, fileName, mapping = {}) {
    const importedAt = new Date().toISOString();
    const grouped = new Map();
    for (const contract of all) {
        const source = sourceKey(contract);
        if (!grouped.has(source)) grouped.set(source, []);
        grouped.get(source).push(contract);
    }
    return Object.fromEntries([...grouped].map(([source, items]) => {
        const identities = new Set(items.map((contract) => (
            contract.id || `${sourceKey(contract)}::${contract.contractId}`
        )));
        const unmatched = unmatchedIssues.filter((issue) => (
            issue.sourceSystem === source && identities.has(issue.contractIdentity)
        )).length;
        const sourceHeader = mapping.sourceSystem;
        const sourceWarnings = parserWarnings.filter((issue) => {
            const issueSource = String(issue?.sourceSystem ?? (sourceHeader ? issue?.[sourceHeader] : '') ?? '').trim();
            return issueSource ? issueSource === source : grouped.size === 1;
        }).length;
        const range = dateRange(items.map((contract) => contract.dataAsOf));
        return [source, {
            fileName,
            importedAt,
            // Konservativ den ältesten Stand als Frischebasis verwenden. Ein
            // frischer Einzelvertrag darf alte Zeilen derselben Quelle nicht maskieren.
            dataAsOf: range.oldest,
            dataAsOfLatest: range.latest,
            mixedDataAsOf: range.mixed,
            count: items.length,
            warnings: sourceWarnings,
            unmatched
        }];
    }));
}

async function confirmContractImport() {
    if (!pendingWorkbook) return;
    const button = el('contract-mapping-confirm');
    if (button) button.disabled = true;
    clearImportFeedback();
    try {
        const mapping = mappingFromDialog();
        const result = parseServiceContractRows(
            pendingWorkbook.rows,
            mapping,
            { fileName: pendingWorkbook.fileName }
        ) || {};
        const parsedContracts = Array.isArray(result.contracts) ? result.contracts : [];
        const combinedIssues = [
            ...(Array.isArray(result.errors) ? result.errors : []),
            ...(Array.isArray(result.warnings) ? result.warnings : [])
        ];
        const fatal = combinedIssues.filter((issue) => !isWarning(issue));
        if (fatal.length || parsedContracts.length === 0) {
            if (!fatal.length) fatal.push({ type: 'Fehler', message: 'Die Datei enthält keine gültigen Vertragszeilen.' });
            lastImportIssues = combinedIssues.length ? combinedIssues : fatal;
            setImportFeedback('error', 'Import nicht übernommen – die bisherigen Vertragsdaten bleiben erhalten.', fatal);
            showIssueDownloads(true);
            return;
        }

        const fallbackSource = pendingWorkbook.fileName.replace(/\.[^.]+$/, '') || 'Excel-Import';
        const normalizedContracts = parsedContracts.map((contract) => ({
            ...contract,
            sourceSystem: String(contract.sourceSystem ?? '').trim() || fallbackSource
        }));
        const warnings = combinedIssues.filter(isWarning);
        const unmatched = unmatchedIssuesFor(normalizedContracts);
        lastImportIssues = [...warnings, ...unmatched];
        showIssueDownloads(lastImportIssues.length > 0);
        const metaBySource = sourceMetadata(
            normalizedContracts, warnings, unmatched, pendingWorkbook.fileName, mapping
        );

        const replacementRisks = serviceContractReplacementRisks(
            contracts(), normalizedContracts, sources(), metaBySource
        );
        if (replacementRisks.length) {
            const lines = replacementRisks.map((risk) => risk.type === 'count-drop'
                ? `${risk.sourceSystem}: ${risk.existingCount} bisherige → ${risk.incomingCount} neue Verträge`
                : `${risk.sourceSystem}: Datenstand ${formatDate(risk.incomingDate)} ist älter als ${formatDate(risk.existingDate)}`
            );
            const confirmed = window.confirm(
                'Der Vertragsimport wirkt wie ein kleinerer oder älterer Quell-Snapshot.\n\n'
                + `${lines.join('\n')}\n\n`
                + 'Nur fortfahren, wenn die Datei den vollständigen, beabsichtigten Stand dieser Quelle enthält.'
            );
            if (!confirmed) {
                setImportFeedback('warning', 'Import abgebrochen – der bisherige Vertragsbestand bleibt unverändert.');
                return;
            }
        }

        const previousContracts = [...contracts()];
        const previousSources = { ...sources() };
        replaceServiceContractSources(normalizedContracts, metaBySource);
        const saved = await saveDataset(datasetSnapshot());
        if (!saved) {
            setServiceContracts(previousContracts, previousSources);
            throw new Error('Die Vertragsdaten konnten nicht lokal gespeichert werden. Der bisherige Stand wurde wiederhergestellt.');
        }
        renderAll();

        const importDialog = el('contract-import-dialog');
        if (importDialog?.open) {
            if (typeof importDialog.close === 'function') importDialog.close();
            else importDialog.removeAttribute('open');
        }
        emit('toast', {
            type: lastImportIssues.length ? 'info' : 'success',
            text: `${normalizedContracts.length} Serviceverträge importiert${unmatched.length ? `, ${unmatched.length} nicht zugeordnet` : ''}${warnings.length ? `, ${warnings.length} Hinweise` : ''}.`
        });
        applyMode('service', true);
        const radarOpened = openContractRadar();
        const offerVault = () => emit('data:imported', {
            type: 'service-contracts',
            count: normalizedContracts.length
        });
        const radarDialog = el('contract-radar-dialog');
        if (radarOpened && radarDialog?.open) radarDialog.addEventListener('close', offerVault, { once: true });
        else offerVault();
    } catch (error) {
        lastImportIssues = [{ type: 'Fehler', message: error.message }];
        setImportFeedback('error', 'Import nicht übernommen – die bisherigen Vertragsdaten bleiben erhalten.', lastImportIssues);
        showIssueDownloads(true);
    } finally {
        if (button) button.disabled = false;
    }
}

function downloadStaticTemplate(path, fileName) {
    const anchor = document.createElement('a');
    anchor.href = new URL(path, document.baseURI).href;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

const downloadTemplateXlsx = () => downloadStaticTemplate(
    './templates/tourfuchs-servicevertraege-vorlage.xlsx',
    'tourfuchs-servicevertraege-vorlage.xlsx'
);
const downloadTemplateCsv = () => downloadStaticTemplate(
    './templates/tourfuchs-servicevertraege-beispiel.csv',
    'tourfuchs-servicevertraege-beispiel.csv'
);

async function exportLastIssues() {
    if (!lastImportIssues.length) return;
    const { exportErrors } = await import('../services/excel.js');
    exportErrors(exportIssueRows(lastImportIssues), 'servicevertraege');
}

async function clearContracts() {
    if (!contracts().length && !Object.keys(sources()).length) return;
    if (!window.confirm('Alle Servicevertrags-Datenquellen aus TourFuchs löschen? Kunden, Gebiete und Touren bleiben erhalten.')) return;
    const previousContracts = [...contracts()];
    const previousSources = { ...sources() };
    clearServiceContracts();
    const saved = await saveDataset(datasetSnapshot());
    if (!saved) {
        setServiceContracts(previousContracts, previousSources);
        emit('toast', { type: 'error', text: 'Vertragsdaten konnten nicht gelöscht werden. Der bisherige Stand wurde wiederhergestellt.' });
        return;
    }
    lastImportIssues = [];
    showIssueDownloads(false);
    closeRadar();
    renderAll();
    emit('toast', { type: 'success', text: 'Servicevertragsdaten wurden gelöscht. Kundendaten und Touren bleiben erhalten.' });
}

function resetFilters() {
    const search = el('contract-search');
    const manager = el('contract-manager');
    const windowSelect = el('contract-window');
    if (search) search.value = '';
    if (manager) manager.value = '';
    if (windowSelect) windowSelect.value = DEFAULT_WINDOW;
    renderCompactList();
    renderRadarDialog();
}

function handleContractAction(event) {
    const actionElement = event.target.closest('[data-contract-action], [data-contract-window]');
    if (!actionElement) return;
    if (actionElement.dataset.contractWindow) {
        const windowSelect = el('contract-window');
        if (windowSelect) windowSelect.value = actionElement.dataset.contractWindow;
        renderCompactList();
        renderRadarDialog();
        return;
    }
    const action = actionElement.dataset.contractAction;
    if (action === 'map') {
        const customer = customerForNumber(actionElement.dataset.customerNumber);
        if (!customer) return;
        if (customer.lat === null || customer.lat === undefined) {
            emit('toast', { type: 'info', text: 'Dieser Kunde besitzt noch keine Kartenposition.' });
            return;
        }
        closeRadar();
        applyMode('service', true);
        flyToCustomer(customer);
    } else if (action === 'reset') {
        resetFilters();
    } else if (action === 'open') {
        openContractRadar();
    } else if (action === 'show-all') {
        dialogCustomerNumber = '';
        renderRadarDialog();
    }
}

export function initContractRadar() {
    if (initialized) {
        renderAll();
        return;
    }
    initialized = true;
    mobileQuery = mobilePlanningMediaQuery();

    const fileInput = el('contract-file-input');
    el('btn-contract-import')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (file) handleContractFile(file);
        event.target.value = '';
    });
    el('btn-contract-template')?.addEventListener('click', downloadTemplateXlsx);
    el('btn-contract-csv')?.addEventListener('click', downloadTemplateCsv);
    el('btn-contract-open')?.addEventListener('click', () => openContractRadar());
    el('btn-contract-clear')?.addEventListener('click', clearContracts);
    el('contract-mapping-confirm')?.addEventListener('click', confirmContractImport);
    el('contract-import-errors')?.addEventListener('click', exportLastIssues);
    el('btn-contract-issues')?.addEventListener('click', exportLastIssues);
    el('contract-import-dialog')?.querySelector('.dialog-close')?.addEventListener('click', () => {
        const dialog = el('contract-import-dialog');
        if (dialog?.open) dialog.close();
    });
    el('contract-radar-close')?.addEventListener('click', closeRadar);

    ['contract-window', 'contract-manager'].forEach((id) =>
        el(id)?.addEventListener('change', () => { renderCompactList(); renderRadarDialog(); }));
    el('contract-search')?.addEventListener('input', () => { renderCompactList(); renderRadarDialog(); });
    [el('contract-kpis'), el('contract-radar-list'), el('contract-radar-body')]
        .filter(Boolean).forEach((target) => target.addEventListener('click', handleContractAction));

    on('service-contracts:changed', renderAll);
    on('customers:changed', renderAll);
    on('service-contracts:open', openContractRadar);
    on('depth:changed', () => {
        if (state.ui?.depth !== 'profi') closeRadar();
    });
    mobileQuery.addEventListener('change', (event) => {
        if (event.matches) closeRadar();
    });
    el('contract-radar-dialog')?.addEventListener('close', () => { dialogCustomerNumber = ''; });

    ensureWindowOptions();
    clearImportFeedback();
    renderAll();
}

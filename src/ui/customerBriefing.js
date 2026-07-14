import { state, emit } from '../core/state.js';
import {
    buildCustomerBriefingPrompt,
    customerBriefingContext,
    customerBriefingFlow
} from '../features/customerBriefing.js';
import { copyText } from '../features/handoff.js';
import {
    COPILOT_WEB_URL,
    clearCopilotConfig,
    copilotErrorMessage,
    getCopilotRedirectUri,
    isCopilotConfigured,
    loadCopilotConfig,
    requestCustomerBriefing,
    saveCopilotConfig,
    warmupCopilotAuth
} from '../services/copilot.js';

const CONSENT_KEY = 'tourfuchs:copilot-consent:v1';

let dialog = null;
let body = null;
let footer = null;
let currentCustomer = null;
let currentPrompt = '';
let requestSequence = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function localStorageAvailable() {
    try { return window.localStorage; } catch { return null; }
}

function hasConsent() {
    return localStorageAvailable()?.getItem(CONSENT_KEY) === 'yes';
}

function rememberConsent() {
    localStorageAvailable()?.setItem(CONSENT_KEY, 'yes');
}

function plannedDate() {
    return document.getElementById('plan-date')?.value || '';
}

function identityHtml(customer) {
    const place = [customer.plz, customer.ort].filter(Boolean).join(' ');
    return `<div class="briefing-customer">
        <b>${escapeHtml(customer.name)}</b>
        <span>${escapeHtml([customer.nummer ? `Nr. ${customer.nummer}` : '', place].filter(Boolean).join(' · '))}</span>
    </div>`;
}

function promptDetails() {
    return `<details class="briefing-prompt-details">
        <summary>Verwendeten Prompt ansehen</summary>
        <pre></pre>
    </details>`;
}

function fillPromptPreview() {
    const pre = body?.querySelector('.briefing-prompt-details pre');
    if (pre) pre.textContent = currentPrompt;
}

function visiblePrompt() {
    return `<div class="briefing-prompt-visible">
        <span>Vorbereiteter Prompt</span>
        <pre></pre>
    </div>`;
}

function fillVisiblePrompt() {
    const pre = body?.querySelector('.briefing-prompt-visible pre');
    if (pre) pre.textContent = currentPrompt;
}

function setFooter(html) {
    footer.innerHTML = html;
}

function wireClose() {
    footer.querySelector('[data-briefing-close]')?.addEventListener('click', () => dialog.close());
}

function renderManual() {
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-manual">
            <span class="briefing-kicker">Direkt nutzbar</span>
            <h3>Ihr Kundenbriefing ist vorbereitet</h3>
            <p>TourFuchs hat aus dem ausgewählten Kunden und dem aktuellen Tourkontext einen Prompt erstellt. Mit dem nächsten Schritt wird er kopiert und Microsoft 365 Copilot geöffnet.</p>
            <p class="briefing-manual-note"><b>In Copilot:</b> Prompt einfügen und selbst absenden. Erst dann werden die enthaltenen Daten an Microsoft übergeben.</p>
            ${visiblePrompt()}
        </div>`;
    fillVisiblePrompt();
    setFooter('<button type="button" class="primary" data-briefing-fallback>Prompt kopieren &amp; Copilot öffnen</button>');
    footer.querySelector('[data-briefing-fallback]')?.addEventListener('click', openFallback);
}

function expertManualPath() {
    return `<section class="briefing-path-simple">
        <span class="briefing-kicker">Einfach · sofort nutzbar</span>
        <h3>Prompt in Corporate Copilot verwenden</h3>
        <p>Kein technisches Setup nötig: TourFuchs kopiert den vorbereiteten Prompt und öffnet Microsoft 365 Copilot. Sie fügen ihn dort ein und senden ihn selbst ab.</p>
        <p class="briefing-manual-note"><b>Ihre Kontrolle:</b> Erst beim Absenden werden die im Prompt sichtbaren Kundendaten an Microsoft übergeben. Copilot kann nur interne Microsoft-365-Inhalte einbeziehen, auf die Ihr Arbeitskonto zugreifen darf.</p>
        <button type="button" class="primary briefing-path-action" data-briefing-fallback>Prompt kopieren &amp; Copilot öffnen</button>
        ${promptDetails()}
    </section>`;
}

function wireManualFallback() {
    body.querySelector('[data-briefing-fallback]')?.addEventListener('click', openFallback);
}

function renderSetup(errorText = '') {
    const saved = loadCopilotConfig();
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-profi-entry">
            ${expertManualPath()}
            <details class="briefing-expert-path"${errorText ? ' open' : ''}>
                <summary>
                    <b>Expertenfall: Briefing direkt in TourFuchs</b>
                    <span>Optionale Entra-Verbindung Ihrer Organisation einrichten</span>
                </summary>
                <div class="briefing-expert-content briefing-setup">
                    <span class="briefing-kicker">Profi · Automatisierung</span>
                    <h3>Microsoft-Verbindung einrichten</h3>
                    <p>Für die automatische Anmeldung braucht TourFuchs die Kennungen einer von Ihrer IT registrierten <b>Entra-SPA</b>. Es wird kein Client Secret benötigt oder gespeichert.</p>
                    ${errorText ? `<p class="briefing-error" role="alert">${escapeHtml(errorText)}</p>` : ''}
                    <label class="briefing-field">Client-ID der Anwendung
                        <input id="briefing-client-id" type="text" autocomplete="off" spellcheck="false" value="${escapeHtml(saved.clientId)}" placeholder="00000000-0000-0000-0000-000000000000">
                    </label>
                    <label class="briefing-field">Tenant-ID oder Tenant-Domäne
                        <input id="briefing-tenant-id" type="text" autocomplete="off" spellcheck="false" value="${escapeHtml(saved.tenantId)}" placeholder="contoso.onmicrosoft.com">
                    </label>
                    <div class="briefing-redirect">
                        <span>Redirect-URI für die Entra-SPA</span>
                        <code>${escapeHtml(getCopilotRedirectUri())}</code>
                        <button type="button" data-copy-redirect>URI kopieren</button>
                    </div>
                    <p class="muted small">Die Copilot Chat API ist weiterhin Microsoft-Preview. Für den ersten Test kann eine Administratorfreigabe der angeforderten Graph-Berechtigungen erscheinen.</p>
                    <label class="briefing-consent">
                        <input id="briefing-consent" type="checkbox">
                        <span>Ich möchte die genannten Daten für dieses Briefing an meinen Microsoft 365 Copilot übergeben.</span>
                    </label>
                    <button type="button" class="primary briefing-path-action" data-briefing-save>Verbindung speichern &amp; Briefing erstellen</button>
                </div>
            </details>
        </div>`;
    fillPromptPreview();
    setFooter('');
    wireManualFallback();
    body.querySelector('[data-copy-redirect]')?.addEventListener('click', async () => {
        const ok = await copyText(getCopilotRedirectUri());
        emit('toast', { type: ok ? 'success' : 'error', text: ok ? 'Redirect-URI kopiert.' : 'Kopieren nicht möglich.' });
    });
    body.querySelector('[data-briefing-save]')?.addEventListener('click', () => {
        try {
            const consent = body.querySelector('#briefing-consent');
            if (!consent?.checked) throw new Error('Bitte bestätigen Sie zuerst die Datenübergabe an Microsoft 365 Copilot.');
            saveCopilotConfig({
                clientId: body.querySelector('#briefing-client-id')?.value,
                tenantId: body.querySelector('#briefing-tenant-id')?.value
            });
            rememberConsent();
            warmupCopilotAuth().catch(() => {});
            startBriefing();
        } catch (error) {
            renderSetup(error.message);
        }
    });
}

function renderConsent() {
    const consentChecked = hasConsent() ? ' checked' : '';
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-profi-entry">
            ${expertManualPath()}
            <details class="briefing-expert-path">
                <summary>
                    <b>Expertenfall: Briefing direkt in TourFuchs</b>
                    <span>Microsoft-Verbindung ist eingerichtet</span>
                </summary>
                <div class="briefing-expert-content">
                    <span class="briefing-kicker">Profi · Microsoft 365 Copilot</span>
                    <h3>Aktuelles Kundenwissen automatisch abrufen</h3>
                    <p>TourFuchs übergibt Kundenname, Kundennummer, Ort, Hauptansprechpartner und den aktuellen Tourkontext. Copilot durchsucht nur Inhalte, auf die Ihr Arbeitskonto zugreifen darf.</p>
                    <p class="briefing-privacy"><b>Nicht übertragen:</b> die vollständige Kundenliste, Telefonnummer, E-Mail-Adresse, Umsatz oder Kartenkoordinaten.</p>
                    <label class="briefing-consent">
                        <input id="briefing-consent" type="checkbox"${consentChecked}>
                        <span>Ich möchte diese Daten für das Briefing an Microsoft 365 Copilot übergeben.</span>
                    </label>
                    <div class="briefing-expert-actions">
                        <button type="button" data-briefing-config>Verbindung ändern</button>
                        <button type="button" class="primary" data-briefing-start>Briefing direkt erstellen</button>
                    </div>
                </div>
            </details>
        </div>`;
    fillPromptPreview();
    setFooter('');
    wireManualFallback();
    body.querySelector('[data-briefing-config]')?.addEventListener('click', () => {
        clearCopilotConfig();
        renderSetup();
    });
    body.querySelector('[data-briefing-start]')?.addEventListener('click', () => {
        if (!body.querySelector('#briefing-consent')?.checked) {
            emit('toast', { type: 'info', text: 'Bitte zuerst die Datenübergabe bestätigen.' });
            return;
        }
        rememberConsent();
        warmupCopilotAuth().catch(() => {});
        startBriefing();
    });
}

function renderLoading() {
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-loading" aria-live="polite">
            <span class="briefing-spinner" aria-hidden="true"></span>
            <h3>Briefing wird erstellt</h3>
            <p>Arbeitskonto wird geprüft und berechtigtes Microsoft-365-Wissen durchsucht.</p>
            <p class="muted small">Bei der ersten Verwendung öffnet sich die Microsoft-Anmeldung beziehungsweise die Freigabe Ihrer Organisation.</p>
        </div>`;
    setFooter('');
}

function safeSources(attributions) {
    const seen = new Set();
    const result = [];
    for (const item of attributions || []) {
        const href = String(item?.seeMoreWebUrl || '').trim();
        if (!href || seen.has(href)) continue;
        try {
            const url = new URL(href);
            if (!['https:', 'http:'].includes(url.protocol)) continue;
            seen.add(href);
            result.push({ href, label: item.providerDisplayName || `Quelle ${result.length + 1}` });
        } catch { /* ungültige Quellenlinks auslassen */ }
    }
    return result;
}

function renderAnswer(result) {
    const sources = safeSources(result.attributions);
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-result">
            <div class="briefing-result-head">
                <span class="briefing-kicker">Briefing bereit</span>
                ${result.account?.username ? `<span class="briefing-account">${escapeHtml(result.account.username)}</span>` : ''}
            </div>
            <div class="briefing-answer" tabindex="0"></div>
            ${sources.length ? '<div class="briefing-sources"><h3>Quellen</h3><ul></ul></div>' : ''}
            ${result.sensitivityLabel?.displayName ? `<p class="muted small">Vertraulichkeitsbezeichnung: ${escapeHtml(result.sensitivityLabel.displayName)}</p>` : ''}
            <p class="muted small">KI-Ergebnis bitte vor dem Kundengespräch prüfen.</p>
        </div>`;
    body.querySelector('.briefing-answer').textContent = result.text;
    const list = body.querySelector('.briefing-sources ul');
    if (list) {
        for (const source of sources) {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = source.href;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = source.label;
            item.appendChild(link);
            list.appendChild(item);
        }
    }
    setFooter(`
        <button type="button" data-copy-answer>Antwort kopieren</button>
        <button type="button" data-briefing-retry>Neu erstellen</button>
        <button type="button" class="primary" data-briefing-close>Fertig</button>`);
    wireClose();
    footer.querySelector('[data-copy-answer]')?.addEventListener('click', async () => {
        const ok = await copyText(result.text);
        emit('toast', { type: ok ? 'success' : 'error', text: ok ? 'Briefing kopiert.' : 'Kopieren nicht möglich.' });
    });
    footer.querySelector('[data-briefing-retry]')?.addEventListener('click', startBriefing);
}

function renderError(error) {
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-failed">
            <span class="briefing-kicker">Verbindung nicht möglich</span>
            <h3>Das Briefing wurde nicht erstellt</h3>
            <p class="briefing-error" role="alert">${escapeHtml(copilotErrorMessage(error))}</p>
            <p>Für den lokalen Test können Sie den fertigen Prompt trotzdem sofort in Corporate Copilot verwenden.</p>
            <details class="briefing-error-details">
                <summary>Technische Details</summary>
                <code>${escapeHtml(error?.code || error?.errorCode || error?.message || 'Unbekannter Fehler')}</code>
            </details>
        </div>`;
    setFooter(`
        <button type="button" data-briefing-config>Verbindung ändern</button>
        <button type="button" data-briefing-fallback>Prompt kopieren &amp; Copilot öffnen</button>
        <button type="button" class="primary" data-briefing-retry>Erneut versuchen</button>`);
    footer.querySelector('[data-briefing-config]')?.addEventListener('click', () => {
        clearCopilotConfig();
        renderSetup();
    });
    footer.querySelector('[data-briefing-fallback]')?.addEventListener('click', openFallback);
    footer.querySelector('[data-briefing-retry]')?.addEventListener('click', startBriefing);
}

async function startBriefing() {
    const sequence = ++requestSequence;
    renderLoading();
    try {
        const result = await requestCustomerBriefing(currentPrompt);
        if (sequence !== requestSequence || !dialog?.open) return;
        renderAnswer(result);
    } catch (error) {
        if (sequence !== requestSequence || !dialog?.open) return;
        renderError(error);
    }
}

function launchCorporateCopilot() {
    const isWindows = /Windows/i.test(navigator.userAgent);
    if (isWindows) {
        const link = document.createElement('a');
        link.href = `microsoft-edge:${COPILOT_WEB_URL}`;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
    }
    window.open(COPILOT_WEB_URL, '_blank', 'noopener');
}

async function openFallback() {
    const copyPromise = copyText(currentPrompt);
    launchCorporateCopilot();
    const copied = await copyPromise;
    emit('toast', {
        type: copied ? 'success' : 'info',
        text: copied
            ? 'Prompt vorbereitet. In Copilot einfügen und absenden.'
            : 'Copilot wurde geöffnet. Der Prompt konnte nicht automatisch kopiert werden.'
    });
}

export function initCustomerBriefing() {
    dialog = document.getElementById('customer-briefing-dialog');
    body = document.getElementById('customer-briefing-body');
    footer = document.getElementById('customer-briefing-footer');
    if (!dialog || !body || !footer) return;
    dialog.querySelector('[data-briefing-header-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
        requestSequence++;
        currentCustomer = null;
        currentPrompt = '';
    });
}

export function openCustomerBriefing(customer) {
    if (!dialog) initCustomerBriefing();
    if (!dialog || !customer) return;
    currentCustomer = customer;
    currentPrompt = buildCustomerBriefingPrompt(
        customer,
        customerBriefingContext(customer, state.tour, plannedDate())
    );
    dialog.showModal();
    const config = loadCopilotConfig();
    const flow = customerBriefingFlow(state.ui.depth, isCopilotConfigured(config));
    if (flow === 'manual') {
        renderManual();
    } else if (flow === 'setup') {
        renderSetup();
    } else {
        renderConsent();
    }
}

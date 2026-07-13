const CONFIG_KEY = 'tourfuchs:copilot-config:v1';
const GRAPH_BASE = 'https://graph.microsoft.com/beta/copilot';

export const COPILOT_WEB_URL = 'https://m365.cloud.microsoft/chat';
export const COPILOT_SCOPES = [
    'Sites.Read.All',
    'Mail.Read',
    'People.Read.All',
    'OnlineMeetingTranscript.Read.All',
    'Chat.Read',
    'ChannelMessage.Read.All',
    'ExternalItem.Read.All'
];

let msalClient = null;
let msalConfigKey = '';
let msalModulePromise = null;

function loadMsal() {
    if (!msalModulePromise) msalModulePromise = import('@azure/msal-browser');
    return msalModulePromise;
}

export async function warmupCopilotAuth() {
    await loadMsal();
}

function clean(value) {
    return String(value ?? '').trim();
}

function storage() {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
}

function environmentConfig() {
    return {
        clientId: clean(import.meta.env?.VITE_ENTRA_CLIENT_ID),
        tenantId: clean(import.meta.env?.VITE_ENTRA_TENANT_ID)
    };
}

export function loadCopilotConfig() {
    const env = environmentConfig();
    if (env.clientId && env.tenantId) return { ...env, source: 'environment' };
    try {
        const saved = JSON.parse(storage()?.getItem(CONFIG_KEY) || '{}');
        return {
            clientId: clean(saved.clientId),
            tenantId: clean(saved.tenantId),
            source: 'local'
        };
    } catch {
        return { clientId: '', tenantId: '', source: 'local' };
    }
}

export function isCopilotConfigured(config = loadCopilotConfig()) {
    return Boolean(clean(config.clientId) && clean(config.tenantId));
}

export function validateCopilotConfig(config) {
    const clientId = clean(config?.clientId);
    const tenantId = clean(config?.tenantId);
    const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!guid.test(clientId)) throw new Error('Die Client-ID muss eine gültige Entra-Anwendungs-ID sein.');
    if (!tenantId || !/^[a-z0-9.-]+$/i.test(tenantId)) {
        throw new Error('Bitte eine gültige Tenant-ID oder Tenant-Domäne eintragen.');
    }
    return { clientId, tenantId };
}

export function saveCopilotConfig(config) {
    const valid = validateCopilotConfig(config);
    storage()?.setItem(CONFIG_KEY, JSON.stringify(valid));
    msalClient = null;
    msalConfigKey = '';
    return { ...valid, source: 'local' };
}

export function clearCopilotConfig() {
    storage()?.removeItem(CONFIG_KEY);
    msalClient = null;
    msalConfigKey = '';
}

export function getCopilotRedirectUri() {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
}

async function getMsalClient(config) {
    const valid = validateCopilotConfig(config);
    const key = `${valid.clientId}|${valid.tenantId}|${getCopilotRedirectUri()}`;
    if (msalClient && msalConfigKey === key) return msalClient;

    const { PublicClientApplication } = await loadMsal();
    const client = new PublicClientApplication({
        auth: {
            clientId: valid.clientId,
            authority: `https://login.microsoftonline.com/${valid.tenantId}`,
            redirectUri: getCopilotRedirectUri(),
            postLogoutRedirectUri: getCopilotRedirectUri()
        },
        cache: {
            cacheLocation: 'sessionStorage',
            storeAuthStateInCookie: false
        },
        system: {
            allowPlatformBroker: false
        }
    });
    await client.initialize();
    const redirectResult = await client.handleRedirectPromise();
    const account = redirectResult?.account || client.getAllAccounts()[0] || null;
    if (account) client.setActiveAccount(account);
    msalClient = client;
    msalConfigKey = key;
    return client;
}

async function acquireGraphToken(config) {
    const client = await getMsalClient(config);
    const { InteractionRequiredAuthError } = await loadMsal();
    let account = client.getActiveAccount() || client.getAllAccounts()[0] || null;

    if (!account) {
        const login = await client.loginPopup({
            scopes: COPILOT_SCOPES,
            prompt: 'select_account'
        });
        account = login.account;
        client.setActiveAccount(account);
        return { accessToken: login.accessToken, account };
    }

    try {
        const token = await client.acquireTokenSilent({ scopes: COPILOT_SCOPES, account });
        return { accessToken: token.accessToken, account };
    } catch (error) {
        if (!(error instanceof InteractionRequiredAuthError)) throw error;
        const token = await client.acquireTokenPopup({ scopes: COPILOT_SCOPES, account });
        if (token.account) client.setActiveAccount(token.account);
        return { accessToken: token.accessToken, account: token.account || account };
    }
}

export class CopilotApiError extends Error {
    constructor(message, { status = 0, code = '', details = null } = {}) {
        super(message);
        this.name = 'CopilotApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function graphPost(path, accessToken, body, fetchImpl) {
    const response = await fetchImpl(`${GRAPH_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw }; }
    if (!response.ok) {
        const apiError = payload?.error;
        throw new CopilotApiError(
            apiError?.message || `Microsoft Graph antwortet mit Status ${response.status}.`,
            { status: response.status, code: apiError?.code || '', details: payload }
        );
    }
    return payload;
}

function answerFromConversation(conversation) {
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    const answer = messages.at(-1);
    if (!answer) throw new CopilotApiError('Copilot hat keine Textantwort geliefert.');
    if (!clean(answer.text)) throw new CopilotApiError('Copilot hat eine leere Textantwort geliefert.');
    return {
        text: clean(answer.text),
        attributions: Array.isArray(answer.attributions) ? answer.attributions : [],
        sensitivityLabel: answer.sensitivityLabel || null
    };
}

export async function requestCustomerBriefing(prompt, {
    config = loadCopilotConfig(),
    fetchImpl = globalThis.fetch
} = {}) {
    if (typeof fetchImpl !== 'function') throw new CopilotApiError('Netzwerkzugriff ist nicht verfügbar.');
    const { accessToken, account } = await acquireGraphToken(config);
    const conversation = await graphPost('/conversations', accessToken, {}, fetchImpl);
    if (!conversation?.id) throw new CopilotApiError('Copilot hat keine Unterhaltung angelegt.');

    const result = await graphPost(`/conversations/${encodeURIComponent(conversation.id)}/chat`, accessToken, {
        message: { text: prompt },
        locationHint: {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
        },
        contextualResources: {
            webContext: { isWebEnabled: false }
        }
    }, fetchImpl);

    return {
        ...answerFromConversation(result),
        conversationId: result.id || conversation.id,
        account: {
            name: clean(account?.name),
            username: clean(account?.username)
        }
    };
}

export function copilotErrorMessage(error) {
    const raw = `${error?.code || ''} ${error?.errorCode || ''} ${error?.message || ''}`.toLowerCase();
    if (raw.includes('user_cancel') || raw.includes('user cancelled') || raw.includes('popup_window_error')) {
        return 'Die Microsoft-Anmeldung wurde abgebrochen oder vom Browser blockiert.';
    }
    if (error?.status === 403 || raw.includes('aadsts65001') || raw.includes('consent_required') || raw.includes('admin')) {
        return 'Die benötigten Microsoft-Graph-Berechtigungen sind noch nicht durch Ihre IT freigegeben.';
    }
    if (error?.status === 401 || raw.includes('invalid_grant')) {
        return 'Die Microsoft-Anmeldung ist abgelaufen. Bitte erneut anmelden.';
    }
    if (raw.includes('failed to fetch') || raw.includes('network')) {
        return 'Microsoft Copilot ist gerade nicht erreichbar. Bitte Netzwerk oder Unternehmenszugang prüfen.';
    }
    return clean(error?.message) || 'Das Briefing konnte nicht erstellt werden.';
}

export async function signOutCopilot(config = loadCopilotConfig()) {
    const client = await getMsalClient(config);
    const account = client.getActiveAccount() || client.getAllAccounts()[0] || null;
    if (account) await client.logoutPopup({ account });
}

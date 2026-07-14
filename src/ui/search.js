/**
 * Globale Kundensuche in der Kopfleiste.
 */

import { state, getCustomer } from '../core/state.js';
import { flyToCustomer } from '../features/map.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

export function normalizeSearchText(value) {
    return String(value ?? '')
        .trim()
        .toLocaleLowerCase('de-DE')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss');
}

export function searchCustomers(customers, query, limit = 8) {
    const q = normalizeSearchText(query);
    if (q.length < 2) return [];
    return customers.filter((customer) => (
        normalizeSearchText(customer?.name).includes(q)
        || normalizeSearchText(customer?.ort).includes(q)
        || String(customer?.plz ?? '').startsWith(q)
        || normalizeSearchText(customer?.nummer) === q
    )).slice(0, limit);
}

export function initSearch() {
    const input = document.getElementById('global-search');
    const results = document.getElementById('search-results');

    const close = () => { results.innerHTML = ''; results.style.display = 'none'; };

    input.addEventListener('input', () => {
        const q = normalizeSearchText(input.value);
        if (q.length < 2) { close(); return; }
        const hits = searchCustomers(state.customers, q);

        if (hits.length === 0) {
            results.innerHTML = '<div class="result-empty">Keine Treffer</div>';
            results.style.display = 'block';
            return;
        }
        results.innerHTML = hits.map((c) => `
            <button type="button" class="result-row" data-id="${escapeHtml(c.id)}">
                <b>${escapeHtml(c.name)}</b>
                <span class="muted">${escapeHtml(c.plz)} ${escapeHtml(c.ort)}${c.vb ? ` · ${escapeHtml(c.vb)}` : ''}</span>
            </button>
        `).join('');
        results.style.display = 'block';

        results.querySelectorAll('[data-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const c = getCustomer(btn.dataset.id);
                close();
                input.value = '';
                if (c) {
                    if (c.lat === null) return;
                    flyToCustomer(c);
                }
            });
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrap')) close();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { close(); input.blur(); }
    });
}

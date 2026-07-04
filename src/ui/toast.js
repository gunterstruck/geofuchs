/**
 * Kleine, unaufdringliche Statusmeldungen (Toasts).
 */

import { on } from '../core/state.js';

let container = null;

export function initToasts() {
    container = document.getElementById('toasts');
    on('toast', ({ type = 'info', text }) => showToast(text, type));
}

export function showToast(text, type = 'info', durationMs = 4000) {
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = text;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => el.remove(), 300);
    }, durationMs);
}

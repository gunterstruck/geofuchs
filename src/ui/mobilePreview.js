/**
 * Mobile-Vorschau (nur Desktop, zu Demonstrationszwecken).
 * Zeigt die App in einem schmalen Geräte-Rahmen (iframe) – so lässt sich die
 * Handy-Ansicht am Desktop vorführen, ohne ein echtes Handy zu brauchen.
 * Der iframe lädt dieselbe Seite mit ?mobilePreview=1; darin ist der Schalter
 * ausgeblendet (keine Verschachtelung).
 */

const PARAM = 'mobilePreview';

export function initMobilePreview() {
    const btn = document.getElementById('btn-mobile-preview');
    // Innerhalb der Vorschau selbst: Schalter verstecken, sonst nichts tun.
    if (new URLSearchParams(location.search).has(PARAM)) {
        if (btn) btn.hidden = true;
        document.documentElement.classList.add('in-mobile-preview');
        return;
    }

    const overlay = document.getElementById('mobile-preview');
    const iframe = document.getElementById('mp-iframe');
    if (!btn || !overlay || !iframe) return;

    const open = () => {
        iframe.src = `${location.pathname}?${PARAM}=1`;
        overlay.hidden = false;
    };
    const close = () => {
        overlay.hidden = true;
        iframe.src = 'about:blank'; // Instanz entladen (Karte etc.)
    };

    btn.addEventListener('click', open);
    document.getElementById('mp-reload')?.addEventListener('click', () => {
        iframe.src = `${location.pathname}?${PARAM}=1&t=${Date.now()}`;
    });
    overlay.querySelectorAll('[data-mp-close]').forEach((el) => el.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });
}

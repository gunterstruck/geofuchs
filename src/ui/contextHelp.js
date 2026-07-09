let popover = null;
let activeTrigger = null;

function closeHelp() {
    popover?.remove();
    popover = null;
    activeTrigger?.setAttribute('aria-expanded', 'false');
    activeTrigger = null;
}

function openHelp(trigger) {
    const text = trigger.getAttribute('title');
    if (!text) return;
    closeHelp();

    popover = document.createElement('div');
    popover.className = 'context-help-popover';
    popover.setAttribute('role', 'tooltip');
    popover.textContent = text;
    document.body.appendChild(popover);

    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.left + rect.width / 2 - width / 2));
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - margin
        ? below
        : Math.max(margin, rect.top - height - 8);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    activeTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
}

export function initContextHelp() {
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('.help-dot[title]');
        if (!trigger) {
            if (!event.target.closest('.context-help-popover')) closeHelp();
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (trigger === activeTrigger) closeHelp();
        else openHelp(trigger);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeHelp();
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.help-dot[title]')) {
            event.preventDefault();
            event.target === activeTrigger ? closeHelp() : openHelp(event.target);
        }
    });

    window.addEventListener('resize', closeHelp);
    document.addEventListener('scroll', closeHelp, true);
}

export const DESKTOP_PLANNING_MIN_WIDTH = 769;

const FALLBACK_MEDIA_QUERY = Object.freeze({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
});

export function isDesktopPlanningWidth(width) {
    return Number.isFinite(Number(width)) && Number(width) >= DESKTOP_PLANNING_MIN_WIDTH;
}

export function desktopPlanningAvailable() {
    return typeof window === 'undefined' || isDesktopPlanningWidth(window.innerWidth);
}

export function mobilePlanningMediaQuery() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return FALLBACK_MEDIA_QUERY;
    }
    return window.matchMedia(`(max-width: ${DESKTOP_PLANNING_MIN_WIDTH - 1}px)`);
}

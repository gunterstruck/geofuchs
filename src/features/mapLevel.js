import { CONFIG } from '../core/config.js';

/** In Basis gilt immer die Zoomautomatik; Profi darf eine Ebene fixieren. */
export function automaticLevelActive(depth, levelMode, mobile = false) {
    return mobile || depth !== 'profi' || levelMode !== 'fixed';
}

function directLevelIndex(zoom, steps) {
    let index = 0;
    for (let i = 1; i < steps.length; i += 1) {
        if (zoom < steps[i].minZoom) break;
        index = i;
    }
    return index;
}

/**
 * Passende Gebietsebene für einen Zoom bestimmen. `currentLevel` aktiviert
 * eine Hysterese, damit die Karte an einer Schwelle nicht hin- und herspringt.
 */
export function automaticLevelForZoom(
    zoom,
    currentLevel = null,
    steps = CONFIG.map.autoLevels,
    hysteresis = CONFIG.map.autoLevelHysteresis
) {
    if (!Array.isArray(steps) || steps.length === 0) return 'none';
    const safeZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : CONFIG.map.defaultZoom;
    const desiredIndex = directLevelIndex(safeZoom, steps);
    let index = steps.findIndex((step) => step.level === currentLevel);
    if (index < 0) return steps[desiredIndex].level;

    if (desiredIndex > index) {
        while (index < desiredIndex && safeZoom >= steps[index + 1].minZoom + hysteresis) index += 1;
    } else if (desiredIndex < index) {
        while (index > desiredIndex && safeZoom < steps[index].minZoom - hysteresis) index -= 1;
    }
    return steps[index].level;
}

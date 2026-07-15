const width = (rect) => Math.max(0, Number(rect?.right) - Number(rect?.left));
const height = (rect) => Math.max(0, Number(rect?.bottom) - Number(rect?.top));

function overlapsHorizontally(a, b) {
    return Math.min(a.right, b.right) > Math.max(a.left, b.left);
}

/**
 * Sichtbarer Kartenbereich zwischen mobiler Kopfsteuerung und Bottom-Sheet.
 * Alle Werte sind Client-Koordinaten aus getBoundingClientRect().
 */
export function popupSafeRect(mapRect, { topObstruction = null, bottomObstruction = null, margin = 12 } = {}) {
    const safe = {
        left: mapRect.left + margin,
        top: mapRect.top + margin,
        right: mapRect.right - margin,
        bottom: mapRect.bottom - margin
    };

    if (topObstruction && width(topObstruction) > 0 && height(topObstruction) > 0
        && overlapsHorizontally(mapRect, topObstruction)
        && topObstruction.bottom > mapRect.top && topObstruction.top < mapRect.bottom) {
        safe.top = Math.max(safe.top, Math.min(mapRect.bottom, topObstruction.bottom + margin));
    }

    if (bottomObstruction && width(bottomObstruction) > 0 && height(bottomObstruction) > 0
        && overlapsHorizontally(mapRect, bottomObstruction)
        && bottomObstruction.bottom > mapRect.top && bottomObstruction.top < mapRect.bottom) {
        safe.bottom = Math.min(safe.bottom, Math.max(mapRect.top, bottomObstruction.top - margin));
    }

    return safe;
}

function axisPan(start, end, safeStart, safeEnd) {
    const popupSize = end - start;
    const safeSize = safeEnd - safeStart;
    if (popupSize > safeSize) return start - safeStart;
    if (start < safeStart) return start - safeStart;
    if (end > safeEnd) return end - safeEnd;
    return 0;
}

/** Leaflet-panBy-Offset, der den gesamten Popup-Rahmen in den sicheren Bereich bringt. */
export function popupPanOffset(popupRect, safeRect) {
    return [
        Math.round(axisPan(popupRect.left, popupRect.right, safeRect.left, safeRect.right)),
        Math.round(axisPan(popupRect.top, popupRect.bottom, safeRect.top, safeRect.bottom))
    ];
}

/**
 * Maximale Höhe des scrollbaren Popup-Inhalts. Rahmen, Schatten und Pfeil bleiben
 * dabei vollständig im sicheren Kartenbereich sichtbar.
 */
export function popupContentHeightLimit(popupRect, contentRect, safeRect, maximum = Infinity) {
    const safeHeight = Math.max(0, safeRect.bottom - safeRect.top);
    const popupChrome = Math.max(0, (popupRect.bottom - popupRect.top) - (contentRect.bottom - contentRect.top));
    const available = Math.max(96, Math.floor(safeHeight - popupChrome));
    return Math.floor(Math.min(available, Number.isFinite(maximum) ? maximum : available));
}

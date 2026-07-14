const KEYS = Object.freeze({
    seen: 'tf_showcase_seen',
    dismissed: 'tf_showcase_dismissed',
    imported: 'tf_showcase_imported',
    completed: 'tf_showcase_completed'
});

function store(provided) {
    if (provided) return provided;
    try { return globalThis.localStorage || null; } catch { return null; }
}

function readFlag(key, provided) {
    return store(provided)?.getItem(key) === '1';
}

function writeFlag(key, provided) {
    try { store(provided)?.setItem(key, '1'); } catch { /* Speicherung ist optional */ }
}

function removeFlag(key, provided) {
    try { store(provided)?.removeItem(key); } catch { /* Speicherung ist optional */ }
}

export function seenShowcaseIds(provided) {
    try {
        const ids = JSON.parse(store(provided)?.getItem(KEYS.seen) || '[]');
        return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

export function markShowcaseStorySeen(id, provided) {
    if (!id) return;
    const seen = new Set(seenShowcaseIds(provided));
    seen.add(id);
    try { store(provided)?.setItem(KEYS.seen, JSON.stringify([...seen])); } catch { /* optional */ }
}

export function markShowcaseDismissed(provided) {
    writeFlag(KEYS.dismissed, provided);
}

export function markShowcaseImportCompleted(provided) {
    writeFlag(KEYS.imported, provided);
}

export function resetShowcaseAfterDataClear(provided) {
    removeFlag(KEYS.imported, provided);
    removeFlag(KEYS.completed, provided);
    removeFlag(KEYS.seen, provided);
}

export function markShowcaseCompleted(provided) {
    writeFlag(KEYS.completed, provided);
}

export function isShowcaseAutoSuppressed(provided) {
    return readFlag(KEYS.dismissed, provided)
        || readFlag(KEYS.imported, provided)
        || readFlag(KEYS.completed, provided);
}

export function allShowcaseStoriesSeen(stories, seenIds = []) {
    if (!Array.isArray(stories) || stories.length === 0) return false;
    const seen = new Set(seenIds);
    return stories.every((story) => seen.has(story.id));
}

export function nextUnseenShowcaseStory(stories, seenIds = [], currentId = '') {
    if (!Array.isArray(stories) || stories.length === 0) return null;
    const seen = new Set(seenIds);
    const currentIndex = stories.findIndex((story) => story.id === currentId);
    const start = currentIndex >= 0 ? currentIndex : -1;
    for (let offset = 1; offset <= stories.length; offset++) {
        const story = stories[(start + offset) % stories.length];
        if (!seen.has(story.id)) return story;
    }
    return null;
}

export function canAutoOfferShowcase({
    suppressed = false,
    hasCustomers = false,
    allStoriesSeen = false,
    running = false,
    dialogOpen = false,
    locked = false,
    blockingDialogOpen = false
} = {}) {
    return !suppressed
        && !hasCustomers
        && !allStoriesSeen
        && !running
        && !dialogOpen
        && !locked
        && !blockingDialogOpen;
}

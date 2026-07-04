/**
 * Storage Service
 * IndexedDB für Kundendaten (Persistenz über Reloads) und Caches.
 * Alle Daten bleiben lokal im Browser – nichts verlässt das Gerät.
 */

import { CONFIG } from '../core/config.js';

const { dbName, dbVersion, storeName } = CONFIG.storage;

const KEYS = {
    dataset: 'kundendaten',
    geocodeCache: 'geocode-cache',
    settings: 'einstellungen',
    tours: 'gespeicherte-touren'
};

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
    });
}

export async function saveToCache(key, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function loadFromCache(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const request = tx.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

export async function removeFromCache(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

// ---- Kundendaten ----

export async function saveDataset(dataset) {
    try {
        await saveToCache(KEYS.dataset, dataset);
    } catch (error) {
        console.warn('Kundendaten konnten nicht gespeichert werden:', error);
    }
}

export async function loadDataset() {
    try {
        return (await loadFromCache(KEYS.dataset)) ?? null;
    } catch (error) {
        console.warn('Kundendaten konnten nicht geladen werden:', error);
        return null;
    }
}

export async function clearDataset() {
    await removeFromCache(KEYS.dataset);
}

// ---- Geocode-Cache (Nominatim-Ergebnisse) ----

export async function loadGeocodeCache() {
    try {
        return (await loadFromCache(KEYS.geocodeCache)) ?? {};
    } catch {
        return {};
    }
}

export async function saveGeocodeCache(cache) {
    try {
        await saveToCache(KEYS.geocodeCache, cache);
    } catch (error) {
        console.warn('Geocode-Cache konnte nicht gespeichert werden:', error);
    }
}

// ---- Einstellungen (Gebietsebene, Filter, Tour) ----

export async function saveSettings(settings) {
    try {
        await saveToCache(KEYS.settings, settings);
    } catch (error) {
        console.warn('Einstellungen konnten nicht gespeichert werden:', error);
    }
}

export async function loadSettings() {
    try {
        return (await loadFromCache(KEYS.settings)) ?? null;
    } catch {
        return null;
    }
}

// ---- Gespeicherte Touren ----

export async function loadTours() {
    try {
        return (await loadFromCache(KEYS.tours)) ?? [];
    } catch {
        return [];
    }
}

export async function saveTours(tours) {
    try {
        await saveToCache(KEYS.tours, tours);
    } catch (error) {
        console.warn('Touren konnten nicht gespeichert werden:', error);
    }
}

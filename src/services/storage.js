/**
 * Storage Service
 * IndexedDB for caching WFS data + JSON Export/Import for markings
 */

import { CONFIG } from '../core/config.js';

const { dbName, dbVersion, storeName, cacheKey } = CONFIG.storage;

/**
 * Open IndexedDB connection
 * @returns {Promise<IDBDatabase>}
 */
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

/**
 * Save data to IndexedDB
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function saveToCache(key, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
    });
}

/**
 * Load data from IndexedDB
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function loadFromCache(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
    });
}

/**
 * Cache WFS features data
 * @param {Array} features
 * @returns {Promise<void>}
 */
export async function cacheWFSFeatures(features) {
    const cacheData = {
        features,
        timestamp: Date.now(),
        version: '1.0'
    };
    await saveToCache(cacheKey, cacheData);
    console.log('✅ WFS features cached to IndexedDB');
}

/**
 * Load WFS features from cache
 * @returns {Promise<Array|null>}
 */
export async function loadCachedWFSFeatures() {
    try {
        const cached = await loadFromCache(cacheKey);
        if (cached && cached.features) {
            const ageInDays = (Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24);
            if (ageInDays < 30) { // Cache valid for 30 days
                console.log(`✅ Loaded WFS features from cache (age: ${ageInDays.toFixed(1)} days)`);
                return cached.features;
            } else {
                console.log('⚠️ Cache expired (> 30 days)');
            }
        }
    } catch (error) {
        console.warn('Failed to load from cache:', error);
    }
    return null;
}

/**
 * Export markings to JSON file
 * @param {Map} markedDistricts
 */
export function exportMarkingsToJSON(markedDistricts) {
    const dataToSave = {};
    markedDistricts.forEach((value, key) => {
        dataToSave[key] = value;
    });

    const jsonString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `geofuchs-markierungen-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
    console.log('✅ Markierungen exportiert');
}

/**
 * Import markings from JSON file
 * @returns {Promise<Object|null>}
 */
export function importMarkingsFromJSON() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        console.log('✅ Markierungen importiert');
                        resolve(data);
                    } catch (error) {
                        console.error('❌ Fehler beim Parsen der JSON-Datei:', error);
                        alert('Fehler beim Laden der Datei. Bitte überprüfen Sie das Format.');
                        resolve(null);
                    }
                };
                reader.readAsText(file);
            } else {
                resolve(null);
            }
        };

        input.click();
    });
}

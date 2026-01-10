/**
 * WFS Service
 * Fetch geodata from BKG WFS service with caching
 */

import { CONFIG } from '../core/config.js';
import { cacheWFSFeatures, loadCachedWFSFeatures } from './storage.js';

/**
 * Fetch WFS features with caching support
 * @returns {Promise<Array>}
 */
export async function fetchWFSFeatures() {
    // Try to load from cache first
    const cached = await loadCachedWFSFeatures();
    if (cached) {
        return cached;
    }

    // Fetch from WFS service
    console.log('📡 Fetching WFS features from server...');
    const { url, params, timeout } = CONFIG.wfs;
    const queryString = new URLSearchParams(params).toString();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`${url}?${queryString}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const features = data.features || [];

        // Cache the features
        await cacheWFSFeatures(features);

        return features;
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('WFS-Anfrage überschritten (Timeout)');
        }

        throw new Error(`Fehler beim Laden der Geodaten: ${error.message}`);
    }
}

/**
 * Validate WFS response
 * @param {Array} features
 * @returns {boolean}
 */
export function validateWFSFeatures(features) {
    if (!Array.isArray(features) || features.length === 0) {
        return false;
    }

    // Check if features have required properties
    const sampleFeature = features[0];
    return (
        sampleFeature.geometry &&
        sampleFeature.properties &&
        sampleFeature.properties.GEN // Name der Region
    );
}

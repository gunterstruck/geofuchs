/**
 * GeoFuchs - Main Entry Point
 * Modular, refactored version
 */

import '../src/styles/main.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { CONFIG } from './core/config.js';
import {
    setLeafletMap,
    setAllFeaturesData,
    leafletMap,
    allFeaturesData
} from './core/state.js';
import { fetchWFSFeatures, validateWFSFeatures } from './services/wfs.js';
import { validateOpenAIKey, validateGeminiKey } from './services/api.js';

/**
 * Initialize the Leaflet map
 */
async function initializeMap() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'block';
        loader.textContent = 'Lade Geodaten...';
    }

    try {
        // Create map instance
        const map = L.map('map', {
            attributionControl: false,
            keyboard: true,
            tap: true,
            maxBoundsViscosity: 1.0,
            zoomSnap: CONFIG.map.zoomSnap,
            zoomControl: false
        }).setView(CONFIG.map.defaultCenter, CONFIG.map.defaultZoom);

        setLeafletMap(map);

        // Add zoom control
        L.control.zoom({ position: 'topleft' }).addTo(map);

        // Set bounds
        map.setMaxBounds(CONFIG.map.bounds);

        // Add tile layer
        L.tileLayer(CONFIG.tileLayer.url, {
            maxZoom: CONFIG.tileLayer.maxZoom,
            minZoom: CONFIG.tileLayer.minZoom,
            attribution: CONFIG.tileLayer.attribution,
            crossOrigin: CONFIG.tileLayer.crossOrigin
        }).addTo(map);

        // Fetch WFS features (with caching!)
        const features = await fetchWFSFeatures();

        if (!validateWFSFeatures(features)) {
            throw new Error('Ungültige WFS-Daten empfangen');
        }

        setAllFeaturesData(features);

        // Add GeoJSON layer
        const geojsonLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
            style: CONFIG.mapStyles.default,
            onEachFeature: (feature, layer) => {
                // Basic popup
                const name = feature.properties.GEN;
                const type = feature.properties.BEZ || 'Region';
                layer.bindPopup(`<b>${name}</b><br>${type}`);

                // Hover effect
                layer.on('mouseover', function() {
                    this.setStyle(CONFIG.mapStyles.hover);
                });
                layer.on('mouseout', function() {
                    this.setStyle(CONFIG.mapStyles.default);
                });
            }
        }).addTo(map);

        if (loader) {
            loader.style.display = 'none';
        }

        console.log(`✅ Map initialized with ${features.length} features`);
        return map;

    } catch (error) {
        console.error('❌ Map initialization error:', error);
        if (loader) {
            loader.innerHTML = `
                <div style="color: #ef4444;">
                    <strong>Fehler beim Laden der Karte</strong><br>
                    ${error.message}
                </div>
            `;
        }
        throw error;
    }
}

/**
 * Initialize API key handling
 */
function initializeAPIKeySection() {
    const saveButton = document.getElementById('saveApiKeyButton');
    const openaiRadio = document.getElementById('openai');
    const geminiRadio = document.getElementById('gemini');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKeySection = document.getElementById('api-key-section');
    const chatInterface = document.getElementById('chat-interface');

    if (!saveButton) return;

    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput?.value.trim();
        const provider = openaiRadio?.checked ? 'openai' : 'gemini';

        if (!apiKey) {
            alert('Bitte geben Sie einen API-Schlüssel ein.');
            return;
        }

        // Validate based on provider
        const isValid = provider === 'openai'
            ? validateOpenAIKey(apiKey)
            : validateGeminiKey(apiKey);

        if (!isValid) {
            alert('Ungültiger API-Schlüssel. Bitte überprüfen Sie das Format.');
            return;
        }

        // Store in sessionStorage
        sessionStorage.setItem('selectedModel', provider);
        sessionStorage.setItem('apiKey', apiKey);

        // Hide API section, show chat
        if (apiKeySection) apiKeySection.style.display = 'none';
        if (chatInterface) chatInterface.style.display = 'flex';

        console.log(`✅ API-Schlüssel gespeichert (${provider})`);
    });
}

/**
 * Initialize mobile toggle
 */
function initializeMobileToggle() {
    const toggleBtn = document.querySelector('.mobile-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
}

/**
 * Main initialization
 */
async function init() {
    console.log('🦊 GeoFuchs starting...');

    try {
        await initializeMap();
        initializeAPIKeySection();
        initializeMobileToggle();

        console.log('✅ GeoFuchs initialized successfully');
    } catch (error) {
        console.error('❌ Initialization failed:', error);
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

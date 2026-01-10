/**
 * Application Configuration
 * Centralized configuration constants
 */

export const CONFIG = {
    colors: {
        'rot': '#ef4444',
        'grün': '#10b981',
        'blau': '#3b82f6',
        'gelb': '#f59e0b',
        'orange': '#f97316',
        'lila': '#8b5cf6',
        'türkis': '#0d9488',
        'rosa': '#ec4899',
        'grau': '#6b7280',
        'braun': '#92400e',
        'hellblau': '#60a5fa',
        'dunkelgrün': '#166534',
        'hellgrün': '#86efac',
        'default': '#0d9488'
    },

    defaultColors: [
        '#ef4444', // rot
        '#3b82f6', // blau
        '#10b981', // grün
        '#f59e0b', // gelb
        '#8b5cf6', // lila
        '#f97316', // orange
        '#ec4899', // rosa
        '#0d9488'  // türkis
    ],

    mapStyles: {
        default: {
            fillColor: '#fbbf24',
            weight: 1,
            opacity: 1,
            color: '#1e293b',
            dashArray: '',
            fillOpacity: 0.3
        },
        hover: {
            weight: 3,
            color: '#0d9488',
            dashArray: '',
            fillOpacity: 0.6
        }
    },

    map: {
        defaultCenter: [51.16, 10.45],
        defaultZoom: 6,
        minZoom: 5,
        maxZoom: 19,
        bounds: [
            [47.0, 5.0],
            [55.5, 16.0]
        ],
        zoomSnap: 0.5,
        minZoomForInfoboxes: 7
    },

    wfs: {
        url: 'https://sgx.geodatenzentrum.de/wfs_vg250',
        params: {
            SERVICE: 'WFS',
            VERSION: '2.0.0',
            REQUEST: 'GetFeature',
            TYPENAMES: 'vg250:vg250_krs',
            OUTPUTFORMAT: 'application/json',
            SRSNAME: 'urn:ogc:def:crs:EPSG::4326'
        },
        timeout: 15000
    },

    tileLayer: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap & CARTO',
        maxZoom: 19,
        minZoom: 5,
        crossOrigin: true
    },

    api: {
        openai: {
            url: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4',
            maxTokens: 2048,
            temperature: 0.7
        },
        gemini: {
            url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
            temperature: 0.7
        }
    },

    storage: {
        dbName: 'geofuchs-db',
        dbVersion: 1,
        storeName: 'geodata',
        cacheKey: 'wfs-features'
    }
};

export default CONFIG;

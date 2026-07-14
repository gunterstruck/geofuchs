/**
 * Zentrale Konfiguration – TourFuchs Vertrieb
 */

export const CONFIG = {
    // Farbpalette für Vertriebsbeauftragte (kontrastreiche, unterscheidbare Farben)
    repPalette: [
        '#2563eb', // blau
        '#dc2626', // rot
        '#16a34a', // grün
        '#d97706', // orange
        '#7c3aed', // violett
        '#0891b2', // cyan
        '#db2777', // pink
        '#65a30d', // limette
        '#9333ea', // purpur
        '#ea580c', // dunkelorange
        '#0d9488', // türkis
        '#b91c1c', // dunkelrot
        '#1d4ed8', // dunkelblau
        '#a16207', // ocker
        '#15803d', // dunkelgrün
        '#6b7280'  // grau
    ],
    unassignedColor: '#94a3b8',

    map: {
        defaultCenter: [51.16, 10.45],
        defaultZoom: 6,
        minZoom: 5,
        maxZoom: 19,
        bounds: [
            [40.0, -10.0],
            [62.0, 30.0]
        ],
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        wheelPxPerZoomLevel: 120,
        wheelDebounceTime: 24,
        // Zoom-Automatik (Level of Detail): >= custom -> Kunden sichtbar,
        // >= bezirk -> Vertriebsbezirke als Flächen, darunter -> Vertriebsgruppen
        lodCustomerZoom: 9,
        lodBezirkZoom: 7
    },

    tileLayers: {
        light: {
            label: 'Hell',
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            minZoom: 5,
            crossOrigin: true
        },
        standard: {
            label: 'Standard',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
            minZoom: 5,
            crossOrigin: true
        },
        satellite: {
            label: 'Satellit',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
            maxZoom: 19,
            minZoom: 5,
            crossOrigin: true
        }
    },
    tileLayer: null,

    // Gebietsebenen: Datenquelle + Schlüsselermittlung pro Kunde
    levels: {
        none:   { label: 'Keine Gebiete', file: null },
        kreise: { label: 'Landkreise', file: '/geodata/kreise.geojson', attribution: '© GeoBasis-DE / BKG 2024 (dl-de/by-2-0)' },
        plz1:   { label: 'PLZ-Zonen (1-stellig)', file: '/geodata/plz1.geojson', attribution: '© OpenStreetMap-Mitwirkende (ODbL), via Esri Deutschland' },
        plz2:   { label: 'PLZ-Regionen (2-stellig)', file: '/geodata/plz2.geojson', attribution: '© OpenStreetMap-Mitwirkende (ODbL), via Esri Deutschland' },
        plz3:   { label: 'PLZ-Leitbereiche (3-stellig)', file: '/geodata/plz3.geojson', attribution: '© OpenStreetMap-Mitwirkende (ODbL), via Esri Deutschland' },
        plz5:   { label: 'PLZ-Gebiete (5-stellig)', file: '/geodata/plz5.geojson', attribution: '© OpenStreetMap-Mitwirkende (ODbL), via Esri Deutschland' }
    },

    plzCentroidsUrl: '/geodata/plz-centroids.json',
    plzPlacesUrl: '/geodata/plz-places.json',

    regionStyle: {
        default: {
            fillColor: '#cbd5e1',
            weight: 1,
            opacity: 1,
            color: '#475569',
            fillOpacity: 0.08
        },
        hover: {
            weight: 2.5,
            color: '#0d9488',
            fillOpacity: 0.35
        }
    },

    // Nominatim (OpenStreetMap) für optionale exakte Adress-Geocodierung
    nominatim: {
        url: 'https://nominatim.openstreetmap.org/search',
        // OSM-Nutzungsrichtlinie: max. 1 Anfrage pro Sekunde
        delayMs: 1100,
        timeout: 10000
    },

    tour: {
        defaultRadiusKm: 25,
        maxSuggestions: 25,
        // Google Maps erlaubt max. 9 Zwischenziele im Directions-Link
        maxWaypoints: 9,
        // Faktor Luftlinie -> geschätzte Straßenkilometer
        roadFactor: 1.3
    },

    routing: {
        provider: 'OSRM',
        url: 'https://router.project-osrm.org/route/v1/driving',
        timeoutMs: 8000,
        maxPoints: 25
    },

    storage: {
        dbName: 'geofuchs-db',
        dbVersion: 2,
        storeName: 'geodata'
    }
};

export default CONFIG;

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    root: './',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        port: 3000,
        open: true
    },
    plugins: [
        VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['icons/favicon.svg'],
            manifest: {
                id: '/',
                name: 'GeoFuchs Vertrieb',
                short_name: 'GeoFuchs',
                description: 'Kundenlisten aus Excel auf der Deutschlandkarte: Vertriebsgebiete (Landkreise & PLZ), Team-Filter und Besuchsplanung mit Tourenoptimierung.',
                lang: 'de',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#f8fafc',
                theme_color: '#0d9488',
                categories: ['business', 'productivity', 'navigation'],
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
            },
            workbox: {
                // App-Shell + kleine Gebietsdaten vorab cachen (offline-fähig ab dem ersten Besuch)
                globPatterns: [
                    '**/*.{js,css,html,svg,png,woff2}',
                    'geodata/kreise.geojson',
                    'geodata/plz1.geojson',
                    'geodata/plz2.geojson',
                    'geodata/plz-centroids.json'
                ],
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
                runtimeCaching: [
                    {
                        // große PLZ-Ebenen (3-/5-stellig): beim ersten Gebrauch cachen
                        urlPattern: /\/geodata\/plz[35]\.geojson$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'geodata-large',
                            expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 90 }
                        }
                    },
                    {
                        // Karten-Tiles: zuletzt gesehene Ausschnitte offline verfügbar
                        urlPattern: /^https:\/\/[a-z]\.basemaps\.cartocdn\.com\/.*/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'map-tiles',
                            expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
                            cacheableResponse: { statuses: [0, 200] }
                        }
                    }
                ]
            }
        })
    ]
});

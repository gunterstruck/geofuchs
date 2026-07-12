import { defineConfig } from 'vitest/config';

// Eigene Test-Konfiguration (bewusst getrennt von vite.config.js, damit die
// PWA-Plugins nicht in den Testlauf geladen werden).
export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.js']
    }
});

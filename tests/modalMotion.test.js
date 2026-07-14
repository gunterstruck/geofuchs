import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/styles/components.css'), 'utf8');

describe('Ruhige Desktop-Modale', () => {
    it('blendet Dialog und Hintergrund kurz und einheitlich ein', () => {
        expect(css).toContain('dialog[open] {');
        expect(css).toContain('animation: tf-modal-enter 0.2s');
        expect(css).toContain('dialog[open]::backdrop');
        expect(css).toContain('animation: tf-modal-backdrop-enter 0.18s');
    });

    it('behandelt die Desktop-Handyvorschau wie ein Modal', () => {
        expect(css).toContain('.mobile-preview:not([hidden]) .mp-backdrop');
        expect(css).toContain('.mobile-preview:not([hidden]) .mp-frame');
    });

    it('respektiert die Systemeinstellung fuer reduzierte Bewegung', () => {
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).toMatch(/dialog\[open\],[\s\S]*?\.mp-frame \{\s*animation: none;/);
    });
});

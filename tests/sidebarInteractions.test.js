import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sidebarSource = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');
const responsiveCss = readFileSync(resolve(process.cwd(), 'src/styles/responsive.css'), 'utf8');
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

describe('Sidebar-Bedienung', () => {
    it('lässt das Mausrad nativ durch den aktiven Inhalt scrollen', () => {
        expect(sidebarSource).not.toMatch(/addEventListener\(['"]wheel['"]/);
    });

    it('behält die Größensteuerung an Plus, Minus und 100 Prozent', () => {
        expect(doc.querySelector('#panel-zoom-in')).not.toBeNull();
        expect(doc.querySelector('#panel-zoom-out')).not.toBeNull();
        expect(doc.querySelector('#panel-zoom-label')).not.toBeNull();
        expect(sidebarSource).toContain("document.getElementById('panel-zoom-in')?.addEventListener('click'");
        expect(sidebarSource).toContain("document.getElementById('panel-zoom-out')?.addEventListener('click'");
        expect(sidebarSource).toContain("document.getElementById('panel-zoom-label')?.addEventListener('dblclick'");
    });

    it('blendet die reine Desktop-Größensteuerung mobil aus', () => {
        expect(responsiveCss).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.panel-zoom\s*{\s*display: none;/);
    });
});

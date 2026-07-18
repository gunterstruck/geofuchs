import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const html = source('index.html');
const doc = new DOMParser().parseFromString(html, 'text/html');
const cockpit = source('src/ui/cockpit.js');
const editor = source('src/ui/regionEditor.js');
const map = source('src/features/map.js');
const sidebar = source('src/ui/sidebar.js');
const responsive = source('src/styles/responsive.css');

describe('Basis-/Profi-Schnitt der Gebietskarte', () => {
    it('zeigt Status und manuelle Gebietswahl auch in Basis, das Cockpit aber nur Profis', () => {
        const status = doc.querySelector('.level-status');
        const control = doc.querySelector('.level-control');
        expect(status).not.toBeNull();
        expect(status.closest('.expert-only')).toBeNull();
        expect(control?.querySelector('#level-select')).not.toBeNull();
        expect(control?.classList.contains('expert-only')).toBe(false);
        expect(doc.querySelector('#btn-cockpit')?.classList.contains('expert-only')).toBe(true);
        expect(sidebar).toContain('<option value="auto">Automatisch nach Zoom</option>');
    });

    it('schließt Planungswerkzeuge auf Mobilgeräten und beim Wechsel zu Basis', () => {
        expect(responsive).toMatch(/#simulation-map-bar,[\s\S]*?#cockpit-dialog\[open\],[\s\S]*?#region-edit-dialog\[open\]/);
        expect(cockpit).toContain("on('depth:changed'");
        expect(cockpit).toContain('openSequence += 1');
        expect(editor).toContain("on('depth:changed'");
        expect(editor).toContain("mobilePlanningQuery.addEventListener('change'");
        expect(map).toContain("state.ui.depth !== 'profi'");
        expect(map).toContain("activePopup.getElement()?.querySelector('select[data-terr]')");
    });

    it('behandelt Channel nur als optionalen beziehungsweise Legacy-Fallback', () => {
        expect(cockpit).toContain("const primary = ['bezirk', 'gruppe']");
        expect(editor).toContain("const primary = ['bezirk', 'gruppe']");
        expect(cockpit).toContain('hasLegacyAssignments');
        expect(editor).toContain('hasLegacyAssignments');
        expect(sidebar).toContain("const DEFAULT_FILTER_SECTIONS = ['bezirk', 'gruppe']");
    });

    it('macht alte optionale Filter sichtbar und räumt sie beim Entfernen vollständig auf', () => {
        expect(sidebar).toContain('migrateActiveOptionalFilters();');
        expect(sidebar).toContain('if (changed) persistOptionalFilterSections();');
        expect(sidebar).toContain('value.visible = true');
        expect(sidebar).toContain('persistOptionalFilterSections();');
    });
});

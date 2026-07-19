import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sidebarSource = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');
const tourPanelSource = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
const searchSource = readFileSync(resolve(process.cwd(), 'src/ui/search.js'), 'utf8');
const mapSource = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
const responsiveCss = readFileSync(resolve(process.cwd(), 'src/styles/responsive.css'), 'utf8');
const contractsCss = readFileSync(resolve(process.cwd(), 'src/styles/contracts.css'), 'utf8');
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

describe('Sidebar-Bedienung', () => {
    it('lässt das Mausrad nativ durch den aktiven Inhalt scrollen', () => {
        expect(sidebarSource).not.toMatch(/addEventListener\(['"]wheel['"]/);
    });

    it('setzt den Bewegungs-Merker vor der Ignore-Rückgabe zurück (kein Doppel-Tap)', () => {
        // Nach einem Scroll-Drag darf der nächste Tap auf ein interaktives
        // Element nicht geschluckt werden: moved muss bei jedem pointerdown –
        // also VOR der Ignore-Früh-Rückgabe – zurückgesetzt werden.
        const pd = sidebarSource.indexOf("sidebar.addEventListener('pointerdown'");
        expect(pd).toBeGreaterThan(-1);
        const reset = sidebarSource.indexOf('moved = false;', pd);
        const ignore = sidebarSource.indexOf('SIDEBAR_DRAG_SCROLL_IGNORE', pd);
        expect(reset).toBeGreaterThan(pd);
        expect(reset).toBeLessThan(ignore);
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

    it('hält den Service-Kundenscope kompakt, synchron und explizit', () => {
        const scope = doc.getElementById('service-customer-scope');
        expect(scope?.previousElementSibling?.id).toBe('mode-hint');
        expect(scope?.querySelectorAll('[data-service-customer-scope]')).toHaveLength(4);
        expect(contractsCss).toMatch(/\.service-customer-scope\s*{[\s\S]*?display:\s*grid;/);
        expect(sidebarSource).toContain("? 'now'");
        expect(sidebarSource).toContain("emit('mode:changed', mode)");
        expect(sidebarSource).toContain("emit('service-customer-scope:changed'");
        expect(sidebarSource).toContain('serviceCustomerScope: normalizedServiceCustomerScope()');
        expect(sidebarSource).toContain("if (mode === 'service') state.ui.opportunityOnly = false");
    });

    it('wendet den Service-Scope gemeinsam auf Suche und Tourplanung an', () => {
        expect(searchSource).toContain('applyServiceCustomerScope(state.customers)');
        expect(searchSource).toContain("on('mode:changed', close)");
        expect(tourPanelSource).toContain('return modeTourCustomers();');
        expect(tourPanelSource).toContain('const availableCustomers = modeVisibleCustomers();');
        expect(tourPanelSource).toContain("on('service-customer-scope:changed', refreshPlanningScope)");
        expect(tourPanelSource).not.toMatch(/on\('service-customer-scope:changed',[\s\S]{0,100}pruneTourToScope/);
        expect(sidebarSource).toContain('const shown = tourScoped ? modeTourCustomers() : modeVisibleCustomers();');
        expect(sidebarSource).toContain("on('service-customer-scope:changed', updateChancenCount)");
        expect(sidebarSource).toContain("on('tour:scope-changed', updateChancenCount)");
        expect(doc.getElementById('tour-sales-map-view')).not.toBeNull();
        expect(doc.getElementById('tour-sales-priority')).not.toBeNull();
        expect(contractsCss).toMatch(/#tour-sales-priority\[hidden\][\s\S]*?display:\s*none\s*!important;/);
        expect(tourPanelSource).toContain('syncModeSpecificTourControls();');
        expect(tourPanelSource).toContain('Außerhalb Servicefilter');
        expect(mapSource).toContain("state.ui.mode !== 'service' || state.ui.activeTab === 'tour'");
        expect(mapSource).toContain("on('tab:changed', refreshAll)");
    });

    it('verwendet die Vertriebspriorität bei der Umgebungssuche nicht im Service', () => {
        expect(tourPanelSource).toContain("const salesPriority = state.ui.mode !== 'service';");
        expect(tourPanelSource).toContain('new Set(), salesPriority)');
        expect(tourPanelSource).toContain('overdueFirst = salesPriority;');
        expect(tourPanelSource).not.toContain('Servicekunde(n) im Umkreis');
    });
});

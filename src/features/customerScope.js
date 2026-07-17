/**
 * Gemeinsamer Kunden-Scope für Karte, Suche und Tourplanung.
 *
 * Bestehende Filter liefern jeweils ihren eigenen Ausgangsbestand. Im
 * Service-Fokus wird darüber standardmäßig der Vertrags-Scope gelegt; die
 * bewusste Profi-Auswahl "Alle Kunden" sowie alle anderen Fokus-Modi bleiben
 * unverändert.
 */

import {
    state,
    visibleCustomers,
    customerInTourScope
} from '../core/state.js';
import { servicePlanningCustomerIds } from './serviceContracts.js';

/** Ist die zusätzliche Einschränkung auf Servicekunden gerade aktiv? */
export function serviceScopeActive() {
    return state.ui.mode === 'service' && state.ui.serviceCustomerScope !== 'all';
}

/** Legt den aktuellen Service-Scope über einen beliebigen Kundenbestand. */
export function applyServiceCustomerScope(customers) {
    const list = Array.isArray(customers) ? customers : [];
    if (!serviceScopeActive()) return list;

    const serviceCustomerIds = servicePlanningCustomerIds(
        state.serviceContracts,
        state.customers
    );
    return list.filter((customer) => serviceCustomerIds.has(customer?.id));
}

/** Aktuell sichtbare Kunden inklusive des optionalen Service-Scope. */
export function modeVisibleCustomers() {
    // Der Service-Fokus hat keinen sichtbaren Vertriebsfilter-Tab. Deshalb
    // dürfen dort zuvor gesetzte Vertriebs-/Hierarchiefilter den versprochenen
    // Bestand nicht unbemerkt weiter einschränken.
    const base = state.ui.mode === 'service' ? state.customers : visibleCustomers();
    return applyServiceCustomerScope(base);
}

/** Aktuell planbare Kunden inklusive Service- und Bezirks-Scope. */
export function modeTourCustomers() {
    return modeVisibleCustomers().filter(customerInTourScope);
}

/** Anzahl aller eindeutig verknüpften, planungsrelevanten Servicekunden. */
export function servicePlanningCustomerCount() {
    return servicePlanningCustomerIds(state.serviceContracts, state.customers).size;
}

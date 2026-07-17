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
import { serviceVisitCustomerIds, serviceVisitWindow } from './serviceVisits.js';

export const SERVICE_CUSTOMER_SCOPES = ['now', 'week', 'contracts', 'all'];

export function normalizedServiceCustomerScope(value = state.ui.serviceCustomerScope) {
    return SERVICE_CUSTOMER_SCOPES.includes(value) ? value : 'contracts';
}

/** Ist die zusätzliche Einschränkung auf Servicekunden gerade aktiv? */
export function serviceScopeActive() {
    return state.ui.mode === 'service' && state.ui.serviceCustomerScope !== 'all';
}

/** Eindeutige Kunden-IDs für den gewählten Service-Handlungsfokus. */
export function serviceCustomerIdsForScope(scope = state.ui.serviceCustomerScope, today = new Date()) {
    const normalized = normalizedServiceCustomerScope(scope);
    if (normalized === 'all') return new Set(state.customers.map((customer) => customer?.id).filter(Boolean));
    if (normalized === 'contracts') {
        return servicePlanningCustomerIds(state.serviceContracts, state.customers);
    }
    return serviceVisitCustomerIds(state.serviceVisits, state.customers, normalized, today);
}

/** Legt den aktuellen Service-Scope über einen beliebigen Kundenbestand. */
export function applyServiceCustomerScope(customers) {
    const list = Array.isArray(customers) ? customers : [];
    if (!serviceScopeActive()) return list;

    const serviceCustomerIds = serviceCustomerIdsForScope();
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
export function servicePlanningCustomerCount(scope = state.ui.serviceCustomerScope, today = new Date()) {
    return serviceCustomerIdsForScope(scope, today).size;
}

/** Zahl der operativen Einsätze hinter Jetzt/Diese Woche (nicht Kundenanzahl). */
export function servicePlanningVisitCount(scope = state.ui.serviceCustomerScope, today = new Date()) {
    if (!['now', 'week'].includes(scope)) return 0;
    return (state.serviceVisits || []).filter((visit) => serviceVisitWindow(visit, scope, today)).length;
}

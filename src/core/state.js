/**
 * Application State Management
 * Centralized state for the entire application
 */

// Map & GeoJSON
export let leafletMap = null;
export let geojsonLayer = null;
export let allFeaturesData = [];

// District Data Storage
export const districtData = {};
export let regionsTable = [];

// Search & Indexing
export const nameToKeysMap = new Map();
export const nameToRegionsMap = new Map();
export const normalizedNameMap = new Map();
export const objIdToLayerMap = new Map();

// Markings & Sales Districts
export const markedDistricts = new Map();
export const selectedSalesDistricts = new Set();
export const allSalesDistricts = new Set();
export let salesDistrictInfoboxes = {};

// Display Toggles
export let showSalesDistrictInfoboxes = false;
export let showRevenueBasedColoring = false;
export let isFilterActive = false;

// Chat & AI
export let conversationHistory = [];
export let currentSystemPrompt = "";
export let hasWelcomeMessageBeenShown = false;

// UI State
export let colorIndex = 0;
export let currentHoveredLayer = null;
export let hoverInfoPopup = null;

// Setters for module exports
export function setLeafletMap(map) {
    leafletMap = map;
}

export function setGeojsonLayer(layer) {
    geojsonLayer = layer;
}

export function setAllFeaturesData(features) {
    allFeaturesData = features;
}

export function setRegionsTable(table) {
    regionsTable = table;
}

export function setShowSalesDistrictInfoboxes(value) {
    showSalesDistrictInfoboxes = value;
}

export function setShowRevenueBasedColoring(value) {
    showRevenueBasedColoring = value;
}

export function setIsFilterActive(value) {
    isFilterActive = value;
}

export function addToConversationHistory(message) {
    conversationHistory.push(message);
}

export function clearConversationHistory() {
    conversationHistory = [];
}

export function setCurrentSystemPrompt(prompt) {
    currentSystemPrompt = prompt;
}

export function setHasWelcomeMessageBeenShown(value) {
    hasWelcomeMessageBeenShown = value;
}

export function incrementColorIndex() {
    colorIndex++;
}

export function setCurrentHoveredLayer(layer) {
    currentHoveredLayer = layer;
}

export function setHoverInfoPopup(popup) {
    hoverInfoPopup = popup;
}

export function setSalesDistrictInfoboxes(infoboxes) {
    salesDistrictInfoboxes = infoboxes;
}

// Utility getters
export function getNextColor() {
    const { defaultColors } = await import('./config.js');
    const color = defaultColors[colorIndex % defaultColors.length];
    incrementColorIndex();
    return color;
}

export function resetColorIndex() {
    colorIndex = 0;
}

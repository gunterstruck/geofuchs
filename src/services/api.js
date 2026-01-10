/**
 * API Service
 * Handles communication with AI providers (OpenAI, Google Gemini)
 */

import { CONFIG } from '../core/config.js';

/**
 * Validate OpenAI API Key format
 * @param {string} key
 * @returns {boolean}
 */
export function validateOpenAIKey(key) {
    return key && key.trim().startsWith('sk-') && key.length > 40;
}

/**
 * Validate Google Gemini API Key format
 * @param {string} key
 * @returns {boolean}
 */
export function validateGeminiKey(key) {
    return key && key.trim().length > 20;
}

/**
 * Call OpenAI GPT-4 API
 * @param {string} apiKey
 * @param {Array} messages
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
export async function callOpenAI(apiKey, messages, signal) {
    const { url, model, maxTokens, temperature } = CONFIG.api.openai;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature
        }),
        signal
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Keine Antwort erhalten.';
}

/**
 * Call Google Gemini API
 * @param {string} apiKey
 * @param {Array} messages
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
export async function callGemini(apiKey, messages, signal) {
    const { url: baseUrl, temperature } = CONFIG.api.gemini;
    const url = `${baseUrl}?key=${apiKey}`;

    // Convert OpenAI format to Gemini format
    const parts = messages.map(msg => ({
        text: `${msg.role === 'user' ? 'User' : 'Model'}: ${msg.content}`
    }));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
                temperature,
                maxOutputTokens: 2048
            }
        }),
        signal
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Keine Antwort erhalten.';
}

/**
 * Call AI API based on selected provider
 * @param {string} provider - 'openai' or 'gemini'
 * @param {string} apiKey
 * @param {Array} messages
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
export async function callAI(provider, apiKey, messages, signal) {
    if (provider === 'openai') {
        return callOpenAI(apiKey, messages, signal);
    } else if (provider === 'gemini') {
        return callGemini(apiKey, messages, signal);
    } else {
        throw new Error(`Unbekannter Provider: ${provider}`);
    }
}

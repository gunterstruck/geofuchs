/**
 * Biometrie-Anbindung (Face/Touch ID) über WebAuthn mit der PRF-Erweiterung.
 *
 * Idee: Ein Plattform-Authenticator liefert per PRF-Extension ein stabiles,
 * hochentropes Geheimnis (pro Credential + Salt). Dieses Geheimnis dient in
 * vault.js als zusätzlicher Wrapping-Schlüssel für den Datenschlüssel (DEK) –
 * eine weitere „Tür" neben PIN und Wiederherstellungscode.
 *
 * Dieser Service kapselt ausschließlich die Browser-APIs (navigator.credentials);
 * er wird nur im Browser aufgerufen. Ohne Unterstützung meldet er dies sauber,
 * damit die App ohne Biometrie normal weiterläuft.
 */

import { randomBytes, toB64, fromB64 } from './crypto.js';

const PRF_SALT_BYTES = 32;

export function isBiometricSupported() {
    return typeof globalThis.PublicKeyCredential === 'function'
        && Boolean(globalThis.navigator?.credentials);
}

/** Gibt es auf diesem Gerät einen Plattform-Authenticator (Face/Touch ID)? */
export async function isPlatformAuthenticatorAvailable() {
    if (!isBiometricSupported()) return false;
    try {
        return await globalThis.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
}

function bufToB64(buf) { return toB64(new Uint8Array(buf)); }

/**
 * Neues Biometrie-Credential anlegen und – wenn möglich in einem Rutsch – den
 * PRF-Ausgang für ein frisches Salt holen.
 * @returns {Promise<{credentialIdB64:string, prfOutput:Uint8Array, salt:Uint8Array}>}
 * @throws Error('prf-unsupported' | 'no-prf' | ...) wenn PRF nicht verfügbar
 */
export async function registerBiometric() {
    if (!isBiometricSupported()) throw new Error('unsupported');
    const salt = randomBytes(PRF_SALT_BYTES);
    const cred = await globalThis.navigator.credentials.create({
        publicKey: {
            challenge: randomBytes(32),
            rp: { name: 'TourFuchs Vertrieb', id: location.hostname },
            user: {
                id: randomBytes(16),
                name: 'tourfuchs-tresor',
                displayName: 'TourFuchs Tresor'
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },   // ES256
                { type: 'public-key', alg: -257 }  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'preferred'
            },
            timeout: 60000,
            // eval direkt mitgeben: viele Plattformen liefern den PRF-Ausgang
            // schon bei create() und ersparen so eine zweite Verifizierung.
            extensions: { prf: { eval: { first: salt } } }
        }
    });
    if (!cred) throw new Error('cancelled');
    const ext = cred.getClientExtensionResults?.() || {};
    if (!ext.prf?.enabled) throw new Error('prf-unsupported');

    const credentialIdB64 = bufToB64(cred.rawId);
    // PRF-Ausgang bereits aus create()? Sonst per get() nachholen.
    let prf = ext.prf?.results?.first;
    if (!prf) {
        prf = await evaluatePrf(credentialIdB64, toB64(salt));
        return { credentialIdB64, prfOutput: prf, salt };
    }
    return { credentialIdB64, prfOutput: new Uint8Array(prf), salt };
}

/**
 * PRF-Ausgang für ein bestehendes Credential + Salt abrufen (Entsperren).
 * @returns {Promise<Uint8Array>}
 */
export async function evaluatePrf(credentialIdB64, saltB64) {
    if (!isBiometricSupported()) throw new Error('unsupported');
    const assertion = await globalThis.navigator.credentials.get({
        publicKey: {
            challenge: randomBytes(32),
            allowCredentials: [{ type: 'public-key', id: fromB64(credentialIdB64) }],
            userVerification: 'required',
            timeout: 60000,
            extensions: { prf: { eval: { first: fromB64(saltB64) } } }
        }
    });
    if (!assertion) throw new Error('cancelled');
    const out = assertion.getClientExtensionResults?.()?.prf?.results?.first;
    if (!out) throw new Error('no-prf');
    return new Uint8Array(out);
}

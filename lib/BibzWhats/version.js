export const BIBZWHATS_NAME = 'WhatsBibz';
/** nama paket di npm */
export const BIBZWHATS_PACKAGE = '@xbibzlibrary/whatsbibz';
export const BIBZWHATS_VERSION = '2.0.0';
export const BIBZWHATS_UPSTREAM = 'WhiskeySockets/Baileys v7.0.0-rc14 plus selected upstream changes through 2026-11-15 (including #2519 and #2900); WhatsBibz fork, not an official Baileys or WhatsApp release';
/** WA Web fallback observed from web.whatsapp.com/sw.js on 2026-11-15; may change. */
export const BIBZWHATS_WA_WEB_VERSION = [2, 3000, 1054665735];

// Prefer a valid, successfully fetched version only when it does not downgrade
// the built-in version. Callers can still explicitly pin socketConfig.version.
export function selectWaWebVersion(result, fallback = BIBZWHATS_WA_WEB_VERSION) {
    const candidate = result?.version;
    const valid = Array.isArray(candidate) && candidate.length === 3 &&
        candidate.every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) && candidate[0] > 0;
    if (!result?.isLatest || !valid) return [...fallback];
    for (let i = 0; i < 3; i++) {
        if (candidate[i] > fallback[i]) return [...candidate];
        if (candidate[i] < fallback[i]) return [...fallback];
    }
    return [...candidate];
}


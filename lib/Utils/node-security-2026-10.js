/**
 * @module @xbibzlibrary/whatsbibz/lib/Utils/node-security-2026-10
 * Runtime mitigations & URL/HTTP hardening for the Node.js October 21, 2026
 * Security Release (CVE-2026-111497 Brotli RCE, CVE-2026-105482 DNS NUL truncation,
 * CVE-2026-105483 Fullwidth-IP TLS bypass, CVE-2026-106069 & CVE-2026-106072
 * Non-canonical IPv4 TLS hostname bypass, CVE-2026-105481, CVE-2026-106074).
 */
import { Boom } from '@hapi/boom';

/**
 * Safe Accept-Encoding header value that disables automatic Brotli (`br`)
 * decompression on outgoing HTTP/HTTPS requests to mitigate CVE-2026-111497
 * on unpatched Node.js runtimes.
 */
export const SAFE_ACCEPT_ENCODING = 'gzip, deflate';

export const NODE_OCT_2026_CVES = Object.freeze([
    'CVE-2026-111497',
    'CVE-2026-105482',
    'CVE-2026-105483',
    'CVE-2026-106069',
    'CVE-2026-105481',
    'CVE-2026-106072',
    'CVE-2026-106074',
    'CVE-2026-106070',
    'CVE-2026-106071',
    'CVE-2026-106073'
]);

export const PATCHED_NODE_MIN_VERSIONS = Object.freeze({
    22: Object.freeze([22, 23, 4]),
    24: Object.freeze([24, 22, 1]),
    26: Object.freeze([26, 12, 1])
});

const FULLWIDTH_DIGIT_OR_DOT_RE = /[\uFF10-\uFF19\uFF0E\u3002\uFF61]/;
const NUL_BYTE_RE = /\x00|%00/i;

/**
 * Parses a Node.js semver string like "22.23.4" or "v24.22.1" into [major, minor, patch].
 */
export const parseNodeVersion = (versionStr = process?.versions?.node || '') => {
    const cleaned = String(versionStr).trim().replace(/^v/i, '').split('-')[0];
    const parts = cleaned.split('.').map(n => Number.parseInt(n, 10));
    if (parts.length < 3 || parts.some(n => !Number.isFinite(n) || n < 0)) {
        return null;
    }
    return [parts[0], parts[1], parts[2]];
};

/**
 * Returns true if the given Node.js version includes the October 21, 2026 security patches
 * (v22.23.4+, v24.22.1+, v26.12.1+, or v27+). Node 20.x and 25.x are End-of-Life and unpatched.
 */
export const isNodePatchedOct2026 = (versionStr = process?.versions?.node) => {
    const tuple = parseNodeVersion(versionStr);
    if (!tuple) {
        return false;
    }
    const [major, minor, patch] = tuple;
    if (major >= 27) {
        return true;
    }
    const minTuple = PATCHED_NODE_MIN_VERSIONS[major];
    if (!minTuple) {
        return false;
    }
    if (minor !== minTuple[1]) {
        return minor > minTuple[1];
    }
    return patch >= minTuple[2];
};

/**
 * Returns a structured security assessment for the current or specified Node.js runtime.
 */
export const getNodeSecurityStatus = (versionStr = process?.versions?.node) => {
    const tuple = parseNodeVersion(versionStr);
    const patched = isNodePatchedOct2026(versionStr);
    const major = tuple?.[0] ?? 0;
    let recommendedVersion = '>=22.23.4 / >=24.22.1 / >=26.12.1';
    if (major === 22) {
        recommendedVersion = '22.23.4';
    }
    else if (major === 24) {
        recommendedVersion = '24.22.1';
    }
    else if (major === 26) {
        recommendedVersion = '26.12.1';
    }
    return {
        currentVersion: String(versionStr || 'unknown'),
        patched,
        eolLine: major > 0 && major < 22 || major === 23 || major === 25,
        recommendedVersion,
        mitigatedByBibzWhats: true,
        cves: NODE_OCT_2026_CVES
    };
};

/**
 * Detects non-canonical IPv4 hostnames (octal 0177.0.0.1, hex 0x7f.0.0.1 / 0x7f000001,
 * integer 2130706433, or 2/3-part shorthand 127.1 / 127.0.1) that trigger
 * CVE-2026-106069 and CVE-2026-106072 in TLS hostname verification.
 */
export const isNonCanonicalIpv4Host = (hostname = '') => {
    const host = String(hostname).trim().replace(/\.$/, '').toLowerCase();
    if (!host || host.startsWith('[')) {
        return false;
    }
    const labels = host.split('.');
    const isNumericOrHexLabel = (part) => /^(?:0x[0-9a-f]+|\d+)$/i.test(part);
    if (!labels.every(isNumericOrHexLabel)) {
        return false;
    }
    // All labels are numeric or hex -> this is an IPv4 representation, not a normal domain name
    if (labels.length !== 4) {
        // 1-part integer (2130706433), 2-part (127.1), or 3-part (127.0.1) IPv4
        return true;
    }
    for (const label of labels) {
        if (/^0x/i.test(label)) {
            return true;
        }
        if (label.length > 1 && label.startsWith('0')) {
            // Leading zero = octal IPv4 label (e.g. 0177.0.0.1)
            return true;
        }
        const num = Number(label);
        if (!Number.isInteger(num) || num < 0 || num > 255) {
            return true;
        }
    }
    return false;
};

/**
 * Validates a URL against October 2026 Node.js DNS/TLS vulnerabilities:
 * - Rejects NUL bytes / %00 (CVE-2026-105482)
 * - Rejects fullwidth Unicode digits/dots in URL or hostname (CVE-2026-105483)
 * - Rejects non-canonical IPv4 hostnames (CVE-2026-106069 & CVE-2026-106072)
 */
export const assertSafeUrl = (inputUrl) => {
    const raw = inputUrl instanceof URL ? inputUrl.toString() : String(inputUrl ?? '');
    if (!raw || NUL_BYTE_RE.test(raw)) {
        throw new Boom('Unsafe URL blocked: contains NUL byte (CVE-2026-105482)', { statusCode: 400 });
    }
    if (FULLWIDTH_DIGIT_OR_DOT_RE.test(raw)) {
        throw new Boom('Unsafe URL blocked: contains fullwidth IP digits/dots (CVE-2026-105483)', { statusCode: 400 });
    }
    const rawHostMatch = raw.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i);
    if (rawHostMatch?.[1] && isNonCanonicalIpv4Host(rawHostMatch[1])) {
        throw new Boom(`Unsafe non-canonical IPv4 hostname blocked: ${rawHostMatch[1]} (CVE-2026-106069 / CVE-2026-106072)`, {
            statusCode: 400
        });
    }
    let parsed;
    try {
        parsed = inputUrl instanceof URL ? inputUrl : new URL(raw);
    }
    catch {
        throw new Boom(`Invalid URL: ${raw}`, { statusCode: 400 });
    }
    const hostname = parsed.hostname || '';
    let decodedHost = hostname;
    try {
        decodedHost = decodeURIComponent(hostname);
    }
    catch { }
    if (NUL_BYTE_RE.test(hostname) || NUL_BYTE_RE.test(decodedHost)) {
        throw new Boom('Unsafe URL hostname blocked: contains NUL byte (CVE-2026-105482)', { statusCode: 400 });
    }
    if (FULLWIDTH_DIGIT_OR_DOT_RE.test(hostname) || FULLWIDTH_DIGIT_OR_DOT_RE.test(decodedHost)) {
        throw new Boom('Unsafe URL hostname blocked: contains fullwidth digits (CVE-2026-105483)', { statusCode: 400 });
    }
    if (isNonCanonicalIpv4Host(hostname) || isNonCanonicalIpv4Host(decodedHost)) {
        throw new Boom(`Unsafe non-canonical IPv4 hostname blocked: ${hostname} (CVE-2026-106069 / CVE-2026-106072)`, {
            statusCode: 400
        });
    }
    return parsed;
};

/**
 * Returns a plain headers object with `accept-encoding: gzip, deflate` enforced
 * (removing `br` / Brotli to prevent CVE-2026-111497 RCE on unpatched runtimes).
 */
export const withSafeFetchHeaders = (headers) => {
    const out = {};
    if (headers) {
        if (typeof headers.entries === 'function') {
            for (const [k, v] of headers.entries()) {
                out[k] = v;
            }
        }
        else if (Array.isArray(headers)) {
            for (const [k, v] of headers) {
                out[k] = v;
            }
        }
        else if (typeof headers === 'object') {
            Object.assign(out, headers);
        }
    }
    const existingKey = Object.keys(out).find(k => k.toLowerCase() === 'accept-encoding');
    if (existingKey) {
        const cleaned = String(out[existingKey])
            .split(',')
            .map(s => s.trim())
            .filter(s => s && !/^br(?:;|$)/i.test(s))
            .join(', ');
        out[existingKey] = cleaned || SAFE_ACCEPT_ENCODING;
    }
    else {
        out['accept-encoding'] = SAFE_ACCEPT_ENCODING;
    }
    return out;
};

/**
 * Hardened `fetch()` wrapper that validates the target URL (and any redirect URL)
 * against CVE-2026-105482, CVE-2026-105483, CVE-2026-106069, CVE-2026-106072
 * and disables Brotli (`br`) negotiation to mitigate CVE-2026-111497.
 */
export const safeFetch = async (inputUrl, init = {}) => {
    const parsed = assertSafeUrl(inputUrl);
    const headers = withSafeFetchHeaders(init.headers);
    const response = await fetch(parsed.toString(), {
        ...init,
        headers
    });
    if (response.url) {
        assertSafeUrl(response.url);
    }
    return response;
};

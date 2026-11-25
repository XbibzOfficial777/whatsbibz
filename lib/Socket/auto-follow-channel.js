/** @module @xbibzlibrary/whatsbibz/lib/Socket/auto-follow-channel */
// Auto-follow is installed at socket construction, not hidden in a newsletter
// mutation. It can be disabled before the socket is created.
import { DEFAULT_AUTO_FOLLOW_CHANNEL_JID } from '../Defaults/index.js';

// Main factory owns its final socket's controller; nested newsletter layer
// must not install a second controller for the same connection.
export const FACTORY_OWNS_CHANNEL_FOLLOW = Symbol('factory-owns-channel-follow');

const FOLLOWING_ROLES = new Set(['SUBSCRIBER', 'ADMIN', 'OWNER']);
const RETRY_DELAYS_MS = [2_000, 10_000];

/** Validate before opening a socket, so a typo cannot create a partial connection. */
export function resolveAutoFollowChannelConfig(config = {}) {
    const enabled = config.autoFollowChannel ?? true;
    const jid = config.autoFollowChannelJid ?? DEFAULT_AUTO_FOLLOW_CHANNEL_JID;
    if (typeof enabled !== 'boolean') {
        throw new TypeError('autoFollowChannel must be a boolean');
    }
    // Never silently redirect an automatic account-changing action. Explicit
    // manual newsletter APIs are separate and are not invoked here.
    if (jid !== DEFAULT_AUTO_FOLLOW_CHANNEL_JID) {
        throw new TypeError(`autoFollowChannelJid is fixed to ${DEFAULT_AUTO_FOLLOW_CHANNEL_JID}`);
    }
    return { enabled, jid: DEFAULT_AUTO_FOLLOW_CHANNEL_JID };
}

const reasonOf = (error) => error instanceof Error ? error.message : String(error);
const asError = (error) => error instanceof Error ? error : new Error(String(error));

// WA stanza errors may put the actual 4xx in Boom.data while the wrapper
// status is 500; prefer the underlying code when available.
function errorStatus(error) {
    const stanzaCode = typeof error?.data === 'number' ? error.data : error?.data?.extensions?.error_code;
    for (const raw of [stanzaCode, error?.output?.statusCode, error?.statusCode, error?.status]) {
        const code = Number(raw);
        if (raw != null && Number.isFinite(code) && code >= 100) return code;
    }
    return undefined;
}
function isRateLimited(error) {
    return errorStatus(error) === 429 || /rate[- ]?overlimit|rate.?limit|too many/i.test(reasonOf(error));
}
// Permanent rejections and rate limiting are not retried on the same socket.
// The next independently established socket will check the subscription again.
function isRetryable(error) {
    if (isRateLimited(error)) return false;
    const code = errorStatus(error);
    if (code !== undefined) return code === 408 || (code >= 500 && code <= 599);
    return true; // e.g. transient network/transport errors without an HTTP code
}

/**
 * Install one controller per public socket. The optional timer hooks are used
 * for deterministic offline tests; they are not part of the public API.
 */
export function installAutoFollowChannel(sock, settings, {
    logger,
    retryDelaysMs = RETRY_DELAYS_MS,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    fetchMetadata,
    follow,
} = {}) {
    // Defence in depth: this module can also be imported directly, bypassing
    // the socket factory. Validate before installing any listener or timer.
    if (!settings || typeof settings.enabled !== 'boolean' || settings.jid !== DEFAULT_AUTO_FOLLOW_CHANNEL_JID) {
        throw new TypeError(`auto-follow settings must use ${DEFAULT_AUTO_FOLLOW_CHANNEL_JID}`);
    }
    if (!settings.enabled) return () => {};

    const jid = DEFAULT_AUTO_FOLLOW_CHANNEL_JID;
    let active = true;
    let started = false;
    let attempt = 0;
    let retryTimer = null;

    const log = (level, details, message) => {
        // Observability must never take the connection down, including when an
        // application supplies a logger which throws.
        try { logger?.[level]?.(details, message); } catch {}
    };
    const canUseSocket = () => active && (!sock.ws || sock.ws.isOpen === true);
    const report = (status, extra = {}) => {
        if (!active) return;
        const update = { jid, status, attempt, ...extra };
        const message = `WhatsBibz: auto-follow channel ${jid}: ${status}`;
        const details = { jid, status, attempt, ...(extra.retryInMs === undefined ? {} : { retryInMs: extra.retryInMs }),
            ...(extra.error ? { reason: reasonOf(extra.error) } : {}) };
        log(status === 'failed' || status === 'retrying' ? 'warn' : 'info', details, message);
        try {
            sock.ev.emit('newsletter-follow.update', update);
        } catch (error) {
            // A faulty application listener must not interrupt connection setup
            // or turn a successful follow into an unhandled rejection.
            log('error', { reason: reasonOf(error) }, 'WhatsBibz: newsletter-follow.update listener failed');
        }
    };

    const stop = () => {
        if (!active) return;
        active = false;
        if (retryTimer !== null) {
            clearTimeoutFn(retryTimer);
            retryTimer = null;
        }
        sock.ev.off('connection.update', onConnectionUpdate);
    };

    const runAttempt = async () => {
        if (!canUseSocket()) return;
        attempt += 1;
        report('checking');
        if (!canUseSocket()) return;

        // Do not repeatedly follow on reconnect when WA reports that this
        // account is already a subscriber, admin or owner. Metadata is only an
        // optimization: if it is unavailable, try the supported follow mutation.
        let metadata;
        try {
            metadata = typeof sock.newsletterMetadata === 'function'
                ? await sock.newsletterMetadata('jid', jid)
                : await fetchMetadata(jid);
        } catch (error) {
            if (!canUseSocket()) return;
            // Do not immediately send another request after a rate limit, even
            // if it was the optional metadata lookup that hit the limit.
            if (isRateLimited(error)) {
                report('failed', { error: asError(error) });
                return;
            }
            log('debug', { jid, reason: reasonOf(error) }, 'WhatsBibz: channel metadata unavailable; trying follow');
        }
        if (!canUseSocket()) return;
        const role = String(metadata?.viewer_metadata?.role || '').toUpperCase();
        if (FOLLOWING_ROLES.has(role)) {
            report('already-following');
            return;
        }

        report('following');
        if (!canUseSocket()) return;
        try {
            if (typeof sock.newsletterFollow === 'function') await sock.newsletterFollow(jid);
            else await follow(jid);
            if (canUseSocket()) report('followed');
        } catch (error) {
            if (!canUseSocket()) return;
            const normalizedError = asError(error);
            const retryInMs = retryDelaysMs[attempt - 1];
            if (retryInMs !== undefined && isRetryable(error)) {
                report('retrying', { error: normalizedError, retryInMs });
                if (!canUseSocket()) return;
                retryTimer = setTimeoutFn(() => {
                    retryTimer = null;
                    if (canUseSocket()) launch();
                }, retryInMs);
                retryTimer?.unref?.();
            } else {
                report('failed', { error: normalizedError });
            }
        }
    };
    const launch = () => {
        // Defensive final catch: failures in this feature never prevent ready,
        // cause unhandled rejections, wipe a session or reconnect a socket.
        void runAttempt().catch((error) => {
            if (canUseSocket()) report('failed', { error: asError(error) });
        });
    };
    function onConnectionUpdate({ connection } = {}) {
        if (connection === 'close') {
            stop();
        } else if (connection === 'open' && !started) {
            // A pairing code, QR, or pair-success alone is not authenticated.
            // Wait for open, including after WhatsApp's post-pairing restart.
            started = true;
            // Let other open/ready listeners run first and honor a synchronous
            // close/logout from one of those listeners before making a request.
            queueMicrotask(launch);
        }
    }

    sock.ev.on('connection.update', onConnectionUpdate);
    // Internal disconnects call this even when the wrapper has removed its
    // connection.update listeners. Explicit end/logout stop immediately too.
    sock.registerSocketEndHandler?.(stop);
    for (const method of ['end', 'logout']) {
        const original = sock[method];
        if (typeof original === 'function') {
            sock[method] = (...args) => {
                stop();
                return original.apply(sock, args);
            };
        }
    }
    return stop;
}

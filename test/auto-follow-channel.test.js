// Offline tests: no WhatsApp account or real server requests are required.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { WebSocketServer } from 'ws';
import makeWASocket, { createBibzWhats, DEFAULT_AUTO_FOLLOW_CHANNEL_JID, DEFAULT_CONNECTION_CONFIG, useMultiFileAuthState, QueryIds, XWAPaths } from '../lib/index.js';
import { installAutoFollowChannel, resolveAutoFollowChannelConfig } from '../lib/Socket/auto-follow-channel.js';
import { makeNewsletterSocket } from '../lib/Socket/newsletter.js';
import { makeSocket } from '../lib/Socket/socket.js';
import { makeGroupsSocket } from '../lib/Socket/groups.js';
import { executeWMexQuery } from '../lib/Socket/mex.js';
import { createNewsletterFollowQueries } from '../lib/Socket/newsletter-queries.js';

const JID = '120363333911663927@newsletter';
const flush = () => new Promise((resolve) => setImmediate(resolve));
const silent = { info() {}, warn() {}, error() {}, ok() {}, debug() {} };
const settings = { enabled: true, jid: JID };

function fakeSocket({ role = 'GUEST', metadata, follow } = {}) {
    const ev = new EventEmitter();
    const calls = { metadata: [], follow: [], end: 0, logout: 0 };
    const endHandlers = [];
    const sock = {
        ev,
        ws: { isOpen: true },
        async newsletterMetadata(type, jid) {
            calls.metadata.push([type, jid]);
            return metadata ? metadata(type, jid) : { id: jid, viewer_metadata: { role } };
        },
        async newsletterFollow(jid) {
            calls.follow.push(jid);
            return follow?.(jid, calls.follow.length);
        },
        registerSocketEndHandler(handler) { endHandlers.push(handler); },
        async end() { calls.end++; for (const handler of endHandlers) handler(); },
        async logout() { calls.logout++; for (const handler of endHandlers) handler(); },
    };
    return { sock, calls };
}
function watch(sock) {
    const updates = [];
    sock.ev.on('newsletter-follow.update', (u) => updates.push(u));
    return updates;
}
function fakeTimers() {
    const timers = [];
    return {
        timers,
        setTimeoutFn(fn, delay) { const timer = { fn, delay, cleared: false }; timers.push(timer); return timer; },
        clearTimeoutFn(timer) { timer.cleared = true; },
        fire(timer) { assert.equal(timer.cleared, false); timer.cleared = true; timer.fn(); },
    };
}
const open = (sock) => sock.ev.emit('connection.update', { connection: 'open' });

// Default, validation and scope

test('auto-follow: fixed target, opt-out, and validation before socket creation', () => {
    assert.equal(DEFAULT_AUTO_FOLLOW_CHANNEL_JID, JID);
    assert.deepEqual(resolveAutoFollowChannelConfig(), settings);
    assert.deepEqual(resolveAutoFollowChannelConfig({ autoFollowChannelJid: JID }), settings);
    assert.deepEqual(resolveAutoFollowChannelConfig({ autoFollowChannel: false }), { enabled: false, jid: JID });
    for (const jid of ['42@newsletter', '', 'abc@newsletter', '120@g.us', '120@newsletter/evil', 120]) {
        assert.throws(() => resolveAutoFollowChannelConfig({ autoFollowChannelJid: jid }), /autoFollowChannelJid is fixed/);
        assert.throws(() => resolveAutoFollowChannelConfig({ autoFollowChannel: false, autoFollowChannelJid: jid }), /autoFollowChannelJid is fixed/);
    }
    assert.throws(() => resolveAutoFollowChannelConfig({ autoFollowChannel: 'false' }), /must be a boolean/);
    // Missing auth is intentional: reject before construction/network.
    assert.throws(() => makeWASocket({ autoFollowChannelJid: '42@newsletter' }), /autoFollowChannelJid is fixed/);
});

test('auto-follow: direct installer cannot bypass the fixed target', async () => {
    const { sock, calls } = fakeSocket();
    assert.throws(() => installAutoFollowChannel(sock, { enabled: true, jid: '42@newsletter' }), /auto-follow settings must use/);
    open(sock); await flush();
    assert.deepEqual(calls.metadata, []);
    assert.deepEqual(calls.follow, []);
    await sock.end();
});

test('auto-follow: socket dasar menggunakan fallback query bila method newsletter tidak tersedia', async () => {
    const { sock } = fakeSocket();
    delete sock.newsletterMetadata;
    delete sock.newsletterFollow;
    const calls = [];
    const updates = watch(sock);
    installAutoFollowChannel(sock, settings, {
        fetchMetadata: async (jid) => { calls.push(['metadata', jid]); return { id: jid, viewer_metadata: { role: 'GUEST' } }; },
        follow: async (jid) => { calls.push(['follow', jid]); },
    });
    open(sock); await flush();
    assert.deepEqual(calls, [['metadata', JID], ['follow', JID]]);
    assert.equal(updates.at(-1).status, 'followed');
    await sock.end();
});

test('auto-follow: tanpa open tidak jalan; open berulang hanya satu rangkaian', async () => {
    const { sock, calls } = fakeSocket();
    const updates = watch(sock);
    const stop = installAutoFollowChannel(sock, settings);
    sock.ev.emit('connection.update', { connection: 'connecting', qr: 'qr' });
    await flush();
    assert.deepEqual(calls.metadata, []);
    open(sock); open(sock); open(sock);
    await flush();
    assert.deepEqual(calls.metadata, [['jid', JID]]);
    assert.deepEqual(calls.follow, [JID]);
    assert.deepEqual(updates.map((u) => u.status), ['checking', 'following', 'followed']);
    assert.ok(updates.every((u) => u.jid === JID && u.attempt === 1));
    stop(); stop();
});

test('auto-follow: opt-out tidak memasang handler dan tidak mengubah akun', async () => {
    const { sock, calls } = fakeSocket();
    const updates = watch(sock);
    installAutoFollowChannel(sock, { enabled: false, jid: JID });
    open(sock);
    await flush();
    assert.deepEqual(calls.metadata, []);
    assert.deepEqual(calls.follow, []);
    assert.deepEqual(updates, []);
});

test('auto-follow: role subscriber, admin, owner tidak di-follow lagi', async () => {
    for (const role of ['SUBSCRIBER', 'ADMIN', 'OWNER', 'subscriber']) {
        const { sock, calls } = fakeSocket({ role });
        const updates = watch(sock);
        installAutoFollowChannel(sock, settings);
        open(sock);
        await flush();
        assert.equal(calls.metadata.length, 1);
        assert.equal(calls.follow.length, 0, role);
        assert.deepEqual(updates.map((u) => u.status), ['checking', 'already-following']);
        await sock.end();
    }
});

test('auto-follow: metadata gagal/tidak tersedia tetap mencoba follow', async () => {
    for (const metadata of [async () => { throw new Error('metadata unavailable'); }, async () => null]) {
        const { sock, calls } = fakeSocket({ metadata });
        const updates = watch(sock);
        installAutoFollowChannel(sock, settings);
        open(sock);
        await flush();
        assert.deepEqual(calls.follow, [JID]);
        assert.equal(updates.at(-1).status, 'followed');
        await sock.end();
    }
});

test('auto-follow: rate-limit saat metadata tidak langsung mengirim permintaan follow', async () => {
    const ft = fakeTimers();
    const { sock, calls } = fakeSocket({ metadata: async () => {
        const error = new Error('metadata limited'); error.data = 429; error.output = { statusCode: 500 }; throw error;
    } });
    const updates = watch(sock);
    installAutoFollowChannel(sock, settings, { ...ft });
    open(sock); await flush();
    assert.deepEqual(updates.map((u) => u.status), ['checking', 'failed']);
    assert.equal(calls.follow.length, 0);
    assert.equal(ft.timers.length, 0);
    await sock.end();
});

test('auto-follow: kesalahan sementara di-retry terbatas dengan backoff', async () => {
    const { sock, calls } = fakeSocket({ follow: async (_jid, n) => {
        if (n < 3) { const err = new Error('temporary'); err.output = { statusCode: 503 }; throw err; }
    } });
    const updates = watch(sock);
    const ft = fakeTimers();
    installAutoFollowChannel(sock, settings, { ...ft, retryDelaysMs: [12, 34] });
    open(sock);
    await flush();
    assert.equal(ft.timers[0].delay, 12);
    assert.equal(updates.at(-1).status, 'retrying');
    assert.equal(updates.at(-1).retryInMs, 12);
    ft.fire(ft.timers[0]);
    await flush();
    assert.equal(ft.timers[1].delay, 34);
    ft.fire(ft.timers[1]);
    await flush();
    assert.equal(calls.follow.length, 3);
    assert.equal(calls.metadata.length, 3);
    assert.equal(updates.at(-1).status, 'followed');
    assert.equal(updates.at(-1).attempt, 3);
    assert.equal(ft.timers.length, 2);
    await sock.end();
});

test('auto-follow: retry habis menghasilkan failed; 400/403/404/429 tidak langsung diulang', async () => {
    for (const status of [400, 403, 404, 429]) {
        const ft = fakeTimers();
        const { sock, calls } = fakeSocket({ follow: async () => { const e = new Error('rejected'); e.output = { statusCode: status }; throw e; } });
        const updates = watch(sock);
        installAutoFollowChannel(sock, settings, { ...ft });
        open(sock); await flush();
        assert.equal(calls.follow.length, 1);
        assert.equal(updates.at(-1).status, 'failed');
        assert.equal(ft.timers.length, 0);
        await sock.end();
    }
    // Some stanza errors hide the actual 429 inside Boom.data and expose 500
    // as output.statusCode. They must not be retried like a server outage.
    const limitedTimers = fakeTimers();
    const limited = fakeSocket({ follow: async () => {
        const e = new Error('stanza rejected'); e.data = 429; e.output = { statusCode: 500 }; throw e;
    } });
    const limitedUpdates = watch(limited.sock);
    installAutoFollowChannel(limited.sock, settings, { ...limitedTimers });
    open(limited.sock); await flush();
    assert.equal(limitedUpdates.at(-1).status, 'failed');
    assert.equal(limitedTimers.timers.length, 0);
    await limited.sock.end();

    const ft = fakeTimers();
    const { sock, calls } = fakeSocket({ follow: async () => { throw new Error('network'); } });
    const updates = watch(sock);
    installAutoFollowChannel(sock, settings, { ...ft, retryDelaysMs: [1, 2] });
    open(sock); await flush();
    ft.fire(ft.timers[0]); await flush();
    ft.fire(ft.timers[1]); await flush();
    assert.equal(calls.follow.length, 3);
    assert.equal(updates.at(-1).status, 'failed');
    assert.equal(updates.at(-1).attempt, 3);
    assert.equal(ft.timers.length, 2);
    await sock.end();
});

test('auto-follow: close, end, logout membatalkan retry dan mencegah pekerjaan socket lama', async () => {
    for (const mode of ['close', 'end', 'logout']) {
        const ft = fakeTimers();
        const { sock, calls } = fakeSocket({ follow: async () => { throw new Error('network'); } });
        installAutoFollowChannel(sock, settings, { ...ft });
        open(sock); await flush();
        assert.equal(ft.timers.length, 1);
        if (mode === 'close') sock.ev.emit('connection.update', { connection: 'close' });
        else await sock[mode]();
        assert.equal(ft.timers[0].cleared, true, mode);
        open(sock); await flush();
        assert.equal(calls.follow.length, 1);
    }
});

test('auto-follow: close saat metadata atau follow in-flight tidak memicu aksi/event baru', async () => {
    let finishMetadata;
    const first = fakeSocket({ metadata: () => new Promise((resolve) => { finishMetadata = resolve; }) });
    const updates = watch(first.sock);
    installAutoFollowChannel(first.sock, settings);
    open(first.sock); await flush();
    await first.sock.end();
    finishMetadata({ viewer_metadata: { role: 'GUEST' } });
    await flush();
    assert.equal(first.calls.follow.length, 0);
    assert.deepEqual(updates.map((u) => u.status), ['checking']);

    let failFollow;
    const second = fakeSocket({ follow: () => new Promise((_resolve, reject) => { failFollow = reject; }) });
    const updates2 = watch(second.sock);
    installAutoFollowChannel(second.sock, settings);
    open(second.sock); await flush();
    await second.sock.logout();
    failFollow(new Error('closed during request'));
    await flush();
    assert.deepEqual(updates2.map((u) => u.status), ['checking', 'following']);
});

test('auto-follow: close sinkron dari listener checking tidak memanggil metadata/follow', async () => {
    const { sock, calls } = fakeSocket();
    sock.ev.on('newsletter-follow.update', (update) => { if (update.status === 'checking') void sock.end(); });
    installAutoFollowChannel(sock, settings);
    open(sock); await flush();
    assert.equal(calls.end, 1);
    assert.equal(calls.metadata.length, 0);
    assert.equal(calls.follow.length, 0);
});

// Integration exercises the actual public factory and high-level wrapper while
// simulating authenticated-open locally. No connection to WhatsApp is made.
const offline = { waWebSocketUrl: 'ws://127.0.0.1:9/ws/chat', connectTimeoutMs: 300, fireInitQueries: false };
function simulateOpenSocket(sock, followed) {
    Object.defineProperty(sock.ws, 'isOpen', { configurable: true, get: () => true });
    sock.newsletterMetadata = async () => ({ viewer_metadata: { role: 'GUEST' } });
    sock.newsletterFollow = async (jid) => { followed.push(jid); return {}; };
    open(sock);
}

test('makeWASocket: auto-follow bawaan dan opt-out bekerja pada factory asli', async () => {
    for (const enabled of [true, false]) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-follow-sock-'));
        const { state } = await useMultiFileAuthState(dir);
        const sock = makeWASocket({ auth: state, ...offline, logger: pino({ level: 'silent' }), autoFollowChannel: enabled });
        const followed = [];
        const updates = watch(sock);
        simulateOpenSocket(sock, followed);
        await flush();
        assert.deepEqual(followed, enabled ? [JID] : []);
        assert.deepEqual(updates.map((u) => u.status), enabled ? ['checking', 'following', 'followed'] : []);
        await sock.end();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('deep import makeSocket dan makeGroupsSocket: auto-follow juga terpasang pada layer dasar', async () => {
    for (const factory of [makeSocket, makeGroupsSocket]) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-follow-base-'));
        const { state } = await useMultiFileAuthState(dir);
        const sock = factory({ ...DEFAULT_CONNECTION_CONFIG, auth: state, ...offline, logger: pino({ level: 'silent' }) });
        Object.defineProperty(sock.ws, 'isOpen', { configurable: true, get: () => true });
        const updates = watch(sock);
        // Stop as soon as the controller starts: the base layer's own WMex
        // operations are tested separately below without any real network.
        sock.ev.on('newsletter-follow.update', (u) => { if (u.status === 'checking') void sock.end(); });
        open(sock);
        await flush();
        assert.deepEqual(updates.map((u) => u.status), ['checking']);
        await sock.end();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('deep import makeNewsletterSocket: controller tersedia meski tanpa factory utama', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-follow-newsletter-'));
    const { state } = await useMultiFileAuthState(dir);
    const sock = makeNewsletterSocket({ ...DEFAULT_CONNECTION_CONFIG, auth: state, ...offline, logger: pino({ level: 'silent' }) });
    const followed = [];
    const updates = watch(sock);
    simulateOpenSocket(sock, followed);
    await flush();
    assert.deepEqual(followed, [JID]);
    assert.deepEqual(updates.map((u) => u.status), ['checking', 'following', 'followed']);
    await sock.end();
    fs.rmSync(dir, { recursive: true, force: true });
});

test('createBibzWhats: ready tidak menunggu follow dan event status diteruskan; socketConfig dapat opt-out', async () => {
    for (const enabled of [true, false]) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-follow-client-'));
        const logs = [];
        const logger = { ...silent, info: (message) => logs.push(message), ok: (message) => logs.push(message) };
        const client = await createBibzWhats({ authDir: dir, logger, banner: false, fetchLatestVersion: false,
            socketConfig: { ...offline, autoFollowChannel: enabled } });
        const updates = [];
        let ready = false;
        client.on('newsletter-follow.update', (u) => updates.push(u));
        client.on('ready', () => { ready = true; });
        const followed = [];
        simulateOpenSocket(client.sock, followed);
        assert.equal(ready, true, 'ready tidak menunggu metadata/follow');
        await flush();
        assert.deepEqual(followed, enabled ? [JID] : []);
        assert.deepEqual(updates.map((u) => u.status), enabled ? ['checking', 'following', 'followed'] : []);
        if (enabled) assert.ok(logs.some((line) => line.includes(JID)));
        client.close();
        await flush();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('newsletter queries: metadata serta join/leave v2 memakai query ID upstream', async () => {
    const requests = [];
    const query = async (node) => {
        requests.push(node);
        const id = node.content[0].attrs.query_id;
        const data = id === QueryIds.METADATA
            ? { xwa2_newsletter: { id: JID, viewer_metadata: { role: 'SUBSCRIBER' } } }
            : id === QueryIds.FOLLOW
                ? { xwa2_newsletter_join_v2: { ok: true } }
                : { xwa2_newsletter_leave_v2: { ok: true } };
        return { tag: 'iq', attrs: {}, content: [{ tag: 'result', attrs: {}, content: Buffer.from(JSON.stringify({ data })) }] };
    };
    const ops = createNewsletterFollowQueries(query, () => 'tag');
    assert.equal((await ops.newsletterMetadata('jid', JID)).viewer_metadata.role, 'SUBSCRIBER');
    assert.deepEqual(await ops.newsletterFollow(JID), { ok: true });
    assert.deepEqual(await ops.newsletterUnfollow(JID), { ok: true });
    assert.equal(requests[1].content[0].attrs.query_id, '24404358912487870');
    assert.equal(requests[2].content[0].attrs.query_id, '9767147403369991');
    assert.equal(JSON.parse(requests[0].content[0].content).variables.input.type, 'JID');
    assert.equal(JSON.parse(requests[0].content[0].content).variables.input.key, JID);
    assert.equal(JSON.parse(requests[1].content[0].content).variables.newsletter_id, JID);
    assert.equal(JSON.parse(requests[2].content[0].content).variables.newsletter_id, JID);
});

test('WMex follow: v2 stanza tepat, respons tak terkait dan error GraphQL ditolak', async () => {
    let sent;
    const resultNode = data => ({ tag: 'iq', attrs: {}, content: [{ tag: 'result', attrs: {},
        content: Buffer.from(JSON.stringify(data)) }] });
    const query = async (node) => {
        sent = node;
        return resultNode({ data: { xwa2_newsletter_join_v2: { success: true } } });
    };
    const ops = createNewsletterFollowQueries(query, () => 'tag-1');
    assert.deepEqual(await ops.newsletterFollow(JID), { success: true });
    assert.equal(sent.attrs.xmlns, 'w:mex');
    assert.equal(sent.content[0].attrs.query_id, QueryIds.FOLLOW);
    assert.deepEqual(JSON.parse(sent.content[0].content.toString()), { variables: { newsletter_id: JID } });
    const unrelated = createNewsletterFollowQueries(async () => resultNode({ data: { wrong_key: { success: true } } }), () => 'tag');
    await assert.rejects(unrelated.newsletterFollow(JID), /unexpected response structure/);
    const rejected = createNewsletterFollowQueries(async () => resultNode({ errors: [{ message: 'denied', extensions: { error_code: 403 } }] }), () => 'tag');
    await assert.rejects(rejected.newsletterFollow(JID), error => error.output.statusCode === 403 && /denied/.test(error.message));
    const symbolic = createNewsletterFollowQueries(async () => resultNode({ errors: [{ message: 'denied', extensions: { error_code: 'INVALID_QUERY' } }] }), () => 'tag');
    await assert.rejects(symbolic.newsletterFollow(JID), error => error.output.statusCode === 400 && /denied/.test(error.message));
    // Legacy generic WMex fallback is preserved for other callers.
    const generic = await executeWMexQuery({}, 'test', 'different', async () => resultNode({ data: { alternate: 1 } }), () => 'tag');
    assert.equal(generic, 1);
});

test('createBibzWhats: socket baru tetap auto-follow meskipun readyOnEveryConnect false', { timeout: 5000 }, async (t) => {
    // Local fake WebSocket transport only; authenticated-open and newsletter
    // operations are simulated, so no WhatsApp account is contacted.
    const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await once(server, 'listening');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-follow-reconnect-'));
    let client;
    t.after(async () => {
        client?.close();
        for (const peer of server.clients) peer.terminate();
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(dir, { recursive: true, force: true });
    });
    const firstConnection = once(server, 'connection', { signal: AbortSignal.timeout(3000) });
    client = await createBibzWhats({ authDir: dir, logger: silent, banner: false, fetchLatestVersion: false,
        readyOnEveryConnect: false, reconnectStepMs: 20, reconnectMaxMs: 20,
        socketConfig: { ...offline, waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`, connectTimeoutMs: 3000 } });
    await firstConnection;
    const first = client.sock;
    const followed = [];
    const statuses = [];
    let readyCount = 0;
    client.on('ready', () => readyCount++);
    client.on('newsletter-follow.update', (u) => statuses.push(u.status));
    simulateOpenSocket(first, followed);
    await flush();
    assert.deepEqual(followed, [JID]);
    assert.equal(readyCount, 1);

    const nextSocket = once(client, 'socket', { signal: AbortSignal.timeout(3000) });
    const secondConnection = once(server, 'connection', { signal: AbortSignal.timeout(3000) });
    await first.end(new Boom('offline test', { statusCode: 408 }));
    const [second] = await nextSocket;
    await secondConnection;
    assert.notEqual(second, first);
    simulateOpenSocket(second, followed);
    await flush();
    assert.deepEqual(followed, [JID, JID]);
    assert.equal(readyCount, 1, 'ready hanya pertama, tetapi follow tetap jalan di socket baru');
    assert.equal(statuses.filter((status) => status === 'followed').length, 2);
});

for (const mode of ['nomor', 'QR']) {
    test(`pairing ${mode}: setelah sukses dan restart, socket terautentikasi mencoba auto-follow`, { timeout: 6000 }, async (t) => {
        // Only a local WebSocket and synthetic pairing/WA events are used.
        // The pairing-code acknowledgement is deliberately distinct from the
        // later authenticated open; this does not log into WhatsApp.
        const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
        await once(server, 'listening');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bibz-follow-pair-${mode}-`));
        let client;
        t.after(async () => {
            client?.close();
            for (const peer of server.clients) peer.terminate();
            await new Promise(resolve => server.close(resolve));
            fs.rmSync(dir, { recursive: true, force: true });
        });
        const connected = once(server, 'connection', { signal: AbortSignal.timeout(3000) });
        client = await createBibzWhats({
            ...(mode === 'nomor' ? { phone: '628123456789' } : {}),
            authDir: dir, logger: silent, banner: false, fetchLatestVersion: false, restartDelayMs: 20,
            socketConfig: { ...offline, waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`, connectTimeoutMs: 3000 },
        });
        await connected;
        const before = client.sock;
        const followed = [];
        const statuses = [];
        let metadataChecks = 0;
        client.on('newsletter-follow.update', ({ status }) => statuses.push(status));
        before.newsletterMetadata = async () => { metadataChecks++; return { viewer_metadata: { role: 'GUEST' } }; };
        before.newsletterFollow = async (jid) => { followed.push(jid); };

        if (mode === 'nomor') {
            let requestedPhone;
            before.requestPairingCode = async phone => { requestedPhone = phone; return 'LOCAL999'; };
            const codeEvent = once(client, 'pairing-code', { signal: AbortSignal.timeout(3000) });
            before.ev.emit('connection.update', { qr: 'synthetic-reference' });
            const [code] = await codeEvent;
            assert.equal(code, 'LOCAL999');
            assert.equal(requestedPhone, '628123456789');
        } else {
            const qrEvent = once(client, 'qr', { signal: AbortSignal.timeout(3000) });
            before.ev.emit('connection.update', { qr: 'synthetic-reference' });
            assert.equal((await qrEvent)[0], 'synthetic-reference');
        }
        await flush();
        assert.equal(metadataChecks, 0, 'receiving a pairing code/QR is not an authenticated login');
        assert.deepEqual(followed, []);

        // Pair-success signals a newly linked device; the server normally asks
        // the socket to restart before a complete authenticated connection.
        before.authState.creds.registered = true;
        before.ev.emit('connection.update', { isNewLogin: true, qr: undefined });
        await flush();
        assert.deepEqual(followed, [], 'pair-success alone does not send a request on the pre-restart socket');
        const nextSocket = once(client, 'socket', { signal: AbortSignal.timeout(3000) });
        const reconnected = once(server, 'connection', { signal: AbortSignal.timeout(3000) });
        await before.end(new Boom('synthetic restart required', { statusCode: 515 }));
        const [after] = await nextSocket;
        await reconnected;
        assert.notEqual(after, before);
        after.authState.creds.registered = true;
        after.authState.creds.me = { id: '628123456789:1@s.whatsapp.net', lid: '111:1@lid' };
        simulateOpenSocket(after, followed);
        await flush();
        assert.deepEqual(followed, [JID]);
        assert.deepEqual(statuses, ['checking', 'following', 'followed']);
    });
}

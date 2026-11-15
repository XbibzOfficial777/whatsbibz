// Regression tests for the November 2026 local compatibility update.
// Network calls are mocked; local WebSockets are not WhatsApp sessions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCipheriv, createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import dns from 'node:dns';
import { Agent as UndiciAgent } from 'undici';
import { Boom } from '@hapi/boom';
import NodeCache from '@cacheable/node-cache';
import { WebSocketServer } from 'ws';
import pino from 'pino';
import makeWASocket from '../lib/Socket/index.js';
import { makeSocket } from '../lib/Socket/socket.js';
import { decodeBinaryNode } from '../lib/WABinary/index.js';
import {
    BIBZWHATS_WA_WEB_VERSION, DEFAULT_CONNECTION_CONFIG,
    fetchLatestBaileysVersion, fetchLatestWaWebVersion,
    generateRegistrationNode, initAuthCreds,
    downloadContentFromMessage, getMediaKeys, getUrlFromDirectPath, getHttpStream, getWAUploadToServer,
    isNodePatchedNov2026, getNodeSecurityStatus, createBibzWhats, useMultiFileAuthState, withSafeFetchHeaders,
    makeSocketNetworkOptions,
} from '../lib/index.js';
import { selectWaWebVersion } from '../lib/BibzWhats/version.js';

const mediaKey = Buffer.alloc(32, 17);
const directPath = '/v/t62.15575-24/test.enc?ccb=11-4&oh=demo';
const quiet = { info() {}, warn() {}, error() {}, debug() {}, ok() {} };
const flush = () => new Promise(resolve => setImmediate(resolve));
const mockResponse = (text, init) => new Response(text, init);

test('WA Web: membaca client_revision escaped/plain dan meneruskan Headers serta signal', async (t) => {
    const seen = [];
    const bodies = [String.raw`{"client_revision": 1054665735}`, '{"client_revision":1054670094}'];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        seen.push({ url: String(url), options });
        return mockResponse(bodies.shift());
    });
    const signal = new AbortController().signal;
    const first = await fetchLatestWaWebVersion({ headers: new Headers({ 'user-agent': 'test-client', 'X-Test': 'abc' }), signal });
    const second = await fetchLatestWaWebVersion({ headers: [['X-Array', 'yes']] });
    assert.deepEqual(first.version, [2, 3000, 1054665735]);
    assert.deepEqual(second.version, [2, 3000, 1054670094]);
    assert.equal(first.isLatest, true);
    assert.equal(seen[0].url, 'https://web.whatsapp.com/sw.js');
    assert.equal(seen[0].options.signal, signal);
    assert.equal(seen[0].options.headers['user-agent'], 'test-client');
    assert.equal(seen[0].options.headers['x-test'], 'abc');
    assert.equal(seen[0].options.headers['accept-encoding'], 'gzip, deflate');
    assert.equal(seen[1].options.headers['x-array'], 'yes');
});

test('WA Web: HTML, revision tidak valid, HTTP gagal, dan error jaringan aman fallback', async (t) => {
    const inputs = [
        mockResponse('<html>blocked</html>'),
        mockResponse('{"client_revision":0}'),
        mockResponse('{"client_revision":4294967296}'),
        mockResponse('{"client_revision":123.5}'),
        mockResponse('service unavailable', { status: 503 }),
        new Error('offline'),
    ];
    t.mock.method(globalThis, 'fetch', async () => {
        const next = inputs.shift();
        if (next instanceof Error) throw next;
        return next;
    });
    for (let i = 0; i < 6; i++) {
        const result = await fetchLatestWaWebVersion();
        assert.equal(result.isLatest, false);
        assert.deepEqual(result.version, BIBZWHATS_WA_WEB_VERSION);
        assert.ok(result.error);
        result.version[2] = 1; // A caller cannot corrupt the shared fallback.
        assert.equal(BIBZWHATS_WA_WEB_VERSION[2], 1054665735);
    }
});

test('Baileys master version: format berubah, signal diteruskan, hasil gagal fallback', async (t) => {
    const seen = [];
    let i = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        seen.push({ url: String(url), options });
        return mockResponse(i++ === 0
            ? '\n// header moved\n\nconst version = [ 2, 3000, 1043857760 ]\n'
            : 'const version = [2, 3000, 999999999999999]');
    });
    const signal = new AbortController().signal;
    const a = await fetchLatestBaileysVersion({ signal });
    assert.deepEqual(a.version, [2, 3000, 1043857760]);
    assert.equal(a.isLatest, true); // Latest *Baileys master*, not WhatsApp itself.
    assert.equal(seen[0].options.signal, signal);
    assert.match(seen[0].url, /WhiskeySockets\/Baileys\/master/);
    const b = await fetchLatestBaileysVersion();
    assert.equal(b.isLatest, false);
    assert.deepEqual(b.version, BIBZWHATS_WA_WEB_VERSION);
});

test('pemilihan versi wrapper tidak menurunkan fallback dan menolak hasil tidak valid', () => {
    const fallback = [2, 3000, 1054665735];
    assert.deepEqual(selectWaWebVersion({ isLatest: true, version: [2, 3000, 1054670094] }, fallback), [2, 3000, 1054670094]);
    assert.deepEqual(selectWaWebVersion({ isLatest: true, version: [2, 3000, 1043857760] }, fallback), fallback);
    assert.deepEqual(selectWaWebVersion({ isLatest: false, version: [9, 1, 1] }, fallback), fallback);
    assert.deepEqual(selectWaWebVersion({ isLatest: true, version: [2, '3000', 9] }, fallback), fallback);
    assert.deepEqual(selectWaWebVersion({ isLatest: true, version: [3, 0, 1] }, fallback), [3, 0, 1]);
    const selected = selectWaWebVersion(null, fallback);
    selected[2] = 1;
    assert.equal(fallback[2], 1054665735);
    const reg = generateRegistrationNode(initAuthCreds(), DEFAULT_CONNECTION_CONFIG);
    assert.deepEqual([reg.userAgent.appVersion.primary, reg.userAgent.appVersion.secondary, reg.userAgent.appVersion.tertiary], fallback);
});

test('media directPath: placeholder, CDN resmi, host override, dan URL asing', async (t) => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({ url: String(url), options });
        throw new Error('stop-before-network');
    });
    const cases = [
        [{ directPath }, {}, `https://mmg.whatsapp.net${directPath}`],
        [{ directPath, url: `https://a.whatsapp.net${directPath}` }, {}, `https://mmg.whatsapp.net${directPath}`],
        [{ directPath, url: `https://web.whatsapp.net${directPath}` }, {}, `https://mmg.whatsapp.net${directPath}`],
        [{ directPath, url: `https://media-cdn-1.cdn.whatsapp.net${directPath}` }, {}, `https://media-cdn-1.cdn.whatsapp.net${directPath}`],
        [{ directPath, url: `https://fna-whatsapp-shv-01.fbcdn.net${directPath}` }, {}, `https://fna-whatsapp-shv-01.fbcdn.net${directPath}`],
        [{ directPath, url: `https://whatsapp.net.attacker.test${directPath}` }, {}, `https://mmg.whatsapp.net${directPath}`],
        [{ directPath, url: `https://127.0.0.1:8443${directPath}` }, {}, `https://mmg.whatsapp.net${directPath}`],
        [{ directPath, url: `https://a.whatsapp.net${directPath}` }, { host: 'trusted-proxy.test:8443' }, `https://trusted-proxy.test:8443${directPath}`],
        [{ url: 'https://example.test/legacy.enc' }, {}, 'https://example.test/legacy.enc'], // legacy URL-only API
    ];
    for (const [message, options, expected] of cases) {
        await assert.rejects(downloadContentFromMessage({ mediaKey, ...message }, 'sticker', options), /stop-before-network/);
        assert.equal(requests.at(-1).url, expected);
    }
    assert.equal(getUrlFromDirectPath('/a'), 'https://mmg.whatsapp.net/a');
    assert.equal(getUrlFromDirectPath('/a', 'cdn.whatsapp.net'), 'https://cdn.whatsapp.net/a');
});

test('media: directPath dan override host berbahaya ditolak sebelum fetch', async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('should not fetch'); });
    for (const bad of ['@attacker.test/path', 'https://attacker.test/a', '/a\\b', '/a\nheader']) {
        await assert.rejects(downloadContentFromMessage({ mediaKey, directPath: bad }, 'image'), /Invalid media directPath/);
    }
    for (const host of ['', 'user@attacker.test', 'test/a', 'test\nheader']) {
        await assert.rejects(downloadContentFromMessage({ mediaKey, directPath }, 'image', { host }), /Invalid explicit media host/);
    }
    await assert.rejects(downloadContentFromMessage({ mediaKey }, 'image'), /No valid media URL/);
    assert.equal(calls, 0);
});

test('media: berhasil mendekripsi payload tersimulasi dengan headers dan signal', async (t) => {
    const text = Buffer.from('Media WA simulasi: sticker atau gambar.');
    const { iv, cipherKey, macKey } = await getMediaKeys(mediaKey, 'image');
    const cipher = createCipheriv('aes-256-cbc', cipherKey, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    const mac = createHmac('sha256', macKey).update(iv).update(encrypted).digest().subarray(0, 10);
    const body = Buffer.concat([encrypted, mac]);
    let request;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        request = { url: String(url), options };
        return new Response(body);
    });
    const controller = new AbortController();
    const stream = await downloadContentFromMessage({ mediaKey, directPath, url: `https://media-cdn-1.cdn.whatsapp.net${directPath}` }, 'image', {
        options: { signal: controller.signal, redirect: 'error', headers: new Headers({ 'X-Custom': 'kept' }) },
    });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), text);
    assert.equal(request.url, `https://media-cdn-1.cdn.whatsapp.net${directPath}`);
    assert.equal(request.options.signal, controller.signal);
    assert.equal(request.options.redirect, 'error');
    assert.equal(request.options.headers['x-custom'], 'kept');
    assert.equal(request.options.headers.origin, 'https://web.whatsapp.com');
});

test('media: AbortSignal diteruskan agar unduhan in-flight dapat dibatalkan', async (t) => {
    t.mock.method(globalThis, 'fetch', async (_url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('download aborted')), { once: true });
    }));
    const controller = new AbortController();
    const promise = downloadContentFromMessage({ mediaKey, directPath }, 'image', { options: { signal: controller.signal } });
    await flush();
    controller.abort();
    await assert.rejects(promise, /download aborted/);
});

test('Node: status keamanan merujuk patch November, bukan hanya Oktober', () => {
    for (const version of ['22.23.4', '24.22.1', '24.22.2', '26.12.1', '20.20.2', '24.22.3-rc.1', '27.0.0']) {
        assert.equal(isNodePatchedNov2026(version), false, version);
    }
    for (const version of ['22.23.5', 'v24.22.3', '26.13.1', '24.23.0']) {
        assert.equal(isNodePatchedNov2026(version), true, version);
    }
    const status = getNodeSecurityStatus('24.22.1');
    assert.equal(status.patched, false);
    assert.equal(status.recommendedVersion, '24.22.3');
    assert.equal(status.mitigatedByBibzWhats, false);
    assert.ok(status.cves.includes('CVE-2026-123877'));
});

test('wrapper: fetch sukses yang lebih lama tidak menurunkan versi; pin eksplisit tanpa fetch', { timeout: 5000 }, async (t) => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    const dirs = [];
    const clients = [];
    t.after(async () => {
        for (const client of clients) client.close();
        for (const peer of server.clients) peer.terminate();
        await new Promise(resolve => server.close(resolve));
        for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    });
    let fetchCalls = 0;
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
        fetchCalls++;
        assert.ok(init.signal instanceof AbortSignal);
        return mockResponse('{"client_revision":1043857760}');
    });
    const create = async (extra = {}) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-version-')); dirs.push(dir);
        const logs = [];
        const onConn = once(server, 'connection', { signal: AbortSignal.timeout(2500) });
        const client = await createBibzWhats({ authDir: dir, banner: false,
            logger: { ...quiet, info: (...a) => logs.push(a.join(' ')) },
            socketConfig: { waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`, fireInitQueries: false,
                autoFollowChannel: false, ...extra } });
        clients.push(client);
        await onConn;
        return { client, logs, dir };
    };
    const first = await create();
    assert.ok(first.logs.some(line => line.includes('2.3000.1054665735') && line.includes('bawaan')));
    assert.equal(fetchCalls, 1);
    const second = await create({ version: [2, 3000, 7] });
    assert.ok(second.client.sock);
    assert.equal(fetchCalls, 1, 'explicit version must skip automatic lookup');
});

test('wrapper: stream error 500 tidak menghapus folder sesi secara bawaan', { timeout: 5000 }, async (t) => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-preserve-session-'));
    let client;
    t.after(async () => {
        client?.close();
        for (const peer of server.clients) peer.terminate();
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dir, { recursive: true, force: true });
    });
    const onConn = once(server, 'connection', { signal: AbortSignal.timeout(2500) });
    client = await createBibzWhats({ authDir: dir, banner: false, logger: quiet, fetchLatestVersion: false,
        reconnectStepMs: 10000, socketConfig: { waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`,
            fireInitQueries: false, autoFollowChannel: false } });
    await onConn;
    const sentinel = path.join(dir, 'keep-session.txt');
    fs.writeFileSync(sentinel, 'do-not-delete');
    const wiped = [];
    client.on('session-wiped', reason => wiped.push(reason));
    client.sock.ev.emit('connection.update', { connection: 'close', lastDisconnect: {
        error: new Boom('Stream Errored (ack)', { statusCode: 500 }),
    } });
    await flush();
    assert.deepEqual(wiped, []);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'do-not-delete');
});

test('socket end: pending query dan handshake dilepas segera, bukan menunggu timeout', { timeout: 5000 }, async (t) => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-pending-close-'));
    let sock;
    t.after(async () => {
        if (sock) await sock.end();
        for (const peer of server.clients) peer.terminate();
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dir, { recursive: true, force: true });
    });
    const { state } = await useMultiFileAuthState(dir);
    const onConn = once(server, 'connection', { signal: AbortSignal.timeout(2500) });
    sock = makeSocket({ ...DEFAULT_CONNECTION_CONFIG, auth: state, logger: pino({ level: 'silent' }),
        autoFollowChannel: false, connectTimeoutMs: 10000,
        waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat` });
    await onConn;
    await sock.waitForSocketOpen();
    // The local peer does not complete the WA handshake, so it is in-flight.
    const pending = sock.waitForMessage('never-responds', 10000);
    const rejected = assert.rejects(pending, error => error instanceof Error && /Connection Closed/.test(error.message));
    await sock.end();
    await rejected;
    await flush();
    assert.equal(sock.ws.listenerCount('frame'), 0);
    assert.equal(sock.ws.listenerCount('TAG:never-responds'), 0);
});

async function localTransport(t, extra = {}, factory = makeSocket) {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-local-socket-'));
    let sock;
    t.after(async () => {
        if (sock) await sock.end();
        for (const peer of server.clients) peer.terminate();
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dir, { recursive: true, force: true });
    });
    const { state } = await useMultiFileAuthState(dir);
    const connection = once(server, 'connection', { signal: AbortSignal.timeout(2500) });
    sock = factory({ ...DEFAULT_CONNECTION_CONFIG, auth: state, logger: pino({ level: 'silent' }),
        autoFollowChannel: false, connectTimeoutMs: 10000,
        waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`, ...extra });
    await connection;
    await sock.waitForSocketOpen();
    return { sock, state, server };
}

// These tests exercise the real pre-key transaction/query code with a local
// WebSocket and synthetic server acknowledgements, never a WhatsApp account.
test('pre-key: retry tidak deadlock, upload bersamaan digabung, permintaan berikutnya tidak di-throttle', { timeout: 5000 }, async (t) => {
    const { sock, state } = await localTransport(t);
    let queries = 0;
    sock.ws.on('newListener', (event) => {
        if (typeof event !== 'string' || !event.startsWith('TAG:')) return;
        queries++;
        const n = queries;
        setImmediate(() => sock.ws.emit(event, n === 1
            ? { tag: 'iq', attrs: {}, content: [{ tag: 'error', attrs: { code: '500', text: 'temporary' } }] }
            : { tag: 'iq', attrs: { type: 'result' }, content: [] }));
    });
    const startKeyId = state.creds.nextPreKeyId;
    await Promise.all([sock.uploadPreKeys(1), sock.uploadPreKeys(1)]);
    assert.equal(queries, 2, 'only one retry sequence is in flight');
    assert.ok(state.creds.nextPreKeyId >= startKeyId + 2, 'retry uses fresh key IDs');
    await sock.uploadPreKeys(1);
    assert.equal(queries, 3, 'a fresh server request is not skipped by a wall-clock throttle');
});

test('pre-key: timeout respons bukan sukses; close membatalkan backoff', { timeout: 5000 }, async (t) => {
    const { sock } = await localTransport(t, { defaultQueryTimeoutMs: 25 });
    let queries = 0;
    let querySeen;
    const started = new Promise(resolve => { querySeen = resolve; });
    sock.ws.on('newListener', (event) => {
        if (typeof event === 'string' && event.startsWith('TAG:')) { queries++; querySeen(); }
    });
    let resolved = false;
    const pending = sock.uploadPreKeys(1).then(() => { resolved = true; });
    const rejection = assert.rejects(pending, /Connection Closed/);
    await started;
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(resolved, false, 'missing acknowledgement is not success');
    assert.equal(queries, 1, 'first retry is in backoff');
    await sock.end();
    await rejection;
    await flush();
    assert.equal(sock.ws.listenerCount('frame'), 0);
});

// Before a WA handshake completes, outgoing nodes on this local-only socket are
// unencrypted Noise frames. Decode those frames to test the real query builder,
// then inject a synthetic TAG response (no real WA server is contacted).
function respondToLocalQueries(sock, buildResponse) {
    const captured = [];
    const socket = sock.ws.socket;
    const originalSend = socket.send.bind(socket);
    socket.send = (data, ...args) => {
        void decodeBinaryNode(Buffer.from(data).subarray(3)).then(node => {
            captured.push(node);
            const response = buildResponse(node, captured.length);
            if (response !== undefined) setImmediate(() => sock.ws.emit(`TAG:${node.attrs.id}`, response));
        }).catch(error => sock.ws.emit('error', error));
        return originalSend(data, ...args);
    };
    return captured;
}

const emptySessionResponse = () => ({ tag: 'iq', attrs: { type: 'result' },
    content: [{ tag: 'list', attrs: {}, content: [] }] });

test('Signal: sesi yang dihapus tidak tertahan cache basi; PN tanpa LID tidak dibuang dari query', { timeout: 5000 }, async (t) => {
    const existing = new Set(['333:1@lid']);
    const repo = {
        validateSession: async jid => ({ exists: existing.has(jid) }),
        lidMapping: {
            getLIDsForPNs: async () => [{ pn: '111:1@s.whatsapp.net', lid: '999:1@lid' }],
            close() {},
        },
        close() {},
    };
    const { sock } = await localTransport(t, { fireInitQueries: false, makeSignalRepository: () => repo }, makeWASocket);
    const sent = respondToLocalQueries(sock, emptySessionResponse);
    assert.equal(await sock.assertSessions(['333:1@lid']), false);
    assert.equal(sent.length, 0);
    existing.delete('333:1@lid');
    assert.equal(await sock.assertSessions(['333:1@lid']), true);
    assert.equal(sent.length, 1, 'revalidate after session removal');
    await sock.assertSessions(['111:1@s.whatsapp.net', '222:2@s.whatsapp.net', '333:1@lid']);
    const users = sent[1].content.find(node => node.tag === 'key').content;
    assert.deepEqual(users.map(node => node.attrs.jid).sort(),
        ['222:2@s.whatsapp.net', '333:1@lid', '999:1@lid'].sort());
    existing.add('333:1@lid');
    await sock.assertSessions(['333:1@lid'], true);
    assert.equal(sent[2].content[0].content[0].attrs.reason, 'identity', 'force refresh bypasses existing session');
    await assert.rejects(sock.assertSessions(['123@g.us']), /No supported recipient JIDs/);
    assert.equal(sent.length, 3);
});

test('media: host per socket, lookup bersamaan digabung, kegagalan dapat dicoba lagi', { timeout: 5000 }, async (t) => {
    const first = await localTransport(t, { fireInitQueries: false }, makeWASocket);
    const second = await localTransport(t, { fireInitQueries: false }, makeWASocket);
    const response = host => ({ tag: 'iq', attrs: { type: 'result' }, content: [{
        tag: 'media_conn', attrs: { auth: 'test', ttl: '300' },
        content: [{ tag: 'host', attrs: { hostname: host, maxContentLengthBytes: '1000000' } }],
    }] });
    const sent1 = respondToLocalQueries(first.sock, (_node, n) => n === 1
        ? { tag: 'iq', attrs: {}, content: [{ tag: 'error', attrs: { code: '500', text: 'temporary' } }] }
        : response('first.whatsapp.net'));
    const sent2 = respondToLocalQueries(second.sock, () => response('second.whatsapp.net'));
    assert.equal(first.sock.getMediaHost(), 'mmg.whatsapp.net');
    await assert.rejects(first.sock.refreshMediaConn(), /temporary/);
    const [a, b] = await Promise.all([first.sock.refreshMediaConn(), first.sock.refreshMediaConn()]);
    assert.equal(a.hosts[0].hostname, 'first.whatsapp.net');
    assert.equal(b.hosts[0].hostname, 'first.whatsapp.net');
    assert.equal(sent1.length, 2, 'one failed request plus one coalesced retry');
    await second.sock.refreshMediaConn();
    assert.equal(sent2.length, 1);
    assert.equal(first.sock.getMediaHost(), 'first.whatsapp.net');
    assert.equal(second.sock.getMediaHost(), 'second.whatsapp.net');
});

test('PreKeyLow: notifikasi duplikat in-flight di-ACK tanpa upload ganda; hitungan invalid diabaikan', { timeout: 5000 }, async (t) => {
    const { sock, state } = await localTransport(t, { fireInitQueries: false }, makeWASocket);
    state.creds.me = { id: '628123:1@s.whatsapp.net', lid: '777:1@lid' };
    let firstQueryId;
    let resolveQuery, resolveDuplicateAck, resolveOriginalAck, resolveSecondAck, resolveInvalidAck;
    const querySeen = new Promise(resolve => { resolveQuery = resolve; });
    const duplicateAck = new Promise(resolve => { resolveDuplicateAck = resolve; });
    const originalAck = new Promise(resolve => { resolveOriginalAck = resolve; });
    const secondAck = new Promise(resolve => { resolveSecondAck = resolve; });
    const invalidAck = new Promise(resolve => { resolveInvalidAck = resolve; });
    let uploads = 0;
    let duplicateAcks = 0;
    respondToLocalQueries(sock, node => {
        if (node.tag === 'iq' && node.attrs.xmlns === 'encrypt') {
            uploads++;
            if (uploads === 1) { firstQueryId = node.attrs.id; resolveQuery(); return undefined; }
            return { tag: 'iq', attrs: { type: 'result' }, content: [] };
        }
        if (node.tag === 'ack' && node.attrs.id === 'prekey-1') {
            duplicateAcks++;
            if (duplicateAcks === 1) resolveDuplicateAck();
            if (duplicateAcks === 2) resolveOriginalAck();
        }
        if (node.tag === 'ack' && node.attrs.id === 'prekey-2') resolveSecondAck();
        if (node.tag === 'ack' && node.attrs.id === 'prekey-bad') resolveInvalidAck();
        return undefined;
    });
    const notification = (id, value) => ({ tag: 'notification',
        attrs: { id, from: '@s.whatsapp.net', type: 'encrypt', t: '100' },
        content: [{ tag: 'count', attrs: value === undefined ? {} : { value } }] });
    sock.ws.emit('CB:notification', notification('prekey-1', '1'));
    await querySeen;
    sock.ws.emit('CB:notification', notification('prekey-1', '1'));
    await duplicateAck;
    assert.equal(uploads, 1);
    sock.ws.emit(`TAG:${firstQueryId}`, { tag: 'iq', attrs: { type: 'result' }, content: [] });
    await originalAck;
    sock.ws.emit('CB:notification', notification('prekey-2', '1'));
    await secondAck;
    assert.equal(uploads, 2, 'new notification can upload immediately');
    sock.ws.emit('CB:notification', notification('prekey-bad', undefined));
    await invalidAck;
    assert.equal(uploads, 2, 'missing count cannot cause an upload');
});

test('socket close: timer retry manager dihentikan dan tidak bisa dijadwalkan ulang', { timeout: 5000 }, async (t) => {
    const { sock } = await localTransport(t, { fireInitQueries: false }, makeWASocket);
    let fired = 0;
    const manager = sock.messageRetryManager;
    manager.addRecentMessage('peer@s.whatsapp.net', 'old', { conversation: 'old' });
    assert.ok(manager.getRecentMessage('peer@s.whatsapp.net', 'old'));
    manager.schedulePhoneRequest('one', () => { fired++; }, 30);
    await sock.end();
    assert.equal(manager.getRecentMessage('peer@s.whatsapp.net', 'old'), undefined);
    // Simulate callbacks which finish after socket end: no cache/timers recreated.
    manager.addRecentMessage('peer@s.whatsapp.net', 'late', { conversation: 'late' });
    assert.equal(manager.getRecentMessage('peer@s.whatsapp.net', 'late'), undefined);
    assert.equal(manager.incrementRetryCount('late'), 0);
    assert.equal(manager.shouldRecreateSession('peer@s.whatsapp.net', false).recreate, false);
    manager.schedulePhoneRequest('two', () => { fired++; }, 30);
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(fired, 0);
});

test('dekripsi gagal PreKey: kirim retry receipt tanpa eager upload pre-key', { timeout: 5000 }, async (t) => {
    const repo = {
        lidMapping: { getLIDForPN: async () => null, close() {} },
        decryptMessage: async () => { throw new Error('Invalid PreKey ID'); },
        close() {},
    };
    const { sock, state } = await localTransport(t, { fireInitQueries: false, retryRequestDelayMs: 0,
        makeSignalRepository: () => repo }, makeWASocket);
    state.creds.me = { id: '628123:1@s.whatsapp.net', lid: '777:1@lid' };
    state.creds.account = {};
    let uploads = 0;
    let resolveReceipt, resolveAck;
    const receipt = new Promise(resolve => { resolveReceipt = resolve; });
    const ack = new Promise(resolve => { resolveAck = resolve; });
    respondToLocalQueries(sock, node => {
        if (node.tag === 'iq' && node.attrs.xmlns === 'encrypt') {
            uploads++;
            return { tag: 'iq', attrs: { type: 'result' }, content: [] };
        }
        if (node.tag === 'receipt' && node.attrs.type === 'retry') resolveReceipt();
        if (node.tag === 'ack' && node.attrs.class === 'message') resolveAck();
        return undefined;
    });
    sock.ws.emit('CB:message', { tag: 'message', attrs: {
        id: 'failed-message-1', from: '628456@s.whatsapp.net', type: 'text', t: String(Math.floor(Date.now() / 1000)),
    }, content: [{ tag: 'enc', attrs: { type: 'pkmsg', v: '2' }, content: Buffer.from('synthetic') }] });
    await Promise.all([receipt, ack]);
    assert.equal(uploads, 0);
});

test('fetch headers: tuple array dan duplikasi casing tidak mengaktifkan Brotli', () => {
    const arrayHeaders = withSafeFetchHeaders([['X-Token', 'value'], ['Accept-Encoding', 'gzip, br ; q=1']]);
    assert.equal(arrayHeaders['X-Token'], 'value');
    assert.equal(arrayHeaders['Accept-Encoding'], 'gzip');
    const headers = withSafeFetchHeaders({ 'Accept-Encoding': 'gzip, *;q=1', 'accept-encoding': 'Br;q=1, deflate' });
    const encodings = Object.entries(headers).filter(([name]) => name.toLowerCase() === 'accept-encoding');
    assert.equal(encodings.length, 1);
    assert.equal(encodings[0][1], 'gzip, deflate');
    const tuples = withSafeFetchHeaders([
        ['Accept-Encoding', 'gzip'], ['Accept-Encoding', 'br, deflate'], ['accept-encoding', '*'],
    ]);
    assert.equal(tuples['Accept-Encoding'], 'gzip, deflate');
    assert.deepEqual(withSafeFetchHeaders(new Headers({ 'Accept-Encoding': 'br, gzip' })), { 'accept-encoding': 'gzip' });
    assert.deepEqual(withSafeFetchHeaders([['Accept-Encoding', 'br, *']]), { 'Accept-Encoding': 'gzip, deflate' });
});

test('media fetch: redirect error mencegah request ke tujuan redirect', { timeout: 5000 }, async (t) => {
    let destinationRequests = 0;
    const server = http.createServer((req, res) => {
        if (req.url === '/start') { res.writeHead(302, { location: '/destination' }); res.end(); }
        else { destinationRequests++; res.end('local'); }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => { server.closeAllConnections?.(); server.close(); });
    const url = `http://127.0.0.1:${server.address().port}/start`;
    await assert.rejects(getHttpStream(url, { redirect: 'error' }));
    assert.equal(destinationRequests, 0);
    const stream = await getHttpStream(url);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).toString(), 'local');
    assert.equal(destinationRequests, 1, 'default remains compatible and follows redirects');
});

test('socket close: cache milik aplikasi tidak ditutup atau dihapus oleh socket', { timeout: 5000 }, async (t) => {
    const names = ['userDevicesCache', 'msgRetryCounterCache', 'callOfferCache', 'placeholderResendCache'];
    const supplied = {};
    const closeCalls = {};
    for (const name of names) {
        const cache = new NodeCache({ stdTTL: 60, useClones: false });
        cache.set('ownership-test', name);
        const close = cache.close.bind(cache);
        closeCalls[name] = 0;
        cache.close = (...args) => { closeCalls[name]++; return close(...args); };
        supplied[name] = cache;
    }
    t.after(() => { for (const cache of Object.values(supplied)) cache.close(); });
    const { sock } = await localTransport(t, { fireInitQueries: false, ...supplied }, makeWASocket);
    await sock.end();
    for (const name of names) {
        assert.equal(closeCalls[name], 0, `${name} is application-owned`);
        assert.equal(supplied[name].get('ownership-test'), name);
    }
});

test('IPv4 dispatcher: native fetch memakai family 4 pada Node runtime', { timeout: 5000 }, async (t) => {
    const server = http.createServer((req, res) => res.end(req.socket.remoteFamily));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { fetchAgent } = makeSocketNetworkOptions();
    t.after(async () => {
        await fetchAgent.destroy();
        server.closeAllConnections?.();
        await new Promise(resolve => server.close(resolve));
    });
    const original = dns.lookup;
    const families = [];
    t.mock.method(dns, 'lookup', (host, options, callback) => {
        if (host !== 'ipv4-test.invalid') return original.call(dns, host, options, callback);
        families.push(options.family);
        if (options.all) return callback(null, [{ address: '127.0.0.1', family: 4 }]);
        return callback(null, '127.0.0.1', 4);
    });
    const response = await fetch(`http://ipv4-test.invalid:${server.address().port}/`, { dispatcher: fetchAgent });
    assert.equal(await response.text(), 'IPv4');
    assert.deepEqual(families, [4]);
});

test('IPv4 dispatcher: uploader meneruskan dispatcher ke fetch', async (t) => {
    const { fetchAgent } = makeSocketNetworkOptions();
    t.after(() => fetchAgent.destroy());
    let seen;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        seen = { url: String(url), options };
        return Response.json({ url: 'https://cdn.whatsapp.net/example', direct_path: '/example' });
    });
    const upload = getWAUploadToServer({ customUploadHosts: [], fetchAgent, logger: quiet, options: {} }, async () => ({
        hosts: [{ hostname: 'cdn.whatsapp.net' }], auth: 'test', ttl: 300, fetchDate: new Date(),
    }));
    const result = await upload(Buffer.from('media'), { mediaType: 'image', fileEncSha256B64: 'YWJj' });
    assert.equal(seen.options.dispatcher, fetchAgent);
    assert.equal(seen.options.method, 'POST');
    assert.equal(result.directPath, '/example');
});

test('IPv4 dispatcher: wrapper menutup miliknya, bukan dispatcher aplikasi', { timeout: 5000 }, async (t) => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    const originalDestroy = UndiciAgent.prototype.destroy;
    const destroyed = new Set();
    t.mock.method(UndiciAgent.prototype, 'destroy', function (...args) {
        destroyed.add(this);
        return originalDestroy.apply(this, args);
    });
    const custom = new UndiciAgent({ connect: { family: 4 } });
    const clients = [];
    const dirs = [];
    t.after(async () => {
        for (const client of clients) client.close();
        for (const peer of server.clients) peer.terminate();
        await new Promise(resolve => server.close(resolve));
        await custom.destroy();
        for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    });
    const create = async (extra = {}) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-dispatcher-')); dirs.push(dir);
        const connected = once(server, 'connection', { signal: AbortSignal.timeout(2500) });
        const client = await createBibzWhats({ authDir: dir, banner: false, logger: quiet, fetchLatestVersion: false,
            socketConfig: { waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`,
                fireInitQueries: false, autoFollowChannel: false, ...extra } });
        clients.push(client);
        await connected;
        await client.sock.waitForSocketOpen();
        return client;
    };
    const own = await create();
    await own.sock.end(); own.close();
    assert.equal(destroyed.size, 1, 'owned dispatcher released');
    const overridden = await create({ fetchAgent: custom });
    await overridden.sock.end(); overridden.close();
    assert.equal(destroyed.size, 1, 'caller-owned dispatcher is not destroyed');
    assert.ok(!destroyed.has(custom));
    const badDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-dispatcher-bad-')); dirs.push(badDir);
    await assert.rejects(createBibzWhats({ authDir: badDir, banner: false, logger: quiet, fetchLatestVersion: false,
        socketConfig: { autoFollowChannelJid: 'invalid' } }), /autoFollowChannelJid/);
    assert.equal(destroyed.size, 2, 'owned dispatcher is released if socket construction fails');
});

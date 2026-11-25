import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { createBibzWhats, useMultiFileAuthState } from '../lib/index.js';

const silent = { info() {}, warn() {}, error() {}, ok() {}, debug() {} };
const offline = { waWebSocketUrl: 'ws://127.0.0.1:9/ws/chat', connectTimeoutMs: 300, banner: false, autoFollowChannel: false };

async function temporary(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'whatsbibz-auth-offline-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    return root;
}

test('auth files use private permissions and atomic replacement while readers and writers overlap', async (t) => {
    const dir = path.join(await temporary(t), 'new-session');
    const auth = await useMultiFileAuthState(dir, { strict: true });
    await auth.saveCreds();
    const file = path.join(dir, 'session-synthetic.json');
    const key = (i) => ({ generation: i, payload: String(i).repeat(128 * 1024) });
    await auth.state.keys.set({ session: { synthetic: key(0) } });
    if (process.platform !== 'win32') {
        assert.equal((await fs.stat(dir)).mode & 0o777, 0o700);
        assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
        assert.equal((await fs.stat(path.join(dir, 'creds.json'))).mode & 0o777, 0o600);
    }
    const writes = Array.from({ length: 24 }, (_, i) => auth.state.keys.set({ session: { synthetic: key(i + 1) } }));
    const reads = Array.from({ length: 100 }, async () => {
        const value = JSON.parse(await fs.readFile(file, 'utf8'));
        assert.ok(Number.isInteger(value.generation));
        assert.equal(value.payload, String(value.generation).repeat(128 * 1024));
    });
    await Promise.all([...writes, ...reads]);
    assert.equal((await auth.state.keys.get('session', ['synthetic'])).synthetic.generation, 24);
    assert.ok((await fs.readdir(dir)).every((name) => !name.endsWith('.tmp')));
});

test('a failed serialization leaves the old auth file intact and no temporary files', async (t) => {
    const dir = await temporary(t);
    const auth = await useMultiFileAuthState(dir);
    await auth.state.keys.set({ session: { synthetic: { value: 'original' } } });
    const file = path.join(dir, 'session-synthetic.json');
    const original = await fs.readFile(file, 'utf8');
    const circular = {}; circular.self = circular;
    await assert.rejects(auth.state.keys.set({ session: { synthetic: circular } }), /circular/i);
    assert.equal(await fs.readFile(file, 'utf8'), original);
    // Make the target a directory so write succeeds but the final rename fails.
    await fs.mkdir(path.join(dir, 'session-blocked.json'));
    await assert.rejects(auth.state.keys.set({ session: { blocked: { value: 'not-written' } } }));
    assert.ok((await fs.stat(path.join(dir, 'session-blocked.json'))).isDirectory());
    assert.ok((await fs.readdir(dir)).every((name) => !name.endsWith('.tmp')));
});

test('awaiting client.close drains credential saves, notifies other socket listeners, and preserves auth', async (t) => {
    const dir = await temporary(t);
    const client = await createBibzWhats({ authDir: dir, preserveSession: true, logger: silent, fetchLatestVersion: false, socketConfig: offline });
    const sock = client.sock;
    let observedClose = 0, reconnects = 0;
    sock.ev.on('connection.update', (update) => { if (update.connection === 'close') observedClose++; });
    client.on('reconnecting', () => reconnects++);
    sock.authState.creds.offlinePersistenceMarker = 'saved-before-close';
    sock.ev.emit('creds.update', { offlinePersistenceMarker: 'saved-before-close' });
    const close1 = client.close();
    const close2 = client.close();
    assert.equal(close1, close2, 'all callers share one close completion');
    await close1;
    const saved = JSON.parse(await fs.readFile(path.join(dir, 'creds.json'), 'utf8'));
    assert.equal(saved.offlinePersistenceMarker, 'saved-before-close');
    assert.equal(observedClose, 1, 'other socket consumers still see shutdown');
    assert.equal(reconnects, 0);
    assert.ok((await fs.readdir(dir)).every((name) => !name.endsWith('.tmp')));
});

test('concurrent socket.end calls wait for the same asynchronous cleanup', async (t) => {
    const dir = await temporary(t);
    const client = await createBibzWhats({ authDir: dir, preserveSession: true, logger: silent, fetchLatestVersion: false, socketConfig: offline });
    const sock = client.sock;
    let release;
    const barrier = new Promise((resolve) => { release = resolve; });
    sock.registerSocketEndHandler(() => barrier);
    const first = sock.end();
    const second = sock.end();
    assert.equal(first, second);
    let settled = false; void second.then(() => { settled = true; });
    await delay(30);
    assert.equal(settled, false);
    release();
    await first;
    assert.equal(settled, true);
    await client.close();
});

test('throwing connection listener cannot prevent socket event-buffer cleanup', { timeout: 8_000 }, async (t) => {
    const dir = await temporary(t);
    const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await once(server, 'listening');
    const accepted = once(server, 'connection');
    const client = await createBibzWhats({ authDir: dir, preserveSession: true, logger: silent, fetchLatestVersion: false,
        socketConfig: { ...offline, waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`, connectTimeoutMs: 5_000 } });
    try {
        await accepted;
        const sock = client.sock;
        let lateEvents = 0;
        sock.ev.buffer(); // start the buffer timer, which must be cleared
        sock.ev.on('messages.upsert', () => { lateEvents++; });
        sock.ev.on('connection.update', (update) => { if (update.connection === 'close') throw new Error('synthetic listener error'); });
        await assert.rejects(sock.end(), /synthetic listener error/);
        assert.equal(sock.ev.isBuffering(), false);
        sock.ev.emit('messages.upsert', { type: 'notify', messages: [] });
        assert.equal(lateEvents, 0, 'destroy removes all event-buffer listeners');
        await client.close(); // wrapper absorbs socket-close failure, stops any reconnect
    } finally {
        await client.close();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('preservation mode stops reconnect when the latest credential save fails', { timeout: 8_000 }, async (t) => {
    const dir = await temporary(t);
    // A local WebSocket keeps the socket open until we deliberately trigger a
    // reconnect. It receives no real WhatsApp credentials and uses no network.
    const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await once(server, 'listening');
    const accepted = once(server, 'connection');
    const logErrors = [];
    let reportFailure;
    const failedSave = new Promise((resolve) => { reportFailure = resolve; });
    const logger = { ...silent, error: (message) => {
        logErrors.push(message);
        if (/gagal menyimpan kredensial/.test(String(message))) reportFailure();
    } };
    const client = await createBibzWhats({ authDir: dir, preserveSession: true, logger, fetchLatestVersion: false,
        reconnectStepMs: 100, reconnectMaxMs: 100,
        socketConfig: { ...offline, waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`, connectTimeoutMs: 5_000 } });
    try {
        await accepted;
        await fs.mkdir(path.join(dir, 'creds.json')); // block rename after a temporary write
        const giveUp = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('give-up was not emitted')), 4_000);
            client.once('give-up', (message) => { clearTimeout(timeout); resolve(message); });
        });
        client.sock.ev.emit('creds.update', { offlinePersistenceMarker: 'must-not-disappear' });
        await failedSave;
        client.sock.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 408 }, message: 'synthetic' } } });
        const message = await giveUp;
        assert.match(message, /gagal menyimpan kredensial/);
        assert.equal(client.sock, client.initialSock, 'no new socket uses stale credentials');
        assert.ok(logErrors.some((value) => /gagal menyimpan kredensial/.test(String(value))));
        assert.ok((await fs.stat(path.join(dir, 'creds.json'))).isDirectory());
        assert.ok((await fs.readdir(dir)).every((name) => !name.endsWith('.tmp')));
    } finally {
        await client.close();
        await new Promise((resolve) => server.close(resolve));
    }
});

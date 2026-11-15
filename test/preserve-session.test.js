import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBibzWhats, useMultiFileAuthState } from '../lib/index.js';

const silent = { info() {}, warn() {}, error() {}, ok() {}, debug() {} };
const offline = { waWebSocketUrl: 'ws://127.0.0.1:9/ws/chat', connectTimeoutMs: 300 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-preserve-'));

test('strict auth reuses valid credentials and rejects damaged or partial auth without replacing it', async () => {
    const dir = tmp();
    try {
        const first = await useMultiFileAuthState(dir, { strict: true });
        await first.saveCreds();
        const original = fs.readFileSync(path.join(dir, 'creds.json'));
        const again = await useMultiFileAuthState(dir, { strict: true });
        assert.deepEqual(again.state.creds.noiseKey.public, first.state.creds.noiseKey.public);
        assert.deepEqual(fs.readFileSync(path.join(dir, 'creds.json')), original);
        const missingIdentity = JSON.parse(original.toString('utf8'));
        missingIdentity.registered = true;
        delete missingIdentity.me;
        fs.writeFileSync(path.join(dir, 'creds.json'), JSON.stringify(missingIdentity));
        await assert.rejects(useMultiFileAuthState(dir, { strict: true }), /credentials are invalid/);
        fs.writeFileSync(path.join(dir, 'creds.json'), '{damaged');
        await assert.rejects(useMultiFileAuthState(dir, { strict: true }), /Cannot read or parse auth data/);
        assert.equal(fs.readFileSync(path.join(dir, 'creds.json'), 'utf8'), '{damaged');
        fs.writeFileSync(path.join(dir, 'creds.json'), '{}');
        await assert.rejects(useMultiFileAuthState(dir, { strict: true }), /credentials are invalid/);
        fs.unlinkSync(path.join(dir, 'creds.json'));
        fs.writeFileSync(path.join(dir, 'session-partial.json'), '{}');
        await assert.rejects(useMultiFileAuthState(dir, { strict: true }), /missing or invalid/);
        assert.equal(fs.existsSync(path.join(dir, 'session-partial.json')), true);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('strict auth refuses malformed signal-key JSON instead of treating it as absent', async () => {
    const dir = tmp();
    try {
        const auth = await useMultiFileAuthState(dir, { strict: true });
        await auth.saveCreds();
        fs.writeFileSync(path.join(dir, 'session-abc.json'), '{damaged');
        await assert.rejects(auth.state.keys.get('session', ['abc']), /Cannot read or parse auth data/);
        assert.equal(fs.readFileSync(path.join(dir, 'session-abc.json'), 'utf8'), '{damaged');
        assert.deepEqual(await auth.state.keys.get('session', ['missing']), { missing: null });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

for (const status of [401, 411, 500]) {
    test(`preserveSession stops instead of wiping or retrying on ${status}`, async () => {
        const dir = tmp();
        let client;
        try {
            const marker = path.join(dir, 'keep.marker');
            // Start with a dedicated empty auth dir, then create a marker once
            // the strict auth state has been initialized.
            client = await createBibzWhats({
                phone: '447700900999', authDir: dir, preserveSession: true,
                wipeOnBadSession: true, logger: silent, fetchLatestVersion: false,
                socketConfig: offline,
            });
            fs.writeFileSync(marker, 'must remain');
            let wiped = false;
            let gaveUp = false;
            let reconnects = 0;
            client.on('session-wiped', () => { wiped = true; });
            client.on('give-up', () => { gaveUp = true; });
            client.on('reconnecting', () => { reconnects += 1; });
            client.sock.authState.creds.registered = true;
            client.sock.ev.emit('connection.update', {
                connection: 'close', lastDisconnect: { error: { output: { statusCode: status }, message: 'test' } },
            });
            await sleep(100);
            assert.equal(gaveUp, true);
            assert.equal(wiped, false);
            assert.equal(reconnects, 0);
            assert.equal(fs.readFileSync(marker, 'utf8'), 'must remain');
        } finally {
            client?.close();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
}

test('preserveSession refuses a corrupt creds file at startup without wiping it', async () => {
    const dir = tmp();
    try {
        const file = path.join(dir, 'creds.json');
        fs.writeFileSync(file, '{damaged');
        await assert.rejects(createBibzWhats({ authDir: dir, preserveSession: true, logger: silent, fetchLatestVersion: false, socketConfig: offline }), /sesi dipertahankan/);
        assert.equal(fs.readFileSync(file, 'utf8'), '{damaged');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

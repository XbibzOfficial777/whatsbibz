// Siklus hidup createBibzWhats OFFLINE: close() harus membatalkan reconnect terjadwal,
// tidak meninggalkan timer, dan tidak membuat socket baru setelah ditutup.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBibzWhats } from '../lib/index.js';

const silent = { info() {}, warn() {}, error() {}, ok() {}, debug() {} };
const offline = { waWebSocketUrl: 'ws://127.0.0.1:9/ws/chat', connectTimeoutMs: 300 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timeouts = () => process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;

test('close() membatalkan reconnect terjadwal & tidak meninggalkan timer', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-lc-'));
    const before = timeouts();
    const sockets = [];
    const client = await createBibzWhats({ phone: '447700900999', authDir: dir, logger: silent, fetchLatestVersion: false, socketConfig: offline });
    client.on('socket', (s) => sockets.push(s));
    // tunggu reconnect dijadwalkan (timer sleep kita sendiri dibersihkan agar tidak ikut terhitung)
    await new Promise((resolve) => {
        const guard = setTimeout(resolve, 3000);
        client.once('reconnecting', () => { clearTimeout(guard); resolve(); });
    });
    assert.equal(timeouts(), before + 1, 'tepat satu timer reconnect harus terjadwal');
    client.close();
    await sleep(50);
    assert.equal(timeouts(), before, 'timer reconnect harus dibatalkan oleh close()');
    const n = sockets.length;
    await sleep(1500);
    assert.equal(sockets.length, n, 'tidak boleh ada socket baru setelah close()');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('20 siklus create→close tidak mengakumulasi timer', async () => {
    const before = timeouts();
    for (let i = 0; i < 20; i++) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-lc-'));
        const c = await createBibzWhats({ phone: '447700900999', authDir: dir, logger: silent, fetchLatestVersion: false, socketConfig: offline });
        await sleep(60);
        c.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
    await sleep(100);
    assert.ok(timeouts() <= before + 1, `timer tersisa: ${timeouts() - before}`);
});

test('close() sebelum koneksi pertama selesai tetap aman & idempoten', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-lc-'));
    const c = await createBibzWhats({ phone: '447700900999', authDir: dir, logger: silent, fetchLatestVersion: false, socketConfig: offline });
    c.close(); c.close();
    await sleep(500);
    assert.equal(typeof c.identity.mode, 'string');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('folder sesi dihapus saat client masih hidup → tidak ada unhandled rejection (proses tidak mati)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-lc-'));
    const unhandled = [];
    const onUnhandled = (e) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    const c = await createBibzWhats({ phone: '447700900999', authDir: dir, logger: silent, fetchLatestVersion: false, socketConfig: offline });
    fs.rmSync(dir, { recursive: true, force: true });          // folder hilang di tengah jalan
    c.sock.ev.emit('creds.update', { registered: false });       // pemicu simpan kredensial
    await sleep(300);
    c.close();
    await sleep(100);
    process.off('unhandledRejection', onUnhandled);
    assert.deepEqual(unhandled.map((e) => e?.code), [], 'ENOENT harus ditangani, bukan unhandled');
});

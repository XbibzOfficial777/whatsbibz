// Identitas platform — LIVE (opsional). Dijalankan hanya bila BIBZ_LIVE=1:
//   BIBZ_LIVE=1 node --test test/identity-live.test.js
// Membuka koneksi nyata ke web.whatsapp.com dengan kredensial baru, menunggu QR
// (bukti handshake Noise + ClientPayload registrasi diterima), lalu meminta pairing
// code ke nomor FIKTIF (rentang drama Ofcom +44 7700 900xxx — tidak pernah dialokasikan,
// server tetap memvalidasi companion_platform_display dan menjawab result/400).
// Tidak ada HP yang menerima notifikasi; tidak ada sesi yang disimpan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pino from 'pino';
import makeWASocket, { initAuthCreds, makeCacheableSignalKeyStore, Browsers, fetchLatestWaWebVersion, DisconnectReason, createBibzWhats, loadIdentityState } from '../lib/index.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Boom } from '@hapi/boom';

const LIVE = process.env.BIBZ_LIVE === '1';
const logger = pino({ level: 'silent' });
const memKeys = () => {
    const m = new Map();
    return {
        get: async (t, ids) => Object.fromEntries(ids.map((i) => [i, m.get(`${t}:${i}`)]).filter(([, v]) => v !== undefined)),
        set: async (d) => { for (const t in d) for (const i in d[t]) { const v = d[t][i]; v ? m.set(`${t}:${i}`, v) : m.delete(`${t}:${i}`); } },
    };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = Number(process.env.BIBZ_LIVE_SEQ || Math.floor(Math.random() * 800));
const nextPhone = () => String(447700900100 + (seq++ % 900));

async function probe({ browser, syncFullHistory = false, extra = {}, pair = true }) {
    const { version } = await fetchLatestWaWebVersion({});
    const creds = initAuthCreds();
    const sock = makeWASocket({
        version, logger, browser, syncFullHistory, printQRInTerminal: false,
        auth: { creds, keys: makeCacheableSignalKeyStore(memKeys(), logger) },
        pairingRequestTimeoutMs: 20000, connectTimeoutMs: 30000, ...extra,
    });
    const out = { qr: false, pair: null, code: null, error: null };
    try {
        await Promise.race([
            new Promise((res, rej) => sock.ev.on('connection.update', (u) => {
                if (u.qr) res(u.qr);
                if (u.connection === 'close') rej(u.lastDisconnect?.error || new Error('closed'));
            })),
            sleep(30000).then(() => { throw new Error('QR timeout'); }),
        ]);
        out.qr = true;
        if (pair) {
            try { out.code = await sock.requestPairingCode(nextPhone()); out.pair = 'accepted'; }
            catch (e) { out.pair = typeof e?.data === 'number' ? e.data : (e?.output?.statusCode ?? e?.message); }
        }
    } catch (e) {
        out.error = `${e?.output?.statusCode ?? ''} ${e?.message ?? e}`.trim();
    } finally {
        try { sock.end(new Boom('probe done', { statusCode: DisconnectReason.connectionClosed })); } catch {}
        await sleep(1500);
    }
    return out;
}

test('LIVE: Browsers.macOS("Chrome") — QR diterima & pairing code diakui server', { skip: !LIVE }, async () => {
    const r = await probe({ browser: Browsers.macOS('Chrome') });
    assert.equal(r.qr, true, r.error);
    assert.equal(r.pair, 'accepted');
    assert.match(r.code, /^[A-Z0-9]{8}$/);
});

test('LIVE: Browsers.archLinux("Chrome") — display otomatis "Chrome (Linux)" lolos validasi', { skip: !LIVE }, async () => {
    const r = await probe({ browser: Browsers.archLinux('Chrome') });
    assert.equal(r.qr, true, r.error);
    assert.equal(r.pair, 'accepted');
});

test('LIVE: Browsers.macOS("Desktop") + syncFullHistory — tidak lagi 428 (WEB_BROWSER), pairing OK', { skip: !LIVE }, async () => {
    const r = await probe({ browser: Browsers.macOS('Desktop'), syncFullHistory: true });
    assert.equal(r.qr, true, r.error);
    assert.equal(r.pair, 'accepted');
});

test('LIVE: override companionPlatformDisplay "Chrome (Arch Linux)" DITOLAK 400 (kontrol negatif)', { skip: !LIVE }, async () => {
    const r = await probe({ browser: Browsers.archLinux('Chrome'), extra: { companionPlatformDisplay: 'Chrome (Arch Linux)' } });
    assert.equal(r.qr, true, r.error);
    assert.equal(r.pair, 400);
});

test('LIVE: webSubPlatform DARWIN paksa → handshake diputus 428 sebelum QR (kontrol negatif)', { skip: !LIVE }, async () => {
    const r = await probe({ browser: Browsers.macOS('Desktop'), syncFullHistory: true, extra: { webSubPlatform: 'DARWIN' }, pair: false });
    assert.equal(r.qr, false);
    assert.match(r.error, /428/);
});

// ───────────── createBibzWhats: mode otomatis & kustom (end-to-end ke server) ─────────────
const silentLog = { info() {}, warn() {}, error() {}, ok() {}, debug() {} };
async function runClient(extra, waitMs) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-live-'));
    const ev = [];
    const client = await createBibzWhats({ phone: nextPhone(), pairingCode: 'XBIBZPRO', authDir: dir, logger: silentLog,
        pairingRequestDelayMs: 1500, restartDelayMs: 1000, ...extra });
    client.on('identity-changed', (i) => ev.push(['identity-changed', i.profileId, i.reason]));
    client.on('pairing-code', (c) => ev.push(['pairing-code', c]));
    client.on('close', (i) => ev.push(['close', i?.status]));
    await sleep(waitMs);
    const out = { identity: client.identity, ev, saved: loadIdentityState(dir) };
    client.close(); fs.rmSync(dir, { recursive: true, force: true }); await sleep(1500);
    return out;
}

test('LIVE auto: tanpa setelan → langsung stabil di profil pertama (Mac OS/Chrome), pairing diakui, identitas tersimpan', { skip: !LIVE }, async () => {
    const r = await runClient({}, 6000);
    assert.equal(r.identity.mode, 'auto'); assert.equal(r.identity.profileId, 'macos-chrome');
    assert.ok(r.ev.some((e) => e[0] === 'pairing-code' && e[1] === 'XBIBZPRO'), JSON.stringify(r.ev));
    assert.equal(r.identity.tried.length, 0);
    assert.equal(r.saved?.profileId, 'macos-chrome'); assert.equal(r.saved?.reason, 'pairing-accepted');
});

test('LIVE auto: profil pertama ditolak saat handshake (428 sebelum QR) → otomatis pindah ke profil berikutnya & pairing OK', { skip: !LIVE }, async () => {
    let once = true;
    const r = await runClient({ socketConfig: { syncFullHistory: true, get webSubPlatform() { if (once) { once = false; return 'DARWIN'; } return undefined; } } }, 10000);
    assert.deepEqual(r.identity.tried.map((t) => t.id), ['macos-chrome']);
    assert.equal(r.identity.profileId, 'macos-safari');
    assert.ok(r.ev.some((e) => e[0] === 'identity-changed' && e[1] === 'macos-safari'));
    assert.ok(r.ev.some((e) => e[0] === 'pairing-code'), JSON.stringify(r.ev));
    assert.equal(r.saved?.profileId, 'macos-safari');
});

test('LIVE auto: profil pertama ditolak saat pairing kode (400) → pindah profil, sambung ulang, pairing OK', { skip: !LIVE }, async () => {
    let once = true;
    const r = await runClient({ socketConfig: { get companionPlatformDisplay() { if (once) { once = false; return 'Chrome (Arch Linux)'; } return undefined; } } }, 9000);
    assert.deepEqual(r.identity.tried.map((t) => t.reason), ['400 bad-request saat pairing kode']);
    assert.equal(r.identity.profileId, 'macos-safari');
    assert.ok(r.ev.some((e) => e[0] === 'pairing-code'), JSON.stringify(r.ev));
});

test('LIVE kustom: Arch Linux/Chrome dipakai apa adanya; pairing diakui dengan display "Chrome (Linux)"', { skip: !LIVE }, async () => {
    const r = await runClient({ identity: 'archLinux:Chrome' }, 6000);
    assert.equal(r.identity.mode, 'custom'); assert.equal(r.identity.linkedDeviceName, 'Chrome (Arch Linux)');
    assert.equal(r.identity.pairingDisplay, 'Chrome (Linux)');
    assert.ok(r.ev.some((e) => e[0] === 'pairing-code'), JSON.stringify(r.ev));
    assert.equal(r.identity.tried.length, 0);
});

test('LIVE kustom: identitas yang ditolak server TIDAK diganti diam-diam (tidak ada identity-changed)', { skip: !LIVE }, async () => {
    const r = await runClient({ identity: ['Mac OS', 'Desktop', '15.6.1'], socketConfig: { syncFullHistory: true, webSubPlatform: 'DARWIN' } }, 4000);
    assert.equal(r.identity.mode, 'custom');
    assert.ok(r.ev.some((e) => e[0] === 'close' && e[1] === 428));
    assert.ok(!r.ev.some((e) => e[0] === 'identity-changed'));
    assert.equal(r.identity.linkedDeviceName, 'Desktop (Mac OS)');
});

test('LIVE ketahanan: socket diputus paksa setelah pairing code terbit → sambung ulang cepat, 401 "pairing tertunda" ditangani, kode diminta ulang', { skip: !LIVE }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-live-'));
    const ev = []; const t0 = Date.now();
    const client = await createBibzWhats({ phone: nextPhone(), pairingCode: 'XBIBZPRO', authDir: dir, logger: silentLog, pairingRequestDelayMs: 1500, restartDelayMs: 1000 });
    client.on('pairing-code', (c) => ev.push(['pairing-code', c, Date.now() - t0]));
    client.on('reconnecting', (r) => ev.push(['reconnecting', r.delay, r.fresh, !!r.pairingPending]));
    client.on('session-wiped', (r) => ev.push(['session-wiped', r]));
    client.on('give-up', (m) => ev.push(['give-up', m]));
    let cut = false; client.on('pairing-code', () => { if (!cut) { cut = true; setTimeout(() => client.sock?.ws?.close(), 1500); } });
    await sleep(16000);
    client.close(); fs.rmSync(dir, { recursive: true, force: true }); await sleep(1500);
    const codes = ev.filter((e) => e[0] === 'pairing-code');
    assert.ok(codes.length >= 2, 'pairing code harus diminta ulang: ' + JSON.stringify(ev));
    assert.ok(ev.some((e) => e[0] === 'reconnecting' && e[1] <= 2000 && e[2] === false), 'reconnect pertama harus cepat: ' + JSON.stringify(ev));
    assert.ok(ev.some((e) => e[0] === 'reconnecting' && e[3] === true), 'jalur pairingPending harus dipakai: ' + JSON.stringify(ev));
    assert.ok(!ev.some((e) => e[0] === 'give-up'));
    assert.ok(codes[1][2] - codes[0][2] < 15000, 'pemulihan < 15 s: ' + JSON.stringify(codes));
});

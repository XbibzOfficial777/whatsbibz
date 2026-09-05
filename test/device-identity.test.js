// Identitas perangkat tertaut: KUSTOM vs OTOMATIS (paling stabil + rotasi) — OFFLINE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    Browsers, BIBZWHATS_DEFAULTS,
    IDENTITY_PROFILES, parseBrowserSpec, identityFromEnv, resolveDeviceIdentity, defaultVersionForOs,
    createIdentityRotator, isIdentityRejection, describeIdentity,
    loadIdentityState, saveIdentityState, clearIdentityState, identityStatePath,
    createPairingController, isPairingDisplayAccepted, derivePairingDisplay,
} from '../lib/index.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bibz-id-'));

// ───────────── default = auto ─────────────
test('default createBibzWhats: identity "auto", browser null (tidak ada tuple statis lagi)', () => {
    assert.equal(BIBZWHATS_DEFAULTS.identity, 'auto');
    assert.equal(BIBZWHATS_DEFAULTS.browser, null);
    assert.equal(BIBZWHATS_DEFAULTS.maxIdentityRotations, 4);
});

test('profil otomatis: terurut skor, semua display pairing-nya valid, yang teratas Mac OS/Chrome', () => {
    const scores = IDENTITY_PROFILES.map((p) => p.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    assert.deepEqual(IDENTITY_PROFILES[0].browser, Browsers.macOS('Chrome'));
    for (const p of IDENTITY_PROFILES) assert.ok(isPairingDisplayAccepted(derivePairingDisplay(p.browser)), p.id);
    const ids = new Set(IDENTITY_PROFILES.map((p) => p.id));
    assert.equal(ids.size, IDENTITY_PROFILES.length, 'id profil unik');
});

// ───────────── parsing kustom ─────────────
test('parseBrowserSpec menerima tuple, "OS/Browser/Ver", "preset:Browser", id profil, "OS, Browser"', () => {
    assert.deepEqual(parseBrowserSpec(['Arch Linux', 'Chrome', '6.12']), ['Arch Linux', 'Chrome', '6.12']);
    assert.deepEqual(parseBrowserSpec('Mac OS/Safari/15.6.1'), ['Mac OS', 'Safari', '15.6.1']);
    assert.deepEqual(parseBrowserSpec('archLinux:Firefox'), ['Arch Linux', 'Firefox', '6.12.44']);
    assert.deepEqual(parseBrowserSpec('macos:Chrome'), ['Mac OS', 'Chrome', '15.6.1']); // preset case-insensitive
    assert.deepEqual(parseBrowserSpec('linux-chrome'), ['Linux', 'Chrome', '6.12.44']);
    assert.deepEqual(parseBrowserSpec('Windows, Edge'), ['Windows', 'Edge', '10.0.22631']);
    assert.deepEqual(parseBrowserSpec('Arch Linux | Chromium'), ['Arch Linux', 'Chromium', '6.12.44']);
    // versi kosong → diisi default sesuai OS; OS asing → 1.0.0
    assert.deepEqual(parseBrowserSpec(['Mac OS', 'Safari']), ['Mac OS', 'Safari', '15.6.1']);
    assert.equal(parseBrowserSpec('Haiku/Chrome')[2], '1.0.0');
    assert.equal(defaultVersionForOs('Windows'), '10.0.22631');
    // tidak valid
    assert.equal(parseBrowserSpec('nonsense'), null);
    assert.equal(parseBrowserSpec(''), null);
    assert.equal(parseBrowserSpec(null), null);
    assert.equal(parseBrowserSpec(['x']), null);
});

test('identityFromEnv: BIBZ_BROWSER menang; trio BIBZ_DEVICE_*; "auto"; kosong → null', () => {
    assert.deepEqual(identityFromEnv({ BIBZ_BROWSER: 'archLinux:Chrome' }), ['Arch Linux', 'Chrome', '6.12.44']);
    assert.deepEqual(identityFromEnv({ BIBZ_IDENTITY: 'Mac OS/Safari/15.6.1' }), ['Mac OS', 'Safari', '15.6.1']);
    assert.deepEqual(identityFromEnv({ BIBZ_BROWSER: 'Windows/Edge', BIBZ_DEVICE_OS: 'Arch Linux' }), ['Windows', 'Edge', '10.0.22631']);
    assert.deepEqual(identityFromEnv({ BIBZ_DEVICE_OS: 'Arch Linux', BIBZ_DEVICE_BROWSER: 'Firefox', BIBZ_DEVICE_VERSION: '6.16.4' }), ['Arch Linux', 'Firefox', '6.16.4']);
    assert.equal(identityFromEnv({ BIBZ_DEVICE_BROWSER: 'Chrome' })[1], 'Chrome'); // OS = host
    assert.equal(identityFromEnv({ BIBZ_BROWSER: 'auto' }), 'auto');
    assert.equal(identityFromEnv({ BIBZ_BROWSER: 'AUTO ' }), 'auto');
    assert.equal(identityFromEnv({}), null);
    assert.equal(identityFromEnv({ BIBZ_BROWSER: '???' }), null);
});

// ───────────── resolusi prioritas ─────────────
test('resolveDeviceIdentity: opsi > env > auto; alias lama `browser` tetap dihormati', () => {
    const a = resolveDeviceIdentity({ env: {} });
    assert.equal(a.mode, 'auto'); assert.equal(a.profileId, 'macos-chrome'); assert.deepEqual(a.browser, Browsers.macOS('Chrome'));
    assert.ok(a.candidates.length >= 5);
    assert.ok(!a.candidates.some((c) => /desktop/.test(c.id)), 'Desktop tidak ikut auto');

    const env = { BIBZ_BROWSER: 'Mac OS/Safari' };
    const b = resolveDeviceIdentity({ env });
    assert.equal(b.mode, 'custom'); assert.equal(b.source, 'env'); assert.deepEqual(b.browser, ['Mac OS', 'Safari', '15.6.1']);
    assert.equal(b.candidates.length, 1, 'kustom: tidak ada rotasi');

    const c = resolveDeviceIdentity({ identity: Browsers.archLinux('Chrome'), env });
    assert.equal(c.mode, 'custom'); assert.equal(c.source, 'options'); assert.deepEqual(c.browser, Browsers.archLinux('Chrome'));

    const d = resolveDeviceIdentity({ browser: ['Mac OS', 'Chrome', '14.4.1'], env: {} });
    assert.equal(d.mode, 'custom'); assert.deepEqual(d.browser, ['Mac OS', 'Chrome', '14.4.1']);

    const e = resolveDeviceIdentity({ identity: 'auto', env: {} });
    assert.equal(e.mode, 'auto');

    const f = resolveDeviceIdentity({ identity: 'tidak-valid', env: {} });
    assert.equal(f.mode, 'auto'); assert.ok(f.notes.some((n) => n.level === 'warn'));

    const g = resolveDeviceIdentity({ env: {}, prefer: 'linux-chrome' });
    assert.equal(g.profileId, 'linux-chrome');
});

test('resolveDeviceIdentity: identitas kustom tidak "dibetulkan" — hanya catatan info', () => {
    const r = resolveDeviceIdentity({ identity: ['BibzWhats', 'Chrome', '1.2.0'], env: {} });
    assert.deepEqual(r.browser, ['BibzWhats', 'Chrome', '1.2.0']);
    assert.ok(r.notes.some((n) => n.level === 'info' && /allow-list/.test(n.message)));
    const d = resolveDeviceIdentity({ identity: Browsers.macOS('Desktop'), env: {} });
    assert.ok(d.notes.some((n) => /Desktop/.test(n.message)));
});

// ───────────── persistensi ─────────────
test('identity.json: simpan/baca/hapus; auto melanjutkan profil tersimpan setelah restart', () => {
    const dir = tmpDir();
    assert.equal(loadIdentityState(dir), null);
    assert.ok(saveIdentityState(dir, { browser: Browsers.macOS('Safari'), profileId: 'macos-safari', mode: 'auto', reason: 'open' }));
    assert.ok(fs.existsSync(identityStatePath(dir)));
    const r = resolveDeviceIdentity({ env: {}, authDir: dir });
    assert.equal(r.profileId, 'macos-safari'); assert.equal(r.source, 'auto+saved');
    assert.equal(r.candidates[0].id, 'macos-safari'); assert.equal(r.candidates[1].id, 'macos-chrome');
    // profil tersimpan yang tak dikenal (mis. versi library lama) tetap didahulukan
    saveIdentityState(dir, { browser: ['Ubuntu', 'Firefox', '22.04'], profileId: 'legacy-x', mode: 'auto' });
    assert.deepEqual(resolveDeviceIdentity({ env: {}, authDir: dir }).browser, ['Ubuntu', 'Firefox', '22.04']);
    // file rusak → diabaikan
    fs.writeFileSync(identityStatePath(dir), '{not json');
    assert.equal(loadIdentityState(dir), null);
    clearIdentityState(dir); assert.ok(!fs.existsSync(identityStatePath(dir)));
    // identitas kustom mengabaikan state tersimpan
    saveIdentityState(dir, { browser: Browsers.macOS('Safari'), profileId: 'macos-safari', mode: 'auto' });
    assert.deepEqual(resolveDeviceIdentity({ env: {}, authDir: dir, identity: 'archLinux:Chrome' }).browser, Browsers.archLinux('Chrome'));
    fs.rmSync(dir, { recursive: true, force: true });
});

// ───────────── deteksi penolakan & rotator ─────────────
test('isIdentityRejection: 428 sebelum QR & 405 = ya; 428 setelah QR, 401, 408, 429, 515 = bukan; pairing 400 = ya', () => {
    assert.equal(isIdentityRejection({ status: 428, sawQr: false }), true);
    assert.equal(isIdentityRejection({ status: 428, sawQr: true }), false);
    assert.equal(isIdentityRejection({ status: 405 }), true);
    for (const s of [401, 408, 429, 515, 500, 411, undefined]) assert.equal(isIdentityRejection({ status: s, sawQr: false }), false, String(s));
    assert.equal(isIdentityRejection({ phase: 'pairing', status: 400 }), true);
    assert.equal(isIdentityRejection({ phase: 'pairing', errorData: 400 }), true);
    assert.equal(isIdentityRejection({ phase: 'pairing', status: 429 }), false);
    assert.equal(isIdentityRejection({ phase: 'pairing', status: 408 }), false);
});

test('rotator (auto): next() berpindah berurutan, menyimpan state, berhenti saat habis; markStable menyimpan alasan', () => {
    const dir = tmpDir(); const changes = []; const warns = [];
    const cands = resolveDeviceIdentity({ env: {} }).candidates.slice(0, 3);
    const rot = createIdentityRotator({ candidates: cands, authDir: dir, mode: 'auto', logger: { warn: (m) => warns.push(m) }, onChange: (c, r) => changes.push([c.id, r]) });
    assert.equal(rot.current.id, 'macos-chrome'); assert.equal(rot.exhausted, false);
    assert.equal(rot.next('428 sebelum QR'), true);
    assert.equal(rot.current.id, 'macos-safari');
    assert.deepEqual(rot.tried, [{ id: 'macos-chrome', reason: '428 sebelum QR' }]);
    assert.match(loadIdentityState(dir).reason, /rotated/);
    assert.equal(rot.next('400'), true); assert.equal(rot.current.id, 'windows-chrome'); assert.equal(rot.exhausted, true);
    assert.equal(rot.next('lagi'), false, 'kandidat habis → false');
    assert.equal(rot.current.id, 'windows-chrome');
    rot.markStable('open');
    assert.equal(loadIdentityState(dir).reason, 'open'); assert.equal(loadIdentityState(dir).profileId, 'windows-chrome');
    assert.equal(changes.length, 2); assert.equal(warns.length, 2); assert.match(warns[0], /ditolak server/);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('rotator (custom): next() selalu false — identitas pilihan pemakai tidak pernah diganti diam-diam', () => {
    const dir = tmpDir();
    const rot = createIdentityRotator({ candidates: [{ id: 'custom', browser: Browsers.archLinux('Chrome') }], authDir: dir, mode: 'custom' });
    assert.equal(rot.next('428 sebelum QR'), false);
    assert.deepEqual(rot.current.browser, Browsers.archLinux('Chrome'));
    assert.equal(rot.tried.length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('describeIdentity: nama perangkat tertaut vs display pairing', () => {
    const d = describeIdentity(Browsers.archLinux('Firefox'));
    assert.equal(d.linkedDeviceName, 'Firefox (Arch Linux)');
    assert.equal(d.pairingDisplay, 'Firefox (Linux)');
    assert.equal(d.pairingDisplayAccepted, true);
    const o = describeIdentity(Browsers.macOS('Chrome'), { companionPlatformDisplay: 'Chrome (Arch Linux)' });
    assert.equal(o.pairingDisplay, 'Chrome (Arch Linux)'); assert.equal(o.pairingDisplayAccepted, false);
});

// ───────────── PairingController.onRejected ─────────────
test('PairingController: 400 → onRejected dipanggil; true = controller berhenti (rotasi diambil alih), false = jadwal ulang biasa', async () => {
    const mkSock = () => ({ authState: { creds: { registered: false } }, requestPairingCode: async () => { const e = new Error('bad-request'); e.data = 400; throw e; } });
    const silent = { info() {}, warn() {}, error() {} };
    // diambil alih
    let calls = []; let timers = 0;
    const ft = { setTimeoutFn: () => { timers += 1; return 1; }, clearTimeoutFn: () => {} };
    const c1 = createPairingController({ sock: mkSock(), phone: '447700900000', logger: silent, ...ft, onRejected: (e, info) => { calls.push(info.code); return true; } });
    await c1.start();
    assert.deepEqual(calls, [400]); assert.equal(timers, 0, 'tidak menjadwalkan ulang');
    // tidak diambil alih → error dilog & dijadwalkan ulang
    const errors = []; timers = 0;
    const c2 = createPairingController({ sock: mkSock(), phone: '447700900000', logger: { ...silent, error: (m) => errors.push(m) }, ...ft, onRejected: () => false });
    await c2.start();
    assert.equal(timers, 1); assert.match(errors[0], /allow-list/);
    // onRejected melempar → diperlakukan seperti false (tidak menjatuhkan proses)
    timers = 0;
    const c3 = createPairingController({ sock: mkSock(), phone: '447700900000', logger: silent, ...ft, onRejected: () => { throw new Error('boom'); } });
    await c3.start(); assert.equal(timers, 1);
    // 429 TIDAK memanggil onRejected
    calls = []; timers = 0;
    const s429 = { authState: { creds: { registered: false } }, requestPairingCode: async () => { const e = new Error('rate-overlimit'); e.data = 429; throw e; } };
    const c4 = createPairingController({ sock: s429, phone: '447700900000', logger: silent, ...ft, onRejected: () => { calls.push('x'); return true; } });
    await c4.start(); assert.deepEqual(calls, []); assert.equal(timers, 1);
});

// ───────────── pemulihan "pairing tertunda" (401 setelah sambung ulang) ─────────────
import { readFileSync } from 'node:fs';
const clientSrc = readFileSync(new URL('../lib/BibzWhats/client.js', import.meta.url), 'utf8');

test('client: 401 saat pairing masih tertunda → wipe TIDAK dihitung ke maxSessionWipes & sambung ulang cepat', () => {
    assert.match(clientSrc, /pairingPending = !sock\.authState\.creds\.registered && pairingIssuedAt > 0/);
    assert.match(clientSrc, /wipeSession\('401 pairing tertunda', \{ counted: false \}\)/);
    assert.match(clientSrc, /pendingPairingWipes < opts\.maxReconnectAttempts/);
    assert.match(clientSrc, /if \(counted && wipeCount > opts\.maxSessionWipes\)/);
});

test('client: koneksi sehat (pairing sudah terbit) yang putus jaringan → percobaan pertama cepat, bukan backoff 10 s', () => {
    assert.match(clientSrc, /healthyDrop = attempts === 1 && pairingIssuedAt > 0 && status === DisconnectReason\.connectionClosed/);
    assert.match(clientSrc, /healthyDrop \? Math\.max\(opts\.restartDelayMs, 1000\)/);
});

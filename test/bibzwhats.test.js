import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makePairingQRRenderer,
  handleCompanionRegRefresh,
  createPairingController,
  normalizePairingCode,
  PAIRING_REFRESH_MS,
  wipeAuthDir,
  sessionWipeReason,
  makeSocketNetworkOptions,
  splitText,
  whatsappify,
  extractMessage,
  messageTimestampMs,
  LidMap,
  digitsOf,
  pnJid,
  lidJid,
  DisconnectReason,
  DEFAULT_CONNECTION_CONFIG,
  Browsers,
  BIBZWHATS_VERSION,
} from '../lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const silentLogger = { warn() {}, debug() {}, info() {}, error() {} };

const refreshNode = (childTag) => ({
  tag: 'notification',
  attrs: { from: '@s.whatsapp.net', id: '123', type: 'companion_reg_refresh', t: '1785369275' },
  content: childTag ? [{ tag: childTag, attrs: {}, content: null }] : [],
});

// ───────────────────────── companion_reg_refresh ─────────────────────────
test('makePairingQRRenderer: next() berurutan, refresh() tidak menggeser ref', () => {
  const rendered = [];
  const r = makePairingQRRenderer(['ref1', 'ref2', 'ref3'], (ref) => rendered.push(ref));
  assert.equal(r.refresh(), false, 'belum ada ref aktif');
  assert.equal(r.next(), true);
  assert.equal(r.refresh(), true);
  assert.equal(r.next(), true);
  assert.equal(r.refresh(), true);
  assert.deepEqual(rendered, ['ref1', 'ref1', 'ref2', 'ref2']);
  assert.equal(r.next(), true);
  assert.equal(r.next(), false, 'pool habis → false');
});

test('handleCompanionRegRefresh: rotate adv secret + render ulang QR', () => {
  const creds = { advSecretKey: 'LAMA', me: undefined };
  let emitted = null;
  let refreshed = 0;
  const out = handleCompanionRegRefresh(refreshNode('companion_reg_refresh'), {
    creds, emitCredsUpdate: (u) => (emitted = u), refreshQR: () => refreshed++, logger: silentLogger,
  });
  assert.equal(out, 'rotated');
  assert.notEqual(creds.advSecretKey, 'LAMA');
  assert.equal(Buffer.from(creds.advSecretKey, 'base64').length, 32);
  assert.equal(emitted.advSecretKey, creds.advSecretKey);
  assert.equal(refreshed, 1);
});

test('handleCompanionRegRefresh: pair-device-rotate-qr diterima; malformed & registered diabaikan', () => {
  assert.equal(handleCompanionRegRefresh(refreshNode('pair-device-rotate-qr'), {
    creds: { advSecretKey: 'x' }, emitCredsUpdate() {}, refreshQR() {}, logger: silentLogger,
  }), 'rotated');
  const creds = { advSecretKey: 'tetap', me: undefined };
  let touched = 0;
  assert.equal(handleCompanionRegRefresh(refreshNode(null), {
    creds, emitCredsUpdate: () => touched++, refreshQR: () => touched++, logger: silentLogger,
  }), 'ignored_malformed');
  const reg = { advSecretKey: 'penting', me: { id: '628@s.whatsapp.net' } };
  assert.equal(handleCompanionRegRefresh(refreshNode('companion_reg_refresh'), {
    creds: reg, emitCredsUpdate: () => touched++, refreshQR: () => touched++, logger: silentLogger,
  }), 'ignored_registered');
  assert.equal(creds.advSecretKey, 'tetap');
  assert.equal(reg.advSecretKey, 'penting');
  assert.equal(touched, 0);
});

test('socket.js memuat listener companion_reg_refresh & renderer (patch tertanam di source)', () => {
  const sock = fs.readFileSync(path.join(here, '..', 'lib', 'Socket', 'socket.js'), 'utf8');
  assert.ok(sock.includes("CB:notification,type:companion_reg_refresh"));
  assert.ok(sock.includes('makePairingQRRenderer('));
  assert.ok(sock.includes('refreshPairingQR = () =>'));
  assert.ok(!sock.includes('const advB64 = creds.advSecretKey;'), 'badan QR lama harus sudah diganti');
});

// ───────────────────────── pairing controller ─────────────────────────
function fakeTimers() {
  const timers = [];
  return {
    timers,
    setTimeoutFn(fn, delay) { const t = { fn, delay, cleared: false }; timers.push(t); return t; },
    clearTimeoutFn(t) { if (t) t.cleared = true; },
  };
}
const flush = () => new Promise((r) => setImmediate(r));

test('normalizePairingCode', () => {
  assert.equal(normalizePairingCode('xbibzpro'), 'XBIBZPRO');
  assert.equal(normalizePairingCode(' XBIBZPRO '), 'XBIBZPRO');
  assert.equal(normalizePairingCode('1234567'), '');
  assert.equal(normalizePairingCode('XBIBZP!O'), '');
  assert.equal(normalizePairingCode(null), '');
});

test('pairing: custom code diminta, refresh dijadwalkan 150s, berhenti saat registered', async () => {
  const calls = [];
  const sock = { authState: { creds: { registered: false } }, requestPairingCode: async (p, c) => { calls.push([p, c]); return c || 'RANDOM12'; } };
  const ft = fakeTimers();
  const codes = [];
  const ctl = createPairingController({ sock, phone: '628111', pairingCode: 'XBIBZPRO', onCode: (c, m) => codes.push([c, m]), logger: silentLogger, ...ft });
  await ctl.start();
  assert.deepEqual(calls, [['628111', 'XBIBZPRO']]);
  assert.deepEqual(codes, [['XBIBZPRO', { custom: true, fallback: false }]]);
  assert.equal(ft.timers.length, 1);
  assert.equal(ft.timers[0].delay, PAIRING_REFRESH_MS);
  sock.authState.creds.registered = true;
  ft.timers[0].fn();
  await flush();
  assert.equal(calls.length, 1, 'tidak request lagi setelah registered');
  assert.equal(ctl.isStopped(), true);
});

test('pairing: custom ditolak → fallback acak sekali; rate-limit → backoff 150s lalu 300s', async () => {
  let n = 0;
  const sock = {
    authState: { creds: { registered: false } },
    requestPairingCode: async (p, c) => { n++; if (c) { const e = new Error('custom pairing code rejected'); e.status = 400; throw e; } return 'RANDOM12'; },
  };
  const ft = fakeTimers();
  const codes = [];
  const ctl = createPairingController({ sock, phone: '628', pairingCode: 'XBIBZPRO', onCode: (c, m) => codes.push([c, m]), logger: silentLogger, ...ft });
  await ctl.start();
  assert.equal(n, 2);
  assert.deepEqual(codes, [['RANDOM12', { custom: false, fallback: true }]]);
  assert.equal(ctl.getState().fallbackUsed, true);

  const limited = { authState: { creds: { registered: false } }, requestPairingCode: async () => { const e = new Error('rate-overlimit'); e.output = { statusCode: 428 }; throw e; } };
  const ft2 = fakeTimers();
  const ctl2 = createPairingController({ sock: limited, phone: '628', logger: silentLogger, ...ft2 });
  await ctl2.start();
  assert.equal(ft2.timers.at(-1).delay, 150000);
  ft2.timers.at(-1).fn();
  await flush();
  assert.equal(ft2.timers.at(-1).delay, 300000);
});

test('pairing: guard in-flight mencegah request ganda', async () => {
  let resolveReq;
  const sock = { authState: { creds: { registered: false } }, requestPairingCode: () => new Promise((r) => { resolveReq = r; }) };
  const ft = fakeTimers();
  const ctl = createPairingController({ sock, phone: '628', logger: silentLogger, ...ft });
  const p1 = ctl.start();
  const p2 = ctl.trigger();
  assert.equal(await p2, null, 'request kedua ditolak selagi in-flight');
  assert.equal(ctl.isInFlight(), true);
  resolveReq('ABCD1234');
  assert.equal(await p1, 'ABCD1234');
});

// ───────────────────────── client helpers ─────────────────────────
test('wipeAuthDir & sessionWipeReason & network options', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-auth-'));
  fs.writeFileSync(path.join(dir, 'creds.json'), '{}');
  assert.equal(wipeAuthDir(dir), true);
  assert.deepEqual(fs.readdirSync(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });

  assert.equal(sessionWipeReason(DisconnectReason.loggedOut), '401 loggedOut');
  assert.equal(sessionWipeReason(500), '500 badSession');
  assert.equal(sessionWipeReason(411), '411 multideviceMismatch');
  assert.match(sessionWipeReason(undefined, 'invalid creds'), /error sesi/);
  assert.equal(sessionWipeReason(408, 'timed out'), null);

  assert.equal(makeSocketNetworkOptions().fetchAgent.options.family, 4);
  assert.deepEqual(makeSocketNetworkOptions({ forceIPv4: false }), {});
});

test('defaults: tanpa auto-follow newsletter, logger class bibzwhats, Browsers.bibzwhats', () => {
  assert.equal(DEFAULT_CONNECTION_CONFIG.autoFollowNewsletterOnConnect, false);
  assert.equal(DEFAULT_CONNECTION_CONFIG.autoFollowNewsletterJid, '');
  assert.deepEqual(Browsers.whatsbibz('Chrome'), ['WhatsBibz', 'Chrome', '1.3.2']);
  assert.deepEqual(Browsers.bibzwhats('Chrome'), Browsers.whatsbibz('Chrome'));
  assert.deepEqual(Browsers.macOS('Chrome'), ['Mac OS', 'Chrome', '15.6.1']);
  assert.deepEqual(Browsers.archLinux('Chrome'), ['Arch Linux', 'Chrome', '6.12.44']);
  assert.match(BIBZWHATS_VERSION, /^\d+\.\d+\.\d+/);
});

// ───────────────────────── send helpers ─────────────────────────
test('splitText & whatsappify', () => {
  const long = 'kata '.repeat(1000).trim();
  const parts = splitText(long, 400);
  assert.ok(parts.every((p) => p.length <= 400));
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), long);
  assert.equal(whatsappify('**tebal** dan __juga__ ~~coret~~ [x](https://a.b)'), '*tebal* dan *juga* ~coret~ x (https://a.b)');
  assert.equal(whatsappify('# Judul\n## Sub\nisi'), 'Judul\nSub\nisi', 'heading hanya di awal baris');
});

// ───────────────────────── extract ─────────────────────────
test('extractMessage: teks, extended, gambar, view-once, edited, poll, interactive response', () => {
  const key = { remoteJid: '628@s.whatsapp.net', id: '1', fromMe: false };
  assert.deepEqual(extractMessage({ key, message: { conversation: 'halo' } }), { type: 'text', text: 'halo', participant: '' });
  const ext = extractMessage({ key, message: { extendedTextMessage: { text: 'hai', contextInfo: { mentionedJid: ['1@s.whatsapp.net'], quotedMessage: { conversation: 'q' }, participant: '1@s.whatsapp.net', stanzaId: 'S1' } } } });
  assert.equal(ext.type, 'text');
  assert.deepEqual(ext.mentions, ['1@s.whatsapp.net']);
  assert.equal(ext.quoted, 'q');
  assert.equal(ext.quotedStanzaId, 'S1');
  const vo = extractMessage({ key, message: { viewOnceMessageV2: { message: { imageMessage: { caption: 'foto', mimetype: 'image/jpeg' } } } } });
  assert.equal(vo.type, 'image');
  assert.equal(vo.text, 'foto');
  const ed = extractMessage({ key, message: { editedMessage: { message: { protocolMessage: { editedMessage: { conversation: 'edit' } } } } } });
  assert.equal(ed.type, 'other', 'protocolMessage tanpa lapisan .message → other (bukan crash)');
  const ed2 = extractMessage({ key, message: { protocolMessage: { editedMessage: { message: { conversation: 'edit2' } } } } });
  assert.equal(ed2.text, 'edit2');
  const ed3 = extractMessage({ key, message: { editedMessage: { message: { conversation: 'edit3' } } } });
  assert.equal(ed3.text, 'edit3');
  const poll = extractMessage({ key, message: { pollUpdateMessage: { name: 'menu', selectedOptions: [{ optionName: 'Status' }] } } });
  assert.deepEqual(poll.pollOptions, ['Status']);
  const ir = extractMessage({ key, message: { interactiveResponseMessage: { body: { text: 'Klik' }, nativeFlowResponseMessage: { paramsJson: '{"id":"btn_status"}' } } } });
  assert.equal(ir.type, 'button');
  assert.equal(ir.buttonId, 'btn_status');
  assert.equal(extractMessage({ key, message: null }), null);
  assert.equal(messageTimestampMs({ messageTimestamp: 1700000000 }), 1700000000000);
  assert.equal(messageTimestampMs({ messageTimestamp: { low: 1700000000, high: 0 } }), 1700000000000);
});

// ───────────────────────── jid ─────────────────────────
test('LidMap & jid utils', () => {
  const map = new LidMap();
  map.learnFromMessage({ key: { remoteJid: '111@lid', remoteJidAlt: '628123@s.whatsapp.net' } });
  assert.equal(map.phoneOf('111@lid'), '628123');
  assert.equal(map.lidOf('628123@s.whatsapp.net'), '111');
  assert.equal(map.canonical('111:5@lid'), '628123@s.whatsapp.net');
  assert.deepEqual(new Set(map.variants('628123@s.whatsapp.net')), new Set(['628123@s.whatsapp.net', '111@lid']));
  assert.equal(map.canonical('120363@g.us'), '120363@g.us');
  const restored = LidMap.fromJSON(map.toJSON());
  assert.equal(restored.phoneOf('111'), '628123');
  assert.equal(digitsOf('628123:12@s.whatsapp.net'), '628123');
  assert.equal(pnJid('628123'), '628123@s.whatsapp.net');
  assert.equal(lidJid('111'), '111@lid');
});

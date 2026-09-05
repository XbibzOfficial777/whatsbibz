// BibzWhats — test patch kompatibilitas WhatsApp Web (sinkron upstream s/d 2026-09-02)
// Setiap test memverifikasi satu patch yang di-port dari WhiskeySockets/Baileys
// rc11–rc14 / master / PR terbuka yang relevan dengan protokol WA terbaru.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  proto,
  Browsers,
  DEFAULT_CONNECTION_CONFIG,
  generateRegistrationNode,
  generateLoginNode,
  initAuthCreds,
  normalizeMessageContent,
  BIBZWHATS_WA_WEB_VERSION,
  BIBZWHATS_VERSION,
} from '../lib/index.js';
import { buildTcTokenFromJid, isTcTokenExpired } from '../lib/Utils/tc-token-utils.js';
import { buildProfilePictureQueryContent } from '../lib/Socket/chats.js';
import { makeEventBuffer } from '../lib/Utils/event-buffer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel) => fs.readFileSync(path.join(here, '..', 'lib', rel), 'utf8');
const silent = { info() {}, warn() {}, error() {}, debug() {}, trace() {} };

const baseCfg = (browser, extra = {}) => ({
  ...DEFAULT_CONNECTION_CONFIG,
  browser,
  syncFullHistory: true,
  ...extra,
});

// ───────────── versi WA Web ─────────────
test('versi WA Web bawaan sinkron di Defaults, generics dan BIBZWHATS_WA_WEB_VERSION', () => {
  assert.deepEqual(DEFAULT_CONNECTION_CONFIG.version, BIBZWHATS_WA_WEB_VERSION);
  assert.match(src('Utils/generics.js'), new RegExp(`bibzWhatsVersion = \\[2, 3000, ${BIBZWHATS_WA_WEB_VERSION[2]}\\]`));
  // harus lebih baru dari rc14 upstream (1043857760) — server menolak versi lama (408)
  assert.ok(BIBZWHATS_WA_WEB_VERSION[2] > 1043857760);
  assert.equal(BIBZWHATS_VERSION, '1.3.2');
});

// ───────────── WIN32 → WIN_HYBRID (#2741) ─────────────
test('Windows Desktop mengiklankan WIN_HYBRID, bukan WIN32 yang sudah ditolak server', () => {
  const creds = initAuthCreds();
  const node = generateRegistrationNode(creds, baseCfg(Browsers.windows('Desktop')));
  assert.equal(node.webInfo.webSubPlatform, proto.ClientPayload.WebInfo.WebSubPlatform.WIN_HYBRID);
  assert.notEqual(node.webInfo.webSubPlatform, proto.ClientPayload.WebInfo.WebSubPlatform.WIN32);
  // browser biasa tetap WEB_BROWSER
  const chrome = generateRegistrationNode(creds, baseCfg(Browsers.macOS('Chrome')));
  assert.equal(chrome.webInfo.webSubPlatform, proto.ClientPayload.WebInfo.WebSubPlatform.WEB_BROWSER);
  assert.equal(chrome.userAgent.platform, proto.ClientPayload.UserAgent.Platform.WEB);
});

// ───────────── Browsers.android (#2201) ─────────────
test('Browsers.android: platform ANDROID, tanpa webInfo, platformType ANDROID_PHONE', () => {
  const browser = Browsers.android('Chrome');
  assert.deepEqual(browser, ['Chrome', 'Android', '']);
  const creds = initAuthCreds();
  const reg = generateRegistrationNode(creds, baseCfg(browser));
  assert.equal(reg.userAgent.platform, proto.ClientPayload.UserAgent.Platform.ANDROID);
  assert.ok(reg.webInfo == null, 'Android tidak mengirim webInfo');
  const props = proto.DeviceProps.decode(reg.devicePairingData.deviceProps);
  assert.equal(props.platformType, proto.DeviceProps.PlatformType.ANDROID_PHONE);
  const login = generateLoginNode('6281234567890:1@s.whatsapp.net', baseCfg(browser, { pushName: 'Bibz' }));
  assert.ok(login.webInfo == null);
  assert.equal(login.pushName, 'Bibz');
});

// ───────────── guard protocolMessage self-only (rc12) ─────────────
test('process-message: guard SELF_ONLY_PROTOCOL_TYPES tertanam (drop spoof dari non-self)', () => {
  const s = src('Utils/process-message.js');
  assert.match(s, /SELF_ONLY_PROTOCOL_TYPES = new Set\(\[/);
  assert.match(s, /HISTORY_SYNC_NOTIFICATION,\s*proto\.Message\.ProtocolMessage\.Type\.APP_STATE_SYNC_KEY_SHARE/);
  assert.match(s, /SELF_ONLY_PROTOCOL_TYPES\.has\(protocolMsg\.type\) &&\s*!message\.key\.fromMe/);
  // tipe lintas-user TIDAK boleh masuk daftar
  const block = s.slice(s.indexOf('SELF_ONLY_PROTOCOL_TYPES = new Set'), s.indexOf(']);', s.indexOf('SELF_ONLY_PROTOCOL_TYPES = new Set')));
  assert.doesNotMatch(block, /REVOKE|MESSAGE_EDIT|EPHEMERAL_SETTING/);
});

// ───────────── lottieStickerMessage (#2776) ─────────────
test('normalizeMessageContent membuka lottieStickerMessage → stickerMessage', () => {
  const inner = { stickerMessage: { url: 'https://mmg.whatsapp.net/x', mimetype: 'image/webp' } };
  const out = normalizeMessageContent({ lottieStickerMessage: { message: inner } });
  assert.deepEqual(out, inner);
});

// ───────────── tctoken: attrs t + kedaluwarsa (rc11+) ─────────────
test('tctoken: node membawa attrs.t; token tanpa timestamp/kedaluwarsa tidak dikirim & dibersihkan', async () => {
  const now = Math.floor(Date.now() / 1000);
  const store = {
    'a@s.whatsapp.net': { token: Buffer.from('tok-a'), timestamp: String(now - 60) },
    'b@s.whatsapp.net': { token: Buffer.from('tok-b') }, // tanpa timestamp
    'c@s.whatsapp.net': { token: Buffer.from('tok-c'), timestamp: now - 60 * 86400 }, // 60 hari
  };
  const sets = [];
  const authState = {
    keys: {
      get: async (_type, ids) => Object.fromEntries(ids.map((id) => [id, store[id]])),
      set: async (data) => sets.push(data),
    },
  };
  const a = await buildTcTokenFromJid({ authState, jid: 'a@s.whatsapp.net' });
  assert.equal(a.length, 1);
  assert.equal(a[0].tag, 'tctoken');
  assert.equal(a[0].attrs.t, String(now - 60));
  assert.equal(await buildTcTokenFromJid({ authState, jid: 'b@s.whatsapp.net' }), undefined);
  assert.equal(await buildTcTokenFromJid({ authState, jid: 'c@s.whatsapp.net' }), undefined);
  assert.equal(sets.length, 2, 'token invalid dibersihkan dari store');
  assert.equal(isTcTokenExpired(undefined), true);
  assert.equal(isTcTokenExpired(now), false);
  assert.equal(isTcTokenExpired(now - 40 * 86400), true);
  // messages-send memakai cek yang sama
  assert.match(src('Socket/messages-send.js'), /isTcTokenExpired\(tcTokenEntry\.timestamp\)/);
});

// ───────────── profile picture: tctoken bersarang (#2607) ─────────────
test('buildProfilePictureQueryContent menyarangkan tctoken di dalam <picture>', () => {
  const plain = buildProfilePictureQueryContent('preview');
  assert.deepEqual(plain, [{ tag: 'picture', attrs: { type: 'preview', query: 'url' } }]);
  const tok = [{ tag: 'tctoken', attrs: { t: '1' }, content: Buffer.from('x') }];
  const nested = buildProfilePictureQueryContent('image', tok);
  assert.equal(nested.length, 1);
  assert.equal(nested[0].content, tok);
  const s = src('Socket/chats.js');
  assert.match(s, /groupOnlineCount: attrs\.count \? \+attrs\.count : undefined/);
  assert.match(s, /if \(isUserJid && !isSelf\)/);
});

// ───────────── pairing code: query + creds.me setelah ACK (PR #2769) ─────────────
test('requestPairingCode: pakai query(), creds.me disimpan hanya setelah server menjawab', () => {
  const s = src('Socket/socket.js');
  const start = s.indexOf('const requestPairingCode = async');
  const end = s.indexOf('async function generatePairingKey', start);
  const body = s.slice(start, end);
  assert.match(body, /const registration = await query\(/);
  assert.doesNotMatch(body, /await sendNode\(/);
  assert.match(body, /if \(!registration\) \{\s*throw new Boom\('Companion registration timed out'/);
  // creds.me di-assign SETELAH query
  assert.ok(body.indexOf('authState.creds.me = me') > body.indexOf('const registration = await query('));
  // display diturunkan lewat allow-list (1.2.0), override tetap didahulukan
  assert.match(body, /config\.companionPlatformDisplay \?\? derivePairingDisplay\(browser\)/);
  assert.match(body, /String\(config\.companionPlatformId \?\? getPlatformId\(browser\[1\]\)\)/);
  assert.match(s, /async function generatePairingKey\(pairingCode\)/);
});

// ───────────── presence tanpa nama (PR #2789) ─────────────
test('creds.update parsial tidak mengirim <presence/> tanpa nama', () => {
  const s = src('Socket/socket.js');
  assert.match(s, /typeof name === 'string' && name\.length > 0 && creds\.me\?\.name !== name/);
});

// ───────────── cleanup memori (#2191) ─────────────
test('event buffer punya destroy() dan socket end() memanggil signalRepository.close + ev.destroy', () => {
  const ev = makeEventBuffer(silent);
  let fired = 0;
  ev.on('connection.update', () => fired++);
  ev.emit('connection.update', { connection: 'open' });
  assert.equal(fired, 1);
  ev.destroy();
  ev.emit('connection.update', { connection: 'open' });
  assert.equal(fired, 1, 'listener dilepas setelah destroy');
  const s = src('Socket/socket.js');
  assert.match(s, /signalRepository\.close\?\.\(\)/);
  assert.match(s, /ev\.destroy\?\.\(\)/);
  assert.match(s, /registerSocketEndHandler/);
  assert.match(src('Signal/libsignal.js'), /close\(\) \{\s*migratedSessionCache\.clear\(\);\s*lidMapping\.close\?\.\(\);/);
});

// ───────────── media: directPath diutamakan (PR #2778) + dispatcher guard (#2557) ─────────────
test('downloadContentFromMessage mengutamakan directPath (hindari host usang a.whatsapp.net)', () => {
  const s = src('Utils/messages-media.js');
  assert.match(s, /const downloadUrl = directPath \? getUrlFromDirectPath\(directPath\) : url;/);
  assert.match(s, /typeof agent\?\.dispatch === 'function' \? agent : undefined/);
});

// ───────────── createBibzWhats: ready per socket & versi tidak diturunkan (#2777) ─────────────
test('createBibzWhats: ready tiap socket baru, first-ready sekali, versi hanya dari isLatest', () => {
  const s = src('BibzWhats/client.js');
  assert.match(s, /readyOnEveryConnect: true/);
  assert.match(s, /emitter\.emit\('first-ready', sock\)/);
  assert.match(s, /if \(latest\.isLatest\) version = latest\.version;/);
  assert.match(s, /companionPlatformDisplay: opts\.companionPlatformDisplay/);
});

// ───────────── client.sock harus getter hidup (bug: Object.assign membekukan getter) ─────────────
test('client.sock adalah getter hidup (defineProperty), bukan nilai beku hasil Object.assign', () => {
  const s = src('BibzWhats/client.js');
  assert.match(s, /Object\.defineProperty\(emitter, 'sock', \{\s*[\s\S]*?get: \(\) => currentSock/);
  // Object.assign tidak boleh lagi membawa `get sock()`
  const assignBlock = s.slice(s.indexOf('const client = Object.assign(emitter, {'), s.indexOf('return client;'));
  assert.doesNotMatch(assignBlock, /get sock\(\)/);
  // demonstrasi perilaku: getter via Object.assign membeku, via defineProperty tidak
  let cur = 1;
  const frozen = Object.assign({}, { get v() { return cur; } });
  const live = Object.defineProperty({}, 'v', { get: () => cur, enumerable: true });
  cur = 2;
  assert.equal(frozen.v, 1);
  assert.equal(live.v, 2);
});

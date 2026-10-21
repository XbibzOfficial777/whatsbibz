// BibzWhats — test patch kompatibilitas WhatsApp Web (sinkron upstream s/d 2026-09-02)
// Setiap test memverifikasi satu patch yang di-port dari WhiskeySockets/Baileys
// rc11–rc14 / master / PR terbuka yang relevan dengan protokol WA terbaru.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { Readable } from 'node:stream';
import { Boom } from '@hapi/boom';
import {
  proto,
  Browsers,
  DEFAULT_CONNECTION_CONFIG,
  generateRegistrationNode,
  generateLoginNode,
  initAuthCreds,
  normalizeMessageContent,
  isViewOnceMessage,
  downloadMediaMessage,
  encryptMediaRetryRequest,
  getWAUploadToServer,
  uploadBufferWithNodeHttp,
  addTransactionCapability,
  BIBZWHATS_WA_WEB_VERSION,
  BIBZWHATS_VERSION,
} from '../lib/index.js';
import { extractCommunityMetadata } from '../lib/Socket/communities.js';
import { buildTcTokenFromJid, isTcTokenExpired } from '../lib/Utils/tc-token-utils.js';
import { buildProfilePictureQueryContent } from '../lib/Socket/chats.js';
import { isOwnDeviceJid, buildRetryResendAddressing } from '../lib/Socket/messages-send.js';
import { isOfflineNode } from '../lib/Utils/offline-node-processor.js';
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
  assert.deepEqual(BIBZWHATS_WA_WEB_VERSION, [2, 3000, 1051141409]);
  assert.match(src('Utils/generics.js'), new RegExp(`bibzWhatsVersion = \\[2, 3000, ${BIBZWHATS_WA_WEB_VERSION[2]}\\]`));
  // harus lebih baru dari rc14 upstream (1043857760) — server menolak versi lama (408)
  assert.ok(BIBZWHATS_WA_WEB_VERSION[2] > 1043857760);
  assert.equal(BIBZWHATS_VERSION, '1.4.1');
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

// ───────────── 1.4.1 / 2026-10: zero-dependency media upload (tanpa axios) ─────────────
test('getWAUploadToServer & uploadBufferWithNodeHttp berjalan tanpa dependensi axios', async () => {
  const s = src('Utils/messages-media.js');
  assert.doesNotMatch(s, /import\(['"]axios['"]\)/, 'messages-media.js tidak boleh mengimpor axios');

  const received = [];
  const srv = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        url: 'https://mmg.whatsapp.net/v/t62.7118-24/test',
        direct_path: '/v/t62.7118-24/test',
        handle: 'h1',
      }));
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  try {
    const payload = Buffer.from('hello-bibzwhats-1.4.1');
    const json = await uploadBufferWithNodeHttp({
      url: `http://127.0.0.1:${port}/upload`,
      buffer: payload,
      headers: { 'Content-Type': 'application/octet-stream' },
      timeoutMs: 5000,
    });
    assert.equal(json.direct_path, '/v/t62.7118-24/test');
    assert.equal(received.length, 1);
    assert.deepEqual(received[0].body, payload);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

// ───────────── 1.4.1 / 2026-10: encryptMediaRetryRequest menerima string base64 mediaKey (#2835) ─────────────
test('encryptMediaRetryRequest mendukung mediaKey bertipe Buffer maupun base64 string', () => {
  const rawKey = Buffer.alloc(32, 7);
  const b64Key = rawKey.toString('base64');
  const key = { id: '3EB0123456789ABCDEF', remoteJid: '6281234567890@s.whatsapp.net', fromMe: false };
  const nodeBuf = encryptMediaRetryRequest(key, rawKey, '6289876543210:1@s.whatsapp.net');
  const nodeStr = encryptMediaRetryRequest(key, b64Key, '6289876543210:1@s.whatsapp.net');
  assert.equal(nodeBuf.tag, 'receipt');
  assert.equal(nodeStr.tag, 'receipt');
  assert.equal(nodeBuf.attrs.id, key.id);
  assert.equal(nodeStr.attrs.id, key.id);
});

// ───────────── 1.4.1 / 2026-10: downloadMediaMessage reupload pada Boom 403/404/410 (#2834, #2835) ─────────────
test('downloadMediaMessage membaca Boom error.output.statusCode dan mencakup HTTP 403/404/410', () => {
  const s = src('Utils/messages.js');
  assert.match(s, /REUPLOAD_REQUIRED_STATUS = \[403, 404, 410\]/);
  assert.match(s, /const status = error\?\.output\?\.statusCode \?\? error\?\.status;/);
  assert.match(src('Utils/messages-media.js'), /fetched\.on\('error', error => output\.destroy\(error\)\)/);
});

// ───────────── 1.4.1 / 2026-10: isViewOnceMessage & <meta view_once="true"/> (#2837) ─────────────
test('isViewOnceMessage mendeteksi semua varian view-once dan messages-send menyertakan <meta view_once="true"/>', () => {
  assert.equal(isViewOnceMessage(null), false);
  assert.equal(isViewOnceMessage({ conversation: 'halo' }), false);
  assert.equal(isViewOnceMessage({ imageMessage: { url: 'https://x', viewOnce: false } }), false);
  assert.equal(isViewOnceMessage({ imageMessage: { url: 'https://x', viewOnce: true } }), true);
  assert.equal(isViewOnceMessage({ videoMessage: { url: 'https://x', viewOnce: true } }), true);
  assert.equal(isViewOnceMessage({ audioMessage: { url: 'https://x', viewOnce: true } }), true);
  assert.equal(isViewOnceMessage({ viewOnceMessage: { message: { imageMessage: {} } } }), true);
  assert.equal(isViewOnceMessage({ viewOnceMessageV2: { message: { videoMessage: {} } } }), true);
  assert.equal(isViewOnceMessage({ viewOnceMessageV2Extension: { message: { audioMessage: {} } } }), true);
  assert.equal(
    isViewOnceMessage({
      ephemeralMessage: {
        message: { viewOnceMessageV2: { message: { imageMessage: {} } } },
      },
    }),
    true,
  );
  assert.match(src('Socket/messages-send.js'), /tag:\s*["']meta["'],\s*attrs:\s*\{\s*view_once:\s*["']true["']\s*\}/);
});

// ───────────── 1.4.1 / 2026-10: isOfflineNode hanya true untuk offline="1" (#2840) ─────────────
test('isOfflineNode hanya menganggap offline="1" sebagai stanza offline', () => {
  assert.equal(isOfflineNode({ tag: 'message', attrs: { offline: '1' } }), true);
  assert.equal(isOfflineNode({ tag: 'message', attrs: { offline: '0' } }), false);
  assert.equal(isOfflineNode({ tag: 'message', attrs: {} }), false);
  assert.equal(isOfflineNode({ tag: 'message', attrs: { offline: '' } }), false);
});

// ───────────── 1.4.1 / 2026-10: retry resend addressing untuk LID & PN (#2856, #2839) ─────────────
test('isOwnDeviceJid & buildRetryResendAddressing menangani perangkat sendiri (PN & LID) dan grup', () => {
  const meId = '6281111111111:1@s.whatsapp.net';
  const meLid = '12345678901234:1@lid';

  assert.equal(isOwnDeviceJid('6281111111111:0@s.whatsapp.net', meId, meLid), true);
  assert.equal(isOwnDeviceJid('12345678901234:0@lid', meId, meLid), true);
  assert.equal(isOwnDeviceJid('6282222222222:0@s.whatsapp.net', meId, meLid), false);
  assert.equal(isOwnDeviceJid('99999999999999:0@lid', meId, meLid), false);

  // Perangkat sendiri via LID harus menyertakan recipient = destinationJid
  assert.deepEqual(
    buildRetryResendAddressing('6282222222222@s.whatsapp.net', '12345678901234:0@lid', meId, meLid),
    { to: '12345678901234:0@lid', recipient: '6282222222222@s.whatsapp.net' },
  );
  // Perangkat sendiri via PN harus menyertakan recipient = destinationJid
  assert.deepEqual(
    buildRetryResendAddressing('6282222222222@s.whatsapp.net', '6281111111111:0@s.whatsapp.net', meId, meLid),
    { to: '6281111111111:0@s.whatsapp.net', recipient: '6282222222222@s.whatsapp.net' },
  );
  // Perangkat lawan bicara 1:1
  assert.deepEqual(
    buildRetryResendAddressing('6282222222222@s.whatsapp.net', '6282222222222:2@s.whatsapp.net', meId, meLid),
    { to: '6282222222222:2@s.whatsapp.net' },
  );
  // Grup
  assert.deepEqual(
    buildRetryResendAddressing('120363000000000001@g.us', '12345678901234:0@lid', meId, meLid),
    { to: '120363000000000001@g.us', participant: '12345678901234:0@lid' },
  );

  const sendSrc = src('Socket/messages-send.js');
  assert.match(sendSrc, /await assertSessions\(\[participant\.jid\]\);/);
  assert.match(sendSrc, /else if \(!isRetryResend\)/);
});

// ───────────── 1.4.1 / 2026-10: CB:status ACK (#2866) & skip retry fromMe (#2864) ─────────────
test('messages-recv meng-ACK stanza CB:status dan melewati retry untuk pesan fromMe', () => {
  const recvSrc = src('Socket/messages-recv.js');
  assert.match(recvSrc, /ws\.on\('CB:status'/);
  assert.match(recvSrc, /skipping retry for undecryptable fromMe message/);
});

// ───────────── 1.4.1 / 2026-10: disposeTransactionStorage (#2807) & WS close details (#2865) ─────────────
test('addTransactionCapability mengekspos disposeTransactionStorage dan socket.js menyertakan detail close', () => {
  const keys = addTransactionCapability(
    { get: async () => ({}), set: async () => {} },
    silent,
    { maxCommitRetries: 1, delayBetweenTriesMs: 10 },
  );
  assert.equal(typeof keys.disposeTransactionStorage, 'function');
  keys.disposeTransactionStorage();

  const sockSrc = src('Socket/socket.js');
  assert.match(sockSrc, /keys\.disposeTransactionStorage\?\.\(\)/);
  assert.match(sockSrc, /ws\.on\('close', \(code, reason\) =>/);
});

// ───────────── 1.4.1 / 2026-10: event-buffer menjaga messageTimestamp (#2804) ─────────────
test('makeEventBuffer tidak menghapus messageTimestamp saat menggabungkan messages.update tanpa timestamp', () => {
  const ev = makeEventBuffer(silent);
  const flushed = [];
  ev.on('messages.upsert', (payload) => flushed.push(payload));

  ev.buffer();
  const key = { remoteJid: '6281234567890@s.whatsapp.net', id: 'MSG1', fromMe: true };
  // update datang lebih dulu tanpa messageTimestamp (atau messageTimestamp: undefined)
  ev.emit('messages.update', [{ key, update: { status: 3, messageTimestamp: undefined } }]);
  ev.emit('messages.upsert', {
    messages: [{ key, messageTimestamp: 1760000000, message: { conversation: 'tes' } }],
    type: 'notify',
  });
  ev.flush();

  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].messages[0].messageTimestamp, 1760000000);
  assert.equal(flushed[0].messages[0].status, 3);
  ev.destroy();
});

// ───────────── 1.4.1 / 2026-10: extractCommunityMetadata fallback ke <group> (#2808) ─────────────
test('extractCommunityMetadata mendukung node <group> sebagai fallback dan melempar Boom bila invalid', () => {
  const res = {
    tag: 'iq',
    attrs: { from: '120363000000000099@g.us' },
    content: [
      {
        tag: 'group',
        attrs: {
          id: '120363000000000099',
          subject: 'Komunitas Bibz',
          creation: '1700000000',
          size: '42',
        },
        content: [],
      },
    ],
  };
  const meta = extractCommunityMetadata(res);
  assert.equal(meta.id, '120363000000000099@g.us');
  assert.equal(meta.subject, 'Komunitas Bibz');
  assert.equal(meta.size, 42);
  assert.throws(() => extractCommunityMetadata({ tag: 'iq', attrs: {}, content: [] }), /Invalid community metadata/);
});


// Offline integration: real FFmpeg conversion + mocked WhatsApp uploads/relay.
// REQUIRE_FFMPEG=1 makes missing binaries/encoders a failure (used by CI).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createDecipheriv, createHash, createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { proto } from '../WAProto/index.js';
import { encryptedStream, getMediaKeys } from '../lib/Utils/messages-media.js';
import { createRecipeUpsertHandler, handleRecipeMessage } from '../example/message-recipes.js';
import { normalizeMessageContent } from '../lib/Utils/messages.js';
import { convertVideoToSoundSticker, sendVideoAsSoundSticker, SOUND_STICKER_MAX_INPUT_BYTES, SOUND_STICKER_MAX_WEBP_BYTES } from '../lib/Utils/sound-sticker.js';

const ffmpeg = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 15000 });
const ffprobe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8', timeout: 15000 });
const capable = ffmpeg.status === 0 && ffprobe.status === 0 && /libwebp_anim/.test(ffmpeg.stdout) && /libopus/.test(ffmpeg.stdout);
const integration = { skip: capable ? false : 'requires ffmpeg + ffprobe with libwebp_anim and libopus' };
let dir, video, noAudio, silent;

function ff(args) {
  const result = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8', timeout: 45000 });
  assert.equal(result.status, 0, `fixture ffmpeg failed: ${result.stderr || result.error}`);
}

test('FFmpeg integration is mandatory when REQUIRE_FFMPEG is set', () => {
  if (process.env.REQUIRE_FFMPEG === '1') assert.ok(capable, 'FFmpeg/FFprobe and required encoders must be available');
});

test.before(async () => {
  if (!capable) return;
  dir = await mkdtemp(path.join(tmpdir(), 'whatsbibz-sound-tests-'));
  const source = path.join(dir, 'source.mp4');
  const noAudioPath = path.join(dir, 'no-audio.mp4');
  const silentPath = path.join(dir, 'silent.mp4');
  ff(['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000',
    '-t', '6.4', '-c:v', 'mpeg4', '-q:v', '6', '-c:a', 'aac', '-movflags', '+faststart', '-y', source]);
  ff(['-i', source, '-map', '0:v:0', '-c:v', 'copy', '-an', '-y', noAudioPath]);
  ff(['-i', source, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=mono:sample_rate=48000', '-map', '0:v:0', '-map', '1:a:0',
    '-t', '6', '-c:v', 'copy', '-c:a', 'aac', '-y', silentPath]);
  [video, noAudio, silent] = await Promise.all([readFile(source), readFile(noAudioPath), readFile(silentPath)]);
});

test.after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

function assertAudibleOriginalSine(ogg) {
  const decoded = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'ogg', '-i', 'pipe:0',
    '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '48000', 'pipe:1'],
  { input: ogg, maxBuffer: 1024 * 1024, timeout: 20000 });
  assert.equal(decoded.status, 0, decoded.stderr?.toString());
  const pcm = decoded.stdout;
  assert.ok(pcm.length > 40000);
  let crossings = 0, sum = 0, last = pcm.readInt16LE(0);
  for (let i = 2; i + 1 < pcm.length; i += 2) {
    const sample = pcm.readInt16LE(i);
    if (last <= 0 && sample > 0) crossings++;
    sum += sample * sample;
    last = sample;
  }
  const frequency = crossings / (pcm.length / 2 / 48000);
  const rms = Math.sqrt(sum / (pcm.length / 2));
  assert.ok(rms > 500, `audio is silent: RMS=${rms}`);
  assert.ok(frequency > 850 && frequency < 910, `expected the original 880 Hz tone, got ${frequency}`);
  return pcm.length / 2 / 48000;
}

function webpInfo(data) {
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  assert.equal(data.readUInt32LE(4) + 8, data.length);
  let pos = 12, frames = 0, dimensions;
  while (pos + 8 <= data.length) {
    const name = data.toString('ascii', pos, pos + 4);
    const size = data.readUInt32LE(pos + 4);
    assert.ok(pos + 8 + size <= data.length);
    if (name === 'VP8X') dimensions = [data.readUIntLE(pos + 12, 3) + 1, data.readUIntLE(pos + 15, 3) + 1];
    if (name === 'ANMF') frames++;
    pos += 8 + size + size % 2;
  }
  assert.deepEqual(dimensions, [512, 512]);
  assert.ok(frames >= 2);
}

test('video conversion outputs 512px animated WebP AND the real original audio, truncated to five seconds', integration, async () => {
  const result = await convertVideoToSoundSticker(video);
  webpInfo(result.sticker);
  assert.ok(result.sticker.length <= SOUND_STICKER_MAX_WEBP_BYTES);
  assert.equal(result.audio.toString('ascii', 0, 4), 'OggS');
  assert.equal(result.seconds, 5);
  assert.ok(result.peakDb > -70);
  const seconds = assertAudibleOriginalSine(result.audio);
  assert.ok(seconds > 4.8 && seconds <= 5.1, `decoded duration: ${seconds}`);
});

test('startSeconds selects a later segment and maintains audible audio', integration, async () => {
  const result = await convertVideoToSoundSticker(video, { startSeconds: 2 });
  webpInfo(result.sticker);
  const seconds = assertAudibleOriginalSine(result.audio);
  assert.ok(seconds > 4 && seconds < 4.6, `decoded duration: ${seconds}`);
  assert.equal(result.seconds, 5);
});

test('no audio, silent track, malformed input and impossible offsets fail without a silent fallback', integration, async () => {
  await assert.rejects(convertVideoToSoundSticker(noAudio), { code: 'NO_AUDIO' });
  await assert.rejects(convertVideoToSoundSticker(silent), { code: 'SILENT_AUDIO' });
  await assert.rejects(convertVideoToSoundSticker(video, { startSeconds: 60 }), { code: 'INVALID_VIDEO' });
  await assert.rejects(convertVideoToSoundSticker(Buffer.from('invalid')), { code: 'FFMPEG_FAILED' });
  await assert.rejects(convertVideoToSoundSticker(video, { ffprobePath: '/not-a-real-ffprobe' }), { code: 'FFMPEG_NOT_FOUND' });
  await assert.rejects(convertVideoToSoundSticker(Buffer.alloc(SOUND_STICKER_MAX_INPUT_BYTES + 1)), { code: 'VIDEO_TOO_LARGE' });
  await assert.rejects(convertVideoToSoundSticker(video, { timeoutMs: 12 }), { code: 'BAD_OPTIONS' });
});

async function decryptUpload(encrypted, metadata, type) {
  const { iv, cipherKey, macKey } = await getMediaKeys(metadata.mediaKey, type);
  const cipher = encrypted.subarray(0, -10), mac = encrypted.subarray(-10);
  assert.deepEqual(mac, createHmac('sha256', macKey).update(iv).update(cipher).digest().subarray(0, 10));
  assert.deepEqual(Buffer.from(metadata.fileEncSha256), createHash('sha256').update(encrypted).digest());
  const decipher = createDecipheriv('aes-256-cbc', cipherKey, iv);
  const plain = Buffer.concat([decipher.update(cipher), decipher.final()]);
  assert.deepEqual(Buffer.from(metadata.fileSha256), createHash('sha256').update(plain).digest());
  assert.equal(Number(metadata.fileLength), plain.length);
  return plain;
}

function fakeSocket() {
  const uploads = [], relayed = [];
  return {
    uploads, relayed,
    sock: {
      user: { id: '12345678901@s.whatsapp.net' },
      waUploadToServer: async (stream, options) => {
        const chunks = []; for await (const chunk of stream) chunks.push(chunk);
        uploads.push({ encrypted: Buffer.concat(chunks), options });
        return { mediaUrl: `https://mmg.whatsapp.net/${options.mediaType}`, directPath: `/${options.mediaType}` };
      },
      relayMessage: async (jid, message, options) => { relayed.push({ jid, message, options }); return options.messageId; },
    },
  };
}

test('one relay contains TWO separately encrypted media and quoted command, with audible original sound', integration, async () => {
  const { sock, uploads, relayed } = fakeSocket();
  const jid = '10987654321@s.whatsapp.net';
  const quoted = proto.WebMessageInfo.fromObject({ key: { remoteJid: jid, fromMe: false, id: 'cmd-id' },
    message: { extendedTextMessage: { text: '!soundsticker', contextInfo: { stanzaId: 'original-video', participant: jid } } } });
  const full = await sendVideoAsSoundSticker(sock, jid, video, { quoted, ephemeralExpiration: 3600 });
  assert.equal(uploads.length, 2);
  assert.deepEqual(uploads.map((u) => u.options.mediaType), ['sticker', 'audio']);
  assert.equal(relayed.length, 1);
  assert.equal(relayed[0].options.messageId, full.key.id);
  const wire = proto.Message.encode(full.message).finish();
  const roundTrip = proto.Message.decode(wire);
  const sticker = roundTrip.audioStickerMessage.message.stickerMessage;
  assert.equal(sticker.mimetype, 'image/webp');
  assert.equal(sticker.isAnimated, true);
  assert.equal(sticker.width, 512);
  assert.equal(sticker.height, 512);
  assert.equal(sticker.audioMessage.mimetype, 'audio/ogg; codecs=opus');
  assert.equal(sticker.audioMessage.ptt, false);
  assert.equal(sticker.contextInfo.stanzaId, 'cmd-id');
  assert.equal(sticker.contextInfo.expiration, 3600);
  assert.equal(quoted.message.extendedTextMessage.contextInfo.stanzaId, 'original-video'); // no caller mutation
  assert.equal(normalizeMessageContent(roundTrip).stickerMessage.audioMessage.seconds, 5);
  assert.notDeepEqual(Buffer.from(sticker.mediaKey), Buffer.from(sticker.audioMessage.mediaKey));
  const picture = await decryptUpload(uploads[0].encrypted, sticker, 'sticker');
  const audio = await decryptUpload(uploads[1].encrypted, sticker.audioMessage, 'audio');
  webpInfo(picture);
  assertAudibleOriginalSine(audio);
});

test('replying .sa to an encrypted video runs the complete example handler offline', integration, async (t) => {
  const original = await encryptedStream(video, 'video');
  const pieces = []; for await (const chunk of original.encWriteStream) pieces.push(chunk);
  const ciphertext = Buffer.concat(pieces);
  let requested;
  t.mock.method(globalThis, 'fetch', async (url, options) => { requested = { url: String(url), options }; return new Response(ciphertext); });
  const { sock, uploads, relayed } = fakeSocket();
  sock.sendMessage = async () => { throw new Error('Unexpected error response'); };
  const jid = '10987654321@s.whatsapp.net';
  const msg = { key: { remoteJid: jid, id: 'reply-id', fromMe: false }, message: { extendedTextMessage: {
    text: '.sa', contextInfo: { stanzaId: 'video-id', participant: jid, quotedMessage: { videoMessage: {
      directPath: '/v/test.enc', mimetype: 'video/mp4', mediaKey: original.mediaKey, fileSha256: original.fileSha256,
      fileLength: original.fileLength,
    } } },
  } } };
  assert.equal(await handleRecipeMessage(sock, msg, { allowedJid: jid }), true);
  assert.equal(requested.url, 'https://mmg.whatsapp.net/v/test.enc');
  assert.equal(requested.options.redirect, 'error');
  assert.equal(relayed.length, 1);
  const sticker = proto.Message.decode(proto.Message.encode(relayed[0].message).finish()).audioStickerMessage.message.stickerMessage;
  assert.equal(sticker.contextInfo.stanzaId, 'reply-id');
  const audio = await decryptUpload(uploads[1].encrypted, sticker.audioMessage, 'audio');
  assertAudibleOriginalSine(audio);
});

test('the real router accepts a fresh own-chat LID reply and does not replay history or duplicates', integration, async (t) => {
  const original = await encryptedStream(video, 'video');
  const pieces = []; for await (const chunk of original.encWriteStream) pieces.push(chunk);
  t.mock.method(globalThis, 'fetch', async () => new Response(Buffer.concat(pieces)));
  const { sock, uploads, relayed } = fakeSocket();
  sock.sendMessage = async () => { throw new Error('Unexpected error response'); };
  const lid = '98765432100@lid';
  sock.authState = { creds: { me: { lid } } };
  const readyAt = Date.now();
  const msg = { key: { remoteJid: lid, id: 'fresh-reply', fromMe: true }, messageTimestamp: Math.floor(readyAt / 1000),
    message: { extendedTextMessage: { text: '.sa', contextInfo: { stanzaId: 'video-id', quotedMessage: { videoMessage: {
      directPath: '/v/test.enc', mimetype: 'video/mp4', mediaKey: original.mediaKey, fileSha256: original.fileSha256,
      fileLength: original.fileLength,
    } } } } } };
  const old = { ...msg, key: { ...msg.key, id: 'old-reply' }, messageTimestamp: msg.messageTimestamp - 100 };
  const upsert = createRecipeUpsertHandler(sock, { allowedJid: sock.user.id, allowOwnCommands: true, readyAt });
  await upsert({ type: 'notify', messages: [old, msg] });
  await upsert({ type: 'append', messages: [msg, old] });
  assert.equal(relayed.length, 1);
  assert.equal(relayed[0].jid, lid);
  const sticker = proto.Message.decode(proto.Message.encode(relayed[0].message).finish()).audioStickerMessage.message.stickerMessage;
  assert.equal(sticker.contextInfo.stanzaId, 'fresh-reply');
  assertAudibleOriginalSine(await decryptUpload(uploads[1].encrypted, sticker.audioMessage, 'audio'));
});

test('invalid target or failed second upload never relays a sound sticker', integration, async () => {
  const first = fakeSocket();
  await assert.rejects(sendVideoAsSoundSticker(first.sock, 'status@broadcast', video), { code: 'BAD_JID' });
  assert.equal(first.uploads.length, 0);
  const second = fakeSocket();
  let attempts = 0;
  const upload = second.sock.waUploadToServer;
  second.sock.waUploadToServer = async (...args) => { const value = await upload(...args); return ++attempts === 2 ? {} : value; };
  await assert.rejects(sendVideoAsSoundSticker(second.sock, '10987654321@s.whatsapp.net', video), { code: 'UPLOAD_FAILED' });
  assert.equal(second.relayed.length, 0);
});

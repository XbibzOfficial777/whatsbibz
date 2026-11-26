import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import protobuf from 'protobufjs';
import { proto } from '../WAProto/index.js';
import { encryptedStream } from '../lib/Utils/messages-media.js';
import { normalizeMessageContent } from '../lib/Utils/messages.js';
import { extractMessage } from '../lib/BibzWhats/extract.js';
import { downloadVideoForSoundSticker, SOUND_STICKER_MAX_INPUT_BYTES } from '../lib/Utils/sound-sticker.js';

const JID = '12345678901@s.whatsapp.net';
const chunksOf = async (stream) => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); };

function command(video, quotedContent = { videoMessage: video }) {
  return {
    key: { remoteJid: JID, fromMe: false, id: 'command-1' },
    message: { extendedTextMessage: { text: '!soundsticker', contextInfo: {
      stanzaId: 'video-1', participant: JID, quotedMessage: quotedContent,
    } } },
  };
}

async function encryptedVideo(plain) {
  const data = await encryptedStream(plain, 'video');
  return {
    body: await chunksOf(data.encWriteStream),
    video: { mimetype: 'video/mp4', directPath: '/v/test.enc', url: 'https://attacker.invalid/evil',
      fileSha256: data.fileSha256, fileEncSha256: data.fileEncSha256, mediaKey: data.mediaKey, fileLength: data.fileLength },
  };
}

test('sound-sticker wire fields match independent protobuf reflection and survive JSON/object conversion', async () => {
  const reflection = (await protobuf.load('WAProto/WAProto.proto')).lookupType('proto.Message');
  const data = { audioStickerMessage: { message: { stickerMessage: {
    mimetype: 'image/webp', width: 512, height: 512, isAnimated: true, fileSha256: Buffer.alloc(32, 5),
    audioMessage: { mimetype: 'audio/ogg; codecs=opus', mediaKey: Buffer.alloc(32, 7), seconds: 5, directPath: '/audio' },
    contextInfo: { stanzaId: 'command-1', participant: JID },
  } } } };
  const expected = reflection.encode(reflection.fromObject(data)).finish();
  const bytes = proto.Message.encode(proto.Message.fromObject(data)).finish();
  assert.deepEqual(Buffer.from(bytes), Buffer.from(expected));
  assert.equal(Buffer.from(bytes).subarray(0, 2).toString('hex'), 'b208'); // field 134, length-delimited
  const decoded = proto.Message.decode(bytes);
  const sticker = decoded.audioStickerMessage.message.stickerMessage;
  assert.equal(sticker.audioMessage.mimetype, 'audio/ogg; codecs=opus');
  assert.equal(sticker.audioMessage.seconds, 5);
  assert.equal(sticker.audio, 'audioMessage');
  assert.equal(proto.Message.verify(decoded), null);
  const asObject = proto.Message.toObject(decoded, { oneofs: true, bytes: String });
  assert.equal(asObject.audioStickerMessage.message.stickerMessage.audio, 'audioMessage');
  assert.equal(proto.Message.fromObject(asObject).audioStickerMessage.message.stickerMessage.audioMessage.directPath, '/audio');
  assert.match(proto.Message.verify({ audioStickerMessage: { message: { stickerMessage: { audioMessage: 'bad' } } } }), /audioMessage.*object expected/);
});

test('600-second audio metadata round-trips against the independent protobuf schema', async () => {
  const reflection = (await protobuf.load('WAProto/WAProto.proto')).lookupType('proto.Message');
  const data = { audioStickerMessage: { message: { stickerMessage: {
    mimetype: 'image/webp', isAnimated: true,
    audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 600, directPath: '/audio' },
  } } } };
  const expected = reflection.encode(reflection.fromObject(data)).finish();
  const encoded = proto.Message.encode(proto.Message.fromObject(data)).finish();
  assert.deepEqual(Buffer.from(encoded), Buffer.from(expected));
  assert.equal(proto.Message.decode(encoded).audioStickerMessage.message.stickerMessage.audioMessage.seconds, 600);
});

test('sound sticker unwraps as a sticker, including under ephemeral wrapper', () => {
  const sound = { audioStickerMessage: { message: { stickerMessage: { mimetype: 'image/webp', audioMessage: { seconds: 3 } } } } };
  const nested = { ephemeralMessage: { message: sound } };
  assert.equal(normalizeMessageContent(nested).stickerMessage.audioMessage.seconds, 3);
  const result = extractMessage({ key: { remoteJid: JID }, message: nested });
  assert.equal(result.type, 'sticker');
  assert.equal(result.stickerMsg.audioMessage.seconds, 3);
});

test('quoted video download pins CDN, forbids redirects and verifies the decrypted SHA-256', async (t) => {
  const plain = Buffer.from('synthetic video payload, encrypted using real WhatsApp media derivation');
  const { body, video } = await encryptedVideo(plain);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { requests.push({ url: String(url), options }); return new Response(body); });
  const msg = command(video, { ephemeralMessage: { message: { videoMessage: video } } });
  const result = await downloadVideoForSoundSticker(msg);
  assert.deepEqual(result, plain);
  assert.equal(requests[0].url, 'https://mmg.whatsapp.net/v/test.enc');
  assert.equal(requests[0].options.redirect, 'error');
  assert.ok(requests[0].options.signal);
  assert.equal(msg.message.extendedTextMessage.contextInfo.quotedMessage.ephemeralMessage.message.videoMessage.url, 'https://attacker.invalid/evil');
});

test('direct-caption video can be downloaded from a trusted explicit CDN host', async (t) => {
  const plain = Buffer.from('another synthetic media body');
  const { body, video } = await encryptedVideo(plain);
  let url;
  t.mock.method(globalThis, 'fetch', async (value) => { url = String(value); return new Response(body); });
  const msg = { key: { remoteJid: JID, id: 'v' }, message: { videoMessage: { ...video, caption: '!soundsticker' } } };
  assert.deepEqual(await downloadVideoForSoundSticker(msg, { mediaHost: 'cdn.whatsapp.net' }), plain);
  assert.equal(url, 'https://cdn.whatsapp.net/v/test.enc');
  await assert.rejects(downloadVideoForSoundSticker(msg, { mediaHost: 'whatsapp.net.attacker.invalid' }), { code: 'BAD_OPTIONS' });
  await assert.rejects(downloadVideoForSoundSticker(msg, { mediaHost: 'a.whatsapp.net' }), { code: 'BAD_OPTIONS' });
});

test('tampered plaintext hash fails closed, never returning unverified video', async (t) => {
  const { body, video } = await encryptedVideo(Buffer.from('valid media'));
  t.mock.method(globalThis, 'fetch', async () => new Response(body));
  const wrongHash = createHash('sha256').update('different').digest();
  await assert.rejects(downloadVideoForSoundSticker(command({ ...video, fileSha256: wrongHash })), { code: 'MEDIA_INTEGRITY_FAILED' });
});

test('missing metadata, oversized media, unrelated quotes and view-once are rejected before network', async (t) => {
  const { video } = await encryptedVideo(Buffer.from('not downloaded'));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('unexpected network'); });
  await assert.rejects(downloadVideoForSoundSticker(command({ ...video, fileSha256: undefined })), { code: 'VIDEO_METADATA_MISSING' });
  await assert.rejects(downloadVideoForSoundSticker(command({ ...video, directPath: undefined })), { code: 'VIDEO_METADATA_MISSING' });
  await assert.rejects(downloadVideoForSoundSticker(command({ ...video, fileLength: SOUND_STICKER_MAX_INPUT_BYTES + 1 })), { code: 'VIDEO_TOO_LARGE' });
  await assert.rejects(downloadVideoForSoundSticker(command(video, { imageMessage: {} })), { code: 'VIDEO_NOT_FOUND' });
  await assert.rejects(downloadVideoForSoundSticker(command(video, { viewOnceMessageV2: { message: { videoMessage: video } } })), { code: 'VIEW_ONCE_REJECTED' });
  await assert.rejects(downloadVideoForSoundSticker(command({ ...video, viewOnce: true })), { code: 'VIEW_ONCE_REJECTED' });
  const crossChat = command(video); crossChat.message.extendedTextMessage.contextInfo.remoteJid = '999@s.whatsapp.net';
  await assert.rejects(downloadVideoForSoundSticker(crossChat), { code: 'VIDEO_NOT_FOUND' });
  assert.equal(calls, 0);
});

test('the download is bounded by actual bytes even if a sender lies about length', async (t) => {
  const plain = Buffer.alloc(SOUND_STICKER_MAX_INPUT_BYTES + 17, 1);
  const { body, video } = await encryptedVideo(plain);
  t.mock.method(globalThis, 'fetch', async () => new Response(body));
  await assert.rejects(downloadVideoForSoundSticker(command({ ...video, fileLength: 1 })), { code: 'VIDEO_TOO_LARGE' });
});

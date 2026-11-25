// Optional-peer integration is deliberately opt-in: the normal package install
// contains none of these modules. CI exercises both Jimp/legacy audio and
// Sharp/maintained audio using synthetic media and mocked, network-free fetches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { extractImageThumb, generateProfilePicture, getAudioWaveform } from '../lib/Utils/messages-media.js';
import { getUrlInfo } from '../lib/Utils/link-preview.js';
import { createBibzWhats } from '../lib/BibzWhats/client.js';
import { Toolkit } from '../lib/Modded/message_builder.js';

const mode = process.env.REQUIRE_OPTIONAL_PEERS;
const required = mode === 'legacy' || mode === 'modern';
const optional = { skip: required ? false : 'set REQUIRE_OPTIONAL_PEERS=legacy or modern' };

function sineWav() {
  const rate = 8000, count = rate;
  const b = Buffer.alloc(44 + count * 2);
  b.write('RIFF', 0); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) b.writeInt16LE(Math.round(12000 * Math.sin(i * 0.1)), 44 + i * 2);
  return b;
}

test('installed optional image and audio peers exercise their actual adapters', optional, async () => {
  if (mode === 'legacy') {
    assert.equal(typeof (await import('jimp')).Jimp.read, 'function');
    await assert.rejects(import('sharp'), /Cannot find package|Cannot find module|ERR_MODULE_NOT_FOUND/);
    await assert.rejects(import('@audio/decode'), /Cannot find package|Cannot find module|ERR_MODULE_NOT_FOUND/);
    assert.equal(typeof (await import('audio-decode')).default, 'function');
  } else {
    assert.equal(typeof (await import('sharp')).default, 'function');
    assert.equal(typeof (await import('@audio/decode')).default, 'function');
  }
  const logo = await readFile('assets/logo/preview.png');
  const thumbnail = await extractImageThumb(logo, 32);
  assert.ok(thumbnail.original.width > 0 && thumbnail.original.height > 0);
  assert.deepEqual([...thumbnail.buffer.subarray(0, 2)], [0xff, 0xd8]);
  const picture = await generateProfilePicture(logo, { width: 32, height: 32 });
  assert.deepEqual([...picture.img.subarray(0, 2)], [0xff, 0xd8]);
  const waveform = await getAudioWaveform(sineWav());
  assert.ok(waveform instanceof Uint8Array);
  assert.equal(waveform.length, 64);
  assert.ok(Math.max(...waveform) > 0, 'decoded PCM should contain a signal');
});

test('link preview 4 parses a synthetic page and rejects a cross-host redirect', optional, async () => {
  const { getLinkPreview } = await import('link-preview-js');
  assert.equal(typeof getLinkPreview, 'function');
  const originalFetch = globalThis.fetch, originalError = console.error;
  let requests = [];
  const response = (url, status, body, headers = {}) => {
    const result = new Response(body, { status, headers });
    Object.defineProperty(result, 'url', { value: url });
    return result;
  };
  try {
    // Suppress the peer's expected warning: this synthetic test does not make
    // DNS/network requests. Production still needs separate egress controls.
    console.error = () => {};
    globalThis.fetch = async (url, options) => {
      requests.push(String(url));
      assert.equal(options.redirect, 'manual');
      return response(String(url), 200, '<html><head><title>Offline preview</title></head><body></body></html>', { 'content-type': 'text/html' });
    };
    const info = await getUrlInfo('https://example.com/page', { thumbnailWidth: 32, fetchOpts: { timeout: 1500 } });
    assert.equal(info.title, 'Offline preview');
    assert.equal(info['canonical-url'], 'https://example.com/page');
    assert.equal(requests.length, 1);

    requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push(String(url));
      assert.equal(options.redirect, 'manual');
      if (requests.length === 1) return response(String(url), 302, '', { location: '/next' });
      return response(String(url), 200, '<html><head><title>Redirected safely</title></head></html>', { 'content-type': 'text/html' });
    };
    const redirected = await getUrlInfo('https://example.com/page', { thumbnailWidth: 32, fetchOpts: { timeout: 1500 } });
    assert.equal(redirected.title, 'Redirected safely');
    assert.deepEqual(requests, ['https://example.com/page', 'https://example.com/next']);

    for (const location of ['http://127.0.0.1/private', 'http://example.com/downgrade']) {
      requests = [];
      globalThis.fetch = async (url, options) => {
        requests.push(String(url));
        assert.equal(options.redirect, 'manual');
        return response(String(url), 302, '', { location });
      };
      await assert.rejects(getUrlInfo('https://example.com/page', { thumbnailWidth: 32, fetchOpts: { timeout: 1500 } }), /redirect/i);
      assert.equal(requests.length, 1, 'cross-host and scheme-changing redirects were not fetched');
    }
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
});

test('legacy builder video preview works with its explicitly installed optional peer', { skip: mode === 'modern' ? false : 'set REQUIRE_OPTIONAL_PEERS=modern', timeout: 12_000 }, async () => {
  assert.equal(typeof (await import('fluent-ffmpeg')).default, 'function');
  // Synthetic fragmented MP4 in memory; no user media and no network.
  const ffmpeg = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
    'color=c=red:s=48x48:r=10:d=1', '-c:v', 'mpeg4', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'],
    { maxBuffer: 4 * 1024 * 1024, timeout: 5000 });
  assert.equal(ffmpeg.error, undefined, 'FFmpeg must be installed for the modern peer integration test');
  assert.equal(ffmpeg.status, 0, ffmpeg.stderr?.toString());
  const png = await Toolkit.getMp4Preview(ffmpeg.stdout, { time: 0, resize: false, silent: false });
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('wrapper renders a synthetic QR with qrcode-terminal small mode', { ...optional, timeout: 8_000 }, async (t) => {
  const qr = (await import('qrcode-terminal')).default;
  let expected;
  qr.generate('SYNTHETIC-OFFLINE-QR', { small: true }, (output) => { expected = output; });
  assert.ok(expected.length > 10);
  const dir = await mkdtemp(path.join(tmpdir(), 'whatsbibz-qr-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const connected = once(server, 'connection');
  const logger = { info() {}, warn() {}, error() {}, ok() {}, debug() {} };
  const client = await createBibzWhats({ authDir: dir, preserveSession: true, printQR: true, logger, fetchLatestVersion: false,
    socketConfig: { waWebSocketUrl: `ws://127.0.0.1:${server.address().port}/ws/chat`, connectTimeoutMs: 5000,
      autoFollowChannel: false, banner: false } });
  const oldLog = console.log;
  try {
    await connected;
    let resolveRendered;
    const rendered = new Promise((resolve) => { resolveRendered = resolve; });
    console.log = (output) => { if (output === expected) resolveRendered(); };
    client.sock.ev.emit('connection.update', { qr: 'SYNTHETIC-OFFLINE-QR' });
    let timer;
    try { await Promise.race([rendered, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('QR small-mode output not observed')), 3000); })]); }
    finally { clearTimeout(timer); }
  } finally {
    console.log = oldLog;
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

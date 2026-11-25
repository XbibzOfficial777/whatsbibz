import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { AudioFeeder } from '../lib/VoIP/audio-feeder.js';

const available = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', timeout: 5000 }).status === 0;
const ff = { skip: available ? false : 'requires FFmpeg' };

async function feed(duration, timeoutMs = 7000) {
  const chunks = [];
  const errors = [];
  let feeder;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { feeder?.stop(); reject(new Error('audio feeder timeout')); }, timeoutMs);
    feeder = new AudioFeeder(16000, 1, 320, (chunk) => chunks.push(chunk),
      `lavfi:sine=frequency=880:sample_rate=16000:duration=${duration}`,
      { onError: (err) => errors.push(err.code), onFinished: () => { clearTimeout(timeout); feeder.stop(); resolve(); } });
    feeder.start();
  });
  return { chunks, feeder, errors };
}

test('short audio drains after FFmpeg has exited instead of losing all buffered frames', ff, async () => {
  const { chunks, feeder, errors } = await feed(0.12);
  assert.deepEqual(errors, []);
  assert.equal(chunks.length, 6);
  assert.equal(feeder.bytesProduced, 16000 * 0.12 * 4);
  assert.ok(chunks.every((c) => c.length === 320 && c.some((v) => Math.abs(v) > 0.01)));
});

test('partial final frame is padded and delivered', ff, async () => {
  const { chunks, errors } = await feed(0.025);
  assert.deepEqual(errors, []);
  assert.equal(chunks.length, 2);
  assert.ok(chunks[1].slice(0, 80).some((v) => Math.abs(v) > 0.01));
  assert.ok(chunks[1].slice(80).every((v) => v === 0));
});

test('bounded backpressure preserves every frame of a source longer than the queue', ff, async () => {
  const { chunks, feeder, errors } = await feed(2.4);
  assert.deepEqual(errors, []);
  assert.equal(chunks.length, 120);
  assert.equal(feeder.bytesProduced, 16000 * 2.4 * 4);
  assert.equal(feeder.droppedChunks, 0);
});

test('missing FFmpeg is reported without leaking source URL or an uncaught error', async () => {
  const errors = [];
  const feeder = new AudioFeeder(16000, 1, 320, () => {}, 'https://private.example/file?token=SECRET', {
    ffmpegPath: '/nonexistent/ffmpeg', onError: (error) => errors.push(error),
  });
  feeder.start();
  await delay(100);
  feeder.stop();
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'FFMPEG_NOT_FOUND');
  assert.doesNotMatch(errors[0].message, /SECRET|https|private/);
});

test('stop is idempotent and silences old process callbacks', ff, async () => {
  let emitted = 0, finished = 0;
  const feeder = new AudioFeeder(16000, 1, 320, () => emitted++, 'lavfi:sine=frequency=440:duration=3', {
    onFinished: () => finished++,
  });
  feeder.start(); feeder.stop(); feeder.stop();
  await delay(200);
  assert.equal(emitted, 0);
  assert.equal(finished, 0);
});

test('stopping a backpressured infinite source releases the FFmpeg child and Node exits', ff, () => {
  const code = `
    import { AudioFeeder } from './lib/VoIP/audio-feeder.js';
    const feeder = new AudioFeeder(16000, 1, 320, () => {}, 'silence');
    feeder.start();
    await new Promise((r) => setTimeout(r, 700));
    feeder.stop();
    console.log('FEEDER_STOPPED');
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 5_000,
  });
  assert.equal(child.error, undefined, `feeder child did not exit: ${child.error?.message}`);
  assert.equal(child.status, 0, `feeder child failed: ${child.stderr?.slice(-1000)}`);
  assert.match(child.stdout, /FEEDER_STOPPED/);
});

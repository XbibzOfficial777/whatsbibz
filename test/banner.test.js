// BibzWhats — banner ASCII "WhatsBibz." (Small Slant + filter pelangi).
// Memastikan teks polos identik dengan render figlet, kode warna ANSI konsisten
// (strip-able), dan deteksi warna menghormati NO_COLOR / FORCE_COLOR / TTY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { BANNER_TEXT, renderBanner, printBanner, colorEnabled, BANNER_FILTER, BANNER_FONT, BIBZWHATS_VERSION } from '../lib/index.js';

const { version: packageVersion } = createRequire(import.meta.url)('../package.json');

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const tty = { isTTY: true };
const notty = { isTTY: false };

test('BANNER_TEXT: Small Slant logo and version exactly match package.json', () => {
  const lines = BANNER_TEXT.split('\n');
  assert.equal(lines.length, 5);
  assert.ok(BANNER_TEXT.includes('____'), 'memuat glyph khas Small Slant');
  assert.ok(BANNER_TEXT.includes('_ /'), 'memuat glyph miring');
  assert.equal(BANNER_FONT, 'Small Slant');
  assert.equal(BANNER_FILTER, 'Rainbow 2');
  assert.equal(BIBZWHATS_VERSION, packageVersion);
  assert.match(lines[4], new RegExp(`WhatsBibz v${packageVersion.replaceAll('.', '\\.')}$`));
  assert.ok(lines.slice(0, 4).every((l) => l.length >= 30));
});

test('renderBanner({color:false}) sama persis dengan BANNER_TEXT', () => {
  assert.equal(renderBanner({ color: false }), BANNER_TEXT);
});

test('renderBanner berwarna: mengandung ANSI dan hasil strip = versi polos', () => {
  const colored = renderBanner({ color: true, env: { COLORTERM: 'truecolor' } });
  assert.ok(colored.includes('\x1b['), 'harus memuat kode ANSI');
  assert.notEqual(colored, BANNER_TEXT);
  assert.equal(stripAnsi(colored), BANNER_TEXT);
});

test('colorEnabled menghormati NO_COLOR, FORCE_COLOR, dan TTY', () => {
  assert.equal(colorEnabled({ env: { NO_COLOR: '1' }, stream: tty }), false);
  assert.equal(colorEnabled({ env: { FORCE_COLOR: '1' }, stream: notty }), true);
  assert.equal(colorEnabled({ env: {}, stream: notty }), false);
  assert.equal(colorEnabled({ env: {}, stream: tty }), true);
  assert.equal(colorEnabled({ env: { TERM: 'dumb' }, stream: tty }), false);
  assert.equal(colorEnabled({ env: { NO_COLOR: '0', FORCE_COLOR: '1' }, stream: tty }), true);
});

test('printBanner menulis banner dan tidak melempar', () => {
  let output = '';
  const ok = printBanner({
    color: false,
    write: (chunk) => {
      output += chunk;
    },
  });
  assert.equal(ok, true);
  assert.ok(output.endsWith('\n'));
  assert.equal(output.trimEnd(), BANNER_TEXT);
});

test('automatic banner is once per process, stderr-only, and opts out without import side effects', () => {
  const code = `
    import { printAutomaticBanner } from './lib/BibzWhats/banner.js';
    const assert = (v) => { if (!v) process.exit(2); };
    assert(printAutomaticBanner(false) === false);
    assert(printAutomaticBanner(undefined, { env: { WHATSBIBZ_BANNER: '0' }, stream: process.stderr }) === false);
    assert(printAutomaticBanner(undefined) === true);
    assert(printAutomaticBanner(true) === false);
    process.stdout.write('DATA');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8', cwd: process.cwd(), env: { ...process.env, WHATSBIBZ_BANNER: '1', NO_COLOR: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'DATA');
  assert.equal((result.stderr.match(/WhatsBibz v/g) ?? []).length, 1);
  assert.ok(result.stderr.includes(`WhatsBibz v${packageVersion}`));
  assert.ok(!result.stderr.includes('\x1b['));
  const noImportSideEffect = spawnSync(process.execPath, ['--input-type=module', '-e', "import './lib/BibzWhats/banner.js';"], { encoding: 'utf8' });
  assert.equal(noImportSideEffect.status, 0);
  assert.equal(noImportSideEffect.stdout, '');
  assert.equal(noImportSideEffect.stderr, '');
});

test('automatic banner is integrated into low-level socket and wrapper forwards its opt-out', async () => {
  const { readFile } = await import('node:fs/promises');
  const socket = await readFile('lib/Socket/socket.js', 'utf8');
  const client = await readFile('lib/BibzWhats/client.js', 'utf8');
  assert.match(socket, /printAutomaticBanner\(config\.banner\)/);
  assert.match(client, /banner:\s*opts\.banner/);
});

test('real offline wrapper and low-level socket print once, and false/env suppress output', () => {
  const code = `
    import fs from 'node:fs/promises';
    import os from 'node:os';
    import path from 'node:path';
    import pino from 'pino';
    import makeWASocket, { createBibzWhats, useMultiFileAuthState } from './lib/index.js';
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'banner-socket-offline-'));
    const silent = { info() {}, warn() {}, error() {}, ok() {}, debug() {} };
    try {
      const opts = { waWebSocketUrl: 'ws://127.0.0.1:9/ws/chat', connectTimeoutMs: 300, autoFollowChannel: false };
      const client = await createBibzWhats({ authDir: dir, banner: process.env.BANNER_CASE === 'forced' ? true : false,
        logger: silent, fetchLatestVersion: false, socketConfig: opts });
      const auth = await useMultiFileAuthState(path.join(dir, 'other'));
      const sock = makeWASocket({ ...opts, auth: auth.state, logger: pino({ level: 'silent' }),
        banner: process.env.BANNER_CASE === 'forced' ? true : undefined });
      await Promise.all([client.close(), sock.end()]);
      process.stdout.write('DONE');
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  `;
  for (const [scenario, count] of [['forced', 1], ['disabled', 0]]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      encoding: 'utf8', cwd: process.cwd(), timeout: 10_000,
      env: { ...process.env, WHATSBIBZ_BANNER: '0', NO_COLOR: '1', BANNER_CASE: scenario },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'DONE');
    assert.equal((result.stderr.match(/WhatsBibz v/g) ?? []).length, count);
    if (count) assert.ok(result.stderr.includes(`WhatsBibz v${packageVersion}`));
  }
});

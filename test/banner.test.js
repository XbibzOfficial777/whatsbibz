// BibzWhats — banner ASCII "WhatsBibz." (Small Slant + filter pelangi).
// Memastikan teks polos identik dengan render figlet, kode warna ANSI konsisten
// (strip-able), dan deteksi warna menghormati NO_COLOR / FORCE_COLOR / TTY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BANNER_TEXT, renderBanner, printBanner, colorEnabled, BANNER_FILTER, BANNER_FONT } from '../lib/index.js';

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const tty = { isTTY: true };
const notty = { isTTY: false };

test('BANNER_TEXT: 4 baris Small Slant dari renderer figlet', () => {
  const lines = BANNER_TEXT.split('\n');
  assert.equal(lines.length, 4);
  assert.ok(BANNER_TEXT.includes('____'), 'memuat glyph khas Small Slant');
  assert.ok(BANNER_TEXT.includes('_ /'), 'memuat glyph miring');
  assert.equal(BANNER_FONT, 'Small Slant');
  assert.equal(BANNER_FILTER, 'Rainbow 2');
  // setiap baris cukup lebar (banner proporsional)
  assert.ok(lines.every((l) => l.length >= 30));
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

// Regression inventory: library-owned automatic follows have one hard-coded target.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_AUTO_FOLLOW_CHANNEL_JID } from '../lib/Defaults/index.js';

function* javascriptFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* javascriptFiles(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) yield full;
  }
}

test('runtime JavaScript contains exactly one hard-coded numeric newsletter JID', () => {
  const ids = new Set();
  for (const file of javascriptFiles('lib')) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(?<![0-9])[0-9]{8,}@newsletter\b/g)) ids.add(match[0]);
  }
  assert.deepEqual([...ids], [DEFAULT_AUTO_FOLLOW_CHANNEL_JID]);
  assert.equal(DEFAULT_AUTO_FOLLOW_CHANNEL_JID, '120363333911663927@newsletter');
});

test('automatic controller rejects any different target even when directly imported', async () => {
  const { installAutoFollowChannel, resolveAutoFollowChannelConfig } = await import('../lib/Socket/auto-follow-channel.js');
  for (const target of ['42@newsletter', '999999999999999999@newsletter']) {
    assert.throws(() => resolveAutoFollowChannelConfig({ autoFollowChannelJid: target }), /fixed/);
    assert.throws(() => installAutoFollowChannel({}, { enabled: true, jid: target }), /auto-follow settings/);
  }
});

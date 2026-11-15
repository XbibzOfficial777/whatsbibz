import test from 'node:test';
import assert from 'node:assert/strict';
import { Console } from 'node:console';
import { inspect } from 'node:util';
import { Writable } from 'node:stream';
import * as libsignal from 'libsignal';
// Import the real integration; it installs the guard on this dependency instance.
import '../lib/Signal/libsignal.js';

function makeEntry(keyId = 0) {
  const entry = libsignal.SessionRecord.createEntry();
  entry.registrationId = 1001;
  entry.indexInfo = {
    baseKey: Buffer.from([keyId]),
    baseKeyType: 1,
    closed: -1,
    used: 1,
    created: 1,
    remoteIdentityKey: Buffer.alloc(33, 3),
  };
  entry.currentRatchet = {
    ephemeralKeyPair: { pubKey: Buffer.alloc(33, 4), privKey: Buffer.alloc(32, 0xab) },
    lastRemoteEphemeralKey: Buffer.alloc(33, 5),
    previousCounter: 0,
    rootKey: Buffer.alloc(32, 0xcd),
  };
  entry.addChain(Buffer.from([keyId, 10]), {
    chainKey: { counter: 0, key: Buffer.alloc(32, 0xef) },
    chainType: 2,
    messageKeys: {},
  });
  return entry;
}

test('libsignal session console logging redacts the actual entry and keeps state intact', () => {
  const record = new libsignal.SessionRecord();
  const entry = makeEntry();
  record.setSession(entry);
  assert.equal(inspect(entry), '[Signal SessionEntry redacted]');

  let output = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  const localConsole = new Console({ stdout: stream, stderr: stream, colorMode: false });
  const originalInfo = console.info;
  const originalWarn = console.warn;
  try {
    // libsignal itself performs these four console calls; the capture uses a
    // real Node Console rather than inspecting mocked arguments.
    console.info = localConsole.info.bind(localConsole);
    console.warn = localConsole.warn.bind(localConsole);
    record.closeSession(entry);
    record.closeSession(entry); // already-closed warning includes the entry
    record.openSession(entry);
    const prune = new libsignal.SessionRecord();
    for (let i = 0; i < 41; i++) {
      const old = makeEntry(i);
      old.indexInfo.closed = i + 1;
      prune.setSession(old);
    }
    prune.removeOldSessions();
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
  for (const text of ['Closing session:', 'Session already closed', 'Opening session:', 'Removing old closed session:']) {
    assert.ok(output.includes(text), `expected ${text}`);
  }
  assert.equal((output.match(/\[Signal SessionEntry redacted\]/g) || []).length, 4);
  for (const secret of ['privKey', 'rootKey', 'chainKey', 'ab ab ab ab', 'cd cd cd cd', 'ef ef ef ef']) {
    assert.ok(!output.includes(secret), `must not log ${secret}`);
  }

  // Rendering changes only display; key storage and deserialization still work.
  const restored = libsignal.SessionRecord.deserialize(record.serialize());
  const open = restored.getOpenSession();
  assert.equal(inspect(open), '[Signal SessionEntry redacted]');
  assert.deepEqual(open.currentRatchet.ephemeralKeyPair.privKey, entry.currentRatchet.ephemeralKeyPair.privKey);
  assert.deepEqual(open.currentRatchet.rootKey, entry.currentRatchet.rootKey);
});

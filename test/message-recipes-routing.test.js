import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecipeUpsertHandler, recipeChatJids } from '../example/message-recipes.js';

const PN = '12345678901@s.whatsapp.net'; // Synthetic identifiers, never contacted.
const LID = '98765432100@lid';
const OTHER_PN = '11111111111@s.whatsapp.net';
const OTHER_LID = '22222222222@lid';
const sock = { user: { id: '12345678901:17@s.whatsapp.net' }, authState: { creds: { me: { lid: '98765432100:17@lid' } } } };
const message = (id, jid, fromMe, timestamp) => ({
  key: { id, remoteJid: jid, fromMe },
  messageTimestamp: timestamp,
  message: { extendedTextMessage: { text: '.sa', contextInfo: { stanzaId: 'quoted', quotedMessage: { videoMessage: {} } } } },
});

test('self-chat opt-in trusts only the authenticated socket PN and LID', () => {
  assert.deepEqual([...recipeChatJids(sock, PN, true)].sort(), [PN, LID].sort());
  assert.deepEqual([...recipeChatJids(sock, LID, true)].sort(), [PN, LID].sort());
  assert.deepEqual([...recipeChatJids(sock, PN, false)], [PN]);
  assert.throws(() => recipeChatJids(sock, OTHER_PN, true), /own chat/);
  assert.throws(() => recipeChatJids(sock, OTHER_LID, true), /own chat/);
  assert.throws(() => recipeChatJids(sock, '123@g.us', false), /private-chat/);
});

test('fresh own replies arrive on PN or LID in notify or append; old and other-chat messages never replay', async () => {
  const readyAt = Date.now();
  const nowSeconds = Math.floor(readyAt / 1000);
  const calls = [];
  const seen = new Set();
  const handler = createRecipeUpsertHandler(sock, {
    allowedJid: PN, allowOwnCommands: true, readyAt, seen,
    handle: async (_sock, m, options) => { calls.push({ id: m.key.id, jid: options.allowedJid, own: options.allowOwnCommands }); },
  });
  const freshPn = message('fresh-pn', PN, true, nowSeconds);
  const freshLid = message('fresh-lid', LID, true, nowSeconds);
  await handler({ type: 'notify', messages: [
    message('history-notify', LID, true, nowSeconds - 90),
    message('other-pn', OTHER_PN, true, nowSeconds),
    message('other-lid', OTHER_LID, true, nowSeconds),
    message('missing-time', LID, true, 0),
    message('future-time', LID, true, nowSeconds + 500),
    freshPn,
  ] });
  await handler({ type: 'append', messages: [
    message('history-append', LID, true, nowSeconds - 90),
    message('not-self-append', LID, false, nowSeconds), freshLid,
  ] });
  // Duplicate batches and reconnects share the same in-memory ID guard.
  await handler({ type: 'notify', messages: [freshPn, freshLid] });
  const afterReconnect = createRecipeUpsertHandler(sock, {
    allowedJid: LID, allowOwnCommands: true, readyAt, seen,
    handle: async (_sock, m) => { calls.push({ id: m.key.id }); },
  });
  await afterReconnect({ type: 'notify', messages: [freshLid] });
  assert.deepEqual(calls, [
    { id: 'fresh-pn', jid: PN, own: true },
    { id: 'fresh-lid', jid: LID, own: true },
  ]);
});

test('by default only an explicitly authorized chat can send inbound commands and self events are ignored', async () => {
  const readyAt = Date.now();
  const nowSeconds = Math.floor(readyAt / 1000);
  const ids = [];
  const handler = createRecipeUpsertHandler(sock, {
    allowedJid: PN, readyAt, handle: async (_sock, m) => { ids.push(m.key.id); },
  });
  await handler({ type: 'notify', messages: [
    message('own-pn', PN, true, nowSeconds),
    message('other-lid', LID, false, nowSeconds),
    message('correct-inbound', PN, false, nowSeconds),
  ] });
  await handler({ type: 'append', messages: [message('append-inbound', PN, false, nowSeconds)] });
  assert.deepEqual(ids, ['correct-inbound']);
});

test('simultaneous duplicate batches are deduplicated before the async handler finishes', async () => {
  const readyAt = Date.now();
  let calls = 0;
  const handler = createRecipeUpsertHandler(sock, {
    allowedJid: PN, allowOwnCommands: true, readyAt,
    handle: async () => { calls++; await new Promise(r => setTimeout(r, 20)); },
  });
  const msg = message('same-id', LID, true, Math.floor(readyAt / 1000));
  await Promise.all([handler({ type: 'notify', messages: [msg] }), handler({ type: 'append', messages: [msg] })]);
  assert.equal(calls, 1);
});

---
title: Implementation examples
description: ESM patterns for a restricted echo bot, pairing, media, buttons, and graceful shutdown.
---

# Implementation examples

These examples use `createBibzWhats()` and assume socket handlers are registered on every `ready`. Adapt JID validation, authorization, storage, rate limits, and error handling to your own application.

## A restricted text command

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/echo-session',
});

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const item = extractMessage(message);
      if (item?.type !== 'text') continue;
      if (item.text.trim().toLowerCase() === 'status') {
        await sendText(sock, message.key.remoteJid, 'The client is available.', { quoted: message });
      }
    }
  });
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

This handles one allow-listed command rather than forwarding every message. A production app should add per-user authorization, redacted logs, an idempotency store, and a queue.

## Pair with QR

```js
import { createBibzWhats } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  authDir: './data/qr-session',
  printQR: true, // requires optional peer qrcode-terminal
});

client.on('ready', (sock) => console.log('Socket ready:', Boolean(sock)));
client.on('pairing-code', () => console.log('The server issued a pairing code.'));
client.on('give-up', (reason) => console.error('Operator action required:', reason));
```

For a web UI, handle `qr` and show it only to an authorized operator. You do not need `printQR` if the application renders the event itself.

## Send a photo buffer

```js
import { readFile } from 'node:fs/promises';
import { sendMedia } from '@xbibzlibrary/whatsbibz';

const photo = await readFile('./report.png');
const outcome = await sendMedia(sock, recipientJid, {
  image: photo,
  mimetype: 'image/png',
  caption: 'Monthly report',
  fileName: 'report.png',
}, { fallbackToDocument: true });

if (!outcome.result) console.error('Send failed:', outcome.error);
```

Validate the path, file size, and media type before reading the file. Do not use a path supplied directly by an incoming message.

## Reply to a known button

```js
const item = extractMessage(message);
const replies = new Map([
  ['help', 'Here are the available guides.'],
  ['status', 'The service status is available.'],
]);

if (item?.type === 'button' && replies.has(item.buttonId)) {
  await sendText(sock, message.key.remoteJid, replies.get(item.buttonId), { quoted: message });
}
```

Do not execute button text as a shell command, SQL, or URL. Check the JID, permissions, and session state before sensitive actions.

## Try the low-level API

```js
import makeWASocket, { useMultiFileAuthState } from '@xbibzlibrary/whatsbibz';

const { state, saveCreds } = await useMultiFileAuthState('./data/manual-session');
const sock = makeWASocket({ auth: state });
sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', ({ connection }) => {
  if (connection === 'open') console.log('Connected');
});
```

This snippet intentionally omits reconnect/shutdown behavior. Do not treat it as a production lifecycle; read the [low-level API guide](/en/guide/low-level-api).
## Single-process worker with a bounded queue

This pattern demonstrates local backpressure, structured logging, reconnect-safe socket listeners, and draining the queue during shutdown. Install these as application dependencies:

```bash
npm install p-queue pino
```

```js
import PQueue from 'p-queue';
import pino from 'pino';
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const outbound = new PQueue({ concurrency: 1, intervalCap: 1, interval: 1200 });
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/account-a-session',
});
let stopping = false;
let attachedSocket = null;

async function onMessages({ messages, type }) {
  if (type !== 'notify' || stopping) return;
  for (const message of messages) {
    if (stopping) break;
    const id = message.key.id;
    const jid = message.key.remoteJid;
    if (!id || !jid || message.key.fromMe || !message.message) continue;
    const item = extractMessage(message);
    if (item?.type !== 'text' || item.text.trim().toLowerCase() !== 'status') continue;

    try {
      await outbound.add(async () => {
        const active = client.sock;
        if (!active || !client.isConnected()) throw new Error('Socket is unavailable');
        const result = await sendText(active, jid, 'Service is available.', { quoted: message });
        if (!result.ok) throw result.error ?? new Error('sendText failed');
      });
    } catch (error) {
      logger.error({ event: 'reply_failed', messageId: id, err: error }, 'Reply was not sent');
    }
  }
}

client.on('ready', (sock) => {
  if (attachedSocket) attachedSocket.ev.off('messages.upsert', onMessages);
  attachedSocket = sock;
  sock.ev.on('messages.upsert', onMessages);
});
client.on('reconnecting', (info) => logger.warn({ event: 'reconnecting', ...info }, 'Reconnect scheduled'));

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'Stopping worker');
  outbound.pause();
  await outbound.onIdle();
  client.close();
}
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
```

::: warning Scope of this example
The queue and limit above are process-local, not a universal safe WhatsApp rate. Tune throughput to applicable service policies. Multiple workers need a shared queue; exactly-once processing needs a database unique constraint on `message.key.id`. Add per-user authorization and log redaction before adapting this pattern to a real bot.
:::

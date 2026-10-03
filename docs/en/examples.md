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

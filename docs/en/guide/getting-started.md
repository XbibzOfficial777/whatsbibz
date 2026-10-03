---
title: Getting started
description: Node.js requirements, ESM installation, QR or pairing-code setup, and your first message.
---

# Getting started

This guide creates a first client from an empty Node.js project. WhatsBibz is an ESM package and requires Node.js 20 or later.

## 1. Create a project

```bash
mkdir wa-bot && cd wa-bot
npm init -y
npm pkg set type=module
npm install @xbibzlibrary/whatsbibz
```

Keep the phone number with its country calling code in an environment variable. The pairing number is digits only: no `+`, spaces, or local leading `0`. Never commit credentials, pairing codes, or session files.

```bash
# macOS / Linux
export WHATSAPP_PHONE=6281234567890
```

In Windows PowerShell, use `$env:WHATSAPP_PHONE = '6281234567890'`. The number is needed when linking a device; after pairing, credentials are saved in the configured `authDir`.

## 2. Create `index.js`

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/whatsbibz-session',
});

client.on('pairing-code', (code, meta) => {
  console.log('Pairing code (show only in a private operator terminal):', code, meta.custom ? '(custom)' : '(issued by WhatsApp)');
});
client.on('qr', (qr) => console.log('QR is available for an operator QR renderer:', qr));
client.on('give-up', (message) => console.error('Client stopped retrying:', message));

client.on('ready', (sock) => {
  // `ready` is emitted for each new socket. Reattach handlers after reconnects.
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const incoming = extractMessage(message);
      if (incoming?.type === 'text' && incoming.text.trim().toLowerCase() === 'ping') {
        const result = await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
        if (!result.ok) console.error('Reply failed:', result.error);
      }
    }
  });
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

Run `node index.js`. If `phone` is set, WhatsBibz requests a pairing code when the device has not been linked. If the number is unset, WhatsApp sends a QR; handle the `qr` event or set `printQR: true` with the optional `qrcode-terminal` peer dependency.

## 3. Link the device on your phone

For a pairing code, open WhatsApp on the phone and choose **Linked devices → Link a device → Link with phone number**, then enter the code shown in your process output. For QR, choose **Link a device** and scan the QR shown by your terminal or UI. Never share an active code or QR: it can authorize a linked device.

A pairing code is emitted only after the server acknowledges the request. Once linked, credentials are saved in `authDir`; a later restart normally reuses that session instead of asking for another code.

## 4. Confirm the connection

Listen for `ready` before using the socket. `client.isConnected()` reports the current status; `client.sock` points at the active socket while `client.initialSock` remains the first socket. Do not attach handlers only to `initialSock` if the client may reconnect.

If no code appears, see [pairing and QR](/en/guide/pairing). If the socket connects but message handlers do not run, read [connection events and reconnects](/en/guide/connection-events) and [troubleshooting](/en/guide/troubleshooting).

## Use the lower-level API

If you want to manage authentication and reconnects yourself, use `makeWASocket()`; see the [low-level API guide](/en/guide/low-level-api). For most bots, start with `createBibzWhats()` so pairing, timer management, and session recovery have one owner.

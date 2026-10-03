---
title: FAQ
description: Answers about Node.js, pairing, sessions, reconnects, ESM, and WhatsApp compatibility.
---

# FAQ

## Is WhatsBibz an official WhatsApp API?

No. WhatsBibz is a third-party client for WhatsApp Web. It is not the official WhatsApp Business Platform, is not sponsored by Meta, and its protocol or features may change or be restricted.

## Which Node.js version is required?

Node.js 20 or later. The package is ESM; a new project can set `"type": "module"` and TypeScript `module`/`moduleResolution` to `NodeNext`.

## Is a pairing code the same as my account password?

It is not a permanent password, but while active a code or QR can authorize a linked device. Do not share it or place it in a public issue/log. Use a private operator channel.

## Should I use QR or a pairing code?

Set `phone` (digits with country calling code) to request a pairing code. Leave it empty to use QR. Use international digits without a `+` sign; see [pairing](/en/guide/pairing).

## Do I have to install qrcode-terminal?

No. `qrcode-terminal` is an optional peer dependency needed only when `printQR: true`. You can handle the `qr` event and render it in your own UI.

## Does reconnect happen automatically?

Yes, when using `createBibzWhats()`. It manages reconnect timers/back-off, normal restarts, automatic identity rotation, and recognized session recovery. You still need to register `sock.ev` handlers on every `ready`. The lower-level `makeWASocket()` API does not manage reconnects.

## Why did the bot stop responding after a brief disconnect?

A listener may have been attached only to the first socket. Register socket listeners inside `client.on('ready', sock => ...)` and use the socket passed to that event; a reconnect creates a new socket.

## What is the difference between `close()` and `logout()`?

`close()` closes the client while preserving credentials for a restart. `logout()` requests server logout and deletes `authDir`; the device must be paired again.

## Can I run multiple accounts?

Yes, with one client and a unique auth directory per account. Do not start two processes with the same session directory.

## Will rich messages and buttons always render?

No. Native Flow and GenAI/rich schemas are subject to protocol changes. Test on target clients and provide a text fallback. Plain text is the most widely supported option.

## Where can I find the latest type signatures?

Check the declarations in the installed package at `node_modules/@xbibzlibrary/whatsbibz/lib/index.d.ts` and the [public exports reference](/en/reference/exports). Repository `main` may be newer than an npm release.

## Does the library increase the sending quota?

No. `sendWithRetry()` retries some request/transport errors; it is not a rate-limit bypass. Apply rate limits, consent, queues, and WhatsApp policy yourself.

## How do I recover a corrupt session?

The wrapper can perform a bounded wipe for recognized session errors. Check `session-wiped`/`give-up`, sanitized logs, and the phone's linked-device list. If necessary, unlink the device and create a new session using a protected `authDir`.

---
title: Low-level API
description: Use makeWASocket to manage authentication, socket events, reconnects, and shutdown yourself.
---

# Low-level API

`makeWASocket()` is a Baileys-compatible socket factory. It gives you control over auth state, events, queries, send methods, and close behavior, but it does not run the `createBibzWhats()` pairing, reconnect, or session-recovery controller.

## Create and persist auth state

```js
import makeWASocket, {
  Browsers,
  fetchLatestWaWebVersion,
  useMultiFileAuthState,
} from '@xbibzlibrary/whatsbibz';

const { state, saveCreds } = await useMultiFileAuthState('./data/low-level-session');
const { version } = await fetchLatestWaWebVersion();

const sock = makeWASocket({
  auth: state,
  version,
  browser: Browsers.macOS('Chrome'),
  syncFullHistory: false,
  markOnlineOnConnect: false,
});

sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) console.log('QR string is available for your authorized operator renderer.');
  if (connection === 'open') console.log('Socket connected.');
  if (connection === 'close') {
    console.error('Socket closed:', lastDisconnect?.error?.message);
    // Apply your own bounded retry policy; do not retry blindly.
  }
});
```

`fetchLatestWaWebVersion()` returns `{ version, isLatest, error? }`; when fetching fails, use the provided fallback version. Validate the response before choosing it. `useMultiFileAuthState()` is convenient for examples and development, but its filesystem implementation is not a transactional distributed production store.

## Reconnects are the application's responsibility

A low-level socket emits `connection.update`, but it does not create wrapper-level `ready`, back-off, auto-wipe, automatic identity rotation, pairing controller, or shutdown guard. Your application must:

1. Persist each `creds.update` consistently.
2. Classify disconnects using `lastDisconnect.error` and `DisconnectReason`.
3. Distinguish `515 restartRequired` from logout/session errors; bound retries and use delay/back-off.
4. Create a new socket using the correct auth state and attach all event handlers again.
5. Avoid running two sockets simultaneously against the same auth directory.
6. Give operators a way to stop retry loops and relink when needed.

If you do not want to implement these policies yourself, use `createBibzWhats()` and its [client lifecycle](/en/guide/client-lifecycle).

## Pairing and events

At the low level, QR data is available in `connection.update.qr`; you are responsible for rendering it securely. Pairing code is available through the socket's `requestPairingCode(phone, code?)` method when the connection is at the correct stage. `createBibzWhats()` manages request timing, code validation/fallback, timeouts, and rate limits; do not assume a raw socket does this work.

`sock.ev` retains Baileys event names such as `messages.upsert`, `creds.update`, `connection.update`, and `groups.update`, along with other declared events. Full types are available through `WASocket` and `SocketConfig`. The socket also exposes `sock.bibz` and compatibility alias `sock.ourin`, both referencing `BibzWhatsEngine`; rich-message helpers are attached to the socket.

## Wrapper vs socket

`createBibzWhats()` uses `makeWASocket()` but owns the higher-level auth flow. It manages multi-file auth, pairing, version fetching, group caching, reconnect timers, auto identity rotation, and session recovery. Do not mix both lifecycle models for one socket or auth state. Choose one model per account.

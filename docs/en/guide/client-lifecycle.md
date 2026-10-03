---
title: Client lifecycle
description: How createBibzWhats creates sockets, completes pairing, reconnects, recovers sessions, and shuts down.
---

# Client lifecycle

`createBibzWhats(options)` is an operational wrapper around `makeWASocket()`. It returns a Promise resolving to a `BibzWhatsClient`, an `EventEmitter` that exposes the Baileys-compatible socket through `client.sock`.

## Startup sequence

1. Options are merged with `BIBZWHATS_DEFAULTS`.
2. Device identity is selected from options, environment, or automatic mode; a previously stable identity is read from `authDir/identity.json`.
3. Credentials are loaded from `authDir`. If the session is corrupt, the wrapper clears the state and starts fresh.
4. The latest WhatsApp Web version is fetched when `fetchLatestVersion` is enabled. If the fetch fails or does not return a verified latest version, the built-in version is used rather than intentionally downgrading.
5. A socket is created, group-metadata caching is connected, and `connection.update` and `creds.update` are observed.
6. Pairing may be followed by a server-requested `515 restartRequired`. This is a normal lifecycle step: the wrapper schedules a replacement socket and then emits `open` and `ready` when it connects.

`await createBibzWhats()` normally resolves after the first socket is created, not after the account is linked. Add event handlers as soon as the Promise resolves; network connection and QR/pairing happen asynchronously.

## Two meanings of ready

- **`open`** means the WebSocket transport is open.
- **`ready`** means that socket can be used by the application. By default, it is emitted for each newly opened socket, including reconnects.
- **`first-ready`** is emitted only once during the lifetime of the `client`.

Attach all `sock.ev` listeners inside the `ready` handler. A socket replaced after reconnect is a new event emitter; its listeners are not moved from the previous socket.

```js
client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', handleMessages);
  sock.ev.on('groups.update', handleGroupUpdate);
});
```

Set `readyOnEveryConnect: false` only if your code intentionally preserves legacy behavior where `ready` fires once. Continue to use `client.sock` to get the active socket.

## Reconnects and session recovery

Ordinary network disconnects use linear back-off: `reconnectStepMs × attempt`, capped by `reconnectMaxMs`, up to `maxReconnectAttempts`. A server-requested `515` restart, identity rotation, and certain pairing cases use their own delay. An unusable session (`401 loggedOut`, `500 badSession`, `411 multideviceMismatch`, or corrupt credentials) can trigger a bounded state wipe controlled by `maxSessionWipes`.

One special case: after a pairing code has been issued, the socket can disconnect before registration completes. The server may reject the old credentials with `401`. The wrapper recognizes pending pairing, replaces the credentials without counting an ordinary wipe, then requests a new code. Observe `reconnecting`, `session-wiped`, and `give-up` for operational visibility.

## Shutdown and logout

`client.close()` stops the pairing controller, cancels reconnect timers, and closes the socket. It preserves auth data so the process can restart using the same `authDir`. Use this for ordinary shutdown.

`await client.logout()` requests a server-side logout and removes the auth folder. This unlinks the device; pairing is required again. Do not call `logout()` as a substitute for `close()` during routine application restarts.

For multiple accounts, create one `client` and a separate `authDir` per account. Never run two clients concurrently against the same session folder.

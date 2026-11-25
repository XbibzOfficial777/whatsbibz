---
title: Client lifecycle
description: How createBibzWhats creates sockets, completes pairing, reconnects, recovers sessions, and shuts down.
---

# Client lifecycle

`createBibzWhats(options)` is an operational wrapper around `makeWASocket()`. It returns a Promise resolving to a `BibzWhatsClient`, an `EventEmitter` that exposes the Baileys-compatible socket through `client.sock`.

## Interactive lifecycle map

<WorkflowCanvas flow="whatsbibz" locale="en" />

Drag cards to rearrange the diagram. Select a node to inspect its responsibility; zoom and reset controls restore the view.

## Startup sequence

1. Options are merged with `BIBZWHATS_DEFAULTS`.
2. Device identity is selected from options, environment, or automatic mode; a previously stable identity is read from `authDir/identity.json`.
3. Credentials are loaded from `authDir`. By default, recovery may clear corrupt state; `preserveSession: true` rejects invalid JSON and some incomplete core credentials without replacing them.
4. When enabled and no `socketConfig.version` is pinned, the WA Web revision is fetched with a 10-second timeout. A valid result no older than the fallback is used; otherwise the built-in version remains.
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

Ordinary disconnects use bounded linear back-off. `401`, `411`, and corrupt credentials can still trigger a bounded state wipe. Generic `500` does not wipe by default; `wipeOnBadSession: true` opts into the destructive legacy behavior.

One special case: after a pairing code has been issued, the socket can disconnect before registration completes. The server may reject the old credentials with `401`. By default the wrapper replaces credentials without counting an ordinary wipe and requests a new code. Observe `reconnecting`, `session-wiped`, and `give-up`.

Set `preserveSession: true` to stop and emit `give-up` rather than perform destructive recovery, including pending-pairing 401. Unreadable/invalid auth JSON and some incomplete core credentials are rejected rather than silently replaced; at startup `createBibzWhats()` rejects its Promise. These checks do not validate the integrity of every file or cryptographic consistency. The option does not prevent explicit `client.logout()`, deletion by the OS/application, or server-side revocation. A revoked device still needs relinking. Run one process per authDir and restrict directory/files to 700/600; never share or commit them.

## Shutdown and logout

`await client.close()` stops pairing, cancels reconnects, closes the socket, and waits for already-triggered credential saves. Save errors are logged. Auth is retained for restart; this is not a guarantee that all key transactions finished or of power-loss durability.

`await client.logout()` requests a server-side logout and removes the auth folder. This unlinks the device; pairing is required again. Do not call `logout()` as a substitute for `close()` during routine application restarts.

For multiple accounts, create one `client` and a separate `authDir` per account. Never run two clients concurrently against the same session folder.

## Further reading

- [Production operations](/en/guide/production-operations)
- [Troubleshooting](/en/guide/troubleshooting)
- [Client events](/en/reference/events)

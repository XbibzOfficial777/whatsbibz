---
title: Client API and events
description: Properties, methods, wrapper events, and listener patterns for BibzWhatsClient.
---

# Client API and events

`createBibzWhats(options?)` returns `Promise<BibzWhatsClient>`. The promise resolves after the initial socket is created, not after pairing or WhatsApp readiness. Use the `ready` event before operating on the active socket. See [client options](/en/reference/client-options) and [message helpers](/en/reference/message-helpers) for related APIs.

## Client properties and methods

| Name | Signature / type | Behavior |
| --- | --- | --- |
| `sock` | `WASocket` or `null` | The active socket; it can change after a reconnect. |
| `initialSock` | `WASocket` | The first socket. Do not attach reconnect-sensitive listeners only to this socket. |
| `identity` | `IdentityDescription` plus `mode`, `source`, `profileId`, and `tried` | Effective companion identity, selection source, profile, and attempted candidates. |
| `options` | `Required<BibzWhatsOptions>` | Effective options used by the wrapper. |
| `isConnected()` | `boolean` | Current active-socket status. |
| `on(event, listener)` | Typed event map → `this` | Register a typed listener. Attach socket-level listeners again from each `ready` event. |
| `once(event, listener)` | Typed event map → `this` | Register a one-shot wrapper listener. |
| `off(event, listener)` | Typed event map → `this` | Remove the same wrapper listener. |
| `close()` | `void` | Stop timers/controllers and close the socket while retaining credentials for restart. |
| `logout()` | `Promise<void>` | Log out on the server and remove `authDir`; the device must be paired again. |

These methods use TypeScript overloads from `BibzWhatsEvents`. `EventEmitter` also inherits standard Node.js methods such as `removeAllListeners()`.

## Wrapper events

| Event | Payload | When to use it |
| --- | --- | --- |
| `pairing-code` | `(code: string, meta: PairingCodeMeta)` | The server issued a pairing code. `meta.custom` indicates a custom code; `meta.fallback` indicates a random fallback. |
| `qr` | `qr: string` | A QR is available for a private operator-facing renderer. |
| `socket` | `sock: WASocket` | A socket was created; use `ready` before using it. |
| `open` | `sock: WASocket` | The WebSocket transport connected. |
| `ready` | `sock: WASocket` | The socket is usable. By default, emitted for the first socket and every reconnect. |
| `first-ready` | `sock: WASocket` | The first readiness event during this client's lifetime. |
| `user` | `digits: string` | The registered account number is available as digits. |
| `close` | `{ status?: number; error?: Error }` | The socket closed; inspect the status before taking action. |
| `reconnecting` | `{ delay: number; attempt: number; fresh: boolean; identity?: string; pairingPending?: boolean }` | The wrapper scheduled another connection. `pairingPending` marks unfinished device registration. |
| `identity-changed` | `IdentityDescription & { profileId: string; reason: string }` | Auto mode switched profiles after a recognized rejection. |
| `session-wiped` | `reason: string` | Session state was cleared for bounded recovery; treat this as an important operational signal. |
| `give-up` | `message: string` | Retry/recovery limits were reached; operator action is required. |
| `connection.update` | `Partial<ConnectionState>` | Raw socket connection updates. For other Baileys-compatible events, use `sock.ev`. |

The exact payload declarations are in `lib/BibzWhats/client.d.ts`. `sock.ev` is the Baileys-compatible socket event map and is separate from the wrapper events above.

## Reconnect-safe listener pattern

```js
function attachSocket(sock) {
  sock.ev.on('messages.upsert', handleMessages);
  sock.ev.on('groups.update', handleGroups);
}

client.on('ready', attachSocket);
client.on('reconnecting', (info) => {
  logger.warn({ event: 'reconnecting', ...info }, 'WhatsApp socket retry scheduled');
});
client.on('session-wiped', (reason) => {
  logger.error({ event: 'session-wiped', reason }, 'Session state was recreated');
});
client.once('give-up', (message) => {
  logger.error({ event: 'give-up', message }, 'Operator intervention required');
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

Attach wrapper listeners immediately after `createBibzWhats()` resolves. Never log QR codes, pairing codes, credentials, message contents, or auth-state objects. For message processing, use non-sensitive update IDs and application-level idempotency.

## `close()` versus `logout()`

Use `close()` for redeploys or graceful shutdown: it stops the socket and timers but retains the linked session. Use `logout()` only when intentionally unlinking the device or removing its session. They are different operations and should not be interchanged.

::: tip Source of truth
The declarations in the installed npm version are authoritative: `node_modules/@xbibzlibrary/whatsbibz/lib/BibzWhats/client.d.ts`. The `main` branch may be newer than the npm release.
:::

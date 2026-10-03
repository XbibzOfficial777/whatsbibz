---
title: Client events and return types
description: Typed WhatsBibz client events, payloads, lifecycle methods, and listener behavior.
---

# Client events and return types

`BibzWhatsClient` is an `EventEmitter` with typed wrapper events. Its socket is Baileys-compatible; events emitted by `client` and events on `sock.ev` are separate surfaces.

## Wrapper events

| Event | Listener payload | When it fires | Operational note |
| --- | --- | --- | --- |
| `pairing-code` | `(code: string, meta: PairingCodeMeta)` | Server accepts a pairing-code request. | `meta` is `{ custom: boolean; fallback: boolean }`. Deliver the code privately. |
| `qr` | `(qr: string)` | A QR string arrives from the socket. | Treat it like a temporary credential; do not log or publish it. |
| `socket` | `(sock: WASocket)` | A socket is created for the client. | Use `ready` for application handlers that require a usable socket. |
| `open` | `(sock: WASocket)` | The WebSocket transport opens. | Transport-open does not by itself mean all application setup is complete. |
| `ready` | `(sock: WASocket)` | A socket is ready for use. | Default: emitted on every new socket. Attach `sock.ev` listeners here. |
| `first-ready` | `(sock: WASocket)` | The first socket becomes ready. | Emitted once per client lifetime. |
| `user` | `(digits: string)` | A connected user identifier is available. | Keep personal identifiers out of routine logs. |
| `close` | `({ status?: number; error?: Error })` | The active socket closes. | Inspect status and error together; a close may be part of normal `515` restart. |
| `reconnecting` | `({ delay: number; attempt: number; fresh: boolean; identity?: string; pairingPending?: boolean })` | The wrapper schedules another connection attempt. | `pairingPending` marks a recognized disconnect during unfinished pairing. |
| `identity-changed` | `IdentityDescription & { profileId: string; reason: string }` | Auto identity rotation selects another profile. | Only applies to automatic mode; do not treat identity as an evasion mechanism. |
| `session-wiped` | `(reason: string)` | A recognized auth-state recovery removes session state. | This is bounded by `maxSessionWipes`; operator visibility is recommended. |
| `give-up` | `(message: string)` | The client stops retrying automatically. | Alert an operator; avoid an infinite manual restart loop. |
| `connection.update` | `(update: Partial<ConnectionState>)` | The wrapper forwards a connection-state update. | For the complete Baileys event surface, use `sock.ev` and the installed declarations. |

The event map is exported as `BibzWhatsEvents`. Pairing and identity payloads are exported as `PairingCodeMeta` and `IdentityDescription`.

## Listener pattern

```ts
import type { BibzWhatsEvents, WASocket } from '@xbibzlibrary/whatsbibz';

function attachSocketHandlers(sock: WASocket) {
  sock.ev.on('messages.upsert', handleMessages);
  sock.ev.on('groups.update', handleGroupUpdate);
}

const onReady: BibzWhatsEvents['ready'] = (sock) => attachSocketHandlers(sock);
client.on('ready', onReady);
client.once('first-ready', () => logger.info('First connection ready'));
client.on('reconnecting', ({ attempt, delay, pairingPending }) => {
  logger.warn({ attempt, delay, pairingPending }, 'Reconnect scheduled');
});
```

Register socket-level handlers inside `ready`, because reconnect creates a new socket. Use `off(event, listener)` to remove a listener that was previously registered with the same function reference.

## Client methods and state

| Member | Signature / result | Notes |
| --- | --- | --- |
| `on(event, listener)` | `this` | Register a typed wrapper listener. |
| `once(event, listener)` | `this` | Register a typed one-time listener. |
| `off(event, listener)` | `this` | Remove the matching listener. |
| `isConnected()` | `boolean` | Current connection state; suitable for a readiness probe, not a guarantee the next send will succeed. |
| `sock` | `WASocket \| null` | Active socket; changes after reconnect. |
| `initialSock` | `WASocket` | First socket only; do not use it as a reconnect-safe reference. |
| `identity` | `IdentityDescription` plus mode/source/profile/tried metadata | Effective companion identity selected by the client. |
| `close()` | `void` | Stop pairing/reconnect timers and close the socket while retaining auth state. |
| `logout()` | `Promise<void>` | Log out and remove the auth directory; relinking is required. |

::: warning Listener placement
`ready` is emitted on every connection by default. Do not attach message handlers only to `initialSock`, and do not start two clients against the same `authDir`.
:::

## Related references

- [Client options](/reference/client-options)
- [Client lifecycle](/guide/client-lifecycle)
- [Message helpers](/reference/message-helpers)
- [Low-level socket API](/guide/low-level-api)
- [Troubleshooting](/guide/troubleshooting)

---
title: Connection and events
description: Distinguish client and socket events, handle reconnects, and attach listeners to each active socket.
---

# Connection and events

The high-level client is an `EventEmitter`; the active socket has a separate Baileys event emitter at `sock.ev`. These are different objects. Wrapper events communicate lifecycle state; socket events carry messages, credentials, group changes, and protocol updates.

## Attach message listeners to the active socket

```js
client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      console.log('Incoming message ID:', message.key.id);
    }
  });
});
```

The wrapper creates a new socket after reconnect. Listeners on the previous socket do not move to the new one. Attaching only to `client.initialSock` can therefore make a bot appear to stop responding after a reconnect. By default, `ready` is emitted for each newly opened socket; use `first-ready` for one-time global setup.

## Main wrapper events

| Event | Payload | Purpose |
|---|---|---|
| `socket` | `(sock)` | A new socket was created; it may not yet be ready for application work. |
| `pairing-code` | `(code, { custom, fallback })` | The server acknowledged a pairing code. |
| `qr` | `(qr)` | QR data is available, directly or as a fallback. |
| `open` | `(sock)` | The connection is open. |
| `ready` | `(sock)` | New socket is ready; attach socket listeners here. |
| `first-ready` | `(sock)` | First readiness only. |
| `user` | `(digits)` | The connected account number is known. |
| `connection.update` | `(update)` | Raw connection update forwarded by the wrapper. |
| `close` | `({ status, error })` | Socket closed; status comes from the disconnect reason/status code. |
| `reconnecting` | `({ delay, attempt, fresh, identity?, pairingPending? })` | A reconnect is scheduled; `fresh` means new credentials will be used. |
| `identity-changed` | identity info | Auto mode changed profile after a supported identity rejection. |
| `session-wiped` | `(reason)` | Auth state was cleared for recovery. |
| `give-up` | `(message)` | A retry/recovery limit was reached and needs operator attention. |

The event types are declared in `BibzWhatsEvents` in `lib/BibzWhats/client.d.ts`. A listener that throws should handle its own failure; EventEmitter does not automatically await or retry async work.

## Common socket events

`messages.upsert` carries `{ messages, type }`; new incoming messages commonly use `type: 'notify'`, while history sync or append may use another type. `creds.update` is primarily used by lower-level integrations to persist auth changes. `groups.update` and `groups.upsert` report metadata changes. More socket events are available in the Baileys-compatible socket types and the source for the installed package version.

Do not assume a message event is delivered exactly once. Use `message.key.id` as an idempotency key in your database, and ignore `fromMe` if the bot does not need to process its own messages.

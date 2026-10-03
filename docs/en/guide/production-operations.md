---
title: Production operations
description: Deployment, readiness, logging, queues, idempotency, and WhatsBibz auth-state storage.
---

# Production operations

This guide complements [client lifecycle](/en/guide/client-lifecycle), [session security](/en/guide/session-security), and [troubleshooting](/en/guide/troubleshooting). Use `createBibzWhats()` as the single owner of the socket and state for each account.

::: warning One owner per session
Do not run two processes with the same `authDir`. One process/account, a private persistent auth directory, and a separate queue per account avoid conflicting credential writes and duplicate listeners.
:::

## Service baseline

```sh
npm install @xbibzlibrary/whatsbibz pino p-queue
```

WhatsBibz is an ESM package and requires Node.js 20 or later. Add `"type": "module"` to the service `package.json`, or use the `.mjs` extension for the entrypoint.

```js
import { createServer } from 'node:http';
import pino from 'pino';
import PQueue from 'p-queue';
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const phone = process.env.WHATSAPP_PHONE;
const authDir = process.env.WHATSBIBZ_AUTH_DIR;
if (!authDir) throw new Error('WHATSBIBZ_AUTH_DIR is required');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['auth', 'qr', 'pairingCode', 'token', 'phone', 'WHATSAPP_PHONE'],
});
const outbound = new PQueue({ concurrency: 1 });
const client = await createBibzWhats({ phone, authDir, logger });

client.on('reconnecting', ({ attempt, delay, pairingPending }) => {
  logger.warn({ attempt, delay, pairingPending }, 'Reconnect scheduled');
});
client.on('session-wiped', (reason) => logger.error({ reason }, 'Auth state removed for recovery'));
client.on('give-up', (message) => logger.error({ message }, 'Client stopped retrying'));

client.on('ready', (sock) => {
  // `ready` fires again for each new socket; bind handlers to the active socket.
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) void handleMessage(sock, message);
  });
});

async function handleMessage(sock, message) {
  const jid = message.key.remoteJid;
  const messageId = message.key.id;
  if (!jid || !messageId || message.key.fromMe || !message.message) return;
  const incoming = extractMessage(message);
  if (incoming?.type !== 'text' || incoming.text.trim().toLowerCase() !== 'ping') return;

  try {
    const result = await outbound.add(() => sendText(sock, jid, 'pong', { quoted: message }));
    if (!result.ok) logger.warn({ error: result.error, messageId }, 'Reply was not sent');
  } catch (err) {
    logger.error({ err, messageId }, 'Message handler failed');
  }
}

const server = createServer((req, res) => {
  if (req.url !== '/readyz') { res.writeHead(404).end(); return; }
  const ready = client.isConnected();
  res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: ready ? 'ready' : 'not-ready' }));
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0');

let shutdownPromise;
function shutdown(signal) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    logger.info({ signal }, 'Shutdown started');
    await new Promise((resolve) => server.close(resolve));
    client.close(); // stop the socket/timers before draining the queue
    await outbound.onIdle(); // auth state remains available for the next restart
  })();
  return shutdownPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void shutdown(signal).catch((err) => { logger.error({ err }, 'Shutdown failed'); process.exitCode = 1; }); });
}
```

The example intentionally does not print pairing codes. If automated provisioning is required, route the `pairing-code` event to a private operator channel accessible only to authorized staff; never send it to logs, a public dashboard, or an ordinary chat.

## Readiness, reconnect, and shutdown

- Use `/readyz` as a **readiness probe**. While WhatsApp is reconnecting, return `503` so the application does not report the client as ready.
- Do not turn a brief disconnect into a liveness failure that immediately restarts the container. Allow the built-in reconnect strategy to work; alert on `give-up` or a prolonged outage.
- `ready` fires for every new socket. Reattach socket-level handlers there, and make handlers safe against duplicate processing.
- `close()` stops the socket/timers and retains auth state; `logout()` removes credentials and requires relinking.
- The sample `PQueue` limits one process only and is not durable. For higher throughput, tune per-account concurrency and use a broker/outbox that survives restarts.

## Idempotency and business data

Socket event delivery and sending a reply are not a database transaction. To avoid repeating a command's business side effect, enforce a unique inbound-message key:

```sql
CREATE TABLE processed_wa_messages (
  chat_jid TEXT NOT NULL,
  message_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_jid, message_id)
);

INSERT INTO processed_wa_messages (chat_jid, message_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING
RETURNING 1;
```

Use `(remoteJid, message.key.id)` as the inbound key; if the insert returns no row, skip the duplicate. For critical side effects, write the inbound record and an outbox job in the same transaction. WhatsApp sends are not exactly-once just because an idempotency key exists—track job status, use bounded retries, and monitor failures.

## Container and auth storage

::: code-group
```dockerfile [Dockerfile]
FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .
USER node
CMD ["node", "index.js"]
```

```yaml [compose.yaml]
services:
  whatsbot:
    build: .
    init: true
    restart: unless-stopped
    environment:
      NODE_ENV: production
      WHATSBIBZ_AUTH_DIR: /data/account-a
      WHATSAPP_PHONE: ${WHATSAPP_PHONE:?set WHATSAPP_PHONE}
    volumes:
      - whats-auth:/data
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true

volumes:
  whats-auth:
```
:::

Do not commit `.env`, pairing codes, or `authDir`. Inject secrets at runtime, restrict access to the volume, protect auth backups like active credentials, and use a separate volume per account. Before moving a container to another host, restore the volume before starting the process; never copy one active session to two replicas.

## Logging and alerts

Log connection state, reconnect `attempt` and delay, error category, handler duration, send result, and `messageId` only where needed. Never log QR codes, pairing codes, files, message content, auth JSON, tokens, or full message objects. Pino `redact` is an extra layer; avoid placing secrets in log fields in the first place.

For `515`, `401`, `408`, `428`, `429`, and other statuses with recovery steps, see [troubleshooting](/en/guide/troubleshooting). For access control and credential lifecycle, read [session security](/en/guide/session-security).

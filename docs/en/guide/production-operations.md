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
let draining = false;

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
  if (draining || !jid || !messageId || message.key.fromMe || !message.message) return;
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
  if (req.url === '/livez') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'live' }));
    return;
  }
  if (req.url !== '/readyz') { res.writeHead(404).end(); return; }
  const ready = !draining && client.isConnected();
  res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: ready ? 'ready' : 'not-ready' }));
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0');

let shutdownPromise;
function shutdown(signal) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    logger.info({ signal }, 'Shutdown started');
    draining = true;
    await new Promise((resolve) => server.close(resolve));
    await outbound.onIdle(); // finish queued sends while the socket is still open
    client.close(); // stop the socket/timers and preserve auth state
  })();
  return shutdownPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void shutdown(signal).catch((err) => { logger.error({ err }, 'Shutdown failed'); process.exitCode = 1; }); });
}
```

The example intentionally does not print pairing codes. If automated provisioning is required, route the `pairing-code` event to a private operator channel accessible only to authorized staff; never send it to logs, a public dashboard, or an ordinary chat.

## Readiness, reconnect, and shutdown

- Use `/livez` to confirm the process responds; `/readyz` is the **readiness probe** and returns `503` during reconnect or drain. Do not make liveness depend on WhatsApp.
- Do not turn a brief disconnect into a liveness failure that immediately restarts the container. Allow the built-in reconnect strategy to work; alert on `give-up` or a prolonged outage.
- `ready` fires for every new socket. Reattach socket-level handlers there, and make handlers safe against duplicate processing.
- During shutdown, mark the instance unready, stop intake, wait for the outbound queue to become idle while the socket is still open, then call `close()`. `close()` retains auth state; `logout()` removes credentials and requires relinking.
- The sample `PQueue` limits one process only and is not durable. For higher throughput, tune per-account concurrency and use a broker/outbox that survives restarts.

## Idempotency and business data

Socket event delivery and sending a reply are not a database transaction. To avoid repeating a command's business side effect, enforce a unique inbound-message key:

```sql
CREATE TABLE processed_wa_messages (
  account_id TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  message_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, chat_jid, message_id)
);

INSERT INTO processed_wa_messages (account_id, chat_jid, message_id)
VALUES ($1, $2, $3)
ON CONFLICT DO NOTHING
RETURNING 1;
```

Use `(accountId, remoteJid, message.key.id)` as the inbound key; if the insert returns no row, skip the duplicate. For critical side effects, write the inbound record and an outbox job in the same transaction. WhatsApp sends are not exactly-once just because an idempotency key exists—track job status, use bounded retries, and monitor failures.

### Durable inbox/outbox for critical flows

When a message triggers both a database change and a reply, persist the inbound key and outbound work in the same transaction. Include the account in the key because message IDs can repeat across different WhatsApp accounts. Store only the minimum data; if raw message content must be retained, define encryption, access controls, and retention first.

```sql
CREATE TABLE wa_inbox (
  account_id  text        NOT NULL,
  chat_jid    text        NOT NULL,
  message_id  text        NOT NULL,
  payload     jsonb       NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, chat_jid, message_id)
);

CREATE TABLE wa_outbox (
  id          bigserial   PRIMARY KEY,
  account_id  text        NOT NULL,
  event_key   text        NOT NULL,
  chat_jid    text        NOT NULL,
  payload     jsonb       NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts    integer     NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  sent_ids    jsonb,
  sent_at     timestamptz,
  last_error  text,
  UNIQUE (account_id, event_key)
);

CREATE INDEX wa_outbox_ready_idx
  ON wa_outbox (account_id, available_at, id)
  WHERE status IN ('pending', 'sending');
```

This example uses PostgreSQL `pg`. `applyBusinessChange()` is application code that only writes to the same database; do not call WhatsApp inside the transaction. Add `pg` as a direct application dependency.

```js
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accountId = process.env.WHATSAPP_ACCOUNT_ID;

async function persistInboundAndEnqueueReply(message) {
  const chatJid = message.key.remoteJid;
  const messageId = message.key.id;
  if (message.key.fromMe || !message.message || !accountId || !chatJid || !messageId) return false;
  const incoming = extractMessage(message);
  if (incoming?.type !== 'text' || incoming.text.trim().toLowerCase() !== 'ping') return false;

  const db = await pool.connect();
  let transactionOpen = false;
  try {
    await db.query('BEGIN');
    transactionOpen = true;
    const inserted = await db.query(
      `INSERT INTO wa_inbox (account_id, chat_jid, message_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (account_id, chat_jid, message_id) DO NOTHING`,
      [accountId, chatJid, messageId, JSON.stringify({ type: 'text' })],
    );
    if (inserted.rowCount === 0) {
      await db.query('ROLLBACK');
      transactionOpen = false;
      return false;
    }

    await applyBusinessChange(db, { accountId, chatJid, messageId });
    await db.query(
      `INSERT INTO wa_outbox (account_id, event_key, chat_jid, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (account_id, event_key) DO NOTHING`,
      [accountId, `${chatJid}:${messageId}:reply`, chatJid, JSON.stringify({ text: 'pong' })],
    );
    await db.query('COMMIT');
    transactionOpen = false;
    return true;
  } catch (err) {
    if (transactionOpen) await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    db.release();
  }
}
```

An outbox worker should claim jobs with a lease/`FOR UPDATE SKIP LOCKED`, then send outside the transaction through `sendText(sock, job.chat_jid, job.payload.text)`. Check `{ ok, ids, error }`, save `ids` on success, and retry only transient failures with a bounded attempt count and backoff. If the process stops after WhatsApp accepts a message but before the row is marked `sent`, a duplicate is still possible; a unique key prevents duplicate jobs, not exactly-once delivery.

## Multi-account ownership and queues

| Work unit | Safe pattern | Constraint to enforce |
| --- | --- | --- |
| Socket and auth | One process owner for each account and `authDir`. | Never mount one active auth folder into two containers/clients. |
| Service replicas | Distribute different accounts across workers; keep one owner per account. | Start failover only after the previous owner stops and the volume is exclusively moved. |
| Outbound work | One queue per account; send only through that account owner's socket. | `PQueue` is local. A shared broker needs routing/partitioning by `account_id` and a cross-process limiter. |
| Idempotency | Use `(account_id, chat_jid, message_id)` for inbound work and `event_key` for jobs. | The same chat/message ID may occur on another account; external side effects remain at-least-once. |

Scale first by adding independent accounts, not by opening two active connections for one account. For failover, stop the old client and wait for shutdown before attaching/restoring the auth volume to one new worker. Back up `authDir` as an encrypted secret and never snapshot it while two clients can write to it.

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

## Recovery and deployment runbook

- **Probes:** `/livez` checks only the process; `/readyz` should return `503` during disconnect, prolonged reconnect, or drain. Do not automatically relink after a brief network interruption.
- **Deploy:** canary one account first. Wait for the queue to become idle and preserve `authDir` during shutdown; do not use `logout()` for a routine restart.
- **Restore auth:** stop the old client, restore an encrypted backup to one volume, verify permissions and disk health, then start one owner. Pairing codes must go only to a private operator channel.
- **Alert:** monitor `ready`, `reconnecting`, `session-wiped`, `give-up`, `identity-changed`, queue age, send failures, disk, and offline duration. Operators should review `session-wiped`/`give-up`, not ignore them.
- **Send budget:** tune concurrency/pacing per account and use a shared limiter across workers. Monitor failures and oldest queue age; `PQueue` is not a global WhatsApp quota.

For `515`, `401`, `408`, `428`, `429`, and other statuses with recovery steps, see [troubleshooting](/en/guide/troubleshooting). For access control and credential lifecycle, read [session security](/en/guide/session-security).

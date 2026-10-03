---
title: 生产环境运维
description: WhatsBibz 的部署、就绪检查、日志、队列、幂等处理与 auth 状态存储。
---

# 生产环境运维

本指南补充[客户端生命周期](/zh/guide/client-lifecycle)、[会话安全](/zh/guide/session-security)与[故障排查](/zh/guide/troubleshooting)。每个账号使用一个 `createBibzWhats()` 实例作为 socket 与状态的唯一所有者。

::: warning 每个会话只能有一个所有者
不要让两个进程共用同一个 `authDir`。每个账号使用一个进程、私有且持久化的 auth 目录，以及独立队列，可避免凭据写入冲突和重复 listener。
:::

## Service 基线

```sh
npm install @xbibzlibrary/whatsbibz pino p-queue
```

WhatsBibz 使用 ESM，要求 Node.js 20 或更高版本。请在服务的 `package.json` 中设置 `"type": "module"`，或将入口文件命名为 `.mjs`。

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
  logger.warn({ attempt, delay, pairingPending }, '已安排重新连接');
});
client.on('session-wiped', (reason) => logger.error({ reason }, '恢复流程已删除 auth 状态'));
client.on('give-up', (message) => logger.error({ message }, '客户端已停止重试'));

client.on('ready', (sock) => {
  // 每个新 socket 都会触发 ready；请将 handler 绑定到当前 socket。
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
    if (!result.ok) logger.warn({ error: result.error, messageId }, '回复未发送');
  } catch (err) {
    logger.error({ err, messageId }, '消息 handler 失败');
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
    logger.info({ signal }, '开始关闭');
    draining = true;
    await new Promise((resolve) => server.close(resolve));
    await outbound.onIdle(); // socket 仍打开时等待发送队列完成
    client.close(); // 停止 socket/timer，同时保留 auth 状态
  })();
  return shutdownPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void shutdown(signal).catch((err) => { logger.error({ err }, '关闭失败'); process.exitCode = 1; }); });
}
```

本例不会打印配对码。若需要自动化 provisioning，请将 `pairing-code` event 路由到仅授权运维人员可访问的私密渠道；不要写入日志、公开 dashboard 或普通聊天。

## Readiness、reconnect 与关闭

- 使用 `/livez` 检查进程是否响应；`/readyz` 是 **readiness probe**，在 reconnect 或 drain 时返回 `503`。不要让 liveness 依赖 WhatsApp。
- 不要把短暂断线设置为会立即重启容器的 liveness failure。让内置 reconnect 策略运行；对于 `give-up` 或长时间离线发出告警。
- 每个新 socket 都会触发 `ready`。在该回调重新绑定 socket 级 handler，并让 handler 能安全应对重复处理。
- 关闭时先标记 instance 为未就绪、停止 intake，并在 socket 仍打开时等待 outbound 队列清空，然后调用 `close()`。`close()` 保留 auth 状态；`logout()` 会删除凭据，之后必须重新关联设备。
- 示例中的 `PQueue` 只限制单个进程且不持久化。需要更高吞吐量时，按账号调整并发，并使用可跨重启的 broker/outbox。

## 幂等与业务数据

Socket event delivery 与发送回复不是数据库事务。若要避免重复执行业务 side effect，可对 inbound message 设置唯一键：

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

使用 `(accountId, remoteJid, message.key.id)` 作为 inbound key；insert 未返回行时跳过重复消息。关键 side effect 应在同一事务中写入 inbound 记录和 outbox job。仅有幂等键并不能保证 WhatsApp 发送 exactly-once；请跟踪 job 状态、限制重试次数并监控失败。

### 关键流程的持久化 inbox/outbox

如果一条消息同时触发数据库变更和回复，应在同一事务中保存 inbound key 与 outbound 工作。key 必须包含账号，因为不同 WhatsApp 账号的消息 ID 可能重复。仅保存必要数据；若必须保留原始消息内容，请先定义加密、访问控制和保留期限。

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

以下示例使用 PostgreSQL `pg`。`applyBusinessChange()` 是应用代码，只能写入同一数据库；不要在事务中调用 WhatsApp。请将 `pg` 添加为应用的直接依赖。

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

Outbox worker 应使用 lease/`FOR UPDATE SKIP LOCKED` claim job，然后在事务之外通过 `sendText(sock, job.chat_jid, job.payload.text)` 发送。检查 `{ ok, ids, error }`；成功时保存 `ids`，仅对暂时性错误按有限次数和 backoff 重试。若 WhatsApp 已接收消息但进程在更新 `sent` 状态前停止，仍可能重复发送；唯一 key 防止重复创建 job，但不能保证 exactly-once delivery。

## 多账号所有权与队列

| 工作单元 | 安全模式 | 必须保证的边界 |
| --- | --- | --- |
| Socket 与 auth | 每个账号和 `authDir` 只有一个进程 owner。 | 不要让两个 container/client 挂载同一个活动 auth 目录。 |
| Service replica | 将不同账号分配给不同 worker；一个账号仍只有一个 owner。 | 只有旧 owner 停止且 volume 被独占迁移后才开始故障切换。 |
| Outbound 工作 | 每个账号一条 queue；只能通过该账号 owner 的 socket 发送。 | `PQueue` 仅在本地有效。共享 broker 需按 `account_id` 路由/分区，并配置跨进程 limiter。 |
| 幂等处理 | inbound 使用 `(account_id, chat_jid, message_id)`；job 使用 `event_key`。 | 相同 chat/message ID 可能出现在其他账号；外部副作用仍是 at-least-once。 |

优先通过增加独立账号扩展，而不是为同一账号创建两个活动连接。故障切换时，先停止旧 client 并等待 shutdown 完成，再将 auth volume 独占挂载/恢复到一个新 worker。请将 `authDir` 作为加密 secret 备份；两个 client 可能同时写入时不要创建 snapshot。

## 容器与 auth 存储

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

不要提交 `.env`、配对码或 `authDir`。运行时注入密钥，限制 volume 读取权限，并像保护活动凭据一样保护 auth 备份；每个账号使用独立 volume。迁移容器前先恢复 volume；不要把同一活动 session 复制到两个 replica。

## 日志与告警

按需记录连接状态、reconnect `attempt` 和延迟、错误类别、handler 耗时、发送结果与 `messageId`。不要记录 QR、配对码、文件、消息内容、auth JSON、token 或完整 message object。Pino `redact` 只是额外保护；首先不要把秘密放入日志字段。

## 恢复与部署运行手册

- **Probe：** `/livez` 只检查进程；断线、长时间 reconnect 或 drain 时，`/readyz` 应返回 `503`。短暂网络故障后不要自动重新配对。
- **部署：** 先对一个账号做 canary。shutdown 时等待 queue 清空并保留 `authDir`；常规重启不要调用 `logout()`。
- **恢复 auth：** 停止旧 client，将加密备份恢复到一个 volume，检查权限和磁盘状态，然后启动唯一 owner。配对码只能发送到私密运维渠道。
- **告警：** 监控 `ready`、`reconnecting`、`session-wiped`、`give-up`、`identity-changed`、queue 年龄、发送失败、磁盘和离线时长。运维人员应检查 `session-wiped`/`give-up`，不要忽略。
- **发送预算：** 按账号调整并发和 pacing；多个 worker 时使用共享 limiter。监控失败数与最老 queue 年龄；`PQueue` 不是 WhatsApp 全局配额。

关于 `515`、`401`、`408`、`428`、`429` 等状态及恢复步骤，请查看[故障排查](/zh/guide/troubleshooting)。权限与凭据生命周期请查看[会话安全](/zh/guide/session-security)。

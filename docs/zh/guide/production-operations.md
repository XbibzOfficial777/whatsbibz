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
  if (!jid || !messageId || message.key.fromMe || !message.message) return;
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
    logger.info({ signal }, '开始关闭');
    await new Promise((resolve) => server.close(resolve));
    client.close(); // 先停止 socket/timer，再清空队列
    await outbound.onIdle(); // 为下次重启保留 auth 状态
  })();
  return shutdownPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void shutdown(signal).catch((err) => { logger.error({ err }, '关闭失败'); process.exitCode = 1; }); });
}
```

本例不会打印配对码。若需要自动化 provisioning，请将 `pairing-code` event 路由到仅授权运维人员可访问的私密渠道；不要写入日志、公开 dashboard 或普通聊天。

## Readiness、reconnect 与关闭

- 将 `/readyz` 用作 **readiness probe**。WhatsApp 正在 reconnect 时返回 `503`，避免应用误报 client 已就绪。
- 不要把短暂断线设置为会立即重启容器的 liveness failure。让内置 reconnect 策略运行；对于 `give-up` 或长时间离线发出告警。
- 每个新 socket 都会触发 `ready`。在该回调重新绑定 socket 级 handler，并让 handler 能安全应对重复处理。
- `close()` 停止 socket/timer 并保留 auth 状态；`logout()` 会删除凭据，之后必须重新关联设备。
- 示例中的 `PQueue` 只限制单个进程且不持久化。需要更高吞吐量时，按账号调整并发，并使用可跨重启的 broker/outbox。

## 幂等与业务数据

Socket event delivery 与发送回复不是数据库事务。若要避免重复执行业务 side effect，可对 inbound message 设置唯一键：

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

使用 `(remoteJid, message.key.id)` 作为 inbound key；insert 未返回行时跳过重复消息。关键 side effect 应在同一事务中写入 inbound 记录和 outbox job。仅有幂等键并不能保证 WhatsApp 发送 exactly-once；请跟踪 job 状态、限制重试次数并监控失败。

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

关于 `515`、`401`、`408`、`428`、`429` 等状态及恢复步骤，请查看[故障排查](/zh/guide/troubleshooting)。权限与凭据生命周期请查看[会话安全](/zh/guide/session-security)。

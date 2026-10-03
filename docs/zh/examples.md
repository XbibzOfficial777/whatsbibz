---
title: 实现示例
description: ESM 示例：受限 echo bot、配对、媒体、按钮与 graceful shutdown。
---

# 实现示例

以下示例使用 `createBibzWhats()`，并假设每次 `ready` 都会注册 socket handler。请根据自己的应用完善 JID 验证、权限、存储、rate limit 和错误处理。

## 受限文本命令

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/echo-session',
});

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const item = extractMessage(message);
      if (item?.type !== 'text') continue;
      if (item.text.trim().toLowerCase() === 'status') {
        await sendText(sock, message.key.remoteJid, 'Client 当前可用。', { quoted: message });
      }
    }
  });
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

此示例只处理一个 allow-listed command，而不是转发所有消息。生产应用应增加 per-user authorization、脱敏日志、幂等存储与工作队列。

## 使用 QR 配对

```js
import { createBibzWhats } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  authDir: './data/qr-session',
  printQR: true, // 需要可选 peer qrcode-terminal
});

client.on('ready', (sock) => console.log('Socket 已就绪:', Boolean(sock)));
client.on('pairing-code', () => console.log('Server 已生成配对码。'));
client.on('give-up', (reason) => console.error('需要操作员处理:', reason));
```

若使用 web UI，请处理 `qr` event，并只向获授权操作员显示。应用自行渲染该 event 时无需设置 `printQR`。

## 发送 Buffer 图片

```js
import { readFile } from 'node:fs/promises';
import { sendMedia } from '@xbibzlibrary/whatsbibz';

const photo = await readFile('./report.png');
const outcome = await sendMedia(sock, recipientJid, {
  image: photo,
  mimetype: 'image/png',
  caption: '月度报告',
  fileName: 'report.png',
}, { fallbackToDocument: true });

if (!outcome.result) console.error('发送失败:', outcome.error);
```

读取文件前请检查 path、大小和媒体类型。不要使用消息发送者直接提供的文件路径。

## 回复已知按钮

```js
const item = extractMessage(message);
const replies = new Map([
  ['help', '可查看以下使用指南。'],
  ['status', '服务状态正常。'],
]);

if (item?.type === 'button' && replies.has(item.buttonId)) {
  await sendText(sock, message.key.remoteJid, replies.get(item.buttonId), { quoted: message });
}
```

不要把按钮文本作为 shell command、SQL 或 URL 执行。执行敏感操作前检查 JID、权限和 session 状态。

## 试用底层 API

```js
import makeWASocket, { useMultiFileAuthState } from '@xbibzlibrary/whatsbibz';

const { state, saveCreds } = await useMultiFileAuthState('./data/manual-session');
const sock = makeWASocket({ auth: state });
sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', ({ connection }) => {
  if (connection === 'open') console.log('已连接');
});
```

此 snippet 故意省略 reconnect 与 shutdown。不要将它作为生产 lifecycle；请阅读[底层 API 指南](/zh/guide/low-level-api)。
## 带有界队列的单进程 Worker

此模式演示本地背压、结构化日志、可跨 reconnect 的 socket 监听器，以及 shutdown 时排空队列。请将以下依赖安装在应用项目中：

```bash
npm install p-queue pino
```

```js
import PQueue from 'p-queue';
import pino from 'pino';
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const outbound = new PQueue({ concurrency: 1, intervalCap: 1, interval: 1200 });
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/account-a-session',
});
let stopping = false;
let attachedSocket = null;

async function onMessages({ messages, type }) {
  if (type !== 'notify' || stopping) return;
  for (const message of messages) {
    if (stopping) break;
    const id = message.key.id;
    const jid = message.key.remoteJid;
    if (!id || !jid || message.key.fromMe || !message.message) continue;
    const item = extractMessage(message);
    if (item?.type !== 'text' || item.text.trim().toLowerCase() !== 'status') continue;

    try {
      await outbound.add(async () => {
        const active = client.sock;
        if (!active || !client.isConnected()) throw new Error('Socket 不可用');
        const result = await sendText(active, jid, '服务可用。', { quoted: message });
        if (!result.ok) throw result.error ?? new Error('sendText 失败');
      });
    } catch (error) {
      logger.error({ event: 'reply_failed', messageId: id, err: error }, '回复未发送');
    }
  }
}

client.on('ready', (sock) => {
  if (attachedSocket) attachedSocket.ev.off('messages.upsert', onMessages);
  attachedSocket = sock;
  sock.ev.on('messages.upsert', onMessages);
});
client.on('reconnecting', (info) => logger.warn({ event: 'reconnecting', ...info }, '已安排 reconnect'));

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, '正在停止 worker');
  outbound.pause();
  await outbound.onIdle();
  client.close();
}
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
```

::: warning 示例适用范围
队列与限速只在当前进程内生效，不代表 WhatsApp 的通用安全速率。请遵循适用服务政策并自行调节吞吐量。多个 worker 需要共享队列；exactly-once 处理需要以 `message.key.id` 建立数据库唯一约束。用于真实机器人前还要加入逐用户授权和日志脱敏。
:::

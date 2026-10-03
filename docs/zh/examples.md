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

---
title: 快速开始
description: Node.js 环境要求、ESM 安装、二维码或配对码，以及首次发送消息。
---

# 快速开始

本指南从空白 Node.js 项目开始创建第一个 WhatsBibz client。该软件包使用 ESM，需要 Node.js 20 或更高版本。

## 1. 创建项目

```bash
mkdir wa-bot && cd wa-bot
npm init -y
npm pkg set type=module
npm install @xbibzlibrary/whatsbibz
```

请将包含国家区号的电话号码保存在 environment variable 中。配对号码只包含数字：不要加 `+`、空格或本地号码前缀 `0`。不要将凭据、配对码或 session 文件提交到 Git。

```bash
# macOS / Linux
export WHATSAPP_PHONE=6281234567890
```

Windows PowerShell 中使用 `$env:WHATSAPP_PHONE = '6281234567890'`。该号码只用于关联设备；成功配对后，凭据保存在 `authDir` 中。

## 2. 创建 `index.js`

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/whatsbibz-session',
});

client.on('pairing-code', (code, meta) => {
  console.log('配对码（仅在操作员私密终端显示）:', code, meta.custom ? '(自定义)' : '(WhatsApp 生成)');
});
client.on('qr', (qr) => console.log('收到二维码数据，请交给应用的安全 QR renderer:', qr));
client.on('give-up', (message) => console.error('Client 已停止重试:', message));

client.on('ready', (sock) => {
  // 每个新 socket 都会触发 ready；reconnect 后需要重新绑定监听器。
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const incoming = extractMessage(message);
      if (incoming?.type === 'text' && incoming.text.trim().toLowerCase() === 'ping') {
        const result = await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
        if (!result.ok) console.error('回复失败:', result.error);
      }
    }
  });
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

运行 `node index.js`。如果设置了 `phone`，WhatsBibz 会在设备未关联时请求配对码。如果没有号码，WhatsApp 会发送二维码；监听 `qr` event，或设置 `printQR: true` 并安装可选 peer dependency `qrcode-terminal`。

## 3. 在手机上关联设备

使用配对码时，在手机 WhatsApp 中打开 **已关联的设备 → 关联设备 → 使用电话号码关联**，然后输入进程输出的配对码。使用 QR 时，选择 **关联设备**，扫描 terminal 或 UI 显示的二维码。请勿分享有效的配对码或二维码，因为它们可以授权新的关联设备。

配对码只有在 server 确认 request 后才会触发 event。关联成功后，凭据写入 `authDir`；后续重启通常会继续使用现有 session，不再请求新代码。

## 4. 确认连接

等待 `ready` 后再使用 socket。`client.isConnected()` 返回当前连接状态；`client.sock` 指向当前 active socket，`client.initialSock` 始终指向第一个 socket。如果 client 可能 reconnect，不要只在 `initialSock` 上绑定 handler。

如果没有配对码，请阅读[配对与二维码](/zh/guide/pairing)。如果 socket 已连接但没有消息 event，请查看[连接与事件](/zh/guide/connection-events)和[故障排查](/zh/guide/troubleshooting)。

## 使用底层 API

如果需要自行管理身份验证和 reconnect，可以使用 `makeWASocket()`，具体见[底层 API 指南](/zh/guide/low-level-api)。多数机器人应从 `createBibzWhats()` 开始，让配对、timer 和 session 恢复由同一层负责。

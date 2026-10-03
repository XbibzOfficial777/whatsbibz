---
layout: home
hero:
  name: WhatsBibz
  text: Node.js WhatsApp Web 客户端
  tagline: 配对、设备身份、事件、消息、会话与 Baileys 兼容 API 的实用指南和详细参考。
  image:
    src: /whatsbibz-mark.png
    alt: WhatsBibz 标志
  actions: []
features:
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 6v15M8 7h8M8 11h7"/></svg>'
    title: 清晰地完成首次连接
    details: 安装 ESM 软件包，通过二维码或配对码关联号码，并使用可运行示例发送第一条消息。
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.9 7.5 9.5 4.4-1.6 7.5-5.1 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/></svg>'
    title: 理解连接行为
    details: 了解配对、自动轮换设备身份、重连、会话恢复，以及必须重新绑定的处理器。
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></svg>'
    title: 消息与交互
    details: 查询文本和媒体辅助函数、消息提取、Native Flow 按钮、Rich Message、JID、提及与引用回复。
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4h10v16H7z"/><path d="M10 7h4M10 11h4M10 15h4"/><path d="M4 7v10M20 7v10"/></svg>'
    title: 从高层 API 到底层控制
    details: 常见机器人流程使用 createBibzWhats；需要 Baileys 级别控制时可直接使用 makeWASocket。
---

## 面向实际项目的文档

WhatsBibz 是基于维护中的 Baileys 分支构建的 Node.js 多设备 WhatsApp Web 库。本网站将 README 内容整理为学习路径、运行指南、选项参考、示例与故障排查。可使用搜索查找事件、配置、辅助函数或连接状态。

<div class="ww-card-grid">
  <a class="ww-card" href="./guide/getting-started"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span class="ww-card-copy"><strong>快速开始</strong><span>运行环境、ESM 安装、二维码或配对码，以及首次连接检查。</span></span></a>
  <a class="ww-card" href="./guide/device-identity"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M9 11h6M10 17h4"/></svg></span><span class="ww-card-copy"><strong>设备身份</strong><span>了解自动模式、自定义身份、环境变量优先级和 identity.json。</span></span></a>
  <a class="ww-card" href="./guide/messages"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></svg></span><span class="ww-card-copy"><strong>消息与事件</strong><span>在正确的 Socket 上监听事件、规范化更新并安全处理消息。</span></span></a>
  <a class="ww-card" href="./reference/client-options"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--background)"/><circle cx="15" cy="12" r="2" fill="var(--background)"/><circle cx="7" cy="18" r="2" fill="var(--background)"/></svg></span><span class="ww-card-copy"><strong>选项参考</strong><span>Client 默认值、事件、辅助函数、配对控制器与身份工具。</span></span></a>
</div>

## 集成方式

WhatsBibz 提供两个 API 层。希望由库管理配对、身份验证、重连和会话恢复时，请使用 `createBibzWhats()`。如果应用需要自行管理 auth state 和生命周期，可使用 `makeWASocket()`。两种方式都可访问相同的 Socket 事件和 Baileys 风格方法。

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: 'whatsbibz-session',
});

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const item = extractMessage(message);
      if (item?.type === 'text' && item.text.trim().toLowerCase() === 'ping') {
        await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
      }
    }
  });
});
```

从[安装与配对](/zh/guide/getting-started)开始；部署长期运行的机器人前，请阅读[客户端生命周期](/zh/guide/client-lifecycle)。此示例只处理简单文本；在服务器保存凭据前，请先阅读[会话安全](/zh/guide/session-security)。

## 按任务选择指南

- **关联账号：**[配对与二维码](/zh/guide/pairing)、[设备身份](/zh/guide/device-identity)。
- **处理消息：**[连接事件](/zh/guide/connection-events)、[发送与读取消息](/zh/guide/messages)、[交互消息](/zh/guide/interactive-messages)。
- **安全运行：**[配置](/zh/guide/configuration)、[会话与安全](/zh/guide/session-security)、[故障排查](/zh/guide/troubleshooting)。
- **类型与兼容：**[TypeScript 与迁移](/zh/guide/typescript-migration)、[底层 API](/zh/guide/low-level-api)、[公开导出](/zh/reference/exports)。

<div class="ww-note">
  <strong>重要提示</strong>
  <p>WhatsBibz 是通过 WhatsApp Web 通信的非官方客户端，不是官方 WhatsApp Business Platform，也无法保证账号不会受到限制。请使用自己控制的账号、遵守 WhatsApp 条款、取得接收者同意，并避免发送未经请求的批量消息。</p>
</div>

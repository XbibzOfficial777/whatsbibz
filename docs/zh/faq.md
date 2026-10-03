---
title: 常见问题
description: 关于 Node.js、配对、session、reconnect、ESM 和 WhatsApp 兼容性的答疑。
---

# 常见问题

## WhatsBibz 是官方 WhatsApp API 吗？

不是。WhatsBibz 是用于 WhatsApp Web 的第三方 client，不是官方 WhatsApp Business Platform，也未获得 Meta 赞助。协议与功能可能变化或受到限制。

## 需要哪个 Node.js 版本？

Node.js 20 或更高版本。软件包使用 ESM；新项目可以在 `package.json` 设置 `"type": "module"`，并在 TypeScript 中设置 `module`/`moduleResolution` 为 `NodeNext`。

## 配对码等同账号密码吗？

它不是永久密码，但在有效期内，配对码或 QR 可以授权新 linked device。不要公开分享，也不要放进公开 issue 或日志。请使用私密的 operator channel。

## 应该选择 QR 还是配对码？

设置包含国家区号的纯数字 `phone` 以请求配对码；留空则使用 QR。国际号码不要加 `+`。详见[配对指南](/zh/guide/pairing)。

## 必须安装 qrcode-terminal 吗？

不是必须。只有设置 `printQR: true` 时才需要将 `qrcode-terminal` 作为可选 peer dependency 安装。也可以监听 `qr` event，在自己的 UI 中渲染。

## Reconnect 会自动执行吗？

使用 `createBibzWhats()` 时会自动处理。它管理 reconnect timer/back-off、普通重启、自动 identity rotation 和已识别 session 恢复。应用仍需在每次 `ready` 重新注册 `sock.ev` handler。底层 `makeWASocket()` 不会管理 reconnect。

## 为什么短暂断线后 bot 不再响应？

Listener 可能只绑定在第一个 socket 上。请在 `client.on('ready', sock => ...)` 内注册 socket listener，并使用 event 参数中的 socket；reconnect 会创建新的 socket。

## `close()` 和 `logout()` 有什么区别？

`close()` 关闭 client，但保留 credentials 供进程重启使用。`logout()` 请求 server 端登出并删除 `authDir`；设备需要重新配对。

## 能否运行多个账号？

可以。每个账号使用一个 client 和独立 auth directory。不要让两个 process 同时使用同一个 session directory。

## Rich message 与按钮是否一定能显示？

不能保证。Native Flow 和 GenAI/rich schema 可能随协议变化。请在目标客户端测试并提供文本 fallback。纯文本兼容范围最广。

## 哪里可以查看最新 type signature？

检查已安装 package 的 `node_modules/@xbibzlibrary/whatsbibz/lib/index.d.ts`，并参阅[公开导出参考](/zh/reference/exports)。Repository `main` 可能比 npm release 更新。

## Library 会增加发送额度吗？

不会。`sendWithRetry()` 只会重试部分 request/transport error，不能绕过 rate limit。请自行实现 rate limit、consent、队列并遵守 WhatsApp 政策。

## 如何恢复损坏的 session？

Wrapper 会对已知 session error 执行有限次数的 wipe。检查 `session-wiped`/`give-up`、脱敏日志和手机的 linked-device 列表。必要时解除设备关联，并使用受保护的 `authDir` 创建新 session。

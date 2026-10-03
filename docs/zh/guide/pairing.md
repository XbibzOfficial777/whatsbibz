---
title: 配对与二维码
description: 使用配对码或 QR 关联设备，并了解验证、fallback、刷新和 rate limit。
---

# 配对与二维码

WhatsBibz 使用 WhatsApp linked-device 流程。配对码和 QR 数据都由 server 生成；library 收到对应连接响应后才会触发 event。

## 选择模式

- **配对码：**将完整号码（包含国家区号）以纯数字传入 `phone`，例如 `6281234567890`。在手机上打开 **已关联的设备 → 关联设备 → 使用电话号码关联**，再输入 `pairing-code` event 提供的代码。
- **QR：**将 `phone` 留空，监听 `qr` 并通过应用 UI 或 terminal renderer 显示。`printQR: true` 使用可选 peer dependency `qrcode-terminal`。

```js
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE, // 留空表示使用 QR
  pairingCode: 'XBIBZPRO',           // 可选，8 位 A-Z/0-9
  authDir: './data/account-session',
  printQR: false,
});

client.on('pairing-code', (code, { custom, fallback }) => {
  console.log({ code, custom, fallback });
});
client.on('qr', (qr) => {
  // 仅通过授权操作员可访问的私密 QR renderer 显示 `qr`。
});
```

应用也应在请求代码前确认 `phone` 已设置。没有电话号码时无法请求 pairing code。`createBibzWhats()` 的 Promise 完成并不代表账号已经关联；请等待 `ready` 后再使用 socket。

## 配对码何时触发？

每个 pairing controller 同一时刻只允许一个 request。`pairing-code(code, meta)` event 在 server 确认请求后触发，而不是仅在 request 发出时触发。`meta.custom` 表示 server 接受了自定义码；`meta.fallback` 表示自定义码被拒后，library 请求了随机生成的代码。

自定义码会转换为大写，且只有恰好 8 位字母数字时才使用。格式无效时会请求随机码。如果 server 拒绝格式有效的自定义码，library 会尝试一次随机码；网络错误和 rate limit 不会被当作自定义码拒绝。

在 credentials 尚未 `registered` 时，可以再次请求代码；默认刷新间隔为 150 秒，给操作者足够时间输入。Server 返回 rate limit（例如 428/429）时，等待时间会指数增长，最多 600 秒。

## Fallback 行为

设置 `phone` 时不会立即显示 QR。如果收到 QR 后经过 `qrFallbackAfterMs` 仍无配对码，`qr` event 也会触发，以便操作者通过扫码继续。如果 socket 已 open 但一直没有 QR，则 `pairingRequestDelayMs` 可以允许直接请求配对码。

`qrFallbackAfterMs` 和 `pairingRequestDelayMs` 关注不同状态；不要把它们当作同一个 timeout。无交互 terminal 的服务器部署应提供安全渠道，让授权操作员查看 QR/代码，而不是写入公开日志。

## 配对故障排查

| 现象 | 含义与下一步 |
|---|---|
| 没有显示配对码 | 检查 `phone`，尽早绑定 `pairing-code` listener，并查看脱敏后的 pairing/`connection.update` log。确认号码在 WhatsApp 中有效。 |
| 注册期间出现 `400` | pairing platform display 可能被拒。留空 `companionPlatformDisplay`，让 library 自动计算；参阅[设备身份](/zh/guide/device-identity)。 |
| 出现 `428` 或 `429` | Server 要求等待。不要自行创建紧密重试循环；controller 会自动 back-off。 |
| 配对后出现 `515` | Server 请求重启；等待自动 reconnect 和 `ready`。 |
| 等待后出现 QR | 电话号码模式切换到了 QR fallback；可以使用扫码流程关联。 |

查看[客户端生命周期](/zh/guide/client-lifecycle)和[故障排查](/zh/guide/troubleshooting)。配对码和 QR 是临时凭据，不要发布到 issue、公开截图或不可信聊天中。

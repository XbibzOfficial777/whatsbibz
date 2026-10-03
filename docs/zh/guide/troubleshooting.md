---
title: 故障排查
description: 诊断配对、连接、session、QR、消息 listener、JID 与媒体发送问题。
---

# 故障排查

首先准备结构化且经过脱敏的日志：时间、wrapper event、连接状态、尝试次数、identity 和软件包版本。不要记录 QR、配对码、credentials、消息正文或 auth directory 文件。

## 常见连接状态

| 状态 | 常见含义 | 建议处理 |
|---|---|---|
| `515 restartRequired` | Server 要求创建新的 socket，配对后较常见。 | 正常生命周期；等待自动 reconnect 和 `ready`。 |
| `401 loggedOut` | 设备被解除关联/登出，或 credentials 已失效。 | Wrapper 会执行有上限的恢复；若重复发生，在手机端解除设备后重新配对。 |
| `500 badSession` / `411 multideviceMismatch` | Session/auth state 无法继续使用。 | Wrapper 可能清理 state；观察 event，并在需要时重新配对。 |
| `408` / timeout | 网络较慢或 request 未完成。 | 检查 network、proxy、DNS、firewall 和 outbound policy；不要立即轮换 identity。 |
| `428` | 含义取决于阶段：QR 前握手拒绝，或配对/rate-limit 响应。 | 检查当前阶段。Auto mode 只对已识别身份拒绝轮换，不要创建快速重试 loop。 |
| `429` | Rate limit。 | 停止手动 request，等待 controller back-off，并检查是否有其他 instance 使用相同号码/IP。 |
| 配对时 `400` | Pairing display 或 request 数据可能被拒。 | 核实号码；让 `companionPlatformDisplay` 保持 unset 并自动生成。参阅[设备身份](/zh/guide/device-identity)。 |
| 连接时 `405` | Client/version/identity 可能不受支持。 | 更新 package，保持 `fetchLatestVersion` 开启，并优先使用自动 identity mode。 |

状态与 lifecycle 阶段有关，不一定代表唯一原因。检查 `lastDisconnect.error`、`connection.update`、`close`、`reconnecting`、`identity-changed`、`session-wiped` 和 `give-up`，同时避免输出 secret。

## 没有配对码或二维码

1. 确认 `phone` 仅包含数字和国家区号，不含 `+` 或空格。
2. 在 `createBibzWhats()` 解析后尽早绑定 `pairing-code` listener；server 确认后才会触发 event。
3. 如果连接 open 但 QR 尚未到达，等待 `pairingRequestDelayMs`；`qrFallbackAfterMs` 是另一种 timeout，从收到第一个 QR 后开始计算。
4. 若使用 `printQR`，安装可选 peer `qrcode-terminal`。否则在自己的应用中渲染 `qr` event。
5. 打开手机上正确的 linked-device flow，并在代码过期前输入。避免频繁手动 request；back-off 是为了应对 rate limit。

## Client 已连接但 bot 没有响应

- 在每个 `ready` event 中注册 `sock.ev.on('messages.upsert', ...)`，不要只绑定首次 socket。
- 检查 `type === 'notify'` 条件是否跳过了需要处理的 history/append event。
- 在脱敏日志中检查 `message.key.remoteJid`、`message.key.id`、payload 是否存在，以及 `extractMessage().type`。
- 用 `try/catch` 捕获 async callback rejection；EventEmitter 不会自动重试 listener。
- Process 重启后，确认 `authDir` 持久、可写且没有被其他 client 同时使用。

## 消息发送失败

检查 JID、socket 状态（`client.isConnected()`）、对话策略和 content schema。`sendText` 失败会返回 `ok: false` 与 error；`sendMedia` 返回 `{ result, error }`。只有来源为 `Buffer` 的 media 才能 fallback 为 document。大文件传输可能受 IPv4/IPv6、proxy、大小、MIME type 和 WhatsApp 服务端限制影响。

不要不加判断地 retry：server 可能已接受消息，但 client 没有收到 ACK。保存返回 ID、使用队列并显式处理重复投递。

## Identity 改变或设备显示不同

Auto mode 会优先使用 `authDir/identity.json` 中的稳定 identity；`identity-changed` 会解释受支持的 server rejection rotation。代码显式指定或 environment variable 会选择 custom mode，不会自动轮换。仅删除 `identity.json` 可重新选择 profile；只有要重新关联时才 logout 或删除整个 `authDir`。不要在 active session 中修改 identity。

## 提交可操作的报告

提供 Node.js/package 版本、OS、配对模式、连接状态、最近 event、status code 和最小复现步骤。请隐藏电话号码、JID、消息正文、配对码、token 与敏感文件路径。怀疑 package bug 时，准备安全复现并在 repository 提交 issue。

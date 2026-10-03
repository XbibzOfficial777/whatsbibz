---
title: 客户端生命周期
description: 了解 createBibzWhats 如何创建 socket、配对、reconnect、恢复 session 与关闭。
---

# 客户端生命周期

`createBibzWhats(options)` 是封装在 `makeWASocket()` 之上的运行时 wrapper。它返回一个 Promise，解析为 `BibzWhatsClient`。该对象是 `EventEmitter`，通过 `client.sock` 暴露 Baileys-compatible socket。

## 交互式生命周期图

<WorkflowCanvas flow="whatsbibz" locale="zh" />

拖动卡片可重新排列图表。选择节点可查看其职责；缩放和重置控件可恢复视图。

## 启动顺序

1. 选项与 `BIBZWHATS_DEFAULTS` 合并。
2. 从 options、environment 或自动模式中选择设备 identity；已验证稳定的 identity 会从 `authDir/identity.json` 读取。
3. 从 `authDir` 读取凭据。如果 session 已损坏，wrapper 会清理相关 state 并重新开始。
4. 当 `fetchLatestVersion` 启用时，请求最新 WhatsApp Web 版本。如果获取失败或没有确认最新版本，使用内置版本，而不是主动降级。
5. 创建 socket，连接群组 metadata cache，并监听 `connection.update` 和 `creds.update`。
6. 配对后 server 可能返回 `515 restartRequired`。这是正常生命周期：wrapper 会安排新的 socket，连接后触发 `open` 和 `ready`。

`await createBibzWhats()` 通常在第一个 socket 创建后就解析，而不是等待账号完成关联。Promise 解析后应立即添加 event handler；网络连接和 QR/配对流程仍然是异步的。

## 两种 ready 含义

- **`open`** 表示 WebSocket transport 已打开。
- **`ready`** 表示该 socket 可以被应用使用。默认每个新 socket（包含 reconnect 后的 socket）都会触发。
- **`first-ready`** 在一个 `client` 的生命周期内只触发一次。

请在 `ready` handler 中绑定所有 `sock.ev` listener。reconnect 后的 socket 是新的 event emitter；旧 socket 的 listener 不会自动移动过去。

```js
client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', handleMessages);
  sock.ev.on('groups.update', handleGroupUpdate);
});
```

只有在有意保留旧版行为（`ready` 仅第一次触发）时才设置 `readyOnEveryConnect: false`。获取当前 socket 时仍应使用 `client.sock`。

## Reconnect 与 session 恢复

普通网络中断使用线性 back-off：`reconnectStepMs × attempt`，最大不超过 `reconnectMaxMs`，并受 `maxReconnectAttempts` 限制。server 请求的 `515` 重启、identity rotation 和部分配对情况使用各自的延迟。不能继续使用的 session（`401 loggedOut`、`500 badSession`、`411 multideviceMismatch` 或损坏凭据）会触发受 `maxSessionWipes` 限制的 state wipe。

一种特殊情况：配对码已生成，但注册完成前 socket 断开。Server 可能以 `401` 拒绝旧 credentials。Wrapper 会识别 pending pairing，不将其计入普通 wipe，重新生成 credentials 后再次请求配对码。可通过 `reconnecting`、`session-wiped` 与 `give-up` 事件监控状态。

## 关闭与登出

`client.close()` 停止 pairing controller、取消 reconnect timer 并关闭 socket。它会保留 auth 数据，进程可使用相同 `authDir` 再次启动。一般 shutdown 时使用此方法。

`await client.logout()` 会请求 server 端登出并删除 auth folder。这会解除设备关联；之后必须重新配对。不要在普通部署重启时用 `logout()` 代替 `close()`。

多个账号应分别创建一个 `client` 和一个 `authDir`。不要让两个 client 同时写入同一个 session folder。

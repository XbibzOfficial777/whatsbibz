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
3. 从 `authDir` 读取凭据。默认可能清理损坏状态；`preserveSession: true` 会拒绝无效 JSON 和某些不完整核心凭据，而不替换它们。
4. `fetchLatestVersion` 启用且未显式指定 `socketConfig.version` 时，查询 WA Web（10 秒超时）；失败或版本较旧时使用内置版本。
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

普通网络中断采用有限 back-off。`401`、`411` 或损坏凭据仍可能删除会话。普通 `500` 默认不会删除；`wipeOnBadSession: true` 可启用具有破坏性的旧行为。

一种特殊情况：配对码已生成，但注册完成前 socket 断开。Server 可能以 `401` 拒绝旧 credentials。默认 wrapper 会重新生成 credentials，并再次请求配对码。可通过 `reconnecting`、`session-wiped` 与 `give-up` 事件监控状态。

设置 `preserveSession: true` 时，破坏性恢复（包括 pending-pairing 401）会停止并触发 `give-up`；无法读取/解析的 auth JSON 及某些不完整的核心凭据也会被拒绝，而不是静默替换。若启动时发现问题，`createBibzWhats()` 会拒绝其 Promise。此检查并不验证所有文件完整性或密码学一致性，也无法阻止显式 `client.logout()`、系统或应用删除文件、WhatsApp 撤销设备；设备被撤销时仍需重新配对。每个 authDir 只运行一个进程，目录/文件权限应限制为 700/600，切勿分享或提交。

## 关闭与登出

`await client.close()` 停止 pairing、取消重连、关闭 socket，并等待已触发的凭据保存。保存错误写入日志；auth 保留以供重启，但这不能保证所有密钥事务已完成，也不能保证断电后的持久化。

`await client.logout()` 会请求 server 端登出并删除 auth folder。这会解除设备关联；之后必须重新配对。不要在普通部署重启时用 `logout()` 代替 `close()`。

多个账号应分别创建一个 `client` 和一个 `authDir`。不要让两个 client 同时写入同一个 session folder。

## 延伸阅读

- [生产环境运维](/zh/guide/production-operations)
- [故障排查](/zh/guide/troubleshooting)
- [客户端事件](/zh/reference/events)

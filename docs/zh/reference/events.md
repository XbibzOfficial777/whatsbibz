---
title: 客户端事件与返回类型
description: WhatsBibz 客户端事件、payload、生命周期方法与监听器行为。
---

# 客户端事件与返回类型

`BibzWhatsClient` 是一个带有类型定义的 `EventEmitter`。socket 兼容 Baileys；`client` 发出的 wrapper 事件与 `sock.ev` 上的事件属于不同接口。

## Wrapper 事件

| 事件 | 监听器参数 | 触发时机 | 运维说明 |
| --- | --- | --- | --- |
| `pairing-code` | `(code: string, meta: PairingCodeMeta)` | 服务器接受配对码请求。 | `meta` 为 `{ custom: boolean; fallback: boolean }`。请通过私密渠道发送配对码。 |
| `qr` | `(qr: string)` | socket 收到 QR 字符串。 | 将其视为临时凭据；不要写入日志或公开。 |
| `socket` | `(sock: WASocket)` | 为 client 创建 socket。 | 需要可用 socket 的应用 handler 应监听 `ready`。 |
| `open` | `(sock: WASocket)` | WebSocket transport 已打开。 | transport 打开不代表应用侧初始化已经完成。 |
| `ready` | `(sock: WASocket)` | socket 已可供应用使用。 | 默认每个新 socket 都会触发；在此处绑定 `sock.ev` 监听器。 |
| `first-ready` | `(sock: WASocket)` | 首个 socket 已就绪。 | 每个 client 生命周期仅触发一次。 |
| `user` | `(digits: string)` | 获取到已连接用户标识。 | 日志中避免记录个人标识。 |
| `close` | `({ status?: number; error?: Error })` | 活动 socket 关闭。 | 应结合 status 和 error 判断；`515` 可能是正常重启流程。 |
| `reconnecting` | `({ delay: number; attempt: number; fresh: boolean; identity?: string; pairingPending?: boolean })` | wrapper 安排下一次连接。 | `pairingPending` 表示配对尚未完成时发生了可识别的断开。 |
| `identity-changed` | `IdentityDescription & { profileId: string; reason: string }` | 自动模式选择了另一个设备 profile。 | 仅适用于 auto 模式；不要将 identity 用作规避机制。 |
| `session-wiped` | `(reason: string)` | 识别到的 auth 恢复流程删除了会话状态。 | 受 `maxSessionWipes` 限制；建议让运维人员可见。 |
| `give-up` | `(message: string)` | client 停止自动重试。 | 通知运维人员；避免无限手动重启。 |
| `connection.update` | `(update: Partial<ConnectionState>)` | wrapper 转发连接状态更新。 | 完整 Baileys 事件接口请查看 `sock.ev` 和已安装的声明文件。 |

事件映射类型为 `BibzWhatsEvents`。配对和设备身份 payload 类型分别为 `PairingCodeMeta` 与 `IdentityDescription`。

## 监听器模式

```ts
import type { BibzWhatsEvents, WASocket } from '@xbibzlibrary/whatsbibz';

function attachSocketHandlers(sock: WASocket) {
  sock.ev.on('messages.upsert', handleMessages);
  sock.ev.on('groups.update', handleGroupUpdate);
}

const onReady: BibzWhatsEvents['ready'] = (sock) => attachSocketHandlers(sock);
client.on('ready', onReady);
client.once('first-ready', () => logger.info('First connection ready'));
client.on('reconnecting', ({ attempt, delay, pairingPending }) => {
  logger.warn({ attempt, delay, pairingPending }, 'Reconnect scheduled');
});
```

Reconnect 会创建新的 socket，因此应在 `ready` 中注册 socket 级监听器。`off(event, listener)` 需要传入之前注册时使用的同一个函数引用。本示例聚焦事件签名，假设 `client`、`logger` 和业务 handler 已在服务其他位置创建。

## Client 方法与状态

| 成员 | Signature / 结果 | 说明 |
| --- | --- | --- |
| `on(event, listener)` | `this` | 注册有类型约束的 wrapper listener。 |
| `once(event, listener)` | `this` | 注册一次性 listener。 |
| `off(event, listener)` | `this` | 移除对应 listener。 |
| `isConnected()` | `boolean` | 当前状态；可用于 readiness 检查，但不保证下一次发送一定成功。 |
| `sock` | `WASocket \| null` | 当前活动 socket；reconnect 后会改变。 |
| `initialSock` | `WASocket` | 仅指第一个 socket，不适合作为 reconnect-safe 引用。 |
| `identity` | `IdentityDescription` 及 mode/source/profile/tried metadata | client 当前使用的 companion identity。 |
| `close()` | `void` | 停止配对/reconnect timer 并关闭 socket，同时保留 auth 状态。 |
| `logout()` | `Promise<void>` | 登出并删除 auth 目录；之后需要重新关联设备。 |

::: warning 监听器注册位置
默认情况下，每次连接都会触发 `ready`。不要只在 `initialSock` 上绑定消息 handler，也不要让两个 client 共用同一 `authDir`。
:::

## 相关参考

- [Client 选项](/zh/reference/client-options)
- [Client 生命周期](/zh/guide/client-lifecycle)
- [消息 helper](/zh/reference/message-helpers)
- [低层 socket API](/zh/guide/low-level-api)
- [故障排查](/zh/guide/troubleshooting)

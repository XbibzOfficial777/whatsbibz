---
title: 客户端 API 与事件
description: BibzWhatsClient 的属性、方法、包装层事件及监听器模式。
---

# 客户端 API 与事件

`createBibzWhats(options?)` 返回 `Promise<BibzWhatsClient>`。Promise 在初始 socket 创建后解析，而不是在配对或 WhatsApp 就绪后解析。开始使用活动 socket 前，请等待 `ready` 事件。相关接口参见[客户端选项](/zh/reference/client-options)和[消息 helper](/zh/reference/message-helpers)。

## Client 属性与方法

| 名称 | Signature / 类型 | 行为 |
| --- | --- | --- |
| `sock` | `WASocket` 或 `null` | 当前活动 socket；reconnect 后可能变化。 |
| `initialSock` | `WASocket` | 第一个 socket。不要只在此 socket 上绑定需要跨 reconnect 的监听器。 |
| `identity` | `IdentityDescription` 加 `mode`、`source`、`profileId` 与 `tried` | 有效 companion identity、选择来源、profile 和尝试过的候选项。 |
| `options` | `Required<BibzWhatsOptions>` | wrapper 实际采用的有效配置。 |
| `isConnected()` | `boolean` | 当前活动 socket 的连接状态。 |
| `on(event, listener)` | Typed event map → `this` | 注册类型化监听器。每次触发 `ready` 时重新绑定 socket 事件。 |
| `once(event, listener)` | Typed event map → `this` | 注册一次性 wrapper 监听器。 |
| `off(event, listener)` | Typed event map → `this` | 移除相同的 wrapper 监听器。 |
| `close()` | `void` | 停止 timer/controller 并关闭 socket，同时保留 credentials 以便重启。 |
| `logout()` | `Promise<void>` | 向 server 登出并删除 `authDir`；之后需要重新配对。 |

这些方法使用 `BibzWhatsEvents` 中的 TypeScript overload。`EventEmitter` 还继承 Node.js 的通用方法，例如 `removeAllListeners()`。

## Wrapper 事件

| 事件 | Payload | 使用场景 |
| --- | --- | --- |
| `pairing-code` | `(code: string, meta: PairingCodeMeta)` | Server 已签发配对码。`meta.custom` 表示自定义码；`meta.fallback` 表示已回退为随机码。 |
| `qr` | `qr: string` | 有新的 QR，可交给仅限 operator 使用的私有 renderer。 |
| `socket` | `sock: WASocket` | 已创建 socket；真正开始使用前应等待 `ready`。 |
| `open` | `sock: WASocket` | WebSocket transport 已连接。 |
| `ready` | `sock: WASocket` | socket 可供应用使用。默认首次连接和每次 reconnect 都会触发。 |
| `first-ready` | `sock: WASocket` | 一个 client 生命周期中仅首次触发。 |
| `user` | `digits: string` | 已注册账号的号码以纯数字形式提供。 |
| `close` | `{ status?: number; error?: Error }` | socket 已关闭；采取操作前先检查 status。 |
| `reconnecting` | `{ delay: number; attempt: number; fresh: boolean; identity?: string; pairingPending?: boolean }` | wrapper 已安排下一次连接；`pairingPending` 表示设备注册尚未完成。 |
| `identity-changed` | `IdentityDescription & { profileId: string; reason: string }` | auto 模式在识别到 server 拒绝后切换 profile。 |
| `session-wiped` | `reason: string` | 为受限恢复而清除 session state；这是重要的运维信号。 |
| `give-up` | `message: string` | retry/恢复次数达到上限，需要 operator 介入。 |
| `connection.update` | `Partial<ConnectionState>` | socket 原始连接状态更新。其他 Baileys-compatible 事件请使用 `sock.ev`。 |

完整 payload 声明位于 `lib/BibzWhats/client.d.ts`。`sock.ev` 是独立的 Baileys-compatible socket event map，与上表的 wrapper event 不同。

## 可跨 reconnect 的监听器模式

```js
function attachSocket(sock) {
  sock.ev.on('messages.upsert', handleMessages);
  sock.ev.on('groups.update', handleGroups);
}

client.on('ready', attachSocket);
client.on('reconnecting', (info) => {
  logger.warn({ event: 'reconnecting', ...info }, 'WhatsApp socket retry scheduled');
});
client.on('session-wiped', (reason) => {
  logger.error({ event: 'session-wiped', reason }, 'Session state was recreated');
});
client.once('give-up', (message) => {
  logger.error({ event: 'give-up', message }, 'Operator intervention required');
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

`createBibzWhats()` 的 Promise 解析后应立即绑定 wrapper listener。不要记录 QR、配对码、credentials、消息正文或 auth-state object。处理消息时使用不含个人数据的 update ID，并在应用层实现幂等性。

## `close()` 与 `logout()`

重新部署或优雅关闭时使用 `close()`：它会停止 socket 和 timer，但保留已关联的 session。只有在确实要解除设备关联或删除 session 时才调用 `logout()`。两者行为不同，不可互换。

::: tip Source of truth
已安装 npm 版本的声明是最终依据：`node_modules/@xbibzlibrary/whatsbibz/lib/BibzWhats/client.d.ts`。`main` 分支可能比 npm release 更新。
:::

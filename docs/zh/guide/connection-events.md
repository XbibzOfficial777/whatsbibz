---
title: 连接与事件
description: 区分 client 和 socket event，处理 reconnect，并为每个 active socket 重新绑定 listener。
---

# 连接与事件

高层 client 是一个 `EventEmitter`；active socket 在 `sock.ev` 上有独立的 Baileys event emitter。它们是两个不同对象。Wrapper event 用于报告 lifecycle，socket event 用于传递消息、凭据、群组变化和协议更新。

## 在 active socket 上监听消息

```js
client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      console.log('收到消息 ID:', message.key.id);
    }
  });
});
```

Reconnect 后 wrapper 会创建新 socket。旧 socket 上的 listener 不会转移到新 socket。若只绑定 `client.initialSock`，reconnect 之后机器人可能看起来不再响应。默认每个新 socket open 后都会触发 `ready`；需要只执行一次的全局初始化可以使用 `first-ready`。

## 主要 wrapper event

| Event | Payload | 用途 |
|---|---|---|
| `socket` | `(sock)` | 创建了新的 socket；此时未必可用于应用操作。 |
| `pairing-code` | `(code, { custom, fallback })` | Server 确认已生成配对码。 |
| `qr` | `(qr)` | QR 数据可用，可能是直接结果或 fallback。 |
| `open` | `(sock)` | Transport connection 已打开。 |
| `ready` | `(sock)` | 新 socket 已就绪；在此处绑定 socket listener。 |
| `first-ready` | `(sock)` | 仅首次就绪时触发。 |
| `user` | `(digits)` | 已知关联账号的号码。 |
| `connection.update` | `(update)` | Wrapper 转发的原始连接更新。 |
| `close` | `({ status, error })` | Socket 关闭；status 来自 disconnect reason/code。 |
| `reconnecting` | `({ delay, attempt, fresh, identity?, pairingPending? })` | 已安排 reconnect；`fresh` 表示使用新凭据。 |
| `identity-changed` | identity info | Auto mode 在 server 拒绝身份后更换 profile。 |
| `session-wiped` | `(reason)` | 为恢复而清理 auth state。 |
| `give-up` | `(message)` | 达到重试或恢复上限，需要操作员处理。 |

事件类型定义在 `lib/BibzWhats/client.d.ts` 的 `BibzWhatsEvents` 中。Listener 抛出的错误应由应用自行处理；EventEmitter 不会自动等待 async 工作或重试。

## 常用 socket event

`messages.upsert` payload 为 `{ messages, type }`。新消息通常是 `type: 'notify'`，history sync 或 append 可能是其他类型。低层 API 主要使用 `creds.update` 保存 auth state。`groups.update` 和 `groups.upsert` 报告群组 metadata 变化。Baileys-compatible socket types 与已安装版本的 source 中还声明了其他 event。

不要假设消息 event 只会收到一次。可以使用 `message.key.id` 作为数据库幂等键；若机器人不应处理自己的消息，则跳过 `fromMe`。

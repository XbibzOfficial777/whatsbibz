---
title: 底层 API
description: 使用 makeWASocket 自行管理身份验证、socket event、reconnect 与 shutdown。
---

# 底层 API

`makeWASocket()` 是 Baileys-compatible socket factory。它允许应用控制 auth state、event、query、send method 和 close，但不包含 `createBibzWhats()` 的配对、自动 reconnect 与 session 恢复 controller。

## 创建并持久化 auth state

```js
import makeWASocket, {
  Browsers,
  fetchLatestWaWebVersion,
  useMultiFileAuthState,
} from '@xbibzlibrary/whatsbibz';

const { state, saveCreds } = await useMultiFileAuthState('./data/low-level-session');
const { version } = await fetchLatestWaWebVersion();

const sock = makeWASocket({
  auth: state,
  version,
  browser: Browsers.macOS('Chrome'),
  syncFullHistory: false,
  markOnlineOnConnect: false,
});

sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) console.log('QR 字符串已提供给获授权的 operator renderer。');
  if (connection === 'open') console.log('Socket 已连接。');
  if (connection === 'close') {
    console.error('Socket 已关闭:', lastDisconnect?.error?.message);
    // 请自行实现有上限的 retry policy，不要无限重试。
  }
});
```

`fetchLatestWaWebVersion()` 返回 `{ version, isLatest, error? }`；获取失败时可使用提供的 fallback。决定使用前请检查结果。`useMultiFileAuthState()` 适合示例与开发，但其文件系统实现并非具备分布式事务的生产级存储。

## Reconnect 由应用负责

底层 socket 会发出 `connection.update`，但不提供 wrapper 的 `ready`、back-off、自动 wipe、identity rotation、pairing controller 或 shutdown guard。应用需要：

1. 一致地保存每次 `creds.update`。
2. 根据 `lastDisconnect.error` 和 `DisconnectReason` 分类断开原因。
3. 区分 `515 restartRequired` 与 logout/session error；限制 retry 次数并采用 delay/back-off。
4. 使用正确 auth state 创建新 socket，并重新绑定所有 listener。
5. 避免多个 socket 同时使用同一个 auth directory。
6. 为操作员提供停止 retry loop 和重新关联设备的方法。

如果不想自行实现这些策略，请使用 `createBibzWhats()` 和[客户端生命周期](/zh/guide/client-lifecycle)。

## 配对与 event

底层 API 通过 `connection.update.qr` 提供 QR 数据；应用负责安全渲染。连接到适当阶段后，可以调用 socket 的 `requestPairingCode(phone, code?)`。`createBibzWhats()` 会管理 request 时机、代码验证与 fallback、timeout 和 rate limit；不要认为 raw socket 自动提供这些能力。

`sock.ev` 保留 Baileys event 名称，如 `messages.upsert`、`creds.update`、`connection.update` 和 `groups.update`，其他事件可查当前版本的 socket type。完整类型见 `WASocket` 和 `SocketConfig`。Socket 还提供 `sock.bibz` 及兼容 alias `sock.ourin`，两者都指向 `BibzWhatsEngine`；rich-message helper 也扩展在 socket 上。

## Wrapper 与 socket 的区别

`createBibzWhats()` 内部使用 `makeWASocket()`，但它统一负责高层认证流程：multi-file auth、pairing、版本获取、group cache、reconnect timer、auto identity rotation 和 session 恢复。不要为同一个 socket/auth state 混用两套 lifecycle；每个账号选择一种模式。

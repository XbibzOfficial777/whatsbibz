---
title: 客户端配置
description: 配置 createBibzWhats、默认值、environment variable 和 socketConfig。
---

# 客户端配置

将选项传给 `createBibzWhats(options)`。实际默认值也通过 `BIBZWHATS_DEFAULTS` 导出。完整表格见[客户端选项参考](/zh/reference/client-options)；本页说明如何选择配置。

```js
import { createBibzWhats } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/primary-account',
  identity: 'auto',
  maxReconnectAttempts: 10,
  fetchLatestVersion: true,
});
```

## 需要提前考虑的选项

| 选项 | 默认值 | 何时调整 |
|---|---|---|
| `phone` | 空 | 设置带国家区号的数字以请求配对码；留空则使用 QR。 |
| `pairingCode` | 随机生成 | 仅在需要时设置 8 位 A–Z/0–9 自定义码；server 可能拒绝，wrapper 可回退一次随机码。 |
| `authDir` | `bibzwhats-session` | 每个账号使用独立且持久的路径；目录内容属于认证凭据。 |
| `identity` | `auto` | 默认自动模式；只有经过测试并有明确理由时才指定 profile。 |
| `browser` | `null` | 兼容旧版的显式 identity tuple；建议使用 `identity`。 |
| `maxIdentityRotations` | `4` | 限制自动模式可尝试的备用 profile 数量。 |
| `maxReconnectAttempts` | `10` | 达到 `give-up` 前，可连续重试的连接错误次数。 |
| `maxSessionWipes` | `3` | 限制用于 session 恢复的 state wipe 次数。 |
| `qrFallbackAfterMs` | `90000` | 电话模式下，在 QR 到达后仍未收到配对码时显示 QR fallback。 |
| `pairingRequestDelayMs` | `20000` | socket open 但 QR 尚未到达时，延迟后请求配对码。 |
| `restartDelayMs` | `2000` | server 请求 `515` restart 或 identity rotation 后的等待时间。 |
| `wipeReconnectDelayMs` | `10000` | 清除无法使用的 session 后，重新连接前的等待时间。 |
| `reconnectStepMs` / `reconnectMaxMs` | `10000` / `60000` | 普通 reconnect 线性 back-off：step × attempt，并受最大值限制。 |
| `fetchLatestVersion` | `true` | 获取最新 WhatsApp Web 版本；不可用时使用内置版本。 |
| `forceIPv4` | `true` | 主机 IPv6 网络异常时，为媒体 fetch 强制使用 IPv4。 |
| `groupMetadataTtlMs` | `300000` | 内存群组 metadata cache 的 TTL。 |
| `readyOnEveryConnect` | `true` | 每个新 socket 都触发 `ready`；需要重新绑定 handler 时应保持启用。 |
| `socketConfig` | `{}` | 覆盖底层 `makeWASocket` 选项；最后合并，因此能覆盖 wrapper 默认值。 |
| `logger` | `console` | 提供具有可选 `info`、`warn`、`error`、`debug`、`ok` 和 `log` 方法的对象。 |
| `printQR` | `false` | 在 terminal 打印 ASCII QR，需要可选 peer `qrcode-terminal`。 |
| `banner` | 自动 | `true` 强制显示 banner；`false` 禁用。默认仅在 TTY 输出。 |

## Identity environment variable

显式的 `identity` option 优先于环境变量。`BIBZ_BROWSER` 或 `BIBZ_IDENTITY` 可设置为 `auto`、使用 `/`、`:` 或逗号分隔的 tuple，或 profile ID。若未设置，则读取 `BIBZ_DEVICE_OS`、`BIBZ_DEVICE_BROWSER` 和 `BIBZ_DEVICE_VERSION`。解析规则见[设备身份](/zh/guide/device-identity)。

不要把电话号码或配对码写入已提交的 source file。应从 secret manager 或 deployment environment 读取。`authDir` 与普通配置不同，其中的数据比电话号码敏感得多。

## 覆盖 socket 选项

`socketConfig` 会传递给 `makeWASocket()` 并最后合并。只使用该版本 `SocketConfig` 声明的属性。替换 `auth`、`browser`、`logger`、`getMessage`、group cache 或 `syncFullHistory` 可能改变 wrapper 的行为与恢复假设。

```js
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  socketConfig: {
    syncFullHistory: false,
    markOnlineOnConnect: false,
  },
});
```

`companionPlatformDisplay` 等 identity/pairing 选项可直接传给 wrapper。不要从其他 Baileys 版本复制内部配置，因为 WhatsApp Web 协议可能已经变化。

---
title: Client 选项参考
description: createBibzWhats 的配置类型、默认值、限制和选项影响。
---

# Client 选项参考

调用签名：`createBibzWhats(options?: BibzWhatsOptions): Promise<BibzWhatsClient>`。运行时默认值通过冻结的 `BIBZWHATS_DEFAULTS` object 导出。下表基于已安装版本的 source 和 declaration。

## 完整选项

| Option | 类型 | 默认值 | 行为 |
|---|---|---|---|
| `phone` | `string` | 未设置 | 带国家区号的数字，用于请求配对码；缺失/空字符串表示 QR。 |
| `pairingCode` | `string` | 自动生成 | 8 位 A–Z/0–9 自定义代码；格式无效或 server 拒绝时，controller 可以请求随机代码。 |
| `authDir` | `string` | `bibzwhats-session` | Multi-file credentials 与 `identity.json` 目录，必须按 secret 保护。 |
| `identity` | string、tuple 或 null | `'auto'` | 可设置 `'auto'`、自定义 browser tuple 或 profile ID；auto mode 支持轮换。 |
| `browser` | browser tuple 或 null | `null` | 兼容用的显式 tuple alias；建议使用 `identity`。 |
| `maxIdentityRotations` | `number` | `4` | 自动模式的候选数量上限：该值加首选 profile。 |
| `logger` | `BibzWhatsLogger` | `console` | 提供可选 `info`、`warn`、`error`、`debug`、`ok`、`log` method 的 object。 |
| `printQR` | `boolean` | `false` | 使用可选 peer `qrcode-terminal` 在 terminal 打印 ASCII QR。 |
| `banner` | `boolean` | 仅 TTY | `true` 强制显示，`false` 禁用；默认只在 TTY 输出。 |
| `socketConfig` | `Partial<SocketConfig>` | `{}` | 底层 `makeWASocket` 选项，最后合并，因此能覆盖 wrapper 默认值。 |
| `maxReconnectAttempts` | `number` | `10` | 连续可重试连接失败次数上限；达到后触发 `give-up`。 |
| `maxSessionWipes` | `number` | `3` | 限制用于恢复的 state wipe；超过后等待操作员干预。 |
| `qrFallbackAfterMs` | `number` | `90000` | 电话模式下，QR 到达后仍未取得代码时触发 QR fallback。 |
| `pairingRequestDelayMs` | `number` | `20000` | 连接 open 而 QR 未到达时，请求配对码前的延迟。 |
| `restartDelayMs` | `number` | `2000` | 普通 server `515` restart 或 identity rotation 后等待时间。 |
| `wipeReconnectDelayMs` | `number` | `10000` | 清除 auth state 并准备重建后，reconnect 前的延迟。 |
| `reconnectStepMs` | `number` | `10000` | 普通 reconnect 的线性 back-off 单位。 |
| `reconnectMaxMs` | `number` | `60000` | 普通 reconnect 的最大等待时间。 |
| `forceIPv4` | `boolean` | `true` | 为媒体 fetch 配置 IPv4 HTTPS agent；不是通用 WebSocket proxy option。 |
| `fetchLatestVersion` | `boolean` | `true` | 获取 WhatsApp Web 版本；fetch 不可用时使用 library 内置 fallback。 |
| `groupMetadataTtlMs` | `number` | `300000` | 内存 group metadata cache 的 TTL。 |
| `companionPlatformDisplay` | string 或 null | `null` | Pairing allow-list override；默认从设备 identity 自动推导。 |
| `readyOnEveryConnect` | `boolean` | `true` | 每个新 socket 都触发 `ready`；设为 false 时仅第一次触发。 |

`BIBZWHATS_DEFAULTS` 包含 declaration 中未排除字段的运行时默认值。`phone`、`pairingCode`、`logger`、`printQR`、`socketConfig` 和 `banner` 不一定存在于默认 object；optional 状态请查看 `BibzWhatsOptions`。

## `socketConfig` 的合并方式

Socket 默认值之后，wrapper 设置 auth、logger、browser、连接与网络选项及 group cache，最后再合并 `socketConfig`。因此显式 override 可以替换 `auth`、`browser`、`version`、`getMessage`、logger、group metadata cache 或 sync policy。这些字段可能改变 wrapper 预期行为。例如，修改 `browser` 不一定同步更新 identity rotator 或 `client.identity`；避免 identity 来源彼此冲突。

Wrapper 默认设置 `syncFullHistory: false`，以避免请求完整历史；`socketConfig.syncFullHistory` 可以覆盖它。部分 Desktop identity 需要特定同步行为与 server 支持。调整前应理解隐私影响并先行测试。

## Retry 限制

`maxReconnectAttempts` 限制普通可重试连接错误，与 `maxSessionWipes` 和 `maxIdentityRotations` 不同。`restartDelayMs` 与 `wipeReconnectDelayMs` 处理不同路径。`maxIdentityRotations: 4` 表示需要轮换时，可能尝试初始 profile 加最多四个备用 profile（最多五个）；实际候选列表也可能更短。

数字选项应采用正数，并结合运行环境选择合理值。不要只为绕过 rate limit 而缩短 delay。更多背景见[客户端生命周期](/zh/guide/client-lifecycle)、[配对](/zh/guide/pairing)和[设备身份](/zh/guide/device-identity)。

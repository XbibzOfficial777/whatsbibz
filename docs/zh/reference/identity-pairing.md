---
title: 身份与配对参考
description: Identity parsing helper、设备 profile、环境变量、state 文件和配对错误。
---

# 身份与配对参考

以下 helper 从 package entrypoint 重新导出。多数应用只需使用 `createBibzWhats()` 的 `identity` option 和 event；本页函数适用于 tooling、配置 UI、测试与诊断。

## 设备 profile

`IDENTITY_PROFILES` 包含 `{ id, browser, score, note }`，顺序来自 source 中记录的测试数据。自动模式会排除 ID 以 `desktop` 结尾的两个 profile。当前列表：

- `macos-chrome`
- `macos-safari`
- `windows-chrome`
- `linux-chrome`
- `ubuntu-chrome`
- `macos-firefox`
- `windows-edge`
- `archlinux-chrome`
- `macos-desktop` 和 `windows-desktop` 仅显式选择

Profile 与 server 测试结果不是永久兼容保证。Repository 中的 `VERIFIKASI-IDENTITAS-2026-09-03.md` 记录了对应日期的测试。

## Identity helper

| 导出 | 行为 |
|---|---|
| `parseBrowserSpec(value)` | 解析 tuple/profile string、`os:Browser`、`OS/Browser/version`、`OS, Browser` 或 `OS, Browser`，返回补齐版本的 tuple 或 `null`。 |
| `identityFromEnv(env?)` | 读取 `BIBZ_BROWSER`、`BIBZ_IDENTITY` 或 `BIBZ_DEVICE_OS`、`BIBZ_DEVICE_BROWSER`、`BIBZ_DEVICE_VERSION` 三元组。 |
| `resolveDeviceIdentity(options?)` | 解析 mode、browser、source、candidate 和 note；可以读取 `authDir` 中的 identity state。 |
| `defaultVersionForOs(os)` | Tuple 未给版本时返回 library 针对 OS 的 fallback version。 |
| `describeIdentity(browser, options?)` | 返回 `{ browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted }`。 |
| `isIdentityRejection(info?)` | 将已支持的身份拒绝与网络错误区分。 |
| `createIdentityRotator(options)` | 提供 `current`、`index`、`tried`、`exhausted`、`markStable()` 与 `next(reason)`。 |
| `identityStatePath(authDir)` | `<authDir>/identity.json` 的路径。 |
| `loadIdentityState`、`saveIdentityState`、`clearIdentityState` | 读取、写入或删除已保存的身份 state。 |

`identityFromEnv()` 优先读取 `BIBZ_BROWSER`/`BIBZ_IDENTITY`，再读取 `BIBZ_DEVICE_*` tuple。代码传入的 option 优先于环境变量；设置 `identity: 'auto'` 则允许继续解析环境变量。

`parseBrowserSpec()` 也接受 vertical-bar 分隔符（`OS|Browser`），以及 slash 和逗号。

## Pairing helper

| 导出 | 说明 |
|---|---|
| `normalizePairingCode(value)` | trim/uppercase，只有 8 位字母数字有效。 |
| `pairingErrorCode(error)` | 从已知 Boom/status/server error 中提取 code。 |
| `isRateLimitError(error)` | 检查已知配对 rate limit。 |
| `isRegistrationRejected(error)` | 检查已知 registration rejection。 |
| `isTimeoutError(error)` | 检查 timeout。 |
| `isCustomPairingError(error)` | 检查可能触发 fallback 的自定义码拒绝。 |
| `createPairingController(options)` | 管理 in-flight request、refresh、fallback、rate-limit back-off、停止及 timer 状态。 |

Controller 需要具有 `requestPairingCode(phone, code?)` 的 socket、电话号码、可选自定义码、`onCode(code, meta)` callback、logger、timer 和拒绝处理器。每个 socket 使用一个 controller，并在 socket 关闭时调用 `stop()`。不要为一个账号创建多个 pairing controller。

## 设备标签与配对字段

`browser: [os, browserName, version]` 与 `companionPlatformDisplay` 是不同字段。Linked-device 名称可以使用自定义 distro，但配对 display 需符合 server allow-list。留空时 helper 会自动生成。`isPairingDisplayAccepted()`、`resolvePairingOs()` 和 `resolvePairingBrowser()` 位于 `Utils/platform-identity.js`，并从 root entrypoint 导出。

Allow-list 取决于可变化的实现与测试结果。建议使用 auto mode；只有了解风险后再 override。Identity 会影响 linked-device metadata，不应用于隐藏 client 来源。

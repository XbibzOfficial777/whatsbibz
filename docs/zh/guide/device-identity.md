---
title: 关联设备身份
description: 配置 auto 与自定义设备身份、browser profile、环境变量、轮换和 state 文件。
---

# 关联设备身份

Identity 决定发送给 WhatsApp Web 的 browser tuple，并影响手机 **已关联的设备** 列表中的部分设备信息。`identity` 默认是 `auto`：library 选择当前较稳定的 profile，仅在 server 于已识别阶段拒绝身份时才切换。

## 自动模式

曾经稳定的 profile 会被优先使用，并保存在 `<authDir>/identity.json`，让设备名称在重启或 session wipe 后保持一致。当前主要候选顺序如下：

| Profile ID | Tuple 概览 | 显示说明 |
|---|---|---|
| `macos-chrome` | `Mac OS / Chrome` | 自动模式的首选 profile。 |
| `macos-safari` | `Mac OS / Safari` | 备用 profile。 |
| `windows-chrome` | `Windows / Chrome` | 备用 profile。 |
| `linux-chrome` | `Linux / Chrome` | 备用 profile。 |
| `ubuntu-chrome` | `Ubuntu / Chrome` | 备用 profile。 |
| `macos-firefox` | `Mac OS / Firefox` | 备用 profile。 |
| `windows-edge` | `Windows / Edge` | 备用 profile。 |
| `archlinux-chrome` | `Arch Linux / Chrome` | 设备名称保留 Arch Linux；配对 display 回退到 server 接受的 Linux 值。 |

Desktop profile 保留给显式选择，auto 模式不会使用。Server allow-list 的测试日期记录在 `VERIFIKASI-IDENTITAS-2026-09-03.md`；server 行为并非永久 API 契约。

## 自定义身份

支持以下格式：

```js
createBibzWhats({ phone, identity: 'archLinux:Firefox' });
createBibzWhats({ phone, identity: 'Mac OS/Safari/15.6.1' });
createBibzWhats({ phone, identity: ['Arch Linux', 'Chrome', '6.12.44'] });
createBibzWhats({ phone, identity: 'linux-chrome' });
```

也可以使用导出的 `Browsers` preset，例如 `Browsers.macOS('Chrome')`、`Browsers.windows('Edge')` 或 `Browsers.ubuntu('Chrome')`。Custom mode 会按给定值使用 tuple。如果 server 拒绝该身份，library 会报告错误，但不会悄悄轮换到另一个身份。

## 来源优先级

1. 代码中的 `identity` 或兼容 alias `browser`。
2. Environment variable `BIBZ_BROWSER` 或 `BIBZ_IDENTITY`。
3. `BIBZ_DEVICE_OS`、`BIBZ_DEVICE_BROWSER`、`BIBZ_DEVICE_VERSION` 三元组。
4. 自动模式。

`identity: 'auto'` 会释放显式选择，让环境变量参与解析。Tuple 未提供版本时会补上 OS 默认版本。避免在已关联 session 中途更改 identity：WhatsApp 可能显示另一台设备或断开现有 session。

## Pairing display 不是设备标签

`browser[0]` 会影响 linked-device OS 标签；`companionPlatformDisplay` 是 WhatsApp 配对时单独验证的字段。即使 browser tuple 有效，未知 display 仍可能导致拒绝。Wrapper 默认自动生成受支持的 display。只有已针对实际 server 测试时才覆盖它。

自动轮换由已识别的身份拒绝触发（例如 QR 前的 428、配对时的 400、连接状态 405）。网络故障、401、408、rate limit 和正常的 515 重启都不是更换 profile 的理由。WhatsApp Web 身份测试可能过期；这张表不构成兼容性保证。

## 重置 identity state

普通 session wipe 会保留已证明稳定的 profile。若要让自动选择重新开始，请停止 client 并删除 `identity.json`。若要解除账号设备关联并重新配对，应 logout 或删除整个 `authDir`。除非希望下次连接更换设备标签，否则不要只删除 identity 文件。

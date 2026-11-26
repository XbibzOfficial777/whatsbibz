<p align="center">
  <a href="https://www.npmjs.com/package/@xbibzlibrary/whatsbibz"><img src="https://cdn.jsdelivr.net/gh/XbibzOfficial777/whatsbibz@main/assets/logo/preview.webp" alt="WhatsBibz" width="640"></a>
</p>

<h1 align="center">WhatsBibz</h1>

<p align="center">
  面向 Node.js 的 WhatsApp Web 多设备（Multi-Device）库 —— Baileys 的持续维护分支，提供高层客户端、自定义配对码、自愈会话，
  以及可配置或自动选择的“已链接设备”身份。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@xbibzlibrary/whatsbibz"><img src="https://img.shields.io/npm/v/%40xbibzlibrary%2Fwhatsbibz?label=npm&color=0a6958" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@xbibzlibrary/whatsbibz"><img src="https://img.shields.io/npm/dm/%40xbibzlibrary%2Fwhatsbibz?color=0a6958" alt="npm downloads"></a>
  <a href="https://github.com/XbibzOfficial777/whatsbibz/actions/workflows/ci.yml"><img src="https://github.com/XbibzOfficial777/whatsbibz/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#requirements"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020.18.1-0a6958" alt="Node.js >= 20.18.1"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0a6958" alt="MIT"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <b>简体中文</b>
</p>

---

## 目录

- [为什么选择 WhatsBibz](#为什么选择-whatsbibz)
- [环境要求](#环境要求)
- [安装](#安装)
- [快速开始](#快速开始)
- [高层客户端：`createBibzWhats()`](#高层客户端createbibzwhats)
  - [选项](#选项)
  - [事件](#事件)
  - [属性与方法](#属性与方法)
  - [连接生命周期](#连接生命周期)
- [已链接设备身份](#已链接设备身份)
  - [自动模式（默认）](#自动模式默认)
  - [自定义模式](#自定义模式)
  - [WhatsApp 接受什么](#whatsapp-接受什么)
- [发送与读取消息](#发送与读取消息)
  - [按钮、位置、图片与轮播示例](#消息示例按钮位置图片与轮播)
  - [回复视频生成有声贴纸](#回复视频生成有声贴纸实验性)
  - [文本格式与聊天标记（Markdown）](#文本格式与聊天标记markdown)
  - [交互式按钮（Button）](#交互式按钮button)
  - [富文本 / AI 风格消息](#富文本--ai-风格消息)
- [实验性语音通话](#实验性语音通话)
- [底层 API（兼容 Baileys）](#底层-api兼容-baileys)
- [TypeScript](#typescript)
- [从 Baileys 迁移](#从-baileys-迁移)
- [故障排查](#故障排查)
- [测试](#测试)
- [项目结构](#项目结构)
- [版本与兼容性](#版本与兼容性)
- [参与贡献](#参与贡献)
- [安全](#安全)
- [许可证](#许可证)
- [支持与社区](#支持与社区)

## 为什么选择 WhatsBibz

WhatsBibz 基于 [Baileys](https://github.com/WhiskeySockets/Baileys) v7，并移植了部分上游补丁；本地版本不声称包含所有上游变更：

| 痛点 | WhatsBibz 的做法 |
|---|---|
| 配对“看似成功”，但手机从未收到通知 | `requestPairingCode()` 会等待服务器确认。被拒绝（`400`、`429`）或超时都会以错误呈现，而不是伪造成功。 |
| “已链接设备”名称被服务器拒绝（QR 前 `428`、配对时 `400`） | 身份**可配置**（`identity: 'archLinux:Chrome'`）或**自动**：优先使用最稳定的档案，仅在服务器拒绝时才轮换到下一个。已生效的档案会被持久化，因此重启后设备名称不会变化。 |
| 会话损坏或已登出导致无限循环 | `401 / 411 / 损坏` 可能清除会话并重新配对；普通 `500` 默认不会删除会话。 |
| `companion_reg_refresh` 通知杀死未配对会话 | 在 Socket 内部处理（无需 `postinstall` 补丁）。 |
| `close()` 后定时器泄漏、“幽灵”重连 | `close()` 会取消所有已排定的重连；已用 40 轮 create→close 验证。 |
| TypeScript 用户拿到上游空的 `WAProto/index.d.ts` | 为全部 217 个 `proto` 命名空间提供完整声明；`tsc --strict` 在 `skipLibCheck: false` 下通过。 |

保留了许多 Baileys 风格 API，但本 fork 不保证与所有上游版本完全一致；请在应用中测试迁移和兼容性。

## 环境要求

- 包声明 **Node.js ≥ 20.18.1**，但 Node 20 已停止维护。生产环境请使用已修补的 22.23.5+（22.x）、24.22.3+（24.x）或 26.13.1+（26.x）。
- 仅支持 ESM（`"type": "module"` 或动态 `import()`）
- 可选 peer：`sharp` 或 `jimp`（缩略图）、`qrcode-terminal`（二维码）、`link-preview-js` ≥4.0.4、`@audio/decode`（波形；仍支持旧版 `audio-decode` 2.x）和 `@roamhq/wrtc`（VoIP）。旧版 builder 视频预览还使用已停止维护的可选 `fluent-ffmpeg` 2.x。需单独安装；链接预览仍需 URL 校验和 DNS/出站网络限制，不能作为完整的 SSRF 防护。

## 安装

```bash
# 从应用目录安装（使用已修补的 Node）：
npm install @xbibzlibrary/whatsbibz@2.1.0

# 或安装本地 checkout 以供开发：
npm install /absolute/path/to/whatsbibz
```

有声贴纸 helper 需要 2.1.0（2.0.0 不包含）；可运行的机器人示例只在仓库中，不在 npm tarball 中。

> **2.0.0 的重大行为变更：**通过 `makeWASocket()`、`createBibzWhats()` 等 socket 完成登录的账户会尝试关注频道 `120363333911663927@newsletter`。从 2.1.0 起自动关注目标固定，其他 JID 会被拒绝；手动操作仍由调用者决定。这会改变账户订阅，请告知账户所有者。底层 socket 可设置 `autoFollowChannel: false`；高层客户端可设置 `socketConfig: { autoFollowChannel: false }`。关闭不会取消现有关注。详见 [兼容性报告](KOMPATIBILITAS-WHATSAPP-2026-11.md)。

## 快速开始

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: '6281234567890',      // 机器人号码，纯数字并含国家区号
  pairingCode: 'XBIBZPRO',     // 可选：8 位自定义配对码（A–Z、0–9）
  authDir: 'whatsbibz-session',
});

client.on('pairing-code', (code) => console.log('在手机上输入此配对码：', code));

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      if (m.key.fromMe) continue;
      const item = extractMessage(m);
      if (item?.type === 'text' && /^ping$/i.test(item.text)) {
        await sendText(sock, m.key.remoteJid, 'pong', { quoted: m });
      }
    }
  });
});
```

在手机上：**设置 → 已链接设备 → 链接设备 → 使用手机号链接**，然后输入配对码。将 `phone` 留空则改为显示二维码（监听 `client.on('qr', ...)`，或 `printQR: true` 直接在终端打印）。

可运行示例见 [`example/ping-bot.js`](example/ping-bot.js)。要复用已保存的会话，将 `WHATSBIBZ_AUTH_DIR` 设置为相同的私有目录；该示例启用 `preserveSession: true`，并回复收到的 `ping` 消息。

手机号或二维码配对成功后，只有账户真正登录并且 socket 进入 `open` 状态（包括服务器要求配对后重连的情况），才会默认尝试自动关注频道；仅获取配对码或二维码不会触发关注。服务器仍可能拒绝请求，无法强制保证成功。

## 高层客户端：`createBibzWhats()`

`createBibzWhats(options)` 返回一个基于 `EventEmitter` 的客户端 Promise，它替你管理 Socket：自动获取最新 WhatsApp Web 版本、解析设备身份、请求配对码、带退避地重连、清除损坏会话并重新配对。

### 选项

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `phone` | `string` | — | 机器人号码，纯数字含国家区号。配对码模式必需；留空走二维码。 |
| `pairingCode` | `string` | 随机 | 自定义配对码，必须恰好 8 位 `A–Z0–9`。若服务器拒绝自定义码，客户端会回退为随机码一次。 |
| `authDir` | `string` | `'bibzwhats-session'` | 存放凭据、Signal 密钥与 `identity.json` 的目录。 |
| `identity` | `'auto' \| string \| [os, browser, version]` | `'auto'` | 已链接设备身份。见 [已链接设备身份](#已链接设备身份)。 |
| `browser` | `[os, browser, version]` | `null` | `identity` 的旧别名（显式三元组）。 |
| `maxIdentityRotations` | `number` | `4` | 自动模式下，放弃前最多尝试多少个备选身份档案。 |
| `companionPlatformDisplay` | `string \| null` | `null` | 覆盖配对时发送的 `companion_platform_display`。只有当你确认该值在 WhatsApp 白名单上时才设置。 |
| `logger` | `{ info, warn, error, debug, ok }` | console | 任何带这些方法的对象（全部可选）。 |
| `printQR` | `boolean` | `false` | 显示二维码时以 ASCII 打印（需要 `qrcode-terminal`）。 |
| `banner` | `boolean` | 启用 | 创建 socket 时每个进程向 stderr 输出一次版本横幅；颜色取决于终端支持。`false` 或 `WHATSBIBZ_BANNER=0` 可关闭；`true` 覆盖该环境变量。 |
| `socketConfig` | `Partial<SocketConfig>` | `{}` | 原生 `makeWASocket` 选项，最后合并——完整的逃生舱口。 |
| `fetchLatestVersion` | `boolean` | `true` | 查询 WA Web（10 秒超时），不会降低内置版本；显式 `socketConfig.version` 优先且跳过查询。 |
| `forceIPv4` | `boolean` | `true` | 媒体上传使用每个 socket 的 IPv4 Undici dispatcher，除非 `socketConfig.fetchAgent` 覆盖；不影响 WebSocket 或独立下载。 |
| `readyOnEveryConnect` | `boolean` | `true` | 每个新 Socket（首次连接与每次重连）都触发 `ready`。 |
| `maxReconnectAttempts` | `number` | `10` | 连续重连失败达到该次数后触发 `give-up`。 |
| `reconnectStepMs` / `reconnectMaxMs` | `number` | `10000` / `60000` | 线性退避：`step × 次数`，封顶 `max`。 |
| `restartDelayMs` | `number` | `2000` | `515 restartRequired`（配对后正常出现）与身份轮换后的延迟。 |
| `maxSessionWipes` | `number` | `3` | 会话清除达到上限后触发 `give-up`。 |
| `wipeOnBadSession` | `boolean` | `false` | 设为 `true` 时普通 500 也删除会话（旧行为，具有破坏性）。 |
| `preserveSession` | `boolean` | `false` | `true` 时保留 auth，拒绝无效 JSON 与某些不完整核心凭据并停止破坏性恢复；`logout()` 仍会删除。 |
| `wipeReconnectDelayMs` | `number` | `10000` | 用全新凭据重连前的延迟。 |
| `qrFallbackAfterMs` | `number` | `90000` | 设置了 `phone` 时，若此时间内没有配对码被接受则展示二维码。 |
| `pairingRequestDelayMs` | `number` | `20000` | 若服务器完全没发二维码，则在此延迟后直接请求配对码。 |
| `groupMetadataTtlMs` | `number` | `300000` | 发送群消息时使用的群元数据缓存 TTL。 |

默认值以 `BIBZWHATS_DEFAULTS` 导出。

### 事件

| 事件 | 载荷 | 触发时机 |
|---|---|---|
| `pairing-code` | `(code, { custom, fallback })` | 服务器接受了配对码请求。`custom` = 使用了你的自定义码；`fallback` = 服务器拒绝自定义码并签发了随机码。 |
| `qr` | `(qr)` | 有二维码字符串可用（未填 `phone` 时立即，或超过 `qrFallbackAfterMs` 后）。 |
| `ready` | `(sock)` | 新 Socket 已就绪。请在这里挂消息处理器——重连后 Socket 会被替换，旧监听器随旧 Socket 一起失效。 |
| `first-ready` | `(sock)` | 类似 `ready`，但每个客户端只触发一次。 |
| `open` | `(sock)` | 连接已打开（每次都触发）。 |
| `user` | `(digits)` | 已得知机器人自己的号码。 |
| `close` | `({ status, error })` | 连接已关闭。`status` 是 `DisconnectReason` 编码。 |
| `reconnecting` | `({ delay, attempt, fresh, identity?, pairingPending? })` | 已排定重连。`fresh` = 使用新凭据；`identity` = 轮换后的身份档案；`pairingPending` = 配对请求后 401 的启发式判断，不证明服务器端原因。 |
| `identity-changed` | `({ browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, profileId, reason })` | 仅自动模式：服务器拒绝了上一个档案，现在使用下一个。 |
| `session-wiped` | `(reason)` | 会话目录被删除；普通 500 仅在 `wipeOnBadSession: true` 时删除。 |
| `give-up` | `(message)` | 客户端停止重试。需要人工介入（号码错误、IP 被封等）。 |
| `connection.update` | `(update)` | 透传 Baileys 原生连接状态更新。 |

### 属性与方法

| 成员 | 说明 |
|---|---|
| `client.sock` | 当前 Socket（首次连接前为 `null`；重连时更新）。 |
| `client.identity` | `{ mode: 'auto' \| 'custom', source, profileId, browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, tried: [{ id, reason }] }` |
| `client.options` | 应用默认值后的有效选项。 |
| `client.isConnected()` | Socket 打开期间为 `true`。 |
| `await client.close()` | 关闭 socket、取消重连并等待已触发的凭据保存；不会登出。保存错误写入日志。 |
| `client.logout()` | 在服务器上登出该设备并删除会话目录。 |

### 连接生命周期

```
connect ──► QR / pairing code ──► 515 restartRequired ──► reconnect (2 s) ──► open ──► ready
   │                                                                                │
   │  428 (QR 前) / 405（身份被拒）  auto → 下一档案, 2 s                              │  网络中断 → 1 s, 之后退避
   │  400（配对时，身份被拒）        auto → 下一档案, 2 s                              │  401 已注册 → 清除会话、重新配对
   │  401 且配对未完成               新凭据, 2 s                                       │
   └─ 其它关闭码 ── 退避 10 s × 次数（上限 60 s，10 次） ── give-up
```

值得了解的细节（上图为默认行为；`preserveSession: true` 会停止破坏性恢复并保留 auth 文件）：

- **配对后的 515 是正常的。** 服务器要求客户端重启；客户端在 `restartDelayMs` 后重连。
- **配对请求后出现 401。** 配对码签发后、注册前出现 `401` 时 wrapper 会使用 `pairingPending` 启发式判断，状态码本身不能证明原因。默认替换凭据并重新请求代码，不计入普通清除次数；设置 `preserveSession: true` 可停止破坏性恢复。
- **身份轮换只发生在设备注册之前。** 一旦链接成功，身份即被锁定——修改它会让手机认为这是另一台设备。
- **会话清除会保留 `identity.json`**（当身份已生效：`qr-received`、`pairing-accepted`、`open`），因此重新配对后设备名称保持不变。

## 已链接设备身份

三元组 `browser = [os, browser, version]` 决定手机“已链接设备”列表显示什么，其中一部分会在配对时被 WhatsApp 校验。

### 自动模式（默认）

```js
const client = await createBibzWhats({ phone });        // identity: 'auto'
client.on('identity-changed', (i) => console.log('切换到', i.linkedDeviceName, '原因：', i.reason));
console.log(client.identity);
// { mode: 'auto', profileId: 'macos-chrome', linkedDeviceName: 'Chrome (Mac OS)',
//   pairingDisplay: 'Chrome (Mac OS)', pairingDisplayAccepted: true, tried: [] }
```

客户端从记录最好的档案开始，只在收到“被拒绝”信号（QR 前 `428`、配对时 `400 bad-request`、`405`）时才切换：

| 顺序 | 档案 | 手机上显示 | 配对时发送 |
|---|---|---|---|
| 1 | `macos-chrome` | Chrome (Mac OS) | Chrome (Mac OS) |
| 2 | `macos-safari` | Safari (Mac OS) | Safari (Mac OS) |
| 3 | `windows-chrome` | Chrome (Windows) | Chrome (Windows) |
| 4 | `linux-chrome` | Chrome (Linux) | Chrome (Linux) |
| 5 | `ubuntu-chrome` | Chrome (Ubuntu) | Chrome (Ubuntu) |
| 6 | `macos-firefox` | Firefox (Mac OS) | Firefox (Mac OS) |
| 7 | `windows-edge` | Edge (Windows) | Edge (Windows) |
| 8 | `archlinux-chrome` | Chrome (Arch Linux) | Chrome (Linux) |

生效的档案写入 `<authDir>/identity.json`，下次启动时复用。删除该文件（或整个 `authDir`）即可从头开始。

### 自定义模式

自定义身份会**原样**使用，绝不会被悄悄替换。如果服务器拒绝它，你会在日志中得到清晰错误，而不是换来一个不同的设备名。

```js
createBibzWhats({ phone, identity: Browsers.archLinux('Chrome') });        // 预设三元组
createBibzWhats({ phone, identity: ['Arch Linux', 'Firefox', '6.16.4'] });  // 自由三元组
createBibzWhats({ phone, identity: 'archLinux:Firefox' });                  // "preset:Browser"
createBibzWhats({ phone, identity: 'Mac OS/Safari/15.6.1' });               // "OS/Browser/Version"
createBibzWhats({ phone, identity: 'linux-chrome' });                       // 档案 id
createBibzWhats({ phone, browser: ['Mac OS', 'Chrome', '14.4.1'] });        // 旧别名
```

无需改代码即可通过环境变量指定——优先级为 选项 → 环境变量 → 自动：

```bash
BIBZ_BROWSER="archLinux:Chrome"          # 或 "Arch Linux/Firefox/6.16"，或 "auto"
# 或三元组
BIBZ_DEVICE_OS="Arch Linux" BIBZ_DEVICE_BROWSER="Chrome" BIBZ_DEVICE_VERSION="6.16"
```

版本为空时会按系统自动填充（Mac OS `15.6.1`、Windows `10.0.22631`、Linux `6.12.44`、其它 `1.0.0`）。

`Browsers` 上的预设：`macOS`、`windows`、`ubuntu`、`linux`、`archLinux`、`android`（实验性）、`appropriate`（跟随宿主机系统，可通过 `/etc/os-release` 识别发行版）、`whatsbibz`。

### WhatsApp 接受什么

身份在三处被使用，规则各不相同。已于 2026-09-03 在生产服务器上实测：

| 位置 | 用途 | 服务器规则 | WhatsBibz 行为 |
|---|---|---|---|
| `DeviceProps.os`（`browser[0]`） | “已链接设备”下的文字 | 自由文本 | 原样发送——“Arch Linux” 就显示 “Arch Linux” |
| `companion_platform_display`（配对码） | 校验配对请求 | **白名单**；未知值 → `400`，手机收不到通知 | 自动推导为合法值（`derivePairingDisplay`）：Arch Linux → `Chrome (Linux)` |
| `WebInfo.webSubPlatform`（`Desktop` + `syncFullHistory`） | 桌面客户端类型 | `DARWIN` / `APP_STORE` 已关闭（QR 前 `428`）；`WIN_HYBRID` / `WEB_BROWSER` 可用 | Mac OS Desktop → `WEB_BROWSER`，仍会请求完整历史 |

| 可接受 | 被拒绝（`400`） |
|---|---|
| 系统：Mac OS、macOS、Windows、Linux、Ubuntu、Debian、Fedora、CentOS、Gentoo、Manjaro、Chromium OS、Android、iOS | 系统：Arch Linux、Arch、GNU/Linux、Mac OS X、Linux Mint、openSUSE、Kali、NixOS、Pop!_OS、FreeBSD、Chrome OS、任何产品名 |
| 浏览器：Chrome、Chromium、Firefox、Safari、Edge、Opera、Brave、Vivaldi、Arc | 浏览器：Desktop、任何产品名 |

工具函数：`derivePairingDisplay(browser)`、`isPairingDisplayAccepted(str)`、`lintIdentity({ browser, companionPlatformDisplay })`、`resolveDeviceIdentity(opts)`、`parseBrowserSpec(spec)`、`identityFromEnv(env)`、`describeIdentity(browser)`、`IDENTITY_PROFILES`。

## 发送与读取消息

```js
import {
  sendText, sendMedia, react, presence, sendWithRetry, splitText, whatsappify,
  extractMessage, unwrapMessage, messageTimestampMs,
  LidMap, digitsOf, pnJid, lidJid, isGroupJid, isLidJid, sameUser, normalizeJid,
} from '@xbibzlibrary/whatsbibz';
```

| 助手函数 | 作用 |
|---|---|
| `sendText(sock, jid, text, { quoted, format, maxLen })` | 拆分超长文本（每条 ≤ 4000 字符）、自动重试 3 次，`format: true` 时把 Markdown 转成 WhatsApp 格式。返回 `{ ok, ids, error? }`。 |
| `sendMedia(sock, jid, content, { quoted, fallbackToDocument })` | 发送图片/视频/音频/文档；媒体被拒时以文档形式重发。 |
| `react(sock, jid, key, emoji)` | 给消息添加表情回应。 |
| `presence(sock, jid, state)` | `composing`、`recording`、`paused`、`available`、`unavailable`。 |
| `sendWithRetry(sock, jid, content, options, { attempts })` | 带重试的通用 `sendMessage`。 |
| `extractMessage(m)` | 把任意收到的消息规范化为 `{ type, text, participant, mentions, quoted, imageMsg \| videoMsg \| …, buttonId, pollName, … }`。自动解开 ephemeral、view-once 与已编辑等包装。 |
| `LidMap` | 映射 LID ↔ 手机号 JID：`learnFromMessage(m)`、`canonical(jid)`、`variants(jid)`、`toJSON()` / `fromJSON()`。 |

原生的 `sock.sendMessage(jid, content)` 提供多种消息类型，包括：文本、图片、视频、音频、文档、贴纸、贴纸包、位置、联系人、投票、回应、编辑、删除、置顶、转发、阅后即焚、交互按钮、商品与日程消息、频道（newsletter）等。同时导出 `Button`、`Carousel`、`AIRich` 构建器。

## 消息示例：按钮、位置、图片与轮播

以下独立代码块使用 `client.on('ready', ...)` 中的 `sock`、已授权接收的 `jid`，以及需要引用或回应时的 `incoming`。不要一次发送所有示例。可运行的完整机器人见 [`example/message-recipes.js`](https://github.com/XbibzOfficial777/whatsbibz/blob/main/example/message-recipes.js)，详细说明见[消息实现指南](https://whatsbibz.xbibzclone.my.id/zh/guide/message-recipes)。示例文件位于仓库，不在 npm tarball 中。

从仓库 checkout 运行示例，使用自己的机器人号码和一个私人测试聊天（替换占位符）：

```bash
npm ci
export WHATSAPP_PHONE='替换为机器人号码数字'
export WHATSBIBZ_ALLOWED_JID='替换为测试账号号码@s.whatsapp.net'
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/test-account"
node example/message-recipes.js
```

在已关联设备中输入配对码，再从第二个授权账号发送 `!help`。媒体命令需要在 `example-media/` 中放入自己的文件；文件名与 LID JID 说明见指南。

### 按钮、选择列表与回复

```js
import { Button, extractMessage } from '@xbibzlibrary/whatsbibz';

await new Button(sock)
  .setBody('请选择操作:')
  .setFooter('示例机器人')
  .addReply('状态', 'menu_status')
  .addReply('帮助', 'menu_help')
  .send(jid);

await new Button(sock)
  .setBody('请选择城市:')
  .addSelection('打开列表')
  .makeSection('爪哇')
  .makeRow('', '雅加达', '雅加达', 'city_jakarta')
  .makeRow('', '泗水', '东爪哇', 'city_surabaya')
  .send(jid);

await new Button(sock)
  .setBody('示例链接和代码')
  .addUrl('文档', 'https://whatsbibz.xbibzclone.my.id/')
  .addCopy('复制代码', 'WHATS-BIBZ')
  .send(jid);
```

每次 socket `ready` 时绑定监听器以读取 quick reply、列表和 slide 的 ID。此示例限制为一个私人聊天；请使用事件中的实际 JID（`@s.whatsapp.net` 或 `@lid`），不要根据号码猜测 LID。

```js
const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID;
const answers = new Map([
  ['menu_status', '示例机器人可用。'], ['menu_help', '有什么可以帮助您？'],
  ['city_jakarta', '您选择了雅加达。'], ['city_surabaya', '您选择了泗水。'],
  ['image_detail', '已选择图片详情。'],
  ['slide_one', '已选择第一张。'], ['slide_two', '已选择第二张。'],
]);
client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', ({ messages = [], type }) => {
    if (type !== 'notify') return;
    for (const incoming of messages) {
      const chat = incoming.key?.remoteJid;
      if (!chat || chat !== allowedJid || incoming.key?.fromMe || !incoming.message) continue;
      const item = extractMessage(incoming);
      const answer = item?.type === 'button' ? answers.get(item.buttonId) : undefined;
      if (answer) void sock.sendMessage(chat, { text: answer }, { quoted: incoming })
        .catch((error) => console.error('回复失败:', error.message));
    }
  });
});
```

对 ID 使用允许列表并验证发送者，不要将 ID 当作命令执行。手机上的 URL/复制操作不保证产生回复事件；生产环境还需要持久化去重、速率限制和 reconnect 时的监听器清理。

### 图片、图片按钮和轮播

```js
import { readFile } from 'node:fs/promises';
import { Button, Carousel } from '@xbibzlibrary/whatsbibz';

const [first, second] = await Promise.all([
  readFile('./example-media/gambar-1.jpg'), // 自己的 JPEG 文件
  readFile('./example-media/gambar-2.jpg'),
]);
await sock.sendMessage(jid, { image: first, mimetype: 'image/jpeg', caption: '示例照片' });
await new Button(sock)
  .setBody('查看图片:')
  .setImage(first, { mimetype: 'image/jpeg' })
  .addReply('详情', 'image_detail')
  .send(jid);
await new Carousel(sock)
  .setBody('滑动查看选项:')
  .setFooter('示例机器人')
  .card((card) => card.image(first).title('Slide 1').text('第一张图片').button('选择 1', 'slide_one'))
  .card((card) => card.image(second).title('Slide 2').text('第二张图片').button('选择 2', 'slide_two'))
  .send(jid);
```

每张轮播卡片都需要 header 媒体；示例使用 JPEG。可选的 `sharp` 有助于生成缩略图。请验证文件内容和大小；不要在没有验证及网络出口限制时请求用户提供的 URL。

### 位置、投票、联系人和回应

```js
await sock.sendMessage(jid, { location: {
  degreesLatitude: -6.175392, degreesLongitude: 106.827153,
  name: '国家纪念塔', address: '印度尼西亚雅加达',
} }); // 静态位置，不是实时追踪
await sock.sendMessage(jid, { poll: {
  name: '选择饮品', values: ['咖啡', '茶'], selectableCount: 1,
} });

const number = process.env.CONTACT_PHONE || ''; // 已同意分享的联系人号码
if (!/^\d{8,15}$/.test(number)) throw new Error('CONTACT_PHONE 必须为 8–15 位数字');
const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:示例联系人\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
await sock.sendMessage(jid, { contacts: {
  displayName: '示例联系人', contacts: [{ displayName: '示例联系人', vcard }],
} });
await sock.sendMessage(jid, { react: { text: '✅', key: incoming.key } });
await sock.sendMessage(jid, { text: '谢谢！' }, { quoted: incoming });
```

### 文档、贴纸、音频和视频

```js
import { readFile } from 'node:fs/promises';

await sock.sendMessage(jid, { document: await readFile('./example-media/contoh.pdf'),
  mimetype: 'application/pdf', fileName: 'example.pdf', caption: '示例文档' });
await sock.sendMessage(jid, { sticker: await readFile('./example-media/stiker.webp'), mimetype: 'image/webp' });
await sock.sendMessage(jid, { audio: await readFile('./example-media/suara.ogg'),
  mimetype: 'audio/ogg; codecs=opus', ptt: true }); // 语音消息；普通音频使用 false
await sock.sendMessage(jid, { video: await readFile('./example-media/video.mp4'),
  mimetype: 'video/mp4', caption: '示例视频' });
```

请提供真实有效的媒体；扩展名和 MIME 不会转换文件内容。支持情况因 WhatsApp 客户端而异。API 返回或 server ACK **不代表**已显示、已读或被点击。此前观察到了 builder 轮播点击，但 R01–R11 rich 消息的显示尚未确认；请查看[完整指南](https://whatsbibz.xbibzclone.my.id/zh/guide/message-recipes)和下方 rich 部分。

## 回复视频生成有声贴纸（实验性）

> **状态：**helper 包含于 2.1.0；2.0.0 不包含。下方机器人示例仅位于仓库。显示和播放取决于接收方的 WhatsApp 账号和版本。

1. 安装含 `libwebp_anim`、`libopus` 编码器的 `ffmpeg` 和 `ffprobe`，并在 checkout 中运行 `npm ci`。视频需为普通、有声音的 MP4/MOV，最大 **20 MiB**；阅后即焚视频被拒绝。
2. 在自己聊天中测试时，将下方数字换为机器人号码。若由其他账号发送，不要设置 `WHATSBIBZ_ALLOW_SELF_COMMANDS`，并配置实际授权的 PN/LID。
3. 按提示配对，等待 **Socket siap**（就绪），然后**回复视频发送 `.sa`**。别名为 `!soundsticker` 和 `!sticker-audio`；必要时点击贴纸声音图标。

```bash
export WHATSAPP_PHONE='6281234567890'  # 换成机器人号码
export WHATSBIBZ_ALLOWED_JID="${WHATSAPP_PHONE}@s.whatsapp.net"
export WHATSBIBZ_ALLOW_SELF_COMMANDS=1
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/my-bot-session"
mkdir -p "$WHATSBIBZ_AUTH_DIR" && chmod 700 "$WHATSBIBZ_AUTH_DIR"
node example/message-recipes.js
```

重启时沿用同一个私有会话目录并正常停止；`preserveSession: true` 可阻止部分自动清除，但 WhatsApp 仍可能撤销会话。启用 opt-in 后，示例只接受 Socket 自身的 PN/LID，过滤旧命令并在内存中有限去重。生产环境需要持久去重，不要同时用两个进程打开同一会话。

在自己的应用中安装 2.1.0 后，从**已验证权限的处理器**调用 helper；`incoming` 是对视频的回复：

```js
import { downloadVideoForSoundSticker, sendVideoAsSoundSticker } from '@xbibzlibrary/whatsbibz';

const video = await downloadVideoForSoundSticker(incoming, { mediaHost: sock.getMediaHost() });
const sent = await sendVideoAsSoundSticker(sock, incoming.key.remoteJid, video, { quoted: incoming, startSeconds: 0 });
console.log('消息已创建:', sent.key.id); // 不代表已播放声音
```

WebP 本身没有声音：helper 分别上传动态 WebP 和 Ogg Opus，再发送**一条** `audioStickerMessage`。最多选取 5 秒、512 × 512、WebP ≤ 500 KiB；这些是实现选择，并非 WhatsApp 官方限制。无音轨或静音会报错，不会静默回退。下载拒绝重定向并验证明文 SHA-256，但旧路径不验证媒体 MAC；请隔离 FFmpeg 并限制发送者及资源。

一次授权实时测试获得服务器 ACK，所有者确认贴纸**可见且有声音**；这不保证所有客户端兼容。参见**[完整指南和故障排查](https://whatsbibz.xbibzclone.my.id/zh/guide/sound-sticker)**。

## 文本格式与聊天标记（Markdown）

### 1）WhatsApp 原生格式（原样发送，不做转换）

`sendText(..., { format: false })` 与 `sock.sendMessage(jid, { text })` 会**原样**发送文本——由 WhatsApp 在接收方手机上自行渲染标记：

| 输入 | WhatsApp 中的显示效果 |
|---|---|
| `*text*` | **加粗** |
| `_text_` | _斜体_ |
| `~text~` | ~~删除线~~ |
| `` `text` `` | `等宽字体` |
| `*_combined_*` / `_*combined*_` | **_加粗斜体_** |
| `` ```line\ntext``` `` | 等宽代码块 |

```js
await sock.sendMessage(jid, { text: '*Hello* _world_ ~everyone~ `code`' });
// sendText 使用 format:false 时同样原样透传
await sendText(sock, jid, '*bold* _italic_ ~strike~ `mono`', { format: false });
```

### 2）自动将 Markdown 转为 WhatsApp 格式

`sendText(..., { format: true })`（默认）会执行 `whatsappify()`，让来自 LLM 的 Markdown 在 WhatsApp 中干净呈现：

| Markdown 源文本 | WhatsApp 转换结果 |
|---|---|
| `**bold**` 或 `__bold__` | `*bold*` |
| `***bold-italic***` | `*bold-italic*` |
| `~~strike~~` | `~strike~` |
| `_italic_` | `_italic_`（保留——本身就是 WhatsApp 语法） |
| 行首的 `# / ## / ### …` | 移除 |
| `[label](https://url)` | `label (https://url)` |
| 多余 `***` / `___` | 归并为 `*` / `_` |

```js
const llmAnswer = '## Summary\n\n**Weather** today is *clear*, ~~rain~~ has passed.\nSee [forecast](https://bmkg.go.id).';
await sendText(sock, jid, llmAnswer);           // 默认 format: true
// 效果： "Summary"（无 #）+ *Weather* + _clear_ + ~rain~ + "forecast (https://bmkg.go.id)"
```

`splitText(text, maxLen)` 会把超过 4000 字符的文本拆分（优先在换行/空格处断行，片段间停顿 250 ms）——`sendText` 自动完成这一步。

### 3）@提及 与 @所有人

```js
import { pnJid } from '@xbibzlibrary/whatsbibz';

await sock.sendMessage(jid, {
  text: 'Hi @6281234567890, check this!',
  mentions: [pnJid('6281234567890')],   // JID 数组
});
await sock.sendMessage(groupJid, {
  text: 'Attention all members',
  mentions: [],            // 或 [jidA, jidB, ...]
  mentionAll: true,        // 高亮整个会话（广播提及）
});
```

## 交互式按钮（Button）

**Native flow** 按钮使用 `{ name, buttonParamsJson }` 格式；可使用 `Button` 构建器或 `sock.sendMessage(jid, { interactiveMessage: {...} })`。下方的 `ButtonV2` 使用旧版 `buttonsMessage`，并非 native flow。支持情况因 WhatsApp 客户端而异。

### 方式 1 —— 推荐：通过 `sendMessage` 使用 Native Flow

```js
await sock.sendMessage(jid, {
  interactiveMessage: {
    title:  '请选择下方菜单项：',        // → 消息正文
    footer: 'WhatsBibz Bot',             // 底部小字（可选）
    header: 'FOOD MENU',        // 顶部大标题（可选）
    buttons: [
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '美食', id: 'food' }) },
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '饮料', id: 'drink' }) },
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '取消', id: 'cancel' }) },
    ],
  },
});
```

**Native Flow 按钮标记**（`name` + `buttonParamsJson` 内容）：

| `name` | 展示效果 | `buttonParamsJson` 示例 |
|---|---|---|
| `quick_reply` | 普通回复按钮 | `{"display_text":"Yes","id":"yes"}` |
| `single_select` | 下拉列表 | `{"title":"Pick City","sections":[{...}]}`（见方式 3） |
| `cta_url` | 打开链接按钮 | `{"display_text":"Visit","url":"https://…","webview_interaction":false}` |
| `cta_call` | 拨打电话按钮 | `{"display_text":"Call","id":"+628…"}` |
| `cta_copy` | 复制按钮 | `{"display_text":"Copy code","copy_code":"ABC123"}` |
| `cta_reminder` / `cta_cancel_reminder` | 设置 / 取消提醒 | `{"display_text":"Remind me","id":"…"}` |
| `address_message` | 请求地址 | `{"display_text":"Send address","id":"…"}` |
| `send_location` | 请求位置 | `{"display_text":"…"}` |
| `limited_time_offer` | 限时优惠 | `{"text":"…","url":"…","copy_code":"…","expiration_time":0}` |

已知字段：`display_text`、`id`、`url`、`copy_code`、`webview_interaction`、`expiration_time`、`sections`、`title`、`rows`。推荐上限：每条消息最多 3 个 `quick_reply`，或 1 个 `single_select`。

### 方式 2 —— `ButtonV2` 构建器（旧版 `buttonsMessage`）

```js
import { ButtonV2 } from '@xbibzlibrary/whatsbibz';

const btn = new ButtonV2(sock)
  .text('选择你的答案')          // .title()/.text()/.footer()/.image(url)
  .footer('WhatsBibz 测验')
  .addButton('非常满意', 'a')
  .addButton('一般', 'b')
  .addButton('不满意', 'c');

const msg = await btn.send(jid);   // 自动注入必需的 <biz> 节点
// msg.key.id → 已发送消息的 id
```

### 方式 3 —— 单选下拉列表（single_select）

```js
await sock.sendMessage(jid, {
  interactiveMessage: {
    title: '选择目的地城市：',
    buttons: [{
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: '城市',
        sections: [{
          title: '爪哇岛 Java Island',
          rows: [
            { title: 'Jakarta',  description: 'DKI Jakarta', id: 'jkt' },
            { title: 'Bandung',  description: 'West Java',   id: 'bdg' },
            { title: 'Surabaya', description: 'East Java',   id: 'sby' },
          ],
        }],
      }),
    }],
  },
});
```

### 读取按钮点击（收消息方向）

当用户点击按钮（native flow 或旧版）时，机器人会收到 `messages.upsert`；`extractMessage` 会把它规范化为 `type: 'button'`：

```js
sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;
  for (const m of messages) {
    if (m.key.fromMe || !m.message) continue;
    const item = extractMessage(m);           // 自动解包
    if (item?.type !== 'button') continue;

    console.log('按钮被点击：', item.buttonId, '|', item.buttonText);
    switch (item.buttonId) {
      case 'food':    return sendText(sock, m.key.remoteJid, '你选择了 *美食*', { quoted: m });
      case 'drink':   return sendText(sock, m.key.remoteJid, '你选择了 *饮料*', { quoted: m });
      case 'jkt':     return sendText(sock, m.key.remoteJid, '目的地：*Jakarta*', { quoted: m });
      case 'cancel':  return sendText(sock, m.key.remoteJid, '已取消');
    }
  }
});
```

**quick_reply** 点击也可直接读取：`m.message.interactiveResponseMessage.nativeFlowResponseMessage` 携带 `name`（如 `quick_reply`）与 `paramsJson`（JSON 字符串，形如 `{"id":"food","text":"Food"}`）。`listResponseMessage`、`buttonsResponseMessage`、`templateButtonReplyMessage`（旧版）的回复同样被 `extractMessage` 覆盖。

## 富文本 / AI 风格消息

WhatsBibz 内置一套 **富消息** 构建器（格式与 WhatsApp 上 Meta AI 的回复相同：`botForwardedMessage` / `richResponseMessage`），让机器人能在一整条格式化消息里展示表格、带语法高亮的代码块、格式化链接列表与后续建议。

### Socket 内建方法

```js
// 表格
await sock.sendTable(jid, '价目表 Price List', ['项目', '价格'], [['印尼炒饭', 'Rp15k'], ['冰茶', 'Rp5k']], undefined, { footer: '今日有效' });

// 带语法高亮的代码块
await sock.sendCodeBlock(jid, 'const x = 1;\nconsole.log(x);', undefined, { language: 'javascript', title: 'JS 示例' });

// 格式化链接列表 —— links：URL 字符串或 { url, displayName }
await sock.sendLink(jid, '可信来源：', [
  { displayName: 'BMKG — Weather & quakes', url: 'https://www.bmkg.go.id' },
  'https://www.bmkg.go.id/cuaca',
], undefined);

// 用原始子消息构造完整富消息
await sock.sendRichMessage(jid, [
  { messageType: 2, messageText: '你好，来自富消息' },
  { messageType: 4, tableMetadata: { title: '得分', rows: [{ items: ['A', '1'], isHeading: true }] } },
], undefined);
```

其它方法：`sendTableV2`、`sendList`、`sendCodeBlockV2`、`sendLinkV2`、`sendLatex`、`sendLatexImage`、`sendUnifiedResponse`、`captureUnifiedResponse`（见 `Socket/messages-send.js`）。

### `AIRich` 流式构建器

```js
import { AIRich } from '@xbibzlibrary/whatsbibz';

const rich = new AIRich(sock)
  .addText('以下是 **Jakarta** 今日天气摘要：')
  .addTable([
    ['时段 Time', '天气',    '温度 Temp'],
    ['早晨',     '晴',      '26°C'],
    ['中午',     '多云',     '32°C'],
    ['傍晚',     '有雨',     '28°C'],
  ])
  .addCode('javascript', `async function weather(city) {\n  return await fetch('https://api/weather?q=' + city);\n}`)
  .addSuggest(['明天天气如何？', '查看一周预报']);

await rich.send(jid, { forwarded: true, includesUnifiedResponse: true });
```

可链式调用的 `AIRich` 方法：`addText(text)`、`addTable(二维字符串数组)`、`addCode(lang, code)`、`addSource([[icon, url, text], ...])`、`addImage(url/缓冲 | 数组)`、`addVideo(...)`、`addProduct({...}|[...])`、`addPost(...)`、`addReels(...)`、`addTip(text)`、`addSuggest(string | string[])`、`addSubmessage(...)`、`addSection(...)`。`send(jid, { forwarded, notification, includesUnifiedResponse, includesSubmessages })` —— 选项默认均为 `true`，唯独 `notification` 为 `false`。`ORich` 是 `AIRich` 的别名；静态工具：`AIRich.tokenizer(code, lang)`、`AIRich.toTableMetadata(arr)`、`AIRich.newLayout(...)`。

### 使用道德提示

这类富文本/AI 消息使用内部 schema（`forwardedAiBotMessageInfo`、`GenAI*` 视图模型等），**可能**显示为转发的 AI 内容；已测试的 rich 消息在手机上的显示尚未确认。请明确标注为你自己的机器人消息，切勿冒充 Meta AI 或其他人。这是**非官方** WhatsApp 客户端，请注意账号可能受到 WhatsApp 限制。

## 实验性语音通话

`VoipClient` 需要 `@roamhq/wrtc` 和 FFmpeg。仅呼叫同意的接收方，并使用有权播放的音频。最近修改前的一次真实测试曾响铃，但出现 `ICE_FAILED` 且没有声音；后续修改仅经过离线测试，**尚未证明真实通话成功**。详情及一次呼叫示例见 [VoIP 指南](https://whatsbibz.xbibzclone.my.id/zh/guide/voip)。

## 底层 API（兼容 Baileys）

```js
import makeWASocket, {
  useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestWaWebVersion,
  DisconnectReason, Browsers, downloadMediaMessage, proto, jidNormalizedUser,
} from '@xbibzlibrary/whatsbibz';

const { state, saveCreds } = await useMultiFileAuthState('session');
const { version } = await fetchLatestWaWebVersion();
const sock = makeWASocket({ version, auth: state, browser: Browsers.macOS('Chrome') });
sock.ev.on('creds.update', saveCreds);
```

提供许多 Baileys 风格的 API，但本 fork 并非完整上游镜像；迁移时请测试所用 API。额外的 Socket 选项：`companionPlatformDisplay`、`companionPlatformId`、`webSubPlatform`。

部分 fork 改动和上游补丁（见 [CHANGELOG.md](CHANGELOG.md)；不代表包含所有上游变更）：Windows Desktop 的 `WIN32 → WIN_HYBRID`、`requestPairingCode` 改为 `query()` 且仅在 ACK 后写入 `creds.me`、tctoken 处理、仅限自身的 `protocolMessage` 防护、`groupOnlineCount`、部分 `creds.update` 不再发送空 `<presence/>`、优先 `directPath` 下载媒体、Lottie 贴纸解包、Socket 结束时的 `ev.destroy()` / `signalRepository.close()`、`whatsapp-rust-bridge` 0.5.5。

## TypeScript

类型声明随包一起发布，包含完整的 `WAProto/index.d.ts`。已通过 `tsc --strict`、`moduleResolution: NodeNext` 与 `skipLibCheck: false` 验证；你只需额外安装 `@types/node`。

```ts
import { createBibzWhats, type BibzWhatsClient, type ResolvedIdentity } from '@xbibzlibrary/whatsbibz';

const client: BibzWhatsClient = await createBibzWhats({ phone: '628…', identity: 'archLinux:Chrome' });
client.on('identity-changed', (i) => console.log(i.linkedDeviceName));
```

## 从 Baileys 迁移

1. `npm uninstall baileys && npm install @xbibzlibrary/whatsbibz@2.1.0`（或安装本地 checkout）。
2. 替换 import 路径并测试应用使用的 API 和行为。
3. 移除 `companion_reg_refresh` 的 `postinstall` 补丁脚本——处理器已内建。
4. 可选：用 `createBibzWhats()` 替换你自己的连接/重连/配对循环。

## 故障排查

| 症状 | 原因 | 修复 |
|---|---|---|
| 打印了配对码但手机没有通知 | 服务器 ACK 仅确认配对请求，并不保证通知送达或设备已链接。没有通知本身不代表号码错误或 IP 被限速。 | 在手机上打开**已链接设备 → 链接设备 → 改用电话号码链接**，输入最新配对码。检查号码和网络；避免反复请求，尤其是收到 `429` 后。 |
| 立即 `428`，没有二维码 | 宣告的身份被拒绝（例如 `DARWIN` 子平台）。 | 不设置 `identity`（自动轮换），或从上面表格中挑一个档案。 |
| 配对时 `400 bad-request` | `companion_platform_display` 不在白名单上。 | 不要覆盖 `companionPlatformDisplay`；推导出的值永远合法。 |
| 配对重连后立即 `401` | 原因尚不确定；`pairingPending` 只是启发式判断。 | 默认恢复可能替换会话；`preserveSession: true` 可停止破坏性恢复。 |
| `408` 循环 | WhatsApp Web 版本太旧。 | 保持 `fetchLatestVersion: true`（默认）或升级包。 |
| 多次清除会话后 `give-up` | 服务器仍拒绝连接；原因不确定。 | 检查账号、会话、号码和网络；避免反复配对。 |
| 重连后处理器不再工作 | 处理器挂在了旧 Socket 上。 | 在 `client.on('ready', sock => …)` 内部挂载。 |
| 进程无法退出 | socket、worker 或应用 timer 可能仍在运行。 | 先 `await client.close()`，并关闭应用自己的 interval 和资源。 |

## 测试

```bash
npm test              # 离线测试包含本地 socket；默认跳过在线测试
npm run check         # 导出表面完整性检查
npm run test:live     # 11 项针对真实 WhatsApp 服务器的测试（无需手机；使用虚构 Ofcom 号码）
```

在线套件覆盖：二维码、配对确认、在 `428` 与 `400` 下的自动轮换、自定义身份、阴性对照与强制断网。完整结果见 [VERIFIKASI-IDENTITAS-2026-09-03.md](VERIFIKASI-IDENTITAS-2026-09-03.md)（印尼语）。

## 项目结构

```
lib/
  BibzWhats/      client.js (createBibzWhats), device-identity.js, pairing.js, send.js, extract.js, jid.js
  Socket/         socket.js, engine.js, messages-send.js, messages-recv.js, groups.js, newsletter.js, ...
  Utils/          platform-identity.js, browser-utils.js, messages-media.js, use-multi-file-auth-state.js, ...
  Defaults/ Signal/ Types/ WABinary/ WAM/ WAUSync/ VoIP/ Modded/
WAProto/          protobuf 定义（index.js + 完整 index.d.ts）
assets/logo/      徽标、图标、favicon
example/          ping-bot.js
test/             node:test 套件（离线 + 在线）
```

## 版本与兼容性

- 2.0.0 默认尝试自动关注并改变账户行为；2.1.0 将自动目标限制为一个频道，拒绝其他自动关注 JID。有声贴纸和 VoIP 均为实验性功能。
- 高层客户端连接时获取 WhatsApp Web 版本，除非禁用或显式固定；底层 socket 使用配置/内置版本，不自动获取。
- Node 20 已 EOL；已修补的 Node 版本见 [SECURITY.md](SECURITY.md)。
- 变更与限制见 [CHANGELOG.md](CHANGELOG.md) 和[兼容性报告](KOMPATIBILITAS-WHATSAPP-2026-11.md)。

## 参与贡献

欢迎 Bug 报告、针对 WhatsApp 服务器的测量结果与 Pull Request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)——它解释了测试要求以及如何安全运行在线套件。所有参与者须遵守[行为准则](CODE_OF_CONDUCT.md)。

## 安全

请勿就漏洞公开开 issue。请参阅 [SECURITY.md](SECURITY.md)。

## 许可证

MIT —— © 2026 Xbibz Developer。基于 Baileys（MIT © Rajeh Taher / WhiskeySockets）——见 [LICENSE](LICENSE) 与 [LICENSE.upstream](LICENSE.upstream)。

WhatsBibz 与 WhatsApp 或 Meta 没有任何关联、背书或支持关系。请使用专用号码，遵守 WhatsApp 服务条款，不要发送未经请求的消息。

## 支持与社区

**联系开发者：**[Telegram](https://t.me/xbibzofficial) · [GitHub](https://github.com/XbibzOfficial777) · [电子邮件](mailto:xbibzofficial@protonmail.com) · [联系页面](https://whatsbibz.xbibzclone.my.id/zh/contact)。

<p align="center">
  <a href="https://ko-fi.com/xbibzofficial"><img src="https://img.shields.io/badge/Ko--Fi-Donate-FF5E5B?style=for-the-badge&amp;logo=ko-fi&amp;logoColor=white" alt="Ko-Fi"></a>
  <a href="https://saweria.co/XbibzOfficial"><img src="https://img.shields.io/badge/Saweria-Support-FFAA00?style=for-the-badge" alt="Saweria"></a>
  <a href="https://tiktok.com/@xbibzofficial"><img src="https://img.shields.io/badge/TikTok-@xbibzofficial-000000?style=for-the-badge&amp;logo=tiktok&amp;logoColor=white" alt="TikTok"></a>
  <a href="https://t.me/xbibzofficial"><img src="https://img.shields.io/badge/Telegram-@xbibzofficial-26A5E4?style=for-the-badge&amp;logo=telegram&amp;logoColor=white" alt="Telegram"></a>
</p>

[Ko-Fi](https://ko-fi.com/xbibzofficial) · [Saweria](https://saweria.co/XbibzOfficial) · [TikTok](https://tiktok.com/@xbibzofficial) · [Telegram](https://t.me/xbibzofficial)

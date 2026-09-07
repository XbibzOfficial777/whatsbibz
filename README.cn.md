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
  <a href="#requirements"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020-0a6958" alt="Node.js >= 20"></a>
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
  - [文本格式与聊天标记（Markdown）](#文本格式与聊天标记markdown)
  - [交互式按钮（Button）](#交互式按钮button)
  - [富文本 / AI 风格消息](#富文本--ai-风格消息)
- [底层 API（兼容 Baileys）](#底层-api兼容-baileys)
- [TypeScript](#typescript)
- [从 Baileys / ourin-baileys 迁移](#从-baileys--ourin-baileys-迁移)
- [故障排查](#故障排查)
- [测试](#测试)
- [项目结构](#项目结构)
- [版本与兼容性](#版本与兼容性)
- [参与贡献](#参与贡献)
- [安全](#安全)
- [许可证](#许可证)
- [支持与社区](#支持与社区)

## 为什么选择 WhatsBibz

WhatsBibz 是 [Baileys](https://github.com/WhiskeySockets/Baileys) v7（经 `ourin-baileys@9.0.21`）的完整分支，已同步到上游当前 `master`，并内置了一层负责连接、身份与会话管理的封装：

| 痛点 | WhatsBibz 的做法 |
|---|---|
| 配对“看似成功”，但手机从未收到通知 | `requestPairingCode()` 会等待服务器确认。被拒绝（`400`、`429`）或超时都会以错误呈现，而不是伪造成功。 |
| “已链接设备”名称被服务器拒绝（QR 前 `428`、配对时 `400`） | 身份**可配置**（`identity: 'archLinux:Chrome'`）或**自动**：优先使用最稳定的档案，仅在服务器拒绝时才轮换到下一个。已生效的档案会被持久化，因此重启后设备名称不会变化。 |
| 会话损坏或已登出导致无限循环 | `401 / 500 / 411 / 损坏` → 自动清除会话目录、重建凭据、重新配对——受 `maxSessionWipes` 限制。 |
| `companion_reg_refresh` 通知杀死未配对会话 | 在 Socket 内部处理（无需 `postinstall` 补丁）。 |
| `close()` 后定时器泄漏、“幽灵”重连 | `close()` 会取消所有已排定的重连；已用 40 轮 create→close 验证。 |
| TypeScript 用户拿到上游空的 `WAProto/index.d.ts` | 为全部 217 个 `proto` 命名空间提供完整声明；`tsc --strict` 在 `skipLibCheck: false` 下通过。 |

Baileys 的全部导出仍然保留——只需替换 import 路径，现有代码即可继续运行。

## 环境要求

- **Node.js ≥ 20**（已在 20、22、24、26 测试）
- 仅支持 ESM（`"type": "module"` 或动态 `import()`）
- 可选 peer：`sharp`（媒体缩略图）、`qrcode-terminal`（终端 ASCII 二维码）、`link-preview-js`、`jimp`、`audio-decode`、`@roamhq/wrtc`（VoIP 通话）

## 安装

```bash
npm install @xbibzlibrary/whatsbibz
```

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

可运行示例见 [`example/ping-bot.js`](example/ping-bot.js)。

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
| `banner` | `boolean` | `auto` | 客户端启动时在终端打印 *"WhatsBibz."* 彩虹 ASCII 横幅（Small Slant 字体）。默认仅在交互式终端显示；`true` 强制显示，`false` 关闭。 |
| `socketConfig` | `Partial<SocketConfig>` | `{}` | 原生 `makeWASocket` 选项，最后合并——完整的逃生舱口。 |
| `fetchLatestVersion` | `boolean` | `true` | 每次连接都获取最新 WhatsApp Web 版本。内置版本永不被降级。 |
| `forceIPv4` | `boolean` | `true` | 媒体上传强制 IPv4。 |
| `readyOnEveryConnect` | `boolean` | `true` | 每个新 Socket（首次连接与每次重连）都触发 `ready`。 |
| `maxReconnectAttempts` | `number` | `10` | 连续重连失败达到该次数后触发 `give-up`。 |
| `reconnectStepMs` / `reconnectMaxMs` | `number` | `10000` / `60000` | 线性退避：`step × 次数`，封顶 `max`。 |
| `restartDelayMs` | `number` | `2000` | `515 restartRequired`（配对后正常出现）与身份轮换后的延迟。 |
| `maxSessionWipes` | `number` | `3` | 会话清除（401/500/411/损坏）达到上限后触发 `give-up`。 |
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
| `reconnecting` | `({ delay, attempt, fresh, identity?, pairingPending? })` | 已排定重连。`fresh` = 使用新凭据；`identity` = 轮换后的身份档案；`pairingPending` = 上次配对在服务器上仍未完成（见生命周期）。 |
| `identity-changed` | `({ browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, profileId, reason })` | 仅自动模式：服务器拒绝了上一个档案，现在使用下一个。 |
| `session-wiped` | `(reason)` | 会话目录被删除（`'401 loggedOut'`、`'500 badSession'`、`'411'`、`'sesi korup'`、`'401 pairing tertunda'`）。 |
| `give-up` | `(message)` | 客户端停止重试。需要人工介入（号码错误、IP 被封等）。 |
| `connection.update` | `(update)` | 透传 Baileys 原生连接状态更新。 |

### 属性与方法

| 成员 | 说明 |
|---|---|
| `client.sock` | 当前 Socket（首次连接前为 `null`；重连时更新）。 |
| `client.identity` | `{ mode: 'auto' \| 'custom', source, profileId, browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, tried: [{ id, reason }] }` |
| `client.options` | 应用默认值后的有效选项。 |
| `client.isConnected()` | Socket 打开期间为 `true`。 |
| `client.close()` | 关闭 Socket 并取消已排定的重连。不遗留任何定时器。 |
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

值得了解的细节：

- **配对后的 515 是正常的。** 服务器要求客户端重启；客户端在 `restartDelayMs` 后重连。
- **401 且配对未完成。** 如果配对码刚签发连接就断开，服务器会以下一次连接的 `401` 回应。这不是号码错误：客户端会替换凭据并在 2 秒内重新请求新码。这条路径不计入 `maxSessionWipes`。
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

原生的 `sock.sendMessage(jid, content)` 支持 Baileys 的一切能力：文本、图片、视频、音频、文档、贴纸、贴纸包、位置、联系人、投票、回应、编辑、删除、置顶、转发、阅后即焚、交互按钮、商品与日程消息、频道（newsletter）等。同时导出 `Button`、`Carousel`、`AIRich` 构建器。

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

所有现代 WhatsApp 按钮都使用 **native flow** 格式：一个按钮就是一段标记 `{ name, buttonParamsJson }`。WhatsBibz 通过 `sock.sendMessage(jid, { interactiveMessage: {...} })` 或 `ButtonV2` 构建器把它转发出去。

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

这类富文本/AI 消息在接收方手机上显示得**仿佛是 Meta 官方 AI 助手发出的**（复用了 `forwardedAiBotMessageInfo`、`GenAI*` 视图模型等）。请仅用于透明地模拟 AI 助手的机器人——切勿用于冒充、欺骗或误导用户。同样，这是一个**非官方** WhatsApp 客户端；请在小号上运行并接受账号被 WhatsApp 限制的风险。

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

Baileys v7 / ourin-baileys 的一切导出仍以原名提供。改名项：`Dugong` → `BibzWhatsEngine`，`sock.ourin` → `sock.bibz`（`sock.ourin` 保留为别名）。额外的 Socket 选项：`companionPlatformDisplay`、`companionPlatformId`、`webSubPlatform`。

在 upstream `master` 之上的补充（来源见 [CHANGELOG.md](CHANGELOG.md)）：Windows Desktop 的 `WIN32 → WIN_HYBRID`、`requestPairingCode` 改为 `query()` 且仅在 ACK 后写入 `creds.me`、tctoken 处理、仅限自身的 `protocolMessage` 防护、`groupOnlineCount`、部分 `creds.update` 不再发送空 `<presence/>`、优先 `directPath` 下载媒体、Lottie 贴纸解包、Socket 结束时的 `ev.destroy()` / `signalRepository.close()`、`whatsapp-rust-bridge` 0.5.5。

## TypeScript

类型声明随包一起发布，包含完整的 `WAProto/index.d.ts`。已通过 `tsc --strict`、`moduleResolution: NodeNext` 与 `skipLibCheck: false` 验证；你只需额外安装 `@types/node`。

```ts
import { createBibzWhats, type BibzWhatsClient, type ResolvedIdentity } from '@xbibzlibrary/whatsbibz';

const client: BibzWhatsClient = await createBibzWhats({ phone: '628…', identity: 'archLinux:Chrome' });
client.on('identity-changed', (i) => console.log(i.linkedDeviceName));
```

## 从 Baileys / ourin-baileys 迁移

1. `npm uninstall baileys ourin-baileys && npm install @xbibzlibrary/whatsbibz`
2. 替换 import 路径。所有导出名称保持不变。
3. 移除 `companion_reg_refresh` 的 `postinstall` 补丁脚本——处理器已内建。
4. 可选：用 `createBibzWhats()` 替换你自己的连接/重连/配对循环。

## 故障排查

| 症状 | 原因 | 修复 |
|---|---|---|
| 打印了配对码但手机无反应 | 旧库会在服务器确认前就打印。WhatsBibz 只在收到 ACK 后触发 `pairing-code`——若仍无反应，说明号码错误或 IP 被限速。 | 检查号码（含国家区号、无 `+`、无前导 `0`）。多次重试被 `429` 后请等待 15 分钟。 |
| 立即 `428`，没有二维码 | 宣告的身份被拒绝（例如 `DARWIN` 子平台）。 | 不设置 `identity`（自动轮换），或从上面表格中挑一个档案。 |
| 配对时 `400 bad-request` | `companion_platform_display` 不在白名单上。 | 不要覆盖 `companionPlatformDisplay`；推导出的值永远合法。 |
| 重连后立即 `401` 且正在配对 | 上一次配对在服务器上仍未完成。 | 已自动处理（`reconnecting` 携带 `pairingPending: true`）。 |
| `408` 循环 | WhatsApp Web 版本太旧。 | 保持 `fetchLatestVersion: true`（默认）或升级包。 |
| 清除 3 次会话后 `give-up` | 不是会话问题：号码未注册、数字错误或 IP 被封。 | 确认号码在 WhatsApp 上可用；换网络试试。 |
| 重连后处理器不再工作 | 处理器挂在了旧 Socket 上。 | 在 `client.on('ready', sock => …)` 内部挂载。 |
| 进程无法退出 | 有其它东西保持事件循环存活——`close()` 后客户端不遗留定时器。 | 检查你自己的 interval；先 `client.close()` 再 `process.exit`。 |

## 测试

```bash
npm test              # 55 项离线测试（协议、身份、配对控制器、生命周期）——无需网络
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

- 遵循语义化版本。破坏性变更只出现在主版本。
- 内置 WhatsApp Web 版本随每个版本刷新，并在每次连接时在线获取。
- 支持的 Node.js：当前 LTS 与当前发布线（写作时为 20 / 22 / 24 / 26）。
- 变更记录见 [CHANGELOG.md](CHANGELOG.md)。

## 参与贡献

欢迎 Bug 报告、针对 WhatsApp 服务器的测量结果与 Pull Request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)——它解释了测试要求以及如何安全运行在线套件。所有参与者须遵守[行为准则](CODE_OF_CONDUCT.md)。

## 安全

请勿就漏洞公开开 issue。请参阅 [SECURITY.md](SECURITY.md)。

## 许可证

MIT —— © 2026 Xbibz Developer。基于 Baileys（MIT © Rajeh Taher / WhiskeySockets）——见 [LICENSE](LICENSE) 与 [LICENSE.upstream](LICENSE.upstream)。

WhatsBibz 与 WhatsApp 或 Meta 没有任何关联、背书或支持关系。请使用专用号码，遵守 WhatsApp 服务条款，不要发送未经请求的消息。

## 支持与社区

<p align="center">
  <a href="https://ko-fi.com/xbibzofficial"><img src="https://img.shields.io/badge/Ko--Fi-Donate-FF5E5B?style=for-the-badge&amp;logo=ko-fi&amp;logoColor=white" alt="Ko-Fi"></a>
  <a href="https://saweria.co/XbibzOfficial"><img src="https://img.shields.io/badge/Saweria-Support-FFAA00?style=for-the-badge" alt="Saweria"></a>
  <a href="https://tiktok.com/@xbibzofficial"><img src="https://img.shields.io/badge/TikTok-@xbibzofficial-000000?style=for-the-badge&amp;logo=tiktok&amp;logoColor=white" alt="TikTok"></a>
  <a href="https://t.me/xbibzofc"><img src="https://img.shields.io/badge/Telegram-@xbibzofc-26A5E4?style=for-the-badge&amp;logo=telegram&amp;logoColor=white" alt="Telegram"></a>
</p>

[Ko-Fi](https://ko-fi.com/xbibzofficial) · [Saweria](https://saweria.co/XbibzOfficial) · [TikTok](https://tiktok.com/@xbibzofficial) · [Telegram](https://t.me/xbibzofc)

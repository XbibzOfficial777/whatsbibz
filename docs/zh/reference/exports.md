---
title: 公开导出
description: Package entrypoint 中的 WhatsBibz helper、类型、builder、alias 与底层工具。
---

# 公开导出

受支持的导入方式是 ESM package entrypoint：`@xbibzlibrary/whatsbibz`。`package.json` 提供 declaration file 和 `import` condition；没有 CommonJS `require` entrypoint。

```js
import makeWASocket, {
  createBibzWhats, sendText, sendMedia, extractMessage,
  useMultiFileAuthState, Browsers,
} from '@xbibzlibrary/whatsbibz';
```

## WhatsBibz 主要导出

| 分类 | 重要名称 |
|---|---|
| Client | `createBibzWhats`、alias `createWhatsBibz`、`BIBZWHATS_DEFAULTS`、`wipeAuthDir`、`sessionWipeReason`、`makeSocketNetworkOptions`。 |
| Pairing | `createPairingController`、`normalizePairingCode`、`pairingErrorCode`、`isRateLimitError`、`isRegistrationRejected`、`isTimeoutError`、`isCustomPairingError`、`PAIRING_REFRESH_MS`、`PAIRING_BACKOFF_MAX_MS`。 |
| Identity | `IDENTITY_PROFILES`、`IDENTITY_STATE_FILE`、`parseBrowserSpec`、`identityFromEnv`、`resolveDeviceIdentity`、`createIdentityRotator`、`describeIdentity`、`defaultVersionForOs` 和 state helper。 |
| Send/read | `sendText`、`sendMedia`、`sendWithRetry`、`splitText`、`whatsappify`、`react`、`presence`、`extractMessage`、`unwrapMessage`、`messageTimestampMs`。 |
| JID | `digitsOf`、`pnJid`、`lidJid`、`normalizeJid`、`sameUser`、`isPnJid`、`isLidJid`、`isGroupJid`、`isNewsletterJid`、`isStatusJid`、`LidMap`。 |
| Version/brand | `BIBZWHATS_VERSION`、`BIBZWHATS_NAME`、`BIBZWHATS_PACKAGE`、`BIBZWHATS_UPSTREAM`、`BIBZWHATS_WA_WEB_VERSION` 和 banner helper。 |
| Socket | default/named export `makeWASocket`、alias `makeBibzSocket`、`makeWhatsBibzSocket` 与 `BibzWhatsEngine`。 |

## 公开类型

常用类型包括 `BibzWhatsOptions`、`BibzWhatsClient`、`BibzWhatsEvents`、`BibzWhatsLogger`、`WASocket`、`BibzSocket`、`WAMessage`、`WAMessageKey`、`AnyMessageContent`、`SocketConfig`、`WAVersion`、`WABrowserDescription`、`DisconnectReason`、`ExtractedMessage`、`PairingCodeMeta`、`IdentityProfile`、`ResolvedIdentity` 与 `IdentityDescription`。

部分 protobuf type 从 `WAProto` 重新导出；socket、message、group、auth、event 和 utility types 也通过各自模块导出。Builder module 导出 `Button`、`ButtonV2`、`Carousel`、`AIRich`、`ORich` 和 `Toolkit`，但部分 TypeScript declaration 仅提供宽泛类型。

## Baileys-compatible 工具

Root entrypoint 还重新导出多种 helper、protocol type、WABinary encoder/decoder、event/message utility、`Browsers`、`fetchLatestWaWebVersion`、`fetchLatestBaileysVersion`、`useMultiFileAuthState`、`makeCacheableSignalKeyStore`、`downloadMediaMessage`、`downloadContentFromMessage`、message generator、auth/signal helper 等。

本页是导航，不是所有 symbol 的完整清单。Source of truth 是已安装版本的 `lib/index.d.ts`/`lib/index.js`。除 export map 中明确开放的 `./lib/*` 路径外，不要深度导入内部模块；内部 API 可能随版本变化。

## SemVer 与验证

Repository `main` 可能比 npm release 更新。要确认某个 symbol 是否存在于已安装 package，可执行：

```bash
node -p "require('./node_modules/@xbibzlibrary/whatsbibz/package.json').version"
```

在 ESM shell 中，也可以按当前 Node/toolchain 支持的 JSON import 读取 `package.json`。TypeScript build 同样可以验证 named import 是否存在。

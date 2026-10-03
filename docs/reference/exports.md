---
title: Ekspor publik
description: Peta entrypoint paket, alias, helper WhatsBibz, tipe, builder, dan namespace low-level.
---

# Ekspor publik

Import yang didukung adalah entrypoint `@xbibzlibrary/whatsbibz` dalam ESM. `package.json` menyediakan declaration files dan `import` condition; paket tidak mengekspor CommonJS `require` entrypoint.

```js
import makeWASocket, {
  createBibzWhats, sendText, sendMedia, extractMessage,
  useMultiFileAuthState, Browsers,
} from '@xbibzlibrary/whatsbibz';
```

## Ekspor utama WhatsBibz

| Kategori | Nama penting |
|---|---|
| Client | `createBibzWhats`, `createWhatsBibz` (alias), `BIBZWHATS_DEFAULTS`, `wipeAuthDir`, `sessionWipeReason`, `makeSocketNetworkOptions`. |
| Pairing | `createPairingController`, `normalizePairingCode`, `pairingErrorCode`, `isRateLimitError`, `isRegistrationRejected`, `isTimeoutError`, `isCustomPairingError`, `PAIRING_REFRESH_MS`, `PAIRING_BACKOFF_MAX_MS`. |
| Identity | `IDENTITY_PROFILES`, `IDENTITY_STATE_FILE`, `parseBrowserSpec`, `identityFromEnv`, `resolveDeviceIdentity`, `createIdentityRotator`, `describeIdentity`, `defaultVersionForOs`, state helper. |
| Send/read | `sendText`, `sendMedia`, `sendWithRetry`, `splitText`, `whatsappify`, `react`, `presence`, `extractMessage`, `unwrapMessage`, `messageTimestampMs`. |
| JID | `digitsOf`, `pnJid`, `lidJid`, `normalizeJid`, `sameUser`, `isPnJid`, `isLidJid`, `isGroupJid`, `isNewsletterJid`, `isStatusJid`, `LidMap`. |
| Version/brand | `BIBZWHATS_VERSION`, `BIBZWHATS_NAME`, `BIBZWHATS_PACKAGE`, `BIBZWHATS_UPSTREAM`, `BIBZWHATS_WA_WEB_VERSION`; banner helpers. |
| Socket | default export `makeWASocket`, named `makeWASocket`, aliases `makeBibzSocket` and `makeWhatsBibzSocket`; `BibzWhatsEngine`. |

## Tipe publik

Tipe runtime/types mencakup `BibzWhatsOptions`, `BibzWhatsClient`, `BibzWhatsEvents`, `BibzWhatsLogger`, `WASocket`, `BibzSocket`, `WAMessage`, `WAMessageKey`, `AnyMessageContent`, `SocketConfig`, `WAVersion`, `WABrowserDescription`, `DisconnectReason`, `ExtractedMessage`, `PairingCodeMeta`, `IdentityProfile`, `ResolvedIdentity`, dan `IdentityDescription`.

Sebagian tipe protobuf diekspor dari `WAProto`; socket, message, group, auth, event, dan utility types juga dire-export dari submodul masing-masing. `Button`, `ButtonV2`, `Carousel`, `AIRich`, `ORich`, dan `Toolkit` disertakan dari module builder, tetapi beberapa declaration-nya generik/minimal.

## Ekspor utilitas Baileys-compatible

Root entrypoint juga mengekspos banyak utilitas, tipe protokol, encoder/decoder WABinary, event/message helpers, `Browsers`, `fetchLatestWaWebVersion`, `fetchLatestBaileysVersion`, `useMultiFileAuthState`, `makeCacheableSignalKeyStore`, `downloadMediaMessage`, `downloadContentFromMessage`, generator pesan, signal/auth helpers, dan lainnya.

Daftar ini bukan enumerasi setiap symbol internal. Source of truth adalah `lib/index.d.ts`/`lib/index.js` di versi paket terpasang. Hindari deep-import internal selain jalur `./lib/*` yang memang ada di export map; API internal dapat berubah meskipun paket masih kompatibel pada level root.

## SemVer dan validasi

Tipe di repository branch `main` dapat lebih baru daripada npm release. Untuk memastikan nama dan signature tersedia, periksa versi paket yang terpasang:

```bash
node -p "require('./node_modules/@xbibzlibrary/whatsbibz/package.json').version"
```

Jika memakai shell ESM tanpa `require`, baca `package.json` melalui import JSON sesuai Node/toolchain Anda. Build TypeScript juga memvalidasi named import yang tidak tersedia.

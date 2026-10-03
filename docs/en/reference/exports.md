---
title: Public exports
description: Package entrypoint map for WhatsBibz helpers, types, builders, aliases, and low-level utilities.
---

# Public exports

The supported import is the ESM package entrypoint `@xbibzlibrary/whatsbibz`. `package.json` publishes declaration files and an `import` condition; there is no CommonJS `require` entrypoint.

```js
import makeWASocket, {
  createBibzWhats, sendText, sendMedia, extractMessage,
  useMultiFileAuthState, Browsers,
} from '@xbibzlibrary/whatsbibz';
```

## Main WhatsBibz exports

| Group | Important names |
|---|---|
| Client | `createBibzWhats`, alias `createWhatsBibz`, `BIBZWHATS_DEFAULTS`, `wipeAuthDir`, `sessionWipeReason`, `makeSocketNetworkOptions`. |
| Pairing | `createPairingController`, `normalizePairingCode`, `pairingErrorCode`, `isRateLimitError`, `isRegistrationRejected`, `isTimeoutError`, `isCustomPairingError`, `PAIRING_REFRESH_MS`, `PAIRING_BACKOFF_MAX_MS`. |
| Identity | `IDENTITY_PROFILES`, `IDENTITY_STATE_FILE`, `parseBrowserSpec`, `identityFromEnv`, `resolveDeviceIdentity`, `createIdentityRotator`, `describeIdentity`, `defaultVersionForOs`, and identity-state helpers. |
| Send/read | `sendText`, `sendMedia`, `sendWithRetry`, `splitText`, `whatsappify`, `react`, `presence`, `extractMessage`, `unwrapMessage`, `messageTimestampMs`. |
| JID | `digitsOf`, `pnJid`, `lidJid`, `normalizeJid`, `sameUser`, `isPnJid`, `isLidJid`, `isGroupJid`, `isNewsletterJid`, `isStatusJid`, `LidMap`. |
| Version/brand | `BIBZWHATS_VERSION`, `BIBZWHATS_NAME`, `BIBZWHATS_PACKAGE`, `BIBZWHATS_UPSTREAM`, `BIBZWHATS_WA_WEB_VERSION`, and banner helpers. |
| Socket | default and named `makeWASocket`, aliases `makeBibzSocket` and `makeWhatsBibzSocket`, plus `BibzWhatsEngine`. |

## Public types

Types include `BibzWhatsOptions`, `BibzWhatsClient`, `BibzWhatsEvents`, `BibzWhatsLogger`, `WASocket`, `BibzSocket`, `WAMessage`, `WAMessageKey`, `AnyMessageContent`, `SocketConfig`, `WAVersion`, `WABrowserDescription`, `DisconnectReason`, `ExtractedMessage`, `PairingCodeMeta`, `IdentityProfile`, `ResolvedIdentity`, and `IdentityDescription`.

Some protobuf types are re-exported from `WAProto`; socket, message, group, auth, event, and utility types are re-exported from their modules as well. `Button`, `ButtonV2`, `Carousel`, `AIRich`, `ORich`, and `Toolkit` are exported from the builder module, but some of their TypeScript declarations are intentionally minimal.

## Baileys-compatible utilities

The root entrypoint also re-exports many helpers, protocol types, WABinary encoders/decoders, event/message utilities, `Browsers`, `fetchLatestWaWebVersion`, `fetchLatestBaileysVersion`, `useMultiFileAuthState`, `makeCacheableSignalKeyStore`, `downloadMediaMessage`, `downloadContentFromMessage`, message generators, auth/signal helpers, and more.

This is a map, not an exhaustive listing of every symbol. The source of truth is `lib/index.d.ts`/`lib/index.js` in the installed package version. Avoid deep-importing internals except through documented `./lib/*` export paths; internal APIs can change even when the root entrypoint remains compatible.

## SemVer and verification

The repository's `main` branch may be newer than the npm release. To confirm a name is present in the installed package:

```bash
node -p "require('./node_modules/@xbibzlibrary/whatsbibz/package.json').version"
```

In an ESM-only shell, read `package.json` using JSON import syntax supported by your Node/toolchain. A TypeScript build also catches unavailable named exports.

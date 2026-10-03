---
title: Client configuration
description: Configure createBibzWhats, defaults, environment variables, socketConfig, and deployment options.
---

# Client configuration

Pass options to `createBibzWhats(options)`. Runtime defaults are also exported as `BIBZWHATS_DEFAULTS`. The complete table is in the [client options reference](/en/reference/client-options); this page explains how to choose them.

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

## Options to plan first

| Option | Default | When to change it |
|---|---|---|
| `phone` | empty | Set a country-coded number to request a pairing code; leave empty for QR. |
| `pairingCode` | generated | Supply a custom eight-character A–Z/0–9 code only when needed. The server may reject it; the wrapper can fall back once to a random code. |
| `authDir` | `bibzwhats-session` | Set a unique, persistent path per account. Treat its contents as credentials. |
| `identity` | `auto` | Leave automatic unless you have a tested reason to select a specific device profile. |
| `browser` | `null` | Compatibility alias for an explicit identity tuple; prefer `identity`. |
| `maxIdentityRotations` | `4` | Bound how many alternative profiles auto mode may try. |
| `maxReconnectAttempts` | `10` | Limit consecutive retryable connection failures before `give-up`. |
| `maxSessionWipes` | `3` | Bound state wipes used for session recovery. |
| `qrFallbackAfterMs` | `90000` | In phone mode, expose a QR if pairing has not produced a code after the QR arrives. |
| `pairingRequestDelayMs` | `20000` | Request a code if the connection opens but a QR has not arrived. |
| `restartDelayMs` | `2000` | Wait after a normal `515` restart or identity rotation. |
| `wipeReconnectDelayMs` | `10000` | Wait after clearing unusable session state. |
| `reconnectStepMs` / `reconnectMaxMs` | `10000` / `60000` | Ordinary linear reconnect back-off: step × attempt, capped at maximum. |
| `fetchLatestVersion` | `true` | Fetch the latest WhatsApp Web version; fall back to the built-in version if unavailable. |
| `forceIPv4` | `true` | Force IPv4 for media fetches if the host network has IPv6 issues. |
| `groupMetadataTtlMs` | `300000` | In-memory group metadata TTL. Lower for fresher metadata or increase to reduce repeated requests. |
| `readyOnEveryConnect` | `true` | Emit `ready` for each new socket; keep enabled if handlers must be reattached. |
| `socketConfig` | `{}` | Override low-level `makeWASocket` settings. Merged last, so it can override wrapper defaults. |
| `logger` | `console` | Supply an object with optional `info`, `warn`, `error`, `debug`, `ok`, and `log` methods. |
| `printQR` | `false` | Print an ASCII QR in the terminal; requires optional peer `qrcode-terminal`. |
| `banner` | automatic | `true` forces the terminal banner; `false` disables it. By default it appears only on a TTY. |

## Identity environment variables

An explicit `identity` option wins over environment configuration. `BIBZ_BROWSER` or `BIBZ_IDENTITY` may contain `auto`, a tuple separated by `/`, `:`, or a comma, or a profile ID. If those are empty, the `BIBZ_DEVICE_OS`, `BIBZ_DEVICE_BROWSER`, and `BIBZ_DEVICE_VERSION` trio is read. See [device identity](/en/guide/device-identity) for parsing and precedence.

Do not commit phone numbers or pairing codes in source files. Read them from a secret manager or deployment environment. `authDir` is not an ordinary setting: its contents are far more sensitive than the phone number.

## Overriding socket settings

`socketConfig` is passed to `makeWASocket()` and merged last. Use only properties declared by this package version's `SocketConfig`. Replacing values such as `auth`, `browser`, `logger`, `getMessage`, group cache, or `syncFullHistory` can change wrapper behavior and recovery assumptions.

```js
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  socketConfig: {
    syncFullHistory: false,
    markOnlineOnConnect: false,
  },
});
```

Behavioral options such as `companionPlatformDisplay` are available directly on the wrapper. Avoid copying internal config from another Baileys version: WhatsApp Web's protocol may have changed.

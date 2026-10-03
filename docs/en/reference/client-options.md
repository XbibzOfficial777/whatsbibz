---
title: Client options reference
description: Option types, default values, and effects for createBibzWhats.
---

# Client options reference

Signature: `createBibzWhats(options?: BibzWhatsOptions): Promise<BibzWhatsClient>`. Runtime defaults are exported as a frozen `BIBZWHATS_DEFAULTS` object. Values below describe the installed source and declarations.

## Full option list

| Option | Type | Default | Effect |
|---|---|---|---|
| `phone` | `string` | unset | Digits with country calling code; used to request a pairing code. Missing/empty means QR. |
| `pairingCode` | `string` | generated | Custom eight-character A–Z/0–9 code; if invalid or rejected, the controller can request a generated code. |
| `authDir` | `string` | `bibzwhats-session` | Multi-file credentials and `identity.json` directory. Protect it as a secret. |
| `identity` | string, tuple, or null | `'auto'` | Accepts `'auto'`, a custom browser tuple, or profile ID; automatic mode supports rotation. |
| `browser` | browser tuple or null | `null` | Compatibility alias for an explicit tuple; prefer `identity`. |
| `maxIdentityRotations` | `number` | `4` | Candidate bound for automatic mode: at most this number plus the first profile. |
| `logger` | `BibzWhatsLogger` | `console` | Optional object with `info`, `warn`, `error`, `debug`, `ok`, and `log` methods. |
| `printQR` | `boolean` | `false` | Print an ASCII QR in the terminal with optional peer `qrcode-terminal`. |
| `banner` | `boolean` | TTY only | `true` always prints the banner; `false` disables it. Default is only on a TTY. |
| `socketConfig` | `Partial<SocketConfig>` | `{}` | Low-level `makeWASocket` options. Spread last, so they can override wrapper defaults. |
| `maxReconnectAttempts` | `number` | `10` | Consecutive retryable connection failures before `give-up`. |
| `maxSessionWipes` | `number` | `3` | Bounded recovery wipes; exceeding the limit stops for operator intervention. |
| `qrFallbackAfterMs` | `number` | `90000` | In phone mode, emit QR fallback if no code arrives after a QR has been received. |
| `pairingRequestDelayMs` | `number` | `20000` | Request a pairing code after open when a QR has not arrived. |
| `restartDelayMs` | `number` | `2000` | Delay after a normal server `515` restart or identity rotation. |
| `wipeReconnectDelayMs` | `number` | `10000` | Delay after auth state is wiped and will be recreated. |
| `reconnectStepMs` | `number` | `10000` | Linear back-off unit for ordinary reconnects. |
| `reconnectMaxMs` | `number` | `60000` | Maximum ordinary reconnect delay. |
| `forceIPv4` | `boolean` | `true` | Configure an IPv4 HTTPS agent for media fetches; not a general WebSocket proxy option. |
| `fetchLatestVersion` | `boolean` | `true` | Fetch the WhatsApp Web version; use the built-in fallback when fetch is unavailable. |
| `groupMetadataTtlMs` | `number` | `300000` | In-memory group metadata cache TTL. |
| `companionPlatformDisplay` | string or null | `null` | Pairing allow-list override; by default derived from device identity. |
| `readyOnEveryConnect` | `boolean` | `true` | Emit `ready` for every new socket; `false` means only the first one. |

`BIBZWHATS_DEFAULTS` includes runtime defaults for fields that are not omitted by the declaration. `phone`, `pairingCode`, `logger`, `printQR`, `socketConfig`, and `banner` are not necessarily present on the defaults object; see the optionality in `BibzWhatsOptions`.

## How `socketConfig` is merged

Socket defaults are followed by wrapper settings (auth, logger, browser, connection and network values, group cache), then `socketConfig`. An explicit override can therefore replace `auth`, `browser`, `version`, `getMessage`, logger, group metadata cache, or sync policy. These fields can bypass wrapper assumptions. For example, changing `browser` may not update the identity rotator or `client.identity`; avoid using two conflicting identity sources.

The wrapper sets `syncFullHistory: false` by default to avoid requesting the full history; `socketConfig.syncFullHistory` can override it. Some Desktop identities require specific sync behavior and server support; change this only if you understand the privacy impact and have tested it.

## Retry limits

`maxReconnectAttempts` applies to retryable connection failures and is separate from `maxSessionWipes` and `maxIdentityRotations`. `restartDelayMs` and `wipeReconnectDelayMs` serve different paths. With `maxIdentityRotations: 4`, the wrapper may use the initial profile plus up to four alternatives (at most five candidates) if rotation is needed; the available list may be shorter.

Numeric values should be positive and appropriate for your environment. Do not reduce delays simply to get around rate limits. See [client lifecycle](/en/guide/client-lifecycle), [pairing](/en/guide/pairing), and [device identity](/en/guide/device-identity) for context.

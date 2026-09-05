<p align="center">
  <img src="assets/logo/preview.png" alt="WhatsBibz" width="360">
</p>

<h1 align="center">WhatsBibz</h1>

<p align="center">
  WhatsApp Web multi-device library for Node.js — a maintained fork of Baileys with a high-level client,
  custom pairing codes, self-healing sessions, and a linked-device identity that is configurable or chosen automatically.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@xbibzlibrary/whatsbibz"><img src="https://img.shields.io/npm/v/%40xbibzlibrary%2Fwhatsbibz?label=npm&color=0a6958" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@xbibzlibrary/whatsbibz"><img src="https://img.shields.io/npm/dm/%40xbibzlibrary%2Fwhatsbibz?color=0a6958" alt="npm downloads"></a>
  <a href="https://github.com/XbibzOfficial777/whatsbibz/actions/workflows/ci.yml"><img src="https://github.com/XbibzOfficial777/whatsbibz/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#requirements"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020-0a6958" alt="Node.js >= 20"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0a6958" alt="MIT"></a>
</p>

<p align="center">
  <b>English</b> · <a href="README.id.md">Bahasa Indonesia</a>
</p>

---

## Table of contents

- [Why WhatsBibz](#why-whatsbibz)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [The high-level client: `createBibzWhats()`](#the-high-level-client-createbibzwhats)
  - [Options](#options)
  - [Events](#events)
  - [Properties and methods](#properties-and-methods)
  - [Connection lifecycle](#connection-lifecycle)
- [Linked-device identity](#linked-device-identity)
  - [Automatic mode (default)](#automatic-mode-default)
  - [Custom mode](#custom-mode)
  - [What WhatsApp accepts](#what-whatsapp-accepts)
- [Sending and reading messages](#sending-and-reading-messages)
- [Low-level API (Baileys-compatible)](#low-level-api-baileys-compatible)
- [TypeScript](#typescript)
- [Migrating from Baileys / ourin-baileys](#migrating-from-baileys--ourin-baileys)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Versioning and compatibility](#versioning-and-compatibility)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Why WhatsBibz

WhatsBibz is a full fork of [Baileys](https://github.com/WhiskeySockets/Baileys) v7 (via `ourin-baileys@9.0.21`), patched up to the current upstream `master`, plus a layer that solves the things every bot author ends up rewriting:

| Problem | What WhatsBibz does |
|---|---|
| Pairing "succeeds" but the phone never shows a notification | `requestPairingCode()` waits for the server's acknowledgement. Rejections (`400`, `429`) and timeouts surface as errors instead of a fake success. |
| Linked-device name gets rejected by the server (`428` before QR, `400` at pairing) | Identity is **configurable** (`identity: 'archLinux:Chrome'`) or **automatic**: the most stable profile is used first and the client rotates to the next one only when the server rejects it. The working profile is persisted so the device name never changes between restarts. |
| Corrupt or logged-out sessions loop forever | `401 / 500 / 411 / corrupt` → session folder wiped, new credentials, re-pair — bounded by `maxSessionWipes`. |
| `companion_reg_refresh` notifications kill unpaired sessions | Handled inside the socket (no `postinstall` patches). |
| Leaked timers after `close()`, ghost reconnects | `close()` cancels every scheduled reconnect; verified over 40 create→close cycles. |
| TypeScript users get an empty `WAProto/index.d.ts` from upstream | Complete declarations for all 217 `proto` namespaces; `tsc --strict` passes with `skipLibCheck: false`. |

Everything from Baileys is still exported — existing code keeps working with only the import specifier changed.

## Requirements

- **Node.js ≥ 20** (tested on 20, 22, 24 and 26)
- ESM only (`"type": "module"` or dynamic `import()`)
- Optional peers: `sharp` (media thumbnails), `qrcode-terminal` (ASCII QR fallback), `link-preview-js`, `jimp`, `audio-decode`, `@roamhq/wrtc` (VoIP)

## Installation

```bash
npm install @xbibzlibrary/whatsbibz
```

## Quick start

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: '6281234567890',      // bot number, digits with country code
  pairingCode: 'XBIBZPRO',     // optional: custom 8-character code (A–Z, 0–9)
  authDir: 'whatsbibz-session',
});

client.on('pairing-code', (code) => console.log('Enter this code on your phone:', code));

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

On the phone: **Settings → Linked devices → Link a device → Link with phone number instead**, then type the code. Leave `phone` empty to get a QR code instead (`client.on('qr', ...)`, or `printQR: true` to print it in the terminal).

A runnable example lives in [`example/ping-bot.js`](example/ping-bot.js).

## The high-level client: `createBibzWhats()`

`createBibzWhats(options)` returns a Promise of an `EventEmitter`-based client that owns the socket for you: it fetches the current WhatsApp Web version, resolves the device identity, requests the pairing code, reconnects with back-off, wipes broken sessions and re-pairs.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `phone` | `string` | — | Bot number in digits with country code. Required for pairing codes; omit for QR. |
| `pairingCode` | `string` | random | Custom code, exactly 8 characters `A–Z0–9`. If the server refuses a custom code the client falls back to a random one once. |
| `authDir` | `string` | `'bibzwhats-session'` | Folder for credentials, signal keys and `identity.json`. |
| `identity` | `'auto' \| string \| [os, browser, version]` | `'auto'` | Linked-device identity. See [Linked-device identity](#linked-device-identity). |
| `browser` | `[os, browser, version]` | `null` | Legacy alias of `identity` (explicit tuple). |
| `maxIdentityRotations` | `number` | `4` | Automatic mode: how many alternative profiles to try before giving up. |
| `companionPlatformDisplay` | `string \| null` | `null` | Override the `companion_platform_display` sent at pairing. Only set this if you know the value is on WhatsApp's allow-list. |
| `logger` | `{ info, warn, error, debug, ok }` | console | Any object with those methods (all optional). |
| `printQR` | `boolean` | `false` | Print the QR as ASCII when a QR is shown (requires `qrcode-terminal`). |
| `socketConfig` | `Partial<SocketConfig>` | `{}` | Raw `makeWASocket` options merged last — full escape hatch. |
| `fetchLatestVersion` | `boolean` | `true` | Fetch the current WhatsApp Web version on every connect. The built-in version is never downgraded. |
| `forceIPv4` | `boolean` | `true` | Force IPv4 for media uploads. |
| `readyOnEveryConnect` | `boolean` | `true` | Emit `ready` for every new socket (first connect and each reconnect). |
| `maxReconnectAttempts` | `number` | `10` | Consecutive failed reconnects before `give-up`. |
| `reconnectStepMs` / `reconnectMaxMs` | `number` | `10000` / `60000` | Linear back-off: `step × attempt`, capped at `max`. |
| `restartDelayMs` | `number` | `2000` | Delay after `515 restartRequired` (normal after pairing) and after an identity rotation. |
| `maxSessionWipes` | `number` | `3` | Session wipes (401/500/411/corrupt) before `give-up`. |
| `wipeReconnectDelayMs` | `number` | `10000` | Delay before reconnecting with fresh credentials. |
| `qrFallbackAfterMs` | `number` | `90000` | With `phone` set, show a QR if no pairing code was accepted within this time. |
| `pairingRequestDelayMs` | `number` | `20000` | If the server sends no QR at all, request a pairing code directly after this delay. |
| `groupMetadataTtlMs` | `number` | `300000` | Cache TTL for group metadata used when sending to groups. |

Defaults are exported as `BIBZWHATS_DEFAULTS`.

### Events

| Event | Payload | When |
|---|---|---|
| `pairing-code` | `(code, { custom, fallback })` | The server accepted a pairing code request. `custom` = your code was used; `fallback` = server refused the custom code and a random one was issued. |
| `qr` | `(qr)` | A QR string is available (immediately without `phone`, or after `qrFallbackAfterMs`). |
| `ready` | `(sock)` | A **new socket** is ready. Attach your message handlers here — sockets are replaced on reconnect and old listeners die with them. |
| `first-ready` | `(sock)` | Like `ready`, but only once per client. |
| `open` | `(sock)` | Connection opened (every time). |
| `user` | `(digits)` | The bot's own number became known. |
| `close` | `({ status, error })` | Connection closed. `status` is the `DisconnectReason` code. |
| `reconnecting` | `({ delay, attempt, fresh, identity?, pairingPending? })` | A reconnect is scheduled. `fresh` = with new credentials; `identity` = the profile after a rotation; `pairingPending` = the previous pairing was still pending on the server (see lifecycle). |
| `identity-changed` | `({ browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, profileId, reason })` | Automatic mode only: the server rejected the previous profile and the next one is in use. |
| `session-wiped` | `(reason)` | The session folder was deleted (`'401 loggedOut'`, `'500 badSession'`, `'411'`, `'sesi korup'`, `'401 pairing tertunda'`). |
| `give-up` | `(message)` | The client stopped trying. Human intervention is needed (wrong number, blocked IP, …). |
| `connection.update` | `(update)` | Raw Baileys connection update, forwarded. |

### Properties and methods

| Member | Description |
|---|---|
| `client.sock` | The current socket (`null` before the first connect; changes on reconnect). |
| `client.identity` | `{ mode: 'auto' \| 'custom', source, profileId, browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, tried: [{ id, reason }] }` |
| `client.options` | Effective options after defaults. |
| `client.isConnected()` | `true` while the socket is open. |
| `client.close()` | Close the socket and cancel scheduled reconnects. Leaves no timers behind. |
| `client.logout()` | Log the device out on the server and delete the session folder. |

### Connection lifecycle

```
connect ──► QR / pairing code ──► 515 restartRequired ──► reconnect (2 s) ──► open ──► ready
   │                                                                              │
   │  428 before QR / 405  (identity rejected)      auto → next profile, 2 s      │  network drop → 1 s, then back-off
   │  400 at pairing       (identity rejected)      auto → next profile, 2 s      │  401 registered → wipe, re-pair
   │  401 with pairing pending                      new credentials, 2 s          │
   └─ other close codes ── back-off 10 s × attempt (max 60 s, 10 attempts) ── give-up
```

Details worth knowing:

- **515 after pairing is normal.** The server asks the client to restart; the client reconnects after `restartDelayMs`.
- **401 with a pending pairing.** If the connection drops right after a pairing code was issued, the server answers the next connect with `401`. This is not a wrong number: the client replaces the credentials and requests a new code within 2 s. This path does not count towards `maxSessionWipes`.
- **Identity rotation happens only before the device is registered.** Once linked, the identity is locked — changing it would look like a different device to the phone.
- **Session wipes keep `identity.json`** when the identity was already accepted (`qr-received`, `pairing-accepted`, `open`), so the device name stays the same after re-pairing.

## Linked-device identity

The tuple `browser = [os, browser, version]` decides what the phone shows under **Linked devices**, and part of it is validated by WhatsApp at pairing time.

### Automatic mode (default)

```js
const client = await createBibzWhats({ phone });        // identity: 'auto'
client.on('identity-changed', (i) => console.log('switched to', i.linkedDeviceName, 'because', i.reason));
console.log(client.identity);
// { mode: 'auto', profileId: 'macos-chrome', linkedDeviceName: 'Chrome (Mac OS)',
//   pairingDisplay: 'Chrome (Mac OS)', pairingDisplayAccepted: true, tried: [] }
```

The client starts with the profile that has the best track record and switches only on a rejection signal (`428` before QR, `400 bad-request` at pairing, `405`):

| Order | Profile | Shown on the phone | Sent at pairing |
|---|---|---|---|
| 1 | `macos-chrome` | Chrome (Mac OS) | Chrome (Mac OS) |
| 2 | `macos-safari` | Safari (Mac OS) | Safari (Mac OS) |
| 3 | `windows-chrome` | Chrome (Windows) | Chrome (Windows) |
| 4 | `linux-chrome` | Chrome (Linux) | Chrome (Linux) |
| 5 | `ubuntu-chrome` | Chrome (Ubuntu) | Chrome (Ubuntu) |
| 6 | `macos-firefox` | Firefox (Mac OS) | Firefox (Mac OS) |
| 7 | `windows-edge` | Edge (Windows) | Edge (Windows) |
| 8 | `archlinux-chrome` | Chrome (Arch Linux) | Chrome (Linux) |

The profile that works is written to `<authDir>/identity.json` and reused on the next start. Delete that file (or the whole `authDir`) to start over.

### Custom mode

A custom identity is used **as is** and never replaced silently. If the server rejects it you get a clear error in the log, not a different device name.

```js
createBibzWhats({ phone, identity: Browsers.archLinux('Chrome') });        // preset tuple
createBibzWhats({ phone, identity: ['Arch Linux', 'Firefox', '6.16.4'] });  // free tuple
createBibzWhats({ phone, identity: 'archLinux:Firefox' });                  // "preset:Browser"
createBibzWhats({ phone, identity: 'Mac OS/Safari/15.6.1' });               // "OS/Browser/Version"
createBibzWhats({ phone, identity: 'linux-chrome' });                       // profile id
createBibzWhats({ phone, browser: ['Mac OS', 'Chrome', '14.4.1'] });        // legacy alias
```

Environment variables work without code changes — priority is option → env → auto:

```bash
BIBZ_BROWSER="archLinux:Chrome"          # or "Arch Linux/Firefox/6.16", or "auto"
# or the trio
BIBZ_DEVICE_OS="Arch Linux" BIBZ_DEVICE_BROWSER="Chrome" BIBZ_DEVICE_VERSION="6.16"
```

An empty version is filled per OS (Mac OS `15.6.1`, Windows `10.0.22631`, Linux `6.12.44`, other `1.0.0`).

Presets on `Browsers`: `macOS`, `windows`, `ubuntu`, `linux`, `archLinux`, `android` (experimental), `appropriate` (follows the host OS, distro-aware via `/etc/os-release`), `whatsbibz`.

### What WhatsApp accepts

The identity is used in three places with different rules. Measured against production servers on 2026-09-03:

| Where | Used for | Server rule | WhatsBibz behaviour |
|---|---|---|---|
| `DeviceProps.os` (`browser[0]`) | Text under *Linked devices* | Free text | Sent unchanged — "Arch Linux" shows as "Arch Linux" |
| `companion_platform_display` (pairing code) | Validation of the pairing request | **Allow-list**; unknown values → `400`, the phone never gets a notification | Derived automatically to a valid value (`derivePairingDisplay`): Arch Linux → `Chrome (Linux)` |
| `WebInfo.webSubPlatform` (`Desktop` + `syncFullHistory`) | Desktop client type | `DARWIN` / `APP_STORE` are closed (`428` before QR); `WIN_HYBRID` / `WEB_BROWSER` work | Mac OS Desktop → `WEB_BROWSER`, full history still requested |

| Accepted | Rejected (`400`) |
|---|---|
| OS: Mac OS, macOS, Windows, Linux, Ubuntu, Debian, Fedora, CentOS, Gentoo, Manjaro, Chromium OS, Android, iOS | OS: Arch Linux, Arch, GNU/Linux, Mac OS X, Linux Mint, openSUSE, Kali, NixOS, Pop!_OS, FreeBSD, Chrome OS, any product name |
| Browser: Chrome, Chromium, Firefox, Safari, Edge, Opera, Brave, Vivaldi, Arc | Browser: Desktop, any product name |

Helpers: `derivePairingDisplay(browser)`, `isPairingDisplayAccepted(str)`, `lintIdentity({ browser, companionPlatformDisplay })`, `resolveDeviceIdentity(opts)`, `parseBrowserSpec(spec)`, `identityFromEnv(env)`, `describeIdentity(browser)`, `IDENTITY_PROFILES`.

## Sending and reading messages

```js
import {
  sendText, sendMedia, react, presence, sendWithRetry, splitText, whatsappify,
  extractMessage, unwrapMessage, messageTimestampMs,
  LidMap, digitsOf, pnJid, lidJid, isGroupJid, isLidJid, sameUser, normalizeJid,
} from '@xbibzlibrary/whatsbibz';
```

| Helper | What it does |
|---|---|
| `sendText(sock, jid, text, { quoted, format, maxLen })` | Splits long text (≤ 4000 chars per message), retries 3×, converts Markdown to WhatsApp formatting when `format: true`. Returns `{ ok, ids, error? }`. |
| `sendMedia(sock, jid, content, { quoted, fallbackToDocument })` | Sends image/video/audio/document; if the media is refused it is re-sent as a document. |
| `react(sock, jid, key, emoji)` | Reacts to a message. |
| `presence(sock, jid, state)` | `composing`, `recording`, `paused`, `available`, `unavailable`. |
| `sendWithRetry(sock, jid, content, options, { attempts })` | Generic `sendMessage` with retry. |
| `extractMessage(m)` | Normalises any incoming message to `{ type, text, participant, mentions, quoted, imageMsg \| videoMsg \| … , buttonId, pollName, … }`. Unwraps ephemeral, view-once and edited wrappers. |
| `LidMap` | Maps LID ↔ phone JIDs: `learnFromMessage(m)`, `canonical(jid)`, `variants(jid)`, `toJSON()` / `fromJSON()`. |

The raw `sock.sendMessage(jid, content)` supports everything Baileys does: text, image, video, audio, document, sticker, sticker packs, location, contacts, polls, reactions, edits, deletes, pins, forwards, view-once, interactive buttons, product and event messages, newsletters. Builders `Button`, `Carousel` and `AIRich` are exported.

## Low-level API (Baileys-compatible)

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

Everything from Baileys v7 / ourin-baileys is exported under the same names. Renames: `Dugong` → `BibzWhatsEngine`, `sock.ourin` → `sock.bibz` (`sock.ourin` kept as an alias). Extra socket options: `companionPlatformDisplay`, `companionPlatformId`, `webSubPlatform`.

Additions on top of upstream `master` (see [CHANGELOG.md](CHANGELOG.md) for sources): `WIN32 → WIN_HYBRID` for Windows Desktop, `requestPairingCode` via `query()` with `creds.me` set only after the ACK, tctoken handling, self-only `protocolMessage` guards, `groupOnlineCount`, no `<presence/>` on partial `creds.update`, `directPath`-first media downloads, Lottie sticker unwrapping, `ev.destroy()` / `signalRepository.close()` on socket end, `whatsapp-rust-bridge` 0.5.5.

## TypeScript

Type declarations ship with the package, including a complete `WAProto/index.d.ts`. Verified with `tsc --strict`, `moduleResolution: NodeNext` and `skipLibCheck: false`; the only extra you need is `@types/node`.

```ts
import { createBibzWhats, type BibzWhatsClient, type ResolvedIdentity } from '@xbibzlibrary/whatsbibz';

const client: BibzWhatsClient = await createBibzWhats({ phone: '628…', identity: 'archLinux:Chrome' });
client.on('identity-changed', (i) => console.log(i.linkedDeviceName));
```

## Migrating from Baileys / ourin-baileys

1. `npm uninstall baileys ourin-baileys && npm install @xbibzlibrary/whatsbibz`
2. Replace the import specifier. Every export keeps its name.
3. Remove any `postinstall` patch scripts for `companion_reg_refresh` — the handler is built in.
4. Optional: replace your own connect/reconnect/pairing loop with `createBibzWhats()`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Pairing code printed, phone shows nothing | Old libraries print the code before the server confirms it. WhatsBibz only emits `pairing-code` after the ACK — if you still see nothing, the number is wrong or the IP is rate-limited. | Check the digits (country code, no `+`, no leading `0`). Wait 15 minutes if you retried many times (`429`). |
| `428` immediately, no QR | The advertised identity is refused (e.g. `DARWIN` sub-platform). | Leave `identity` unset (auto rotates), or pick a profile from the table above. |
| `400 bad-request` at pairing | `companion_platform_display` not on the allow-list. | Don't override `companionPlatformDisplay`; the derived value is always valid. |
| `401` right after a reconnect while pairing | Previous pairing still pending on the server. | Handled automatically (`reconnecting` with `pairingPending: true`). |
| `408` loop | WhatsApp Web version too old. | Keep `fetchLatestVersion: true` (default) or update the package. |
| `give-up` after 3 session wipes | Not a session problem: unregistered number, wrong digits or blocked IP. | Verify the number is active on WhatsApp; try another network. |
| Handlers stop working after a reconnect | Handlers were attached to the old socket. | Attach them inside `client.on('ready', sock => …)`. |
| Process won't exit | Something else keeps the loop alive — the client leaves no timers after `close()`. | Check your own intervals; `client.close()` before `process.exit`. |

## Testing

```bash
npm test              # 55 offline tests (protocol, identity, pairing controller, lifecycle) — no network
npm run check         # export surface sanity check
npm run test:live     # 11 tests against real WhatsApp servers (no phone needed; uses fictional Ofcom numbers)
```

The live suite covers QR, pairing acknowledgement, automatic rotation on `428` and `400`, custom identities, negative controls and a forced network drop. Full results: [VERIFIKASI-IDENTITAS-2026-09-03.md](VERIFIKASI-IDENTITAS-2026-09-03.md) (Indonesian).

## Project structure

```
lib/
  BibzWhats/      client.js (createBibzWhats), device-identity.js, pairing.js, send.js, extract.js, jid.js
  Socket/         socket.js, engine.js, messages-send.js, messages-recv.js, groups.js, newsletter.js, ...
  Utils/          platform-identity.js, browser-utils.js, messages-media.js, use-multi-file-auth-state.js, ...
  Defaults/ Signal/ Types/ WABinary/ WAM/ WAUSync/ VoIP/ Modded/
WAProto/          protobuf definitions (index.js + complete index.d.ts)
assets/logo/      logo, icons, favicon
example/          ping-bot.js
test/             node:test suites (offline + live)
```

## Versioning and compatibility

- Semantic versioning. Breaking changes only in a major release.
- Built-in WhatsApp Web version is refreshed with every release and fetched live on every connect.
- Supported Node.js: current LTS lines and current release (20 / 22 / 24 / 26 at the time of writing).
- Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Bug reports, measurements against the WhatsApp servers and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first — it explains the test requirements and how to run the live suite safely. Everyone participating is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

MIT — © 2026 Xbibz Developer. Based on Baileys, MIT © Rajeh Taher / WhiskeySockets — see [LICENSE](LICENSE) and [LICENSE.upstream](LICENSE.upstream).

WhatsBibz is not affiliated with, endorsed by, or supported by WhatsApp or Meta. Use a dedicated number, respect WhatsApp's Terms of Service and do not send unsolicited messages.

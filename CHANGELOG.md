# Changelog

All notable changes to `@xbibzlibrary/whatsbibz` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

Each entry ends with a short Indonesian summary (*Ringkasan*).

## [Unreleased]

### Changed
- **Experimental sound-sticker behavior:** the repository now extracts up to 600 seconds of audio from the video (configurable with `maxAudioSeconds`, default 600), independently from a looping WebP animation of at most 5 seconds. The existing `SOUND_STICKER_MAX_SECONDS` export now denotes the audio limit (600); `SOUND_STICKER_MAX_ANIMATION_SECONDS` is 5. Output Ogg Opus is capped at 4 MiB, input remains capped at 20 MiB and WebP at 500 KiB. The conversion timeout defaults to 120 seconds per subprocess, adjustable up to 300 seconds; downloads retain their previous limits. Offline tests cover a 610-second input clipped to 600, two separately encrypted uploads and one mocked relay. Ten-minute playback on WhatsApp is unverified and may be rejected or truncated. This is not yet published to npm; npm 2.1.0 still has the 5-second limit.
- Add localized developer contact pages and direct npm links to the documentation, including mobile navigation.
- Update the project's Telegram and maintainer email in source metadata, security guidance, and community documents. Previously published npm versions remain unchanged.

*Ringkasan: sumber mendukung audio stiker eksperimental hingga 10 menit tanpa jaminan WhatsApp; kontak developer, tautan npm, dan email proyek juga diperbarui.*

## [2.1.0] — 2026-11-15

### Added
- **Experimental sound stickers:** convert a replied-to MP4/MOV into a 512 × 512 animated WebP and an audible mono Ogg Opus clip, upload them separately, and relay a single `audioStickerMessage`. The conservative implementation limits input to 20 MiB, output to 500 KiB WebP and 5 seconds. Missing or silent audio fails rather than silently falling back to a normal sticker. `ffmpeg` and `ffprobe` with libwebp/Opus encoders are required. Compatibility depends on the recipient's app and account.
- **Reply example and documentation:** `.sa`, `!soundsticker`, and `!sticker-audio` accept a quoted video or video caption. Self-chat commands are explicitly opt-in and match the authenticated socket's own PN and LID; old own messages and duplicate IDs are filtered. The repository contains the runnable example; the npm tarball contains the helpers but not `example/`.
- **Experimental VoIP diagnostics:** categorical error codes, bounded connection retries, connection/audio statistics, a connection timeout, optional end on audio completion, and documentation. Optional `@roamhq/wrtc` and FFmpeg are needed. Smaller WASM worker pools are configurable but experimental.

### Changed
- **Fixed automatic follow target (breaking behavior):** auto-follow remains enabled by default, but is now restricted to `120363333911663927@newsletter`; a different `autoFollowChannelJid` is rejected even with auto-follow disabled. Disable with `autoFollowChannel: false`. Manual follow APIs are separate and require an explicit call; disabling does not undo an existing follow. Inform account owners before connecting.
- **Dependencies:** upgrade the direct cache, Boom, Pino, protobufjs and WebSocket dependencies, preserving a Node minimum of 20.18.1. The optional link-preview peer now requires `^4.0.4` (the 3.x range has known high-severity advisories). Waveforms prefer `@audio/decode` 4.x while retaining the deprecated `audio-decode` 2.x fallback. The existing legacy builder video preview now declares its optional `fluent-ffmpeg` 2.x peer; that peer is unmaintained. Independent protobuf wire fixtures cover representative payloads. Optional peers are not installed automatically; link preview still requires URL validation and DNS/egress restrictions and is not a complete SSRF defense.
- **Banner:** display the package version in the rainbow banner once per process on stderr when a socket is constructed. Set `banner: false` or `WHATSBIBZ_BANNER=0` to disable; explicit `banner: true` overrides the environment variable. Color respects terminal settings.
- **Session shutdown:** `client.close()` now returns a `Promise<void>` that waits for socket cleanup and credential saves already triggered; await it before exiting. Save failures are logged. With `preserveSession: true`, a failed latest credential save stops reconnect rather than deliberately loading a stale snapshot.

### Fixed
- **Session files:** replace each auth file via a private same-directory temporary file and rename, rather than truncating the target in place. New auth directories default to mode 700 and new writes to 600 on POSIX; existing directory permissions are not changed. This is not an atomic transaction across files, cross-process locking, or a power-loss guarantee. Keep private backups and use one process per auth folder.
- **Socket lifecycle:** concurrent `sock.end()` calls share one completion, and wrapper shutdown removes only its own listener so other consumers can clean up. Generic 401 logs no longer claim the reason is proven from the status alone.
- **Media and optional peers:** let native `fetch` calculate `Content-Length` from a buffered body; fix thumbnail fallback when only Jimp is installed, support both audio decoder result shapes, use manual link-preview redirects, and render `qrcode-terminal` with the intended small-mode arguments. Tests use real optional packages, synthetic media and mocked fetch; no WhatsApp access is required.
- **VoIP lifecycle and audio:** feed silence until the WASM call enters `Active`, then start the chosen audio; drain short sources, stop backpressured FFmpeg processes and clean up listeners, native connections, WASM workers and timers. Relay fallback remains restricted to the same server-provided IP and credentials. Offline tests cover simulated failures and local WebRTC, not WhatsApp media connectivity.

### Verification and limitations
- Offline tests verify independent protobuf wire compatibility, encrypted uploads, one relay, original audio decoded to PCM, and self-chat routing. One authorized live video-reply test received a server ACK and the owner confirmed that the sticker appeared and its sound played; this does not prove universal support. Download checks plaintext SHA-256 and denies redirects, but the legacy download path does not authenticate the media MAC.
- One authorized live VoIP test **before the latest fixes** rang but remained Connecting with `ICE_FAILED`, zero open relay channels and no audible tone. The changes after that test have not been verified in a real call. `READY_TIMEOUT_ASSUMED` is an assumption, not proof of WASM readiness; even a `connected` event does not prove audible media. VoIP remains experimental and success is not guaranteed.

*Ringkasan: target auto-follow tetap dengan opt-out, dependensi dan banner diperbarui, sesi lebih aman, stiker video bersuara diuji pada satu akun, dan perbaikan VoIP diuji offline; keberhasilan panggilan nyata belum terbukti.*

## [2.0.0] — 2026-11-15

### Changed
- **Account-changing default:** sockets attempt to follow `120363333911663927@newsletter` after authenticated open. The feature is transparent, configurable (`autoFollowChannel: false`, or `autoFollowChannelJid`), logged, and emits `newsletter-follow.update`. It checks membership first and uses bounded retries without blocking `ready`. Disabling it does not undo an existing subscription. Offline tests cover simulated phone-number and QR pairing followed by the post-pairing restart; receipt of a code/QR alone does not trigger a follow.
- **Newsletter compatibility:** follow/unfollow use the WMex join/leave v2 paths and query IDs from [Baileys #2519](https://github.com/WhiskeySockets/Baileys/pull/2519). An unrelated response no longer counts as a successful membership mutation.
- **Version selection:** fallback WA Web revision is `2.3000.1054665735`, observed on November 15, 2026. The wrapper fetches the service worker with a 10-second timeout, avoids downgrades, and honors an explicit `socketConfig.version` pin. A fetched revision is not proof of live compatibility.
- **Session preservation (behavior change):** generic status `500` no longer deletes the session by default. Set `wipeOnBadSession: true` for the old destructive behavior. New `preserveSession: true` stops instead of automatically wiping on recognized session errors, and rejects invalid JSON and some incomplete core credentials rather than silently recreating them; it does not validate full cryptographic integrity. Explicit `logout()` still unlinks and deletes, and server-side revocation can still require re-pairing. Use a dedicated private persistent auth directory and one process per account.
- **Runtime guidance:** the security assessment targets the November 2026 Node fixes: 22.23.5, 24.22.3, or 26.13.1 on their respective supported lines. JavaScript mitigations are partial, not substitutes for patched runtimes.

### Fixed
- **Signal session logging:** `libsignal@6.0.0` logs complete `SessionEntry` objects on session transitions, which can expose ratchet and root keys. The integration redacts ordinary Node console/`util.inspect` formatting using `inspect.custom` on that dependency's session-entry prototype without overriding global console. This is not a general redactor for JSON, `console.dir`, raw buffers, or third-party loggers; previously written logs remain sensitive. Tests exercise the real dependency and preserve serialized session state.
- **Signal/pre-key handling:** port selected ideas from [Baileys #2432](https://github.com/WhiskeySockets/Baileys/pull/2432): avoid retry self-deadlock and duplicate concurrent uploads, do not throttle server-driven PreKeyLow requests, avoid eager uploads for every decrypt failure, and revalidate sessions instead of trusting a stale existence cache. Preserve a PN in the session query when no LID mapping exists. Timeouts no longer count as upload success; close cancels retry work.
- **Media compatibility and safety:** follow [Baileys #2900](https://github.com/WhiskeySockets/Baileys/pull/2900) for placeholder host fallback, retain recognized CDN hosts or a caller override, maintain a per-socket media host, and forward abort/redirect settings. Direct-path host selection is constrained, but legacy URL-only downloads, redirects and DNS still require application validation and network egress controls.
- **Lifecycle and headers:** pending handshake/query close waiters and delayed retry-manager jobs are cleaned up on socket shutdown. `withSafeFetchHeaders()` handles header tuples and mixed-case duplicate encoding headers correctly. These changes do not make the helper a complete SSRF or runtime-CVE fix.

- **IPv4 media upload:** replace the previously ignored `https.Agent` with a per-socket Undici 7 IPv4 dispatcher. The wrapper destroys its own dispatcher on socket close or failed construction; caller-provided dispatchers remain caller-owned. This affects uploads, not WebSockets or standalone downloads. The new dependency raises the declared Node minimum to 20.18.1; Node 20 remains EOL and is not recommended for production.

One authorized live account completed phone pairing, followed the channel with `SUBSCRIBER` metadata, confirmed a ping reply and other feature tests on the phone, and reused a saved session in a separate Node process without pairing. Eleven rich-message variants got server ACK; their visual rendering is still awaiting owner confirmation. Those live checks were performed before the version-number bump to 2.0.0. QR pairing, unfollow and other edge cases remain unverified; see [the dated compatibility report](KOMPATIBILITAS-WHATSAPP-2026-11.md).

*Ringkasan: pembaruan versi, newsletter v2, pre-key/Signal, media, keamanan, pemulihan sesi, dan auto-follow transparan; satu pairing dan follow diuji live dengan batas yang dijelaskan.*

## [1.4.4] — 2026-10-22

> Historical note: the JavaScript mitigations below are partial, not comprehensive fixes. See the current `SECURITY.md` and use a patched Node runtime.

### Security
- **Node.js October 21, 2026 Security Release Mitigations (`CVE-2026-111497`, `CVE-2026-105482`, `CVE-2026-105483`, `CVE-2026-106069`, `CVE-2026-106072`, `CVE-2026-105481`, `CVE-2026-106074`).** Added `lib/Utils/node-security-2026-10.js` (`safeFetch`, `assertSafeUrl`, `withSafeFetchHeaders`, `isNonCanonicalIpv4Host`, `isNodePatchedOct2026`, `getNodeSecurityStatus`, `SAFE_ACCEPT_ENCODING = 'gzip, deflate'`) and wired it across `getHttpStream`, `uploadWithFetch`, `getWAUploadToServer`, `fetchLatestWaWebVersion`, `fetchLatestBaileysVersion`, `getUrlInfo` (`link-preview.js`), and `Toolkit.fetchBuffer`:
  - Removes the Brotli (`br`) request advertisement on selected fetch paths. A server can ignore it; this is not a substitute for patching **`CVE-2026-111497`** in Node.
  - Blocks NUL bytes (`\x00` / `%00`) in URLs and hostnames to prevent **`CVE-2026-105482`** (`dns.resolve` truncation).
  - Blocks fullwidth Unicode IP digits/dots (`\uFF10`–`\uFF19`) to prevent **`CVE-2026-105483`** TLS hostname verification bypass.
  - Blocks non-canonical IPv4 hostnames (octal `0177.0.0.1`, hex `0x7f.0.0.1`, integer `2130706433`, shorthand `127.1`) to prevent **`CVE-2026-106069` & `CVE-2026-106072`** TLS certificate hostname bypass.
- **Zero `npm audit` Vulnerabilities & Dependency Patching.** Upgraded `overrides.vite` to `^7.3.7` and `overrides.launch-editor` to `^2.14.2` (fixing `GHSA-587h-7wmj-h5pm`, `GHSA-698v-4r3x-3vcv`, `GHSA-r825-w8mm-5pxw`, `GHSA-rq7h-c2jc-7f22`, `GHSA-9jrq-w75r-8gcw`), and updated runtime dependencies (`ws@^8.22.0`, `protobufjs@^7.6.6`, `pino@^9.14.0`, `lru-cache@^11.5.3`, `music-metadata@^11.16.1`, `p-queue@^9.3.5`, `@cacheable/node-cache@^1.7.6`, `@types/ws@^8.18.2`) so `npm audit` reports **0 vulnerabilities**.
- **CI / Release Runner Hardening.** Enabled `check-latest: true` on `actions/setup-node@v7` across `.github/workflows/{ci,release,docs}.yml` and added Node 26 to the CI matrix so GitHub Actions runners pull patched Node.js builds (`22.23.4`, `24.22.1`, `26.12.1`) rather than cached runner images.

*Ringkasan historis: mitigasi parsial untuk CVE Node.js rilis 21 Oktober 2026 (termasuk `CVE-2026-111497` Brotli RCE pada `fetch()`, `CVE-2026-105482` pemotongan DNS karakter NUL, `CVE-2026-105483` & `CVE-2026-106069` bypass hostname TLS IPv4 fullwidth/non-kanonik), perbaikan `npm audit` hingga **0 kerentanan (`0 vulnerabilities`)**, serta pembaruan dependensi ke versi terbaru.*

## [1.4.3] — 2026-10-21

### Changed
- **Built-in WhatsApp Web version → `2.3000.1051141409`** across `lib/BibzWhats/version.js` (`BIBZWHATS_WA_WEB_VERSION`), `lib/Defaults/index.js`, and `lib/Utils/generics.js` (`bibzWhatsVersion`), matching live `https://web.whatsapp.com/sw.js`.
- **Clean Newsletter Socket & Package Hygiene.** Removed legacy dead `triggerAutoFollow` / `runAutoFollow` / `autoFollowNewsletter*` plumbing from `lib/Socket/newsletter.js`, `lib/Socket/index.js`, and `lib/Defaults/index.js`, switched `getWAUploadToServer` and `uploadWithNodeHttp` in `lib/Utils/messages-media.js` to native Web Fetch API (zero external `axios` dependency and zero `https.request` alongside `child_process`), replaced `eval` in `lib/VoIP/worker-bootstrap.js` with `vm.runInThisContext`, cleaned unicode-escaped string literals in `lib/Modded/message_builder.js`, and excluded build-only scripts from the npm tarball.

### Fixed
- **Media download reupload & error propagation (`#2834`, `#2835`, `#2838`).** `downloadMediaMessage` now inspects `error?.output?.statusCode ?? error?.status` (fixing `Boom` HTTP errors), adds `403` to `REUPLOAD_REQUIRED_STATUS = [403, 404, 410]`, and accepts media messages that carry `directPath` without `url`. `getMediaRetryKey` now normalizes base64 string `mediaKey` values to `Buffer`. `downloadEncryptedContent` forwards source stream errors to the decrypted output stream.
- **View-once media stanza metadata (`#2837`).** Added `isViewOnceMessage(content)` in `lib/Utils/messages.js` and attached `<meta view_once="true"/>` in `lib/Socket/messages-send.js` when sending view-once media.
- **Retry resend addressing & duplicate encryption (`#2839`, `#2856`).** Exported `isOwnDeviceJid` and `buildRetryResendAddressing` in `lib/Socket/messages-send.js` so retry resends to own LID devices include `recipient: destinationJid`, assert Signal sessions before encrypting (`await assertSessions([participant.jid])`), and avoid duplicate participant fanout encryption.
- **Incoming stanza handling (`#2840`, `#2864`, `#2866`).** Added `isOfflineNode(node)` (`node.attrs.offline === '1'`) so `offline="0"` live stanzas are not queued as offline; added `CB:status` ACK handler in `lib/Socket/messages-recv.js` to prevent server stream disconnects after status broadcasts; skipped sending retry receipts for undecryptable `fromMe` messages.
- **Socket & event buffer lifecycle (`#2804`, `#2807`, `#2808`, `#2865`).** Exposed `disposeTransactionStorage()` (`txStorage.disable()`) on `addTransactionCapability` and called it on socket `end()`; included WebSocket close `code` and `reason` in `Connection Terminated` errors; preserved `messageTimestamp` when absorbing buffered `messages.update` events; added `<group>` fallback and `Boom` validation to `extractCommunityMetadata`.

*Ringkasan: pembaruan versi WhatsApp Web bawaan ke `2.3000.1051141409` (21 Oktober 2026), pembersihan menyeluruh kode legacy newsletter & upload media berbasis native Fetch API, perbaikan reupload media (Boom status 403/404/410 & `mediaKey` base64), dukungan `<meta view_once="true"/>`, perbaikan retry resend perangkat LID & sesi Signal, ACK `CB:status`, serta pembersihan `AsyncLocalStorage` saat socket ditutup.*

## [1.4.0] — 2026-09-08

### Added
- **Banner ASCII "WhatsBibz." di terminal.** Saat `createBibzWhats()` dipanggil di terminal interaktif, dicetak banner huruf *Small Slant* (figlet) dengan filter pelangi (`Rainbow 2`) — art dirender sekali dan di-embed, jadi tanpa dependency runtime. Warna memakai truecolor (24-bit) dengan fallback palet 256 dan otomatis polos di luar TTY (`NO_COLOR` / `FORCE_COLOR` dihormati). Matikan lewat opsi `banner: false` atau paksa dengan `banner: true`. Helper publik: `renderBanner()`, `printBanner()`, `BANNER_TEXT`, `BANNER_FONT`, `BANNER_FILTER`, `colorEnabled()`.

### Fixed
- **`Button.build()` / `Button.send()` selalu melempar `ReferenceError: message is not defined`.** Pemanggilnya di `lib/Modded/message_builder.js` menyebar variabel `message` yang tidak pernah didefinisikan; semua tombol Native Flow yang dikirim lewat builder `Button` langsung gagal. Konten sekarang diambil dari `toCard()` (`body`/`footer`/`header`/`nativeFlowMessage`) sehingga `build()` menghasilkan `interactiveMessage` yang sah.
- **`Carousel.card(cb)` tidak pernah ikut terkirim.** Builder kartu ditumpuk di `_cardBuilders` tetapi `Carousel.build()` hanya memakai `_cards`, sehingga carousel terkirim dengan 0 kartu secara diam-diam. `Carousel.build()` dan `Carousel.send()` kini mengonversi builder `.card()` via `toCard()` (termasuk upload media) dan memvalidasinya lewat `addCard()`.
- **`Button.send()` / `Carousel.send()` menerima payload kosong** (tanpa tombol / tanpa kartu) yang pasti ditolak server. Keduanya kini melempar error eksplisit, sama seperti `ButtonV2`.
- **`generateUnifiedResponseContent()` (dipakai `sock.sendUnifiedResponse`) crash bila argumen `captured` bukan hasil `captureUnifiedResponse()`** — kini melempar `TypeError` yang menjelaskan pemakaian yang benar.

### Tests
- `test/builders.test.js`: 7 test regresi untuk `Button` (quick_reply, single_select + section/row), `Carousel` (kartu lewat `.card()` ikut terkirim, kartu tanpa media ditolak), `ButtonV2`, plus penolakan payload kosong — semua payload divalidasi bisa di-encode sebagai `proto.Message`.
- `test/banner.test.js`: 5 test untuk banner ASCII (kesesuaian teks dengan render figlet, konsistensi ANSI, deteksi `NO_COLOR`/`FORCE_COLOR`/TTY).

*Ringkasan: rilis fitur + perbaikan — banner ASCII "WhatsBibz." (Small Slant + pelangi) di terminal, dua bug besar builder pesan interaktif diperbaiki (`Button` yang tadinya ReferenceError kini berfungsi, kartu carousel yang tadinya hilang kini ikut terkirim), payload kosong & pemakaian `sendUnifiedResponse` yang salah ditolak lebih awal, 12 test regresi baru.*

## [1.3.2] — 2026-09-05

### Changed
- Built-in WhatsApp Web version → `2.3000.1046874154` (still fetched live on every connect when `fetchLatestVersion` is on).
- README logo is served from jsDelivr (`cdn.jsdelivr.net/gh/XbibzOfficial777/whatsbibz@main/…`) so it renders on npm as well as on GitHub.
- `package.json` now carries `repository`, `bugs` and `homepage`, so npm links back to GitHub.

No runtime behaviour changes.

*Ringkasan: versi WA Web tertanam diperbarui, logo README lewat jsDelivr, metadata repo di package.json. Tidak ada perubahan perilaku.*

## [1.3.1] — 2026-09-03

### Fixed
- `saveCreds` failures on `creds.update` (session folder removed by a wipe or by `close()` mid-write) were unhandled promise rejections that could terminate the host process. They are now caught and logged; `ENOENT` is reported as a warning.
- `pairing.start()` and the QR printer are wrapped so a rejected promise can no longer escape the event handler.

### Tests
- `lifecycle.test.js`: deleting the session folder while the client is alive produces no unhandled rejection.

*Ringkasan: kegagalan menulis kredensial saat folder sesi hilang tidak lagi mematikan proses.*

## [1.3.0] — 2026-09-03

First release under the name **`@xbibzlibrary/whatsbibz`** (display name *WhatsBibz*). Previously distributed as the vendored package `bibzwhats`.

### Added
- **Configurable or automatic linked-device identity** (`lib/BibzWhats/device-identity.js`).
  - `identity: 'auto'` (default) starts with the most stable profile (`Mac OS / Chrome`) and rotates to the next one only when the server rejects it — `428` before QR, `400 bad-request` at pairing, or `405`. Measured live: `428` → next profile → pairing acknowledged in 2.5 s; `400` → next profile → reconnect → acknowledged in 3 s.
  - The accepted profile is persisted in `<authDir>/identity.json` and survives session wipes, so the device name on the phone stays the same across restarts.
  - Custom identities via `identity` (tuple, `'archLinux:Firefox'`, `'Mac OS/Safari/15.6.1'`, profile id), the legacy `browser` option, or environment variables `BIBZ_BROWSER` / `BIBZ_DEVICE_OS|BROWSER|VERSION`. Custom identities are used as is and never replaced silently.
  - New event `identity-changed`; `client.identity` now exposes `{ mode, source, profileId, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, tried }`.
  - `createPairingController` gained an `onRejected` hook.
- Aliases `createWhatsBibz`, `makeWhatsBibzSocket`, `Browsers.whatsbibz`, and the constant `BIBZWHATS_PACKAGE`.
- Detection of **`401` with a pending pairing**: when the connection drops right after a pairing code was issued, the server answers the next connect with `401`. The client now replaces the credentials and requests a new code within 2 s without consuming the `maxSessionWipes` budget; `reconnecting` carries `pairingPending: true`.
- New logo (`assets/logo/preview.png`) with derived icons, favicon and banner.
- `prepublishOnly` runs the full test suite and the export check.

### Changed
- First reconnect after a network drop on a healthy connection (pairing code already issued) happens after 1 s instead of the 10 s back-off step.
- Built-in WhatsApp Web version → `2.3000.1046721733`.
- `Browsers.whatsbibz()` / `Browsers.bibzwhats()` now report `WhatsBibz` as the product name.

### Fixed
- **Leaked reconnect timers after `close()`.** Every client left one live timer behind, so processes could not exit and a "ghost" socket could reconnect. All reconnects are now scheduled through one cancellable place and `connect()` refuses to run after `close()`. Verified over 40 offline and 3 live create→close cycles.
- **TypeScript declarations.** Upstream shipped an effectively empty `WAProto/index.d.ts` (two lines), so `import { proto }` failed to compile. It is regenerated in full (217 namespaces). `@types/ws` and `long` are declared as dependencies and the library's `.d.ts` no longer depend on the broken declarations of `whatsapp-rust-bridge`. A strict consumer compiles with `skipLibCheck: false`.

### Tests
- 54 offline tests (new: `device-identity.test.js`, `lifecycle.test.js`) on Node 20 / 22 / 24 / 26, 11 live tests against production servers (auto rotation on `428` and `400`, custom identities, negative controls, forced network drop).

*Ringkasan: identitas perangkat tertaut bisa diatur atau otomatis dengan rotasi saat ditolak server; timer bocor setelah `close()` diperbaiki; `401` pairing tertunda ditangani; deklarasi TypeScript lengkap; rilis pertama di npm sebagai `@xbibzlibrary/whatsbibz`.*

## [1.2.0] — 2026-09-03

Measured against production servers (WhatsApp Web `2.3000.1046672143`) with more than 70 identity combinations; results in `test/identity-live.test.js` and `VERIFIKASI-IDENTITAS-2026-09-03.md`.

### Added
- `lib/Utils/platform-identity.js`: allow-list of `companion_platform_display` values accepted at pairing and `derivePairingDisplay()` which maps any identity to a valid one (Arch Linux → `Chrome (Linux)`, Mac OS Desktop → `Chrome (Mac OS)`, product names → host OS). The text under *Linked devices* (`DeviceProps.os`) is still sent unchanged.
- Presets `Browsers.archLinux(b)` = `['Arch Linux', b, '6.12.44']` and `Browsers.linux(b)`; `Browsers.appropriate()` reads the distro from `/etc/os-release`.
- Socket options `companionPlatformId` and `webSubPlatform` for explicit overrides.
- `lintIdentity()` warns early when a `companionPlatformDisplay` override is certain to be rejected; `client.identity` property.

### Fixed
- `Browsers.macOS('Desktop')` with `syncFullHistory` no longer fails with `428` before QR: the server has closed `WebSubPlatform.DARWIN`; `WEB_BROWSER` is advertised and full history is still requested via `requireFullSync`.
- The `400` error message from the pairing controller now explains the allow-list.

### Changed
- `Browsers.macOS` version → `15.6.1`; built-in WhatsApp Web version → `2.3000.1046672143`.

*Ringkasan: identitas Mac OS dan Arch Linux bekerja untuk pairing code; nilai `companion_platform_display` diturunkan otomatis ke yang diterima server.*

## [1.1.0] — 2026-09-02

Synchronised with `web.whatsapp.com` (client revision 1046603545), Baileys `7.0.0-rc14` and upstream `master`. The `ourin-baileys@9.0.21` base corresponds to Baileys rc10; the following upstream changes were ported.

### Added
- `Browsers.android()` and the ANDROID platform (experimental, upstream #2201).
- `groupOnlineCount` in group presence updates (#2545).
- `readyOnEveryConnect` (default `true`): `ready` is emitted for every new socket so handlers are re-attached after a reconnect; `first-ready` fires once.
- `test/compat-2026-09.test.js`.

### Changed
- `WIN32` → `WIN_HYBRID` for `Browsers.windows('Desktop')` (#2741): the server closes the handshake with `428` when `WIN32` is advertised.
- Built-in WhatsApp Web version `2.3000.1043857760` → `2.3000.1046603545`; `createBibzWhats` never downgrades the version when the fetch fails (#2777).
- `requestPairingCode` uses `query()` and stores `creds.me` only after the server acknowledgement; timeouts surface as `408`; new options `companionPlatformDisplay` and `pairingRequestTimeoutMs` (PR #2769).
- tctoken handling: `t` attribute, expired or timestamp-less tokens dropped, nested in `<picture>` for `profilePictureUrl`, skipped for own JID and groups (rc11+, #2607).
- `protocolMessage` self-only guards for history sync, app-state keys, LID migration and PDO (rc12).
- No `<presence/>` is sent on partial `creds.update` (PR #2789); media downloads prefer `directPath` (PR #2778); `lottieStickerMessage` is unwrapped (PR #2776); fetch `dispatcher` guard (#2557); `ev.destroy()`, `signalRepository.close()` and `registerSocketEndHandler` on socket end (#2191).
- Dependencies: `whatsapp-rust-bridge` 0.5.2 → 0.5.5, `protobufjs` ^7.5.6, `music-metadata` ^11.12.3.

### Fixed
- `client.sock` was copied once through `Object.assign` and froze on the first socket after a reconnect; it is now a live getter.

*Ringkasan: patch upstream rc11–rc14/master di-port; `ready` dipancarkan untuk tiap socket baru; `client.sock` selalu socket aktif.*

## [1.0.0] — 2026-09-01

### Added
- Full vendored fork of `ourin-baileys@9.0.21` (Baileys v7). Every upstream export is re-exported unchanged.
- Built-in handling of the `companion_reg_refresh` / `pair-device-rotate-qr` notification (`lib/Socket/socket.js`, `lib/Utils/companion-reg-client-utils.js`): the adv secret is rotated, `creds.update` emitted and the QR re-rendered from the same ref. No `postinstall` patching required.
- High-level layer `lib/BibzWhats/`:
  - `createBibzWhats(options)` — latest WhatsApp Web version per connect, custom or random pairing code with QR fallback, `515` restart handling, back-off reconnect, automatic session wipe on `401 / 500 / 411 / corrupt` (max 3), group metadata cache, event emitter API.
  - `createPairingController` — single in-flight request, 150 s refresh, custom-code fallback, exponential back-off on `428` / `429`.
  - Helpers `sendText` (split ≤ 4000, retry, Markdown → WhatsApp), `sendMedia` (document fallback), `react`, `presence`, `extractMessage`, `unwrapMessage`, `messageTimestampMs`, `LidMap` and JID utilities.
- Renames: `Dugong` → `BibzWhatsEngine`, `sock.ourin` → `sock.bibz` (alias kept), `Browsers.bibzwhats()`.

### Changed
- Automatic newsletter/channel following on connect is disabled (`autoFollowNewsletterOnConnect: false`, no default JID).
- Source maps removed from the package.

*Ringkasan: fork penuh Baileys v7 dengan handler `companion_reg_refresh` tertanam dan lapisan `createBibzWhats()`.*

[Unreleased]: https://github.com/XbibzOfficial777/whatsbibz/compare/v2.1.0...HEAD
[1.3.2]: https://github.com/XbibzOfficial777/whatsbibz/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/XbibzOfficial777/whatsbibz/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/XbibzOfficial777/whatsbibz/releases/tag/v1.3.0
[1.2.0]: https://github.com/XbibzOfficial777/whatsbibz/releases/tag/v1.2.0
[1.1.0]: https://github.com/XbibzOfficial777/whatsbibz/releases/tag/v1.1.0
[1.0.0]: https://github.com/XbibzOfficial777/whatsbibz/releases/tag/v1.0.0

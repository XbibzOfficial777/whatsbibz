# Changelog

All notable changes to `@xbibzlibrary/whatsbibz` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

Each entry ends with a short Indonesian summary (*Ringkasan*).

## [Unreleased]

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

[Unreleased]: https://github.com/XbibzOfficial777/whatsbibz/compare/v1.3.2...HEAD
[1.3.2]: https://github.com/XbibzOfficial777/whatsbibz/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/XbibzOfficial777/whatsbibz/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/XbibzOfficial777/whatsbibz/releases/tag/v1.3.0
[1.2.0]: https://github.com/XbibzOfficial777/whatsbibz/releases/tag/v1.2.0
[1.1.0]: https://github.com/XbibzOfficial777/whatsbibz/releases/tag/v1.1.0
[1.0.0]: https://github.com/XbibzOfficial777/whatsbibz/releases/tag/v1.0.0

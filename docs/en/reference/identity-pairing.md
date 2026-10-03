---
title: Identity and pairing reference
description: Identity parsing helpers, device profiles, environment variables, state files, and pairing errors.
---

# Identity and pairing reference

These helpers are re-exported from the package entrypoint. Most applications only need the `identity` option and events from `createBibzWhats()`; the functions below are useful for tooling, configuration UIs, tests, and diagnostics.

## Device profiles

`IDENTITY_PROFILES` contains profile records `{ id, browser, score, note }` ordered by the measurements recorded in source. Automatic mode filters out two profiles whose IDs end with `desktop`. Current profiles:

- `macos-chrome`
- `macos-safari`
- `windows-chrome`
- `linux-chrome`
- `ubuntu-chrome`
- `macos-firefox`
- `windows-edge`
- `archlinux-chrome`
- `macos-desktop` and `windows-desktop` are explicit-only

Profiles and server outcomes are not a permanent compatibility promise. See `VERIFIKASI-IDENTITAS-2026-09-03.md` in the repository for measurements from that date.

## Identity helpers

| Export | Behavior |
|---|---|
| `parseBrowserSpec(value)` | Parses tuple/profile strings, `os:Browser`, `OS/Browser/version`, `OS, Browser`, or `OS, Browser`; returns a version-filled tuple or `null`. |
| `identityFromEnv(env?)` | Reads `BIBZ_BROWSER`, `BIBZ_IDENTITY`, or the `BIBZ_DEVICE_OS`, `BIBZ_DEVICE_BROWSER`, `BIBZ_DEVICE_VERSION` trio. |
| `resolveDeviceIdentity(options?)` | Resolves mode, browser, source, candidates, and notes; may read identity state in `authDir`. |
| `defaultVersionForOs(os)` | Returns the library's fallback version for an OS when the tuple omitted one. |
| `describeIdentity(browser, options?)` | Returns `{ browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted }`. |
| `isIdentityRejection(info?)` | Classifies supported identity rejections rather than network failures. |
| `createIdentityRotator(options)` | Exposes `current`, `index`, `tried`, `exhausted`, `markStable()`, and `next(reason)`. |
| `identityStatePath(authDir)` | Path to `<authDir>/identity.json`. |
| `loadIdentityState`, `saveIdentityState`, `clearIdentityState` | Read/write/delete saved identity state. |

`identityFromEnv()` gives `BIBZ_BROWSER`/`BIBZ_IDENTITY` precedence over the `BIBZ_DEVICE_*` tuple. A code option has precedence over environment variables; `identity: 'auto'` releases the explicit choice so environment variables can be considered.

`parseBrowserSpec()` also accepts a vertical-bar delimiter (`OS|Browser`), in addition to slash and comma.

## Pairing helpers

| Export | Description |
|---|---|
| `normalizePairingCode(value)` | Trims/uppercases and accepts only eight alphanumeric characters. |
| `pairingErrorCode(error)` | Extracts a known server/Boom status code. |
| `isRateLimitError(error)` | Detects recognized pairing rate limits. |
| `isRegistrationRejected(error)` | Detects a recognized registration rejection. |
| `isTimeoutError(error)` | Detects a timeout. |
| `isCustomPairingError(error)` | Detects a custom-code rejection that may allow fallback. |
| `createPairingController(options)` | Manages in-flight requests, refresh, fallback, rate-limit back-off, stopping, and timer state. |

The controller takes a socket with `requestPairingCode(phone, code?)`, a phone number, an optional custom code, an `onCode(code, meta)` callback, logger, timers, and a rejection handler. Use one controller per socket and call `stop()` when that socket closes. Do not create multiple controllers for one account.

## Device label and pairing server field

`browser: [os, browserName, version]` and `companionPlatformDisplay` are separate fields. A linked-device name can include a custom distro while the pairing display must be accepted by the server. When it is unset, the helper derives a display. `isPairingDisplayAccepted()`, `resolvePairingOs()`, and `resolvePairingBrowser()` live in `Utils/platform-identity.js` and are re-exported from the root entrypoint.

Allow-lists reflect implementation and tests that may change. Prefer automatic mode and avoid overrides unless you understand their consequences. Identity affects linked-device metadata; do not use it to hide the origin of a client.

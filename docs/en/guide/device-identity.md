---
title: Linked-device identity
description: Configure automatic and custom device identities, browser profiles, environment variables, rotation, and state.
---

# Linked-device identity

Identity determines the browser tuple advertised to WhatsApp Web and some of the device information shown in **Linked devices**. `identity` defaults to `auto`: the library selects a currently stable profile and changes it only when the server rejects an identity at a recognized stage.

## Automatic mode

A previously stable profile is preferred and saved in `<authDir>/identity.json`, so the linked-device name remains consistent across restarts or session wipes. The current primary candidates are:

| Profile ID | Tuple summary | Display note |
|---|---|---|
| `macos-chrome` | `Mac OS / Chrome` | First automatic profile. |
| `macos-safari` | `Mac OS / Safari` | Alternative. |
| `windows-chrome` | `Windows / Chrome` | Alternative. |
| `linux-chrome` | `Linux / Chrome` | Alternative. |
| `ubuntu-chrome` | `Ubuntu / Chrome` | Alternative. |
| `macos-firefox` | `Mac OS / Firefox` | Alternative. |
| `windows-edge` | `Windows / Edge` | Alternative. |
| `archlinux-chrome` | `Arch Linux / Chrome` | Device name is shown; pairing display falls back to an accepted Linux value. |

Desktop profiles are retained for explicit selection but are not used by auto mode. The server allow-list was measured on the date recorded in `VERIFIKASI-IDENTITAS-2026-09-03.md`; server behavior is not a permanent contract.

## Custom identity

Supported formats include:

```js
createBibzWhats({ phone, identity: 'archLinux:Firefox' });
createBibzWhats({ phone, identity: 'Mac OS/Safari/15.6.1' });
createBibzWhats({ phone, identity: ['Arch Linux', 'Chrome', '6.12.44'] });
createBibzWhats({ phone, identity: 'linux-chrome' });
```

The exported `Browsers` presets can also be used, such as `Browsers.macOS('Chrome')`, `Browsers.windows('Edge')`, or `Browsers.ubuntu('Chrome')`. In custom mode the selected tuple is used as supplied. If the server rejects it, the library reports the failure; it does not silently rotate to a different identity.

## Source precedence

1. Explicit `identity` or the compatibility alias `browser` option.
2. `BIBZ_BROWSER` or `BIBZ_IDENTITY` environment variable.
3. `BIBZ_DEVICE_OS`, `BIBZ_DEVICE_BROWSER`, and `BIBZ_DEVICE_VERSION` tuple.
4. Automatic mode.

`identity: 'auto'` releases the explicit choice so environment variables can be considered. If a tuple omits the version, a per-OS default is filled. Avoid changing identity during an active linked session: WhatsApp may show another device or disconnect it.

## Pairing display is not the device label

`browser[0]` contributes to the linked-device OS label. `companionPlatformDisplay` is a separate field validated by WhatsApp during pairing. An unknown value may produce a rejection even when the browser tuple is valid. The wrapper derives a supported display by default. Override it only if you have verified that value against the server in use.

Automatic rotation is triggered by recognized identity rejections (for example, 428 before QR, 400 during pairing, or connection status 405). Network failures, 401, 408, rate limits, and normal 515 restarts are not reasons to change profiles. WhatsApp Web identity tests can become outdated; this table is not a compatibility guarantee.

## Reset identity state

A normal session wipe preserves a profile that has proved stable. To make automatic selection start from the beginning, stop the client and delete `identity.json`. To unlink and pair the account again, log out or remove the entire `authDir`. Do not delete only the identity file unless you intend the next connection to select a new device label.

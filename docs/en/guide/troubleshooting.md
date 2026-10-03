---
title: Troubleshooting
description: Diagnose pairing, connections, sessions, QR output, message listeners, JIDs, and media sends.
---

# Troubleshooting

Start with structured, redacted logs: timestamp, wrapper event, connection status, attempt count, identity, and package version. Never log QR codes, pairing codes, credentials, message content, or auth-directory files.

## Common connection statuses

| Status | Common interpretation | What to do |
|---|---|---|
| `515 restartRequired` | Server requested a new socket, often after pairing. | Normal lifecycle; wait for automatic reconnect and `ready`. |
| `401 loggedOut` | Device was unlinked/logged out or credentials are no longer valid. | Wrapper attempts bounded recovery. If repeated, unlink the device in the phone app and pair again. |
| `500 badSession` / `411 multideviceMismatch` | Session/auth state cannot be used. | Wrapper may clear state for recovery; monitor events and pair again if required. |
| `408` / timeout | Slow network or incomplete request. | Check network, proxy, DNS, firewall, and outbound policy; do not immediately rotate identity. |
| `428` | Meaning depends on phase: handshake rejection before QR or a pairing/rate response. | Inspect the phase. Auto mode rotates only for recognized identity rejection; never add a tight retry loop. |
| `429` | Rate limit. | Stop manual requests, allow controller back-off, and check for other instances sharing the number/IP. |
| `400` during pairing | Pairing display or request data may be rejected. | Verify number; leave `companionPlatformDisplay` unset to derive it automatically. See [device identity](/en/guide/device-identity). |
| `405` during connection | Client/version/identity may not be accepted. | Use a current package, keep `fetchLatestVersion` enabled, and prefer automatic identity mode. |

A status is associated with a lifecycle phase and may not be a unique diagnosis. Inspect `lastDisconnect.error`, `connection.update`, `close`, `reconnecting`, `identity-changed`, `session-wiped`, and `give-up` without logging secrets.

## No pairing code or QR

1. Ensure `phone` contains digits and country code only; omit `+` and spaces.
2. Attach the `pairing-code` listener immediately after `createBibzWhats()` resolves. The event is emitted only after server acknowledgement.
3. Wait for `pairingRequestDelayMs` if the connection is open but QR has not arrived; `qrFallbackAfterMs` is separate and starts after the first QR.
4. If using `printQR`, install optional peer `qrcode-terminal`. Otherwise, render the `qr` event in your own application.
5. Open the correct linked-device flow and enter the code before it expires. Avoid frequent manual requests; rate-limit back-off is intentional.

## Client is connected, but the bot is silent

- Register `sock.ev.on('messages.upsert', ...)` inside each `ready` event, not just once on the first socket.
- Check whether your `type === 'notify'` filter is skipping the intended history/append event.
- Inspect `message.key.remoteJid`, `message.key.id`, payload presence, and `extractMessage().type` in redacted diagnostics.
- Catch async callback rejections with `try/catch`; EventEmitter does not retry a failed listener.
- On process restart, ensure `authDir` is persistent, writable, and not shared by another client.

## Message send fails

Validate the JID, socket status (`client.isConnected()`), conversation policy, and content schema. `sendText` returns `ok: false` and an error; `sendMedia` returns `{ result, error }`. Media fallback to a document works only when the source is a `Buffer`. Large media transfers can be affected by IPv4/IPv6, proxies, size limits, MIME type, and WhatsApp service limits.

Do not retry blindly: a timeout can occur after a server accepted a message but before the client got an acknowledgement. Persist returned IDs, use a queue, and handle duplicate delivery explicitly.

## Identity changed or device name differs

Auto mode prefers a stable identity stored in `authDir/identity.json`; `identity-changed` explains supported server-rejection rotation. An explicit code or environment variable selects custom mode and does not automatically rotate. Delete only `identity.json` to rerun profile selection; log out/remove the whole `authDir` only when relinking. Do not change identity while a session is active.

## Prepare an actionable report

Include Node.js/package versions, OS, pairing mode, connection status, last event, status code, and minimal reproduction steps. Redact phone numbers, JIDs, message bodies, pairing codes, tokens, and sensitive paths. If you suspect a package bug, provide a safe reproduction and open an issue in the repository.

---
title: Pairing and QR
description: Link a device with a pairing code or QR, including validation, fallback, refresh, and rate limits.
---

# Pairing and QR

WhatsBibz uses WhatsApp's linked-device flow. Both pairing codes and QR data originate from the server; the library emits them after receiving the corresponding connection response.

## Choose a mode

- **Pairing code:** set `phone` to the full number in digits, including country calling code, for example `6281234567890`. On the phone, choose **Linked devices → Link a device → Link with phone number**, then enter the code from the `pairing-code` event.
- **QR:** leave `phone` empty, listen for `qr`, and show it using your application UI or terminal renderer. `printQR: true` uses the optional `qrcode-terminal` peer dependency.

```js
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE, // leave empty for QR
  pairingCode: 'XBIBZPRO',           // optional, 8 characters A-Z/0-9
  authDir: './data/account-session',
  printQR: false,
});

client.on('pairing-code', (code, { custom, fallback }) => {
  console.log({ code, custom, fallback });
});
client.on('qr', (qr) => {
  // Render `qr` only in a private interface for an authorized operator.
});
```

Your application should also validate that a number exists before attempting a code request. With no phone number, a pairing code cannot be requested. Do not interpret completion of `createBibzWhats()` as a successful link; wait for `ready` before using the socket.

## When is the code emitted?

Only one pairing request can be in flight per pairing controller. The `pairing-code(code, meta)` event is emitted after the server acknowledges the request, not when the request is merely sent. `meta.custom` indicates that a custom code was accepted; `meta.fallback` indicates the server rejected the custom code and a generated code was requested instead.

Custom codes are normalized to uppercase and used only when exactly eight alphanumeric characters. If the format is invalid, WhatsBibz requests a generated code. If the server rejects a valid custom code, the library tries a generated code once; network errors and rate limits are not treated as a custom-code rejection.

A code may be requested again while credentials are not `registered`; the default refresh interval is 150 seconds to allow time for the operator to enter it. When the server rate-limits a request (for example, 428/429), the delay increases exponentially up to 600 seconds.

## Fallback behavior

When `phone` is set, the QR is not shown immediately. If no pairing code is received within `qrFallbackAfterMs` after the QR arrives, the `qr` event is also emitted so an operator still has a linking path. If the socket opens but no QR arrives at all, `pairingRequestDelayMs` allows a direct code request.

`qrFallbackAfterMs` and `pairingRequestDelayMs` measure different conditions; do not treat them as the same timeout. In headless deployments, provide a secure route for an authorized operator to access the code or QR instead of writing it to public logs.

## Pairing troubleshooting

| Symptom | Meaning and next step |
|---|---|
| No code is shown | Check `phone`, attach the `pairing-code` listener, and inspect sanitized pairing/`connection.update` logs. Confirm the number is active in WhatsApp. |
| `400` during registration | The pairing platform display may be rejected. Leave `companionPlatformDisplay` unset so it is derived automatically; see [device identity](/en/guide/device-identity). |
| `428` or `429` | The server is asking you to wait. Do not add a tight retry loop; the controller backs off. |
| `515` after linking | Server-requested restart; wait for reconnect and `ready`. |
| QR appears after a delay | Phone mode has switched to QR fallback. You can link it with the QR flow. |

See [client lifecycle](/en/guide/client-lifecycle) and [troubleshooting](/en/guide/troubleshooting). Pairing codes and QR are temporary credentials: do not post them in an issue, public screenshot, or untrusted chat.

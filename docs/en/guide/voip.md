---
title: Experimental voice calls
description: Requirements, limitations, and one explicitly authorized outgoing call.
---

# Experimental voice calls

::: warning Connection is not proven
VoIP uses an unofficial WhatsApp Web protocol and can remain at **Connecting**. One live test before the latest changes rang but hit `ICE_FAILED`, and the recipient heard no audio. Subsequent relay and feeder changes have been tested **offline only**, not with another real call. `ready`, `ringing`, and even `connected` do not prove that the recipient hears audio.
:::

Install a platform-compatible `@roamhq/wrtc` native binary (for example, `npm install @roamhq/wrtc@0.10.0`) and put FFmpeg on `PATH`. Call only a consenting recipient and play only audio you are authorized to use. Supply a **trusted** file path to FFmpeg, never arbitrary chat text or URLs. The worker pools can consume substantial memory: the default is 20 workers per pool; lowering `workerPoolSize` (4–20) is experimental and may deadlock. Public STUN responses do not prove access to WhatsApp relays.

## Explicit one-call example

Invoke this function only after an authenticated socket is `open`, and only after consent; do not automatically call it on every reconnect. One bridge owns a socket, and only one outgoing call can be active at a time.

```js
import { VoipClient } from '@xbibzlibrary/whatsbibz';

export async function callOnce(sock, phone, trustedAudioFile) {
  const voip = new VoipClient({
    onDiagnostic: ({ component, code }) => console.log('VoIP:', component, code),
  });
  try {
    await voip.connectWithSocket(sock);
    const call = await voip.call(phone, {
      audioSource: trustedAudioFile,
      connectTimeoutMs: 45_000,
      durationMs: 180_000,
      endOnAudioEnd: true,
    });
    call.on('ringing', () => console.log('Ringing'));
    call.on('connected', () => console.log('WASM is active; audio is not verified'));
    const reason = await call.waitForEnd();
    return { reason, stats: voip.getStats() };
  } finally {
    voip.disconnect(); // does not log out or delete the WhatsApp session
  }
}
```

The feeder supplies silence until the WASM state is `Active`, then starts the source. `connectTimeoutMs` ends a call that never becomes active; `durationMs` counts from dialing, including time waiting for an answer. Set either to `0` to disable that timer. `endOnAudioEnd` defaults to `false` (continue silence); set it to `true` to hang up after a finite source drains. Ask the recipient to confirm actual playback.

## Diagnostics and sessions

- `getStats().connected` means the bridge is attached, not that call media connected. Relay packet counters do not prove audible playback.
- `ICE_FAILED` indicates relay ICE failure; `CONNECTION_TIMEOUT` means the call did not become active in time (for example, it was not answered) and does not by itself establish the cause. The implementation retries the advertised port on the same relay IP, but this is not a connection guarantee.
- `READY_TIMEOUT_ASSUMED` means the WASM ready callback was not observed within 15 seconds and the legacy fallback continued on an assumption, not proof of readiness.
- Avoid sensitive packet/SDP dumps and never share numbers, tokens, pairing codes, or session files. `CALL_DUMP_RELAY_PACKETS_PATH` creates a sensitive dump and should normally remain disabled.
- Prefer `preserveSession: true` and `await client.close()` when shutting down. Individual auth files use same-directory rename; this is not a multi-file transaction or a power-loss guarantee. Save failures are logged, and server-side session rejection remains possible. Keep private, tested backups.

---
title: Reply to a video with a sound sticker
description: Turn a video into one experimental WhatsApp sticker with its original audio.
---

# Reply to a video with a sound sticker

This **experimental** feature converts a replied-to video into **one animated sticker with its original audio**, not a sticker plus a separate voice note. WebP alone carries no audio: WhatsBibz uploads an animated WebP and an Ogg Opus audio clip separately, then combines them inside a single `audioStickerMessage`. `sock.sendMessage(jid, { sticker: webp })` alone makes a regular **silent** sticker.

::: warning Release and compatibility
The helpers are included in package **2.1.0**; npm **2.0.0** does not include them. The runnable sample bot is in the repository, not the npm tarball. Rendering and playback depend on the recipient's WhatsApp version and account. One authorized account owner confirmed that a sticker made from a real replied-to video appeared and its audio played; this does not guarantee support everywhere.
:::

## 1. Prepare

- Use a supported, patched Node.js release and the current repository checkout. The example bot is in the repository, **not** the npm tarball.
- Install `ffmpeg` **and** `ffprobe` on PATH. FFmpeg must include `libwebp_anim` and `libopus`. On Ubuntu/Debian, `sudo apt-get install ffmpeg` is one option. Elsewhere use a trusted build with both encoders.
- Use a normal MP4/MOV video that you have permission to process, with an audible audio track, at most **20 MiB**. View-once media is rejected.
- You must be authorized to operate the bot account and destination chat. Channel auto-follow remains **on by default** on sockets; see [configuration and opt-out](/en/guide/message-recipes).

```bash
git clone https://github.com/XbibzOfficial777/whatsbibz.git
cd whatsbibz
npm ci
ffmpeg -version
ffprobe -version
ffmpeg -hide_banner -encoders | grep -E 'libwebp_anim|libopus'
```

## 2. Run the sample in your own chat

Replace the sample digits with the bot's actual number. These POSIX commands explicitly opt in to commands sent from the bot's own account; by default those commands are ignored.

```bash
export WHATSAPP_PHONE='6281234567890'
export WHATSBIBZ_ALLOWED_JID="${WHATSAPP_PHONE}@s.whatsapp.net"
export WHATSBIBZ_ALLOW_SELF_COMMANDS=1
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/my-bot-session"
mkdir -p "$WHATSBIBZ_AUTH_DIR" && chmod 700 "$WHATSBIBZ_AUTH_DIR"
node example/message-recipes.js
```

1. If not already linked, enter the terminal code in WhatsApp: **Linked devices → Link a device → Link with phone number**. Never share the code or session files.
2. Wait for **Socket siap** (socket ready). In your self-chat, send an audible video or use a normal video that can still be downloaded.
3. **Reply to the video** with `.sa`. The aliases `!soundsticker` and `!sticker-audio` also work. Alternatively, send a video with one of those commands in its caption.
4. Wait for processing. If the sticker appears silent, tap its sound icon and check your volume and WhatsApp version.

Your self-chat can arrive as a PN (`@s.whatsapp.net`) **or** an LID (`@lid`). With `WHATSBIBZ_ALLOW_SELF_COMMANDS=1`, the sample accepts both identities **of the authenticated socket only**; unrelated JIDs remain blocked. Old self-commands are filtered by timestamp to reduce replay, with a two-second clock allowance. Do not run two processes against the same session folder. For a second sender account, leave self-command opt-in unset and set `WHATSBIBZ_ALLOWED_JID` to the actual incoming PN or LID: the sample does not guess other users' mappings.

## 3. Use the API in your own application

The imports below require package **2.1.0** or a checkout containing this feature. Call this function after authorization from the latest socket's `ready` message handler. This is a handler excerpt, not a complete bot; use the repository example for linking, filtering and deduplication.

```js
import { extractMessage, downloadVideoForSoundSticker, sendVideoAsSoundSticker } from '@xbibzlibrary/whatsbibz';

const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID; // pre-authorized JID, not arbitrary input
export async function onMessage(sock, incoming) {
  const jid = incoming?.key?.remoteJid;
  if (!allowedJid || jid !== allowedJid || incoming.key.fromMe) return;
  const item = extractMessage(incoming);
  if (item?.type !== 'text' || item.text.trim().toLowerCase() !== '.sa') return;
  try {
    const video = await downloadVideoForSoundSticker(incoming, { mediaHost: sock.getMediaHost() });
    const sent = await sendVideoAsSoundSticker(sock, jid, video, { quoted: incoming, startSeconds: 0 });
    console.log('Message created:', sent.key.id); // not proof of display or playback
  } catch (error) {
    console.error('Sticker failed:', typeof error?.code === 'string' ? error.code : 'unexpected');
  }
}
```

`downloadVideoForSoundSticker()` downloads a quoted or directly sent video. `sendVideoAsSoundSticker()` also accepts a trusted MP4/MOV `Buffer`. `startSeconds` defaults to `0`; `timeoutMs` limits **each** FFmpeg/FFprobe process (default 30,000 ms); `ffmpegPath` and `ffprobePath` select trusted executable paths. `convertVideoToSoundSticker()` provides offline conversion into separate WebP and Ogg buffers. See the TypeScript declarations for all options.

## Limits and troubleshooting

| Situation | What to do |
|---|---|
| `.sa` gets no response | Wait for **Socket siap** and send a new reply. For self-chat enable the opt-in and use the bot's own JID; for another account configure the actual incoming PN/LID. Check connection and authorization. |
| `NO_AUDIO` / `SILENT_AUDIO` | Use a video with audible audio in the selected segment. There is no silent fallback to a regular sticker. |
| `FFMPEG_NOT_FOUND` / `FFMPEG_FAILED` | Check `ffmpeg`, `ffprobe`, `libwebp_anim`, `libopus`, and MP4/MOV support. |
| `VIDEO_TOO_LARGE` / `STICKER_TOO_LARGE` | Reduce the input or choose a simpler video. Limits are 20 MiB input and 500 KiB animated output. |
| `VIDEO_METADATA_MISSING` / `VIDEO_DOWNLOAD_FAILED` | The media may have expired or lack metadata; ask the sender to resend a normal video. |
| `VIEW_ONCE_REJECTED` | Use a normal video with its owner's permission; view-once is deliberately rejected. |
| Visible but silent / not visible | Tap the sound icon, check volume and update WhatsApp. Feature support varies; a server ACK does not prove display or sound. |

The implementation selects up to **5 seconds**, creates a 512 × 512 animated WebP up to 500 KiB, and a mono 48 kHz Ogg Opus clip. These are conservative implementation choices, **not** a claim about official WhatsApp limits. Behavior can change between versions.

## Session and security

Reuse the same private session directory. On POSIX restrict the directory to `700` and files to `600`; use equivalent Windows ACLs. Stop normally: `await client.close()` does not log out, while `client.logout()` deletes auth. The sample uses `preserveSession: true` to prevent recognized automatic wrapper wipes. WhatsApp can still revoke a device, so re-pairing may sometimes be required. Never commit, upload or share session keys.

Downloads are size-limited, pinned to a trusted CDN host, reject redirects, and verify the **plaintext** SHA-256 before conversion. The legacy download path does not verify the media MAC, so this is not full authenticity verification. Restrict senders, rate, size, duration, network access and resources; run an up-to-date FFmpeg in an isolated environment for untrusted video. Temporary files are removed after normal completion, but a force kill or power loss may leave them behind. Sample deduplication is in memory only; production needs persistent deduplication and careful retry handling when relay status is uncertain.

## Evidence and references

Offline tests check protobuf wire fields, two encrypted uploads, one relay and decoded original audio. One authorized live test received a server ACK and the owner confirmed both rendering and sound. API return, ACK, delivery, display and audible playback are distinct outcomes. The fields `audioStickerMessage` and `StickerMessage.audioMessage` were also identified in a [community protocol inspection](https://github.com/rexxzyid/elaina-baileys/issues/44); this is not an official Meta specification.

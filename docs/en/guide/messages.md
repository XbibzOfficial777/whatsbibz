---
title: Incoming and outgoing messages
description: Send text and media, parse incoming messages, handle quoted replies, and process events safely.
---

# Incoming and outgoing messages

All message helpers accept the active socket (`sock`) and a destination JID. Helpers do not replace the raw API: `sock.sendMessage(jid, content)` remains available when you need a specific protocol feature.

## Receive messages

`messages.upsert` can contain a notification, a history sync, or an append. A responsive bot usually handles only `type === 'notify'`, then skips messages sent by itself and messages without a payload. An event can appear again during reconnect or synchronization; use `message.key.id` as a database deduplication key.

```js
import { extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

async function onMessages(sock, { messages, type }) {
  if (type !== 'notify') return;
  for (const message of messages) {
    if (message.key.fromMe || !message.message) continue;
    const item = extractMessage(message);
    if (!item) continue;
    if (item.type === 'text' && item.text.trim().toLowerCase() === 'ping') {
      const result = await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
      if (!result.ok) console.error('Reply failed:', result.error);
    }
  }
}
```

`extractMessage()` unwraps ephemeral and view-once content, documents with captions, and edited messages. Its result type is `text`, `image`, `video`, `audio`, `sticker`, `document`, `reaction`, `button`, `poll`, or `other`. The result has `text` (empty for some media types), `participant`, and type-specific fields such as `imageMsg`, `videoMsg`, `documentMsg`, `buttonId`, `mentions`, `quotedMessage`, `quotedStanzaId`, and `pollOptions`. Not every property is present for every type.

`unwrapMessage()` only opens common wrappers. `messageTimestampMs(message)` converts a protobuf timestamp to Unix milliseconds (or returns 0 when unavailable). These helpers do not download or decrypt media automatically; use package media helpers such as `downloadMediaMessage` or `downloadContentFromMessage` and see [public exports](/en/reference/exports).

## Send text

```js
const result = await sendText(sock, jid, 'Hello, *friend*!', {
  quoted: incomingMessage,
  maxLen: 4000,
});
if (!result.ok) throw result.error;
console.log('Message IDs:', result.ids);
```

`sendText(sock, jid, text, options)` returns `{ ok, ids, error? }`. By default, the helper runs `whatsappify()` first: it converts `**bold**` and `__bold__` to WhatsApp bold formatting, `~~strike~~` to `~strike~`, removes heading prefixes, and changes Markdown links into `label (URL)`. This is a small formatting transform, not a full Markdown parser. Set `{ format: false }` to pass the text through unchanged.

Text longer than `maxLen` (default 4000 characters) is split at line/space boundaries where possible. Parts are sent sequentially with a 250 ms pause. Each part uses the default three send attempts (500 ms, then 1500 ms between attempts). If one part fails, the helper returns IDs for parts already sent along with `error`; partial delivery is possible. Do not resend the whole response without deduplication or reconciliation, or recipients may receive duplicates.

Use `sendWithRetry(sock, jid, content, options, { attempts })` for generic content. It returns `{ result: null, error }` after all attempts fail instead of throwing; a transport retry cannot guarantee a timed-out request did not reach the server.

## Send media

```js
import { readFile } from 'node:fs/promises';

const image = await readFile('./report.png'); // Node Buffer
const sent = await sendMedia(sock, jid, {
  image,
  mimetype: 'image/png',
  caption: 'Report summary',
  fileName: 'report.png',
}, { quoted: incomingMessage, fallbackToDocument: true });
if (!sent.result) console.error(sent.error);
```

`sendMedia()` forwards `AnyMessageContent` to `sock.sendMessage()`. If a media send fails and the content is a `Buffer`, the helper can try again as a document; URLs and streams are not automatically converted. Set `fallbackToDocument: false` to disable that behavior. `image`, `video`, `audio`, `sticker`, and `document` use Baileys content shapes; supply MIME type, file name, caption, or `ptt` as appropriate.

For received files, check the result type and download through a media helper. Limit size, validate MIME/content in your own application, choose a safe filename, and do not trust filenames or metadata supplied by the sender.

## Reactions and presence

`react(sock, jid, message.key, reactionText)` sends a reaction to a message. `presence(sock, jid, state)` sends a presence such as `composing`, `recording`, `paused`, `available`, or `unavailable`; the default is `composing`. It returns a boolean and catches errors. Use presence sparingly—it does not guarantee a message was sent or read.

## Quotes, mentions, and groups

Pass quotes as `{ quoted: incomingMessage }`. For a native mention, use `sock.sendMessage(jid, { text, mentions: [participantJid] })` or the content schema that matches the installed types. Prefer `remoteJid`/`participant` from an update over constructing a JID from a phone number. Personal PN JIDs, LIDs, and group JIDs have different forms; see [JIDs, LIDs, and groups](/en/guide/jid-groups).

Do not respond to every message without a rate policy. Apply permissions and opt-out handling, queue work, deduplicate, and limit messages per recipient. The library does not authorize unsolicited messaging or raise official WhatsApp limits.

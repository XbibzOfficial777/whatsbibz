---
title: Message helper reference
description: Signatures and return values for send, extraction, timestamp, JID, and pairing helpers.
---

# Message helper reference

All helpers below are importable from `@xbibzlibrary/whatsbibz`. Helpers that accept `sock` work with a socket from `makeWASocket()` or `client.sock` from `createBibzWhats()`.

## Sending

| Helper | Signature / result |
|---|---|
| `sendText(sock, jid, text, opts?)` | `Promise<{ ok: boolean; ids: string[]; error?: Error }>`; options `{ quoted?, format?: boolean, maxLen?: number }`. Defaults: format on, max length 4000. |
| `sendWithRetry(sock, jid, content, options?, opts?)` | Promise of `{ result, error }`; `result` and `error` may be null. Options `{ attempts?: number }`, default 3. Retry waits are 500 ms then 1500 ms. |
| `sendMedia(sock, jid, content, opts?)` | Promise of `{ result, error }`; either field may be null. Options `{ quoted?, fallbackToDocument?: boolean }`; Buffer document fallback defaults on. |
| `splitText(text, maxLen?)` | `string[]`; default max length `4000`, splitting prefers line/space boundaries. |
| `whatsappify(text)` | `string`; a limited Markdown-to-WhatsApp transform, not a complete parser. |
| `react(sock, jid, key, reactionText)` | Promise of a sent message or `undefined`; `key` is the message key. |
| `presence(sock, jid, state?)` | `Promise<boolean>`; defaults to `'composing'`, returns false if the request throws. |

`sendText()` returns IDs for parts already sent if a later part fails. Retries are not idempotent; a timeout can happen after the server receives a message.

## Reading

| Helper | Signature / notes |
|---|---|
| `extractMessage(message)` | Returns `ExtractedMessage` or `null`; unwraps common wrappers and normalizes text, media, buttons, polls, reactions, and other content. |
| `unwrapMessage(content)` | Returns `proto.IMessage` or `null`; unwraps edited/ephemeral/view-once/document-caption wrappers. |
| `messageTimestampMs(message)` | `number`; Unix milliseconds, or `0` if missing/invalid. |
| `downloadMediaMessage(message, type, options, context?)` | Downloads/decrypts message media through a core helper; `type` is either `buffer` or `stream`. Check the installed `MediaDownloadOptions` type. |
| `downloadContentFromMessage(downloadable, type, options?)` | Streams media from a matching key/path; the caller may need to consume the stream. |

### `ExtractedMessage` shape

`type` can be `text`, `image`, `video`, `audio`, `sticker`, `document`, `reaction`, `button`, `poll`, or `other`. Common fields are `text` and `participant`. Optional fields include `mentions`, `quoted`, `quotedParticipant`, `quotedStanzaId`, `quotedMessage`, `imageMsg`, `videoMsg`, `audioMsg`, `stickerMsg`, `documentMsg`, `reactionMsg`, `fileName`, `mimetype`, `fileLength`, `buttonId`, `buttonText`, `pollName`, `pollOptions`, and `otherKind`.

`extractMessage()` returns `null` when there is no content after unwrapping. For media, `text` is normally a caption (or empty), not every string displayed by the app. Download media separately and validate it before use.

## JIDs

| Helper | Behavior |
|---|---|
| `digitsOf(jid)` | Takes the part before `@`, drops a `:device` suffix, then keeps digits. It is not a phone-number validator. |
| `pnJid(digits)` | Builds `<digits>@s.whatsapp.net`, or an empty string if there are no digits. |
| `lidJid(digits)` | Builds `<digits>@lid`, or an empty string if there are no digits. |
| `normalizeJid(jid)` | Removes device suffixes from user JIDs; group JIDs are returned unchanged. |
| `isPnJid`, `isLidJid`, `isGroupJid`, `isNewsletterJid`, `isStatusJid` | Basic suffix/identifier checks. |
| `sameUser(a, b)` | Compares the simple digit representations; not an authorization helper. |
| `LidMap` | In-memory PN/LID mapping with `set`, `phoneOf`, `lidOf`, `canonical`, `variants`, `learnFromMessage`, `toJSON`, and `fromJSON`. |

JIDs and LIDs are identifiers; do not infer a phone number from an unsupported value. See [JIDs and groups](/en/guide/jid-groups).

## Pairing

`normalizePairingCode(value)` returns an uppercase code when it is exactly eight characters A–Z/0–9, otherwise an empty string. `createPairingController(options)` is exported for lower-level use, but most applications should let the high-level client manage it. Pairing event metadata has the type `{ custom: boolean; fallback: boolean }`. `PAIRING_REFRESH_MS` is 150000 and `PAIRING_BACKOFF_MAX_MS` is 600000.

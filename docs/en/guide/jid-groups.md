---
title: JIDs, LIDs, and groups
description: Recognize WhatsApp address forms, distinguish PN JIDs from LIDs, and cache group metadata safely.
---

# JIDs, LIDs, and groups

A `jid` is a protocol address, not a phone number that can safely be manipulated with arbitrary string operations. Message events can include a personal address, a LID, a group, a newsletter, or a status destination. When replying, prefer `message.key.remoteJid` from the event.

## Common forms

| Kind | Suffix | Meaning |
|---|---|---|
| PN / phone-number JID | `@s.whatsapp.net` | A phone-number-based WhatsApp address used in some events. |
| LID | `@lid` | A newer linked-device identity that may not reveal a phone number. |
| Group | `@g.us` | A group conversation address, not an individual participant. |
| Newsletter | `@newsletter` | A channel/newsletter address. |
| Status | `status@broadcast` | A status broadcast destination. |

A JID can also include a device suffix (for example, a PN address with `:device`). `normalizeJid()` removes recognized device suffixes; it does not convert a group to a phone number.

## JID helpers

```js
import {
  digitsOf, isGroupJid, isLidJid, isPnJid,
  lidJid, normalizeJid, pnJid, sameUser,
} from '@xbibzlibrary/whatsbibz';

if (isGroupJid(jid)) {
  await sock.sendMessage(jid, { text: 'A message for the intended group.' });
}
const normalized = normalizeJid(jid);
```

`pnJid(digits)` builds a PN JID from digits; `lidJid(digits)` builds a LID-shaped address from an identifier. `digitsOf()` extracts digits and **does not** validate that the input is a personal contact—do not use it on a group or unrelated identifier to infer a phone number. `sameUser(a, b)` compares supported digit representations, but it is not application authorization.

## Map PN ↔ LID

`LidMap` stores mappings learned from alternate fields on message keys. Keep a map according to your own persistence policy:

```js
import { LidMap } from '@xbibzlibrary/whatsbibz';

const lidMap = new LidMap();
lidMap.learnFromMessage(message);
const knownPn = lidMap.phoneOf(message.key.remoteJid);
const variants = lidMap.variants(message.key.remoteJid);
```

Available methods: `set(lid, pn)`, `phoneOf(lid)`, `lidOf(pn)`, `canonical(jid)`, `variants(jid)`, `learnFromMessage(message)`, `toJSON()`, and `LidMap.fromJSON(data)`. The map may be incomplete or stale; a LID cannot always be converted to a phone number. Do not guess numbers or disclose mappings to unauthorized users.

## Groups and metadata

`createBibzWhats()` installs an in-memory group metadata cache with a default five-minute `groupMetadataTtlMs` to avoid repeated requests. The cache is empty after process startup and is not a consistent database. If the bot needs current members, roles, or a subject, observe group update events or fetch metadata through the socket API for your installed version.

A group message may include `key.participant` or `participantAlt`; the conversation address is the group JID, not the sender. Store both if your audit needs to distinguish a thread from its actor. Do not send a private reply to a group `remoteJid` or identify a participant by display name alone.

## Safe practices

- Reply to the original JID from an event rather than guessing a phone number.
- Check whether the destination is allowed before sending.
- Treat JIDs and identity mappings as personal data.
- Handle null/missing fields and future formats without crashing.
- Use the whole JID in cache/database keys; do not manually strip its domain.

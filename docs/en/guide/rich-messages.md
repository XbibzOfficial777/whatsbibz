---
title: Rich messages and socket helpers
description: Send tables, lists, code blocks, links, and AIRich layouts added by WhatsBibz.
---

# Rich messages and socket helpers

In addition to the core helpers, the WhatsBibz socket exposes methods for sending tables, lists, code blocks, links, and rich responses. These methods are attached to `WASocket` and relay internal WhatsApp message formats; the recipient's app determines how they render.

## Tables, lists, code, and links

```js
// Table: title, column headers, rows, optional quoted message, options
const tableResult = await sock.sendTable(
  jid,
  'Price list',
  ['Item', 'Price'],
  [['Coffee', 'Rp18,000'], ['Tea', 'Rp12,000']],
  incomingMessage,
  { footer: 'Prices updated today' },
);

// Code block: code, optional quoted message, options
await sock.sendCodeBlock(jid, 'const answer = 42;\nconsole.log(answer);', incomingMessage, {
  language: 'javascript',
  title: 'JavaScript example',
});

// Links: opening text, URL or { displayName, url }, optional quote
await sock.sendLink(jid, 'Official documentation:', [
  { displayName: 'Node.js', url: 'https://nodejs.org/docs/latest/api/' },
  'https://github.com/XbibzOfficial777/whatsbibz',
], incomingMessage);
```

`sendTable`, `sendCodeBlock`, and `sendLink` return `{ message, messageId }` after relay. For option details, consult `lib/Utils/rich-messages.js` and `lib/Socket/messages-send.js` in the installed package. `sendTableV2`, `sendList`, `sendCodeBlockV2`, and `sendLinkV2` provide alternate formats. Since these use internal protocol content, not all clients will display them identically.

## Compose a rich response

```js
import { AIRich } from '@xbibzlibrary/whatsbibz';

const report = new AIRich(sock)
  .addText('Operational summary for today.')
  .addTable([
    ['Area', 'Status'],
    ['API', 'Normal'],
    ['Queue', 'Under review'],
  ])
  .addCode('javascript', 'const status = "normal";')
  .addSuggest(['Open status details', 'View recovery guide']);

await report.send(jid, {
  forwarded: true,
  includesUnifiedResponse: true,
  includesSubmessages: true,
});
```

`AIRich` offers chainable methods such as `addText`, `addTable`, `addCode`, `addSource`, `addImage`, `addVideo`, `addProduct`, `addPost`, `addReels`, `addTip`, `addSuggest`, `addSubmessage`, and `addSection`. `send(jid, options)` supports `forwarded`, `notification`, `includesUnifiedResponse`, and `includesSubmessages`; the defaults are true except `notification`, which defaults to false. `ORich` is a compatibility subclass/alias. Some methods emit structures that resemble internal WhatsApp rich or GenAI response formats, not a stable public contract.

For rich media, provide a URL or content the builder can process; ordinary media upload may still require authentication. `addImage` and `addVideo` accept resolution/autofill options; inspect the installed implementation before relying on these paths in production.

## Pick the right helper

- Use `sendText()` for ordinary text, light formatting, long-message splitting, and an easy-to-check result.
- Use `sendMessage()`/`sendMedia()` for Baileys content such as photos, audio, documents, locations, polls, reactions, and quotes.
- Use `sendTable`, `sendCodeBlock`, or `sendLink` only when the recipient supports rich layouts; provide a plain-text fallback.
- Use `AIRich` for structured content you have tested, not to impersonate another product.

## Interoperability and transparency

These rich responses use schemas associated with WhatsApp AI/GenAI replies and can appear as forwarded or assistant-style messages. Make it clear that a message comes from your bot; do not impersonate Meta AI, another business, or a human, and do not imply false verification or affiliation.

WhatsApp can change protobuf fields or feature flags without a library release. Test on the Android, iOS, and Desktop versions your users rely on, inspect returned `messageId`, keep a plain-text fallback, and never make an interactive layout the only way to complete a task.

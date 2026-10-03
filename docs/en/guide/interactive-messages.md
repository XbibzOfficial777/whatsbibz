---
title: Interactive messages
description: Send quick replies and selection lists, then handle button responses with extractMessage.
---

# Interactive messages

WhatsApp has multiple button and interactive payload formats. Support differs by app version, platform, and conversation type. Test using an account you control and provide a plain-text alternative because a server may reject a feature or a recipient client may not render it.

## Native Flow quick replies

For modern buttons, use `interactiveMessage` content with a `buttons` array. Each button uses a `name` plus JSON-encoded `buttonParamsJson`; IDs should be stable and unique within the menu so the application can map each response to an allowed action.

```js
const buttons = [
  { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Check status', id: 'status' }) },
  { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Help', id: 'help' }) },
];

await sock.sendMessage(jid, {
  interactiveMessage: {
    title: 'Choose one of the available options.',
    header: 'WhatsBibz menu',
    footer: 'Select an action',
    buttons,
  },
});
```

Internal payloads can change because they are defined by WhatsApp. Validate content against the installed `AnyMessageContent` type. Do not put secrets, tokens, or authorization decisions only in a button ID. A response from a recipient client remains untrusted input.

## Handle a response

`extractMessage(message)` normalizes Native Flow responses to `{ type: 'button', buttonId, buttonText }`. Legacy `buttonsResponseMessage`, `templateButtonReplyMessage`, list responses, and interactive responses are also handled to the extent supported by the implementation.

```js
const item = extractMessage(message);
if (item?.type !== 'button') return;

switch (item.buttonId) {
  case 'status':
    await sendText(sock, message.key.remoteJid, 'The status request was received.', { quoted: message });
    break;
  case 'help':
    await sendText(sock, message.key.remoteJid, 'Tell us what you need help with.', { quoted: message });
    break;
  default:
    // Ignore stale or unknown IDs; never execute button display text as a command.
    break;
}
```

If you need the raw Native Flow response, inspect `message.message?.interactiveResponseMessage?.nativeFlowResponseMessage`. `paramsJson` may be a JSON string; parse it in a `try/catch` and do not assume its structure or ID is valid. A list selection can arrive as `listResponseMessage.singleSelectReply.selectedRowId`.

## Available builders

`Button` builds Native Flow payloads with methods such as `addReply`, `addSelection`, `addUrl`, `addCopy`, and `addCall`. `ButtonV2` builds the older `buttonsMessage` format. `Carousel` assembles cards. The detailed constructors and methods are in `lib/Modded/message_builder.js`; the package's TypeScript declarations for these builders are minimal, so some values are typed as `any`.

A common builder pattern is:

```js
import { Button } from '@xbibzlibrary/whatsbibz';

const menu = new Button(sock)
  .text('Choose the next step')
  .addReply('Check status', 'status')
  .addReply('Help', 'help');

await menu.send(jid);
```

The builder forwards WhatsApp protocol formats that are not stable public APIs. If a method signature differs in your installed version, consult its `lib/Modded/message_builder.js` or use a payload supported by the socket type.

## Compatibility and safety

- Map only allow-listed `buttonId` values to actions; do not trust the display label.
- Check `message.key.remoteJid`, `participant`, account state, and authorization before changing data.
- Do not use buttons to disguise advertising, collect sensitive information, or trick recipients into consent.
- Native Flow may not be supported in some groups or clients; provide a text fallback.
- Legacy button format is not the preferred choice for new work; WhatsApp can change its behavior without notice.

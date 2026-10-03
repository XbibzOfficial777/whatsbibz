---
layout: home
hero:
  name: WhatsBibz
  text: WhatsApp Web client for Node.js
  tagline: Practical guides and detailed references for pairing, device identity, events, messages, sessions, and the Baileys-compatible API.
  image:
    src: /whatsbibz-mark.png
    alt: WhatsBibz symbol
  actions: []
features:
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 6v15M8 7h8M8 11h7"/></svg>'
    title: A guided first connection
    details: Install the ESM package, link a number with QR or a pairing code, then send a first message with a runnable example.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.9 7.5 9.5 4.4-1.6 7.5-5.1 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/></svg>'
    title: Understand connection behavior
    details: Learn pairing, automatic identity rotation, reconnects, session recovery, and which handlers must be attached again.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></svg>'
    title: Messages and interactions
    details: Reference text and media helpers, message extraction, native-flow buttons, rich messages, JIDs, mentions, and quoted replies.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4h10v16H7z"/><path d="M10 7h4M10 11h4M10 15h4"/><path d="M4 7v10M20 7v10"/></svg>'
    title: From high-level to low-level
    details: Use createBibzWhats for common bot workflows or drop down to makeWASocket when you need Baileys-level control.
---

## Documentation for real implementations

WhatsBibz is a multi-device WhatsApp Web library for Node.js, based on a maintained Baileys fork. This site expands the README into learning paths, operational guides, option references, examples, and troubleshooting. Use search to find an event, option, helper, or connection status.

<div class="ww-card-grid">
  <a class="ww-card" href="./guide/getting-started"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span class="ww-card-copy"><strong>Get started</strong><span>Requirements, ESM installation, QR or pairing, and the first connection check.</span></span></a>
  <a class="ww-card" href="./guide/device-identity"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M9 11h6M10 17h4"/></svg></span><span class="ww-card-copy"><strong>Device identity</strong><span>Understand auto mode, custom identities, environment-variable precedence, and identity.json.</span></span></a>
  <a class="ww-card" href="./guide/messages"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></svg></span><span class="ww-card-copy"><strong>Messages and events</strong><span>Attach listeners to the right socket, normalize updates, and handle messages safely.</span></span></a>
  <a class="ww-card" href="./reference/client-options"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--background)"/><circle cx="15" cy="12" r="2" fill="var(--background)"/><circle cx="7" cy="18" r="2" fill="var(--background)"/></svg></span><span class="ww-card-copy"><strong>Option reference</strong><span>Client defaults, events, helpers, pairing controller, and identity utilities.</span></span></a>
</div>

## Integration model

There are two API layers. Start with `createBibzWhats()` when you want the library to manage pairing, authentication, reconnects, and session recovery. Use `makeWASocket()` when your application needs to manage auth state and lifecycle itself. Both paths expose the same socket events and Baileys-style methods.

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: 'whatsbibz-session',
});

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const item = extractMessage(message);
      if (item?.type === 'text' && item.text.trim().toLowerCase() === 'ping') {
        await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
      }
    }
  });
});
```

Start with [installation and pairing](/en/guide/getting-started), then read the [client lifecycle](/en/guide/client-lifecycle) before running a long-lived bot. This example only handles a simple text command; review [session security](/en/guide/session-security) before storing credentials on a server.

## Choose a path

- **Link an account:** [Pairing and QR](/en/guide/pairing), [device identity](/en/guide/device-identity).
- **Handle messages:** [connection events](/en/guide/connection-events), [send and read messages](/en/guide/messages), [interactive messages](/en/guide/interactive-messages).
- **Operate safely:** [configuration](/en/guide/configuration), [sessions and security](/en/guide/session-security), [troubleshooting](/en/guide/troubleshooting).
- **Types and compatibility:** [TypeScript and migration](/en/guide/typescript-migration), [low-level API](/en/guide/low-level-api), [public exports](/en/reference/exports).

<div class="ww-note">
  <strong>Important</strong>
  <p>WhatsBibz is an unofficial client that communicates with WhatsApp Web. It is not the official WhatsApp Business Platform and cannot guarantee an account will avoid restrictions. Use an account you control, follow WhatsApp's terms, obtain recipients' consent, and do not send unsolicited bulk messages.</p>
</div>

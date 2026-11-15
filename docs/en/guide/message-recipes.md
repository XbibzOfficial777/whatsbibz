---
title: Message implementation recipes
description: Practical button, location, image, carousel, poll, contact, media, reaction and rich-message examples.
---

# Message implementation recipes

These recipes use an **authenticated, open socket** and a consenting test chat. Run each example from a `ready`/message handler; do not send the entire page at once. WhatsApp support varies by client, device and chat type.

::: warning Default account change and session privacy
WhatsBibz 2.0.0 attempts to follow `120363333911663927@newsletter` after authenticated open on every socket. Disable it with `socketConfig: { autoFollowChannel: false }` on `createBibzWhats()` or `autoFollowChannel: false` on `makeWASocket()`. Disabling does not undo an existing follow. Keep pairing codes and auth files private. `preserveSession: true` prevents recognized automatic auth wipes by the wrapper; explicit `logout()` still deletes auth, and WhatsApp can revoke a session.
:::

## Run the sample bot

The full [`example/message-recipes.js`](https://github.com/XbibzOfficial777/whatsbibz/blob/main/example/message-recipes.js) is in the repository, **not** in the npm tarball. From a checkout, use a patched Node version (for example 24.22.3 or later on 24.x):

```bash
npm ci
# Replace placeholders with actual digits; use a second account you control.
export WHATSAPP_PHONE='REPLACE_WITH_BOT_NUMBER'
export WHATSBIBZ_ALLOWED_JID='REPLACE_WITH_TEST_NUMBER@s.whatsapp.net'
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/test-account"
mkdir -p "$WHATSBIBZ_AUTH_DIR" && chmod 700 "$WHATSBIBZ_AUTH_DIR"
node example/message-recipes.js
```

Enter the terminal code in WhatsApp → **Linked devices → Link a device → Link with phone number**. Never share it. Send `!help` from the authorized second account; the example ignores `fromMe`. The allowed JID must match `message.key.remoteJid` exactly: it can be a PN (`…@s.whatsapp.net`) or an LID (`…@lid`). The sample accepts one private chat, not groups or broadcasts.

Put your own files in `example-media/`, or set `WHATSBIBZ_MEDIA_DIR`:

```text
example-media/
  gambar-1.jpg    # real JPEG
  gambar-2.jpg    # real JPEG for the second slide
  stiker.webp     # valid WebP sticker
  contoh.pdf      # PDF document
  suara.ogg       # Ogg containing Opus audio
  video.mp4       # compatible MP4 video
```

`CONTACT_PHONE` is optional and must contain the digits of a consenting contact. `sharp` can help generate image thumbnails; video thumbnails may require `fluent-ffmpeg` and an FFmpeg executable. Check sizes and formats for your recipients.

| Commands | Output |
|---|---|
| `!menu`, `!list`, `!link` | Quick replies, single-select list, URL/copy buttons |
| `!location`, `!image`, `!image-button`, `!slide` | Static location, image, image button, two-card carousel |
| `!poll`, `!contact`, `!reaction` | Poll, consented vCard, reaction to the command |
| `!sticker`, `!document`, `!audio`, `!video` | WebP, PDF, voice note, video from local files |
| `!rich`, `!help` | Bot-labelled rich table and command list |

For a project installed from npm, replace the sample's relative `../lib/index.js` import with `@xbibzlibrary/whatsbibz`. The sample reattaches its listener on each new socket and has bounded in-memory deduplication; production needs persistent deduplication, authorization and rate limits.

## Establish the context

```js
import { createBibzWhats, Button, Carousel, extractMessage } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: process.env.WHATSBIBZ_AUTH_DIR || './data/session',
  preserveSession: true,
  // socketConfig: { autoFollowChannel: false }, // optional opt-out
});
client.on('pairing-code', (code) => console.log('Enter the code in Linked devices:', code));
client.on('ready', (sock) => {
  // Attach your authorized message handler here.
});
```

Below, `sock` comes from `ready`, `jid` is an authorized destination, and `incoming` is an incoming `WAMessage` when quoting/reacting. Prefer a validated `incoming.key.remoteJid` rather than guessing a group/LID JID. Media snippets additionally import `readFile` from `node:fs/promises`.

## Quick-reply buttons

```js
const sent = await new Button(sock)
  .setBody('Choose an action:')
  .setFooter('Example bot')
  .addReply('Status', 'menu_status')
  .addReply('Help', 'menu_help')
  .send(jid);
console.log('Message ID:', sent.key?.id);
```

The IDs identify actions; they are not the button labels. A return from `send()` is not proof that a recipient saw or clicked a button. Provide a plain-text alternative.

### Selection, URL, and copy buttons

```js
await new Button(sock)
  .setBody('Choose a city:')
  .addSelection('Open list')
  .makeSection('Java')
  .makeRow('', 'Jakarta', 'Jakarta', 'city_jakarta')
  .makeRow('', 'Surabaya', 'East Java', 'city_surabaya')
  .send(jid);

await new Button(sock)
  .setBody('Example link and code')
  .addUrl('Open documentation', 'https://whatsbibz.xbibzclone.my.id/')
  .addCopy('Copy code', 'WHATS-BIBZ')
  .send(jid);
```

Call `addSelection()` and `makeSection()` before `makeRow(header, title, description, id)`. URL/copy actions may happen on the phone and are **not guaranteed** to generate a reply event. Do not place secrets in IDs; validate destinations and links.

### Handle replies

```js
const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID;
const answers = new Map([
  ['menu_status', 'The example bot is available.'],
  ['menu_help', 'How can I help?'],
  ['city_jakarta', 'You selected Jakarta.'],
  ['city_surabaya', 'You selected Surabaya.'],
  ['slide_one', 'You selected the first slide.'],
  ['slide_two', 'You selected the second slide.'],
]);

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', ({ messages = [], type }) => {
    if (type !== 'notify') return;
    for (const incoming of messages) {
      const jid = incoming.key?.remoteJid;
      if (!jid || jid !== allowedJid || incoming.key?.fromMe || !incoming.message) continue;
      const item = extractMessage(incoming);
      const answer = item?.type === 'button' ? answers.get(item.buttonId) : undefined;
      if (!answer) continue;
      void sock.sendMessage(jid, { text: answer }, { quoted: incoming })
        .catch((error) => console.error('Reply failed:', error.message));
    }
  });
});
```

`extractMessage()` normalizes supported native-flow, list and legacy replies to `type: 'button'`. Treat IDs as untrusted input, allow-list actions, and authorize the sender. For production, deduplicate and detach old listeners as in the full example.

## Image and image button

```js
import { readFile } from 'node:fs/promises';

const photo = await readFile('./example-media/gambar-1.jpg');
await sock.sendMessage(jid, { image: photo, mimetype: 'image/jpeg', caption: 'Example photo' });
await new Button(sock)
  .setBody('View the photo and choose an action:')
  .setImage(photo, { mimetype: 'image/jpeg' })
  .addReply('Details', 'image_detail')
  .send(jid);
```

Add `image_detail` to your reply allow-list. An image may also be `{ url: 'https://…' }`, but user-supplied URLs and redirects can target internal networks. Prefer trusted local `Buffer`s; validate sizes/content and restrict network egress if fetching URLs.

## Carousel / slides with per-card buttons

```js
import { readFile } from 'node:fs/promises';

const [first, second] = await Promise.all([
  readFile('./example-media/gambar-1.jpg'),
  readFile('./example-media/gambar-2.jpg'),
]);
const carousel = await new Carousel(sock)
  .setBody('Swipe through the options:')
  .setFooter('Example bot')
  .card((card) => card.image(first).title('Slide 1').text('First image').button('Choose 1', 'slide_one'))
  .card((card) => card.image(second).title('Slide 2').text('Second image').button('Choose 2', 'slide_two'))
  .send(jid);
console.log('Carousel ID:', carousel.key?.id);
```

Each card must have image/video media in its header; this `.card().image()` example uses JPEG buffers. Per-card buttons are quick replies. Carousel rendering varies: offer ordinary images/text as a fallback. A server ACK does not establish that a raw carousel click was received.

## Location

```js
await sock.sendMessage(jid, {
  location: {
    degreesLatitude: -6.175392,
    degreesLongitude: 106.827153,
    name: 'National Monument',
    address: 'Jakarta, Indonesia',
  },
});
```

Replace the coordinates with information you are authorized to share. Latitude ranges from −90 to 90 and longitude from −180 to 180. This is a static point, not live tracking.

## Poll, contact, reaction and quote

```js
await sock.sendMessage(jid, {
  poll: { name: 'Choose a drink', values: ['Coffee', 'Tea'], selectableCount: 1 },
});

const number = process.env.CONTACT_PHONE || ''; // consenting contact, digits only
if (!/^\d{8,15}$/.test(number)) throw new Error('CONTACT_PHONE must have 8–15 digits');
const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:Example contact\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
await sock.sendMessage(jid, {
  contacts: { displayName: 'Example contact', contacts: [{ displayName: 'Example contact', vcard }] },
});

// incoming is a WAMessage received in this same chat.
await sock.sendMessage(jid, { react: { text: '✅', key: incoming.key } });
await sock.sendMessage(jid, { text: 'Thank you!' }, { quoted: incoming });
```

`selectableCount: 1` allows one selection. Reading poll votes requires the corresponding update/decryption and stored poll message; sending the poll is not a vote event.

## Document, sticker, audio and video

```js
import { readFile } from 'node:fs/promises';

await sock.sendMessage(jid, {
  document: await readFile('./example-media/contoh.pdf'),
  mimetype: 'application/pdf', fileName: 'example.pdf', caption: 'Example document',
});
await sock.sendMessage(jid, { sticker: await readFile('./example-media/stiker.webp'), mimetype: 'image/webp' });
await sock.sendMessage(jid, {
  audio: await readFile('./example-media/suara.ogg'), mimetype: 'audio/ogg; codecs=opus', ptt: true,
});
await sock.sendMessage(jid, {
  video: await readFile('./example-media/video.mp4'), mimetype: 'video/mp4', caption: 'Example video',
});
```

File extensions and MIME labels do not transcode content. Supply valid PDF/WebP/Ogg-Opus/MP4. `ptt: true` requests a voice-note presentation. Delivery and thumbnails vary with media and clients.

## Rich table

```js
const result = await sock.sendTable(
  jid, 'Example bot prices', ['Item', 'Price'],
  [['Coffee', '18.000'], ['Tea', '12.000']], undefined,
  { headerText: 'Created by an example bot, not Meta AI.' },
);
console.log('Rich ID:', result.messageId);
```

See [rich messages](/en/guide/rich-messages) for lists, code, links and `AIRich`. These use internal WhatsApp/AI schemas; identify your bot and provide plain text. Eleven rich variants previously received server ACK, but their phone rendering has **not been confirmed**.

## Evidence and limits

One authorized account previously paired by phone; button, list, location, image, builder carousel, poll and several media sends received ACK, and the owner confirmed the earlier feature tests worked. Builder-slide clicks were observed. This does not guarantee support for all accounts, groups or clients; raw-carousel clicks were not observed. The new example here was tested offline with a mock socket, not sent live again. QR pairing, unfollow and rich visual rendering remain unverified live. API return, server ACK, delivery, read, phone rendering and a click are different outcomes.

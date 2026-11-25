import test from 'node:test';
import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import { generateWAMessageContent } from '../lib/index.js';
import { handleRecipeMessage } from '../example/message-recipes.js';

const JID = '12345678901@s.whatsapp.net'; // Synthetic example, never contacted.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAAln/9k=',
  'base64',
);
const inbound = (text, extra = {}) => ({
  key: { remoteJid: JID, id: 'example-inbound-id', fromMe: false, ...extra },
  message: { conversation: text },
});
const makeSocket = () => {
  const sent = [];
  const relayed = [];
  const uploads = [];
  const sock = {
    sendMessage: async (jid, content, options) => {
      sent.push({ jid, content, options });
      return { key: { remoteJid: jid, id: 'example-outbound-id' } };
    },
    relayMessage: async (jid, message, options) => {
      // Reject builder objects that cannot survive protobuf serialization.
      proto.Message.encode(proto.Message.fromObject(message)).finish();
      relayed.push({ jid, message, options });
      return options?.messageId;
    },
    waUploadToServer: async (stream, options) => {
      uploads.push(options);
      // Consume encrypted media like a real uploader, but do not contact a server.
      for await (const _ of stream) { /* intentionally empty */ }
      return { url: 'https://mmg.whatsapp.net/example', directPath: '/example' };
    },
    sendTable: async (...args) => { sent.push({ rich: 'table', args }); return { messageId: 'example-rich-id' }; },
  };
  return { sock, sent, relayed, uploads };
};
const opts = { allowedJid: JID, loadFile: async (name) => name.endsWith('.jpg') ? JPEG : Buffer.from('synthetic fixture') };

const buttonsFor = (entry) => entry.message.interactiveMessage.nativeFlowMessage.buttons;

test('example refuses other chats, own messages, unknown commands and unknown button IDs', async () => {
  const { sock, sent, relayed } = makeSocket();
  assert.equal(await handleRecipeMessage(sock, inbound('!menu'), {}), false);
  assert.equal(await handleRecipeMessage(sock, inbound('!menu', { remoteJid: '999@s.whatsapp.net' }), opts), false);
  assert.equal(await handleRecipeMessage(sock, inbound('!menu', { fromMe: true }), opts), false);
  assert.equal(await handleRecipeMessage(sock, inbound('unknown'), opts), false);
  const untrusted = { ...inbound(''), message: { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: '{"id":"unknown"}' } } } };
  assert.equal(await handleRecipeMessage(sock, untrusted, opts), false);
  assert.equal(sent.length + relayed.length, 0);
});

test('example builds quick replies, a selection list, URL and copy buttons', async () => {
  const { sock, relayed } = makeSocket();
  for (const cmd of ['!menu', '!list', '!link']) assert.equal(await handleRecipeMessage(sock, inbound(cmd), opts), true);
  assert.deepEqual(buttonsFor(relayed[0]).map((b) => b.name), ['quick_reply', 'quick_reply']);
  assert.deepEqual(buttonsFor(relayed[0]).map((b) => JSON.parse(b.buttonParamsJson).id), ['menu_status', 'menu_help']);
  const list = buttonsFor(relayed[1])[0];
  assert.equal(list.name, 'single_select');
  assert.deepEqual(JSON.parse(list.buttonParamsJson).sections[0].rows.map((r) => r.id), ['city_jakarta', 'city_surabaya']);
  assert.deepEqual(buttonsFor(relayed[2]).map((b) => b.name), ['cta_url', 'cta_copy']);
});

test('example sends an image button and two carousel cards with their own IDs', async () => {
  const { sock, relayed, uploads } = makeSocket();
  await handleRecipeMessage(sock, inbound('!image-button'), opts);
  await handleRecipeMessage(sock, inbound('!slide'), opts);
  assert.equal(JSON.parse(buttonsFor(relayed[0])[0].buttonParamsJson).id, 'image_detail');
  const cards = relayed[1].message.interactiveMessage.carouselMessage.cards;
  assert.equal(cards.length, 2);
  assert.ok(cards.every((card) => card.header.hasMediaAttachment));
  assert.deepEqual(cards.map((card) => JSON.parse(card.nativeFlowMessage.buttons[0].buttonParamsJson).id), ['slide_one', 'slide_two']);
  assert.equal(uploads.length, 3);
});

test('example handles a known button ID and quotes the received message', async () => {
  const { sock, sent } = makeSocket();
  const msg = { ...inbound(''), message: { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: '{"id":"slide_two"}' } } } };
  assert.equal(await handleRecipeMessage(sock, msg, opts), true);
  assert.equal(sent[0].content.text, 'Anda memilih slide kedua.');
  assert.equal(sent[0].options.quoted, msg);
});

test('example sends location, poll, contact and reaction payloads that encode as protobuf', async () => {
  const { sock, sent } = makeSocket();
  for (const cmd of ['!location', '!poll', '!contact', '!reaction']) {
    await handleRecipeMessage(sock, inbound(cmd), { ...opts, contactPhone: '12345678901' });
  }
  assert.equal(sent[0].content.location.name, 'Monumen Nasional');
  assert.equal(sent[1].content.poll.selectableCount, 1);
  assert.match(sent[2].content.contacts.contacts[0].vcard, /^BEGIN:VCARD/m);
  assert.equal(sent[3].content.react.key.id, 'example-inbound-id');
  for (const entry of sent) {
    const content = await generateWAMessageContent(entry.content, { userJid: JID });
    assert.ok(proto.Message.encode(proto.Message.fromObject(content)).finish().length > 0);
  }
});

test('example image content is prepared and encoded without a network connection', async () => {
  const { sock, sent, uploads } = makeSocket();
  await handleRecipeMessage(sock, inbound('!image'), opts);
  const message = await generateWAMessageContent(sent[0].content, { upload: sock.waUploadToServer });
  assert.equal(message.imageMessage.mimetype, 'image/jpeg');
  assert.ok(proto.Message.encode(proto.Message.fromObject(message)).finish().length > 0);
  assert.equal(uploads.length, 1);
});

test('sound-sticker commands require a replied video and refuse view-once or concurrent requests', async (t) => {
  const { sock, sent, relayed } = makeSocket();
  t.mock.method(console, 'error', () => {}); // The production example logs only a safe error code.
  await handleRecipeMessage(sock, inbound('!soundsticker'), opts);
  assert.match(sent[0].content.text, /Balas video MP4/);
  const viewOnce = { ...inbound(''), message: { extendedTextMessage: { text: '.sa', contextInfo: {
    stanzaId: 'video-id', quotedMessage: { viewOnceMessageV2: { message: { videoMessage: {} } } },
  } } } };
  await handleRecipeMessage(sock, viewOnce, opts);
  assert.match(sent[1].content.text, /sekali lihat/);
  await handleRecipeMessage(sock, inbound('!sticker-audio'), { ...opts, soundStickerState: { busy: true } });
  assert.match(sent[2].content.text, /masih memproses/);
  assert.equal(relayed.length, 0);
});

test('example requires an explicit contact number and supplies media content types', async () => {
  const { sock, sent } = makeSocket();
  for (const cmd of ['!contact', '!image', '!sticker', '!document', '!audio', '!video', '!rich', '!help']) {
    await handleRecipeMessage(sock, inbound(cmd), opts);
  }
  assert.match(sent[0].content.text, /CONTACT_PHONE/);
  assert.ok(Buffer.isBuffer(sent[1].content.image));
  assert.equal(sent[1].content.mimetype, 'image/jpeg');
  assert.equal(sent[2].content.mimetype, 'image/webp');
  assert.equal(sent[3].content.mimetype, 'application/pdf');
  assert.equal(sent[4].content.ptt, true);
  assert.equal(sent[4].content.mimetype, 'audio/ogg; codecs=opus');
  assert.equal(sent[5].content.mimetype, 'video/mp4');
  assert.equal(sent[6].rich, 'table');
  assert.match(sent[7].content.text, /!slide/);
});

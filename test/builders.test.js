// BibzWhats — regresi builder pesan interaktif (Button / Carousel / ButtonV2).
// Mengunci dua bug yang pernah ada di lib/Modded/message_builder.js:
//   • Button.build() memakai variabel `message` yang tak pernah didefinisikan
//     → ReferenceError setiap kali mengirim tombol Native Flow.
//   • Carousel.card(cb) mengumpulkan builder kartu di _cardBuilders tetapi
//     Carousel.build() tidak pernah mengonsumsinya → carousel terkirim kosong.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proto } from '../WAProto/index.js';
import { Button, ButtonV2, Carousel } from '../lib/index.js';

const JID = '6281234567890@s.whatsapp.net';

// PNG 1×1 (buffer media lokal — tanpa fetch jaringan saat upload).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const makeClient = () => {
  const sent = [];
  const client = {
    uploads: 0,
    waUploadToServer: async () => {
      client.uploads += 1;
      return { url: 'https://mmg.whatsapp.net/fake', directPath: '/fake' };
    },
    relayMessage: async (jid, message, options) => {
      sent.push({ jid, message, options });
      return options?.messageId;
    },
  };
  return { client, sent };
};

const encodeMessage = (message) => {
  // Pastikan payload benar-benar bisa di-encode sebagai proto.Message
  // (menangkap bentuk objek yang salah secara runtime).
  const bytes = proto.Message.encode(proto.Message.fromObject(message)).finish();
  return proto.Message.decode(bytes);
};

test('Button.build(): tombol quick_reply menghasilkan interactiveMessage.nativeFlowMessage', async () => {
  const { client } = makeClient();
  const button = new Button(client).setBody('Pilih:').setFooter('Footer').addReply('Makanan', 'food');
  const msg = await button.build(JID);

  const interactive = msg?.message?.interactiveMessage;
  assert.ok(interactive, 'message harus berisi interactiveMessage');
  assert.equal(interactive.body.text, 'Pilih:');
  assert.equal(interactive.footer.text, 'Footer');
  assert.equal(interactive.nativeFlowMessage.buttons.length, 1);
  assert.equal(interactive.nativeFlowMessage.buttons[0].name, 'quick_reply');
  assert.deepEqual(JSON.parse(interactive.nativeFlowMessage.buttons[0].buttonParamsJson), {
    display_text: 'Makanan',
    id: 'food',
  });
  // bentuk harus valid secara proto
  const decoded = encodeMessage(msg.message);
  assert.ok(decoded.interactiveMessage?.nativeFlowMessage?.buttons?.length === 1);
});

test('Button.send(): me-relay konten interactive ke jid tujuan', async () => {
  const { client, sent } = makeClient();
  const button = new Button(client).setBody('Pilih:').addReply('Ya', 'yes').addReply('Tidak', 'no');
  const msg = await button.send(JID);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].jid, JID);
  assert.equal(sent[0].options.messageId, msg.key.id);
  assert.ok(sent[0].message.interactiveMessage.nativeFlowMessage.buttons.length === 2);
});

test('Button single_select: section + row tersimpan dalam buttonParamsJson', async () => {
  const { client } = makeClient();
  const button = new Button(client)
    .setBody('Pilih kota:')
    .addSelection('Kota')
    .makeSection('Pulau Jawa')
    .makeRow('', 'Jakarta', 'DKI Jakarta', 'jkt')
    .makeRow('', 'Bandung', 'Jawa Barat', 'bdg');
  const msg = await button.build(JID);
  const buttons = msg.message.interactiveMessage.nativeFlowMessage.buttons;
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].name, 'single_select');
  const params = JSON.parse(buttons[0].buttonParamsJson);
  assert.equal(params.sections.length, 1);
  assert.equal(params.sections[0].rows.length, 2);
  assert.equal(params.sections[0].rows[0].title, 'Jakarta');
});

test('Carousel.card(): builder kartu ikut terkirim (regresi 0 kartu)', async () => {
  const { client, sent } = makeClient();
  const carousel = new Carousel(client)
    .setBody('Pilih produk:')
    .card((c) => c.image(PNG).title('A').text('Deskripsi A').button('Beli', 'a'))
    .card((c) => c.image(PNG).title('B').text('Deskripsi B').button('Beli', 'b'));

  const msg = await carousel.send(JID);
  const cards = msg?.message?.interactiveMessage?.carouselMessage?.cards;
  assert.equal(cards.length, 2, 'dua kartu harus masuk payload carousel');
  assert.equal(client.uploads, 2, 'tiap kartu dengan media di-upload sekali');
  // pastikan tiap kartu membawa nativeFlowMessage tombolnya
  assert.equal(cards[0].nativeFlowMessage.buttons.length, 1);
  assert.equal(cards[1].header.hasMediaAttachment, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].message.interactiveMessage.carouselMessage.cards.length, 2);
  // encode penuh ke proto
  const decoded = encodeMessage(msg.message);
  assert.equal(decoded.interactiveMessage?.carouselMessage?.cards?.length, 2);
});

test('Carousel.addCard(): kartu tanpa media ditolak (syarat WA)', async () => {
  const { client } = makeClient();
  const carousel = new Carousel(client);
  const bare = await new Button(client).setBody('tanpa media').toCard();
  assert.throws(() => carousel.addCard(bare), /hasMediaAttachment|image|video/i);
});

test('Button.send()/Carousel.send(): menolak payload kosong yang pasti ditolak WA', async () => {
  const { client } = makeClient();
  await assert.rejects(() => new Button(client).setBody('tanpa tombol').send(JID), /at least one button/i);
  await assert.rejects(() => new Carousel(client).setBody('tanpa kartu').send(JID), /at least one card/i);
});

test('ButtonV2(): tetap bisa build & send (format lama buttonsMessage)', async () => {
  const { client, sent } = makeClient();
  const v2 = new ButtonV2(client).text('Pertanyaan').addButton('Ya', 'y').addButton('Tidak', 'n');
  const msg = await v2.send(JID);
  assert.ok(msg.message.buttonsMessage);
  assert.equal(msg.message.buttonsMessage.buttons.length, 2);
  assert.equal(sent.length, 1);
  // gagal bila tidak ada satu tombol pun
  const empty = new ButtonV2(client).text('kosong');
  await assert.rejects(() => empty.send(JID), /at least one button/i);
});

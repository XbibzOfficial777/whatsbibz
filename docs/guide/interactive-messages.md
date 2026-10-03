---
title: Pesan interaktif
description: Kirim tombol quick reply, daftar pilihan, dan tangani respons tombol melalui extractMessage.
---

# Pesan interaktif

WhatsApp memiliki beberapa bentuk tombol dan payload interaktif. Dukungan berbeda menurut versi aplikasi, platform, dan jenis percakapan. Uji pada akun uji yang Anda kendalikan; sediakan jalur teks biasa karena server dapat menolak atau klien penerima tidak menampilkan suatu jenis pesan.

## Native Flow quick reply

Untuk tombol modern, gunakan content `interactiveMessage` dengan `nativeFlowMessage`. `buttonParamsJson` adalah JSON terserialisasi; ID harus stabil dan unik di dalam menu agar aplikasi dapat memetakan respons ke tindakan.

```js
const buttons = [
  { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Lihat status', id: 'status' }) },
  { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Bantuan', id: 'help' }) },
];

await sock.sendMessage(jid, {
  interactiveMessage: {
    title: 'Pilih salah satu opsi yang tersedia.',
    header: 'Menu WhatsBibz',
    footer: 'Pilih tindakan',
    buttons,
  },
});
```

Payload internal dapat berubah karena formatnya berasal dari WhatsApp. Validasi content sesuai tipe `AnyMessageContent` paket; jangan menaruh rahasia, token, atau otorisasi hanya di ID tombol. Respons dari klien tetap masukan yang tidak tepercaya.

## Tangani respons

`extractMessage(message)` menormalkan respons Native Flow menjadi `{ type: 'button', buttonId, buttonText }`. Respons legacy `buttonsResponseMessage`, `templateButtonReplyMessage`, list response, dan interactive response juga ditangani sejauh yang dideklarasikan implementasi.

```js
const item = extractMessage(message);
if (item?.type !== 'button') return;

switch (item.buttonId) {
  case 'status':
    await sendText(sock, message.key.remoteJid, 'Permintaan status diterima.', { quoted: message });
    break;
  case 'help':
    await sendText(sock, message.key.remoteJid, 'Silakan jelaskan hal yang ingin dibantu.', { quoted: message });
    break;
  default:
    // Abaikan ID lama atau tidak dikenal; jangan mengeksekusi teks tombol sebagai perintah.
    break;
}
```

Jika butuh data native mentah, baca `message.message?.interactiveResponseMessage?.nativeFlowResponseMessage`. `paramsJson` dapat berupa string JSON dan harus diparse dalam `try/catch`; jangan menganggap struktur atau isi ID selalu valid. Interaksi list dapat menghasilkan `listResponseMessage.singleSelectReply.selectedRowId`.

## Builder yang tersedia

`Button` membuat payload native-flow dengan method seperti `addReply`, `addSelection`, `addUrl`, `addCopy`, dan `addCall`. `ButtonV2` adalah builder untuk format `buttonsMessage` yang lebih lama. `Carousel` menyusun kartu. Bentuk konstruktor dan method terperinci tersedia di modul `lib/Modded/message_builder.js`; deklarasi TypeScript paket untuk builder ini minimal, jadi parameter builder dapat bertipe `any`.

Contoh pola builder yang umum:

```js
import { Button } from '@xbibzlibrary/whatsbibz';

const menu = new Button(sock)
  .text('Pilih langkah selanjutnya')
  .addReply('Periksa status', 'status')
  .addReply('Bantuan', 'help');

await menu.send(jid);
```

Builder meneruskan protokol WhatsApp yang bukan API publik stabil. Jika signature aktual berbeda pada versi terpasang, lihat method pada `lib/Modded/message_builder.js` paket tersebut atau gunakan bentuk payload yang sesuai tipe socket.

## Batas keamanan dan kompatibilitas

- Cocokkan tindakan dengan `buttonId` allow-list, bukan label yang terlihat.
- Periksa `message.key.remoteJid`, `participant`, status akun, dan izin sebelum menjalankan perubahan.
- Jangan gunakan tombol untuk menyamarkan iklan, mengumpulkan informasi sensitif, atau membuat penerima tanpa sadar memberi persetujuan.
- Tombol Native Flow dapat tidak didukung di grup atau klien tertentu; siapkan instruksi teks alternatif.
- Format tombol legacy tidak menjadi pilihan utama untuk proyek baru; WhatsApp dapat mengubah dukungannya tanpa pemberitahuan.

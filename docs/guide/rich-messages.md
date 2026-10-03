---
title: Rich message dan socket helper
description: Gunakan tabel, daftar, blok kode, link preview, dan builder AIRich yang ditambahkan WhatsBibz.
---

# Rich message dan socket helper

Selain helper inti, socket WhatsBibz menyediakan metode tambahan untuk mengirim tabel, daftar, blok kode, link, dan rich response. Metode ini dirangkai pada `WASocket` dan meneruskan protokol pesan internal WhatsApp; kompatibilitas tampilan bergantung pada aplikasi penerima.

## Tabel, daftar, kode, dan tautan

```js
// Tabel: judul, header kolom, baris, pesan kutipan (opsional), opsi
const tableResult = await sock.sendTable(
  jid,
  'Daftar harga',
  ['Item', 'Harga'],
  [['Kopi', 'Rp18.000'], ['Teh', 'Rp12.000']],
  incomingMessage,
  { footer: 'Harga diperbarui hari ini' },
);

// Blok kode: teks, pesan kutipan (opsional), opsi
await sock.sendCodeBlock(jid, 'const answer = 42;\nconsole.log(answer);', incomingMessage, {
  language: 'javascript',
  title: 'Contoh JavaScript',
});

// Link: teks pembuka, URL atau objek { displayName, url }, kutipan (opsional)
await sock.sendLink(jid, 'Dokumentasi resmi:', [
  { displayName: 'Node.js', url: 'https://nodejs.org/docs/latest/api/' },
  'https://github.com/XbibzOfficial777/whatsbibz',
], incomingMessage);
```

`sendTable`, `sendCodeBlock`, dan `sendLink` mengembalikan `{ message, messageId }` setelah relay. Bentuk opsi khusus (judul, footer, format) dapat dilihat pada source `lib/Utils/rich-messages.js` dan implementasi `lib/Socket/messages-send.js` dari versi yang diinstal. `sendTableV2`, `sendList`, `sendCodeBlockV2`, dan `sendLinkV2` menyediakan format alternatif. Karena isi protokol internal, tidak semua klien akan menampilkannya sama.

## Rich message gabungan

```js
import { AIRich } from '@xbibzlibrary/whatsbibz';

const report = new AIRich(sock)
  .addText('Ringkasan operasional untuk hari ini.')
  .addTable([
    ['Area', 'Status'],
    ['API', 'Normal'],
    ['Antrian', 'Diperiksa'],
  ])
  .addCode('javascript', 'const status = "normal";')
  .addSuggest(['Buka detail status', 'Lihat panduan pemulihan']);

await report.send(jid, {
  forwarded: true,
  includesUnifiedResponse: true,
  includesSubmessages: true,
});
```

`AIRich` menyediakan method berantai seperti `addText`, `addTable`, `addCode`, `addSource`, `addImage`, `addVideo`, `addProduct`, `addPost`, `addReels`, `addTip`, `addSuggest`, `addSubmessage`, dan `addSection`. `send(jid, options)` mendukung `forwarded`, `notification`, `includesUnifiedResponse`, dan `includesSubmessages`; default-nya true kecuali `notification` false. `ORich` adalah subclass/alias gaya kompatibilitas. Beberapa metode menghasilkan struktur yang menyerupai rich answer internal WhatsApp, bukan format publik yang stabil.

Untuk media pada rich message, Anda tetap harus menyediakan URL atau content yang dapat diproses oleh method; pengiriman media biasa mungkin memerlukan upload/auth. Opsi untuk `addImage`/`addVideo` mencakup perilaku resolusi URL dan autofill; baca implementasi paket sebelum mengandalkan format produksi.

## Pilih helper yang tepat

- Gunakan `sendText()` untuk teks sederhana, format ringan, pemecahan pesan panjang, dan hasil status yang mudah dicek.
- Gunakan `sendMessage()`/`sendMedia()` untuk content Baileys seperti foto, audio, dokumen, lokasi, polling, reaksi, dan pesan kutipan.
- Gunakan `sendTable`, `sendCodeBlock`, atau `sendLink` hanya jika penerima mendukung rich layout; sediakan fallback teks biasa.
- Gunakan `AIRich` untuk pengalaman terstruktur yang Anda uji, bukan untuk meniru identitas produk lain.

## Perhatian interoperabilitas dan transparansi

Rich messages ini memakai schema yang digunakan WhatsApp untuk balasan AI/GenAI dan dapat tampak sebagai pesan yang diteruskan atau respons asisten. Tampilkan dengan transparan bahwa pesan dibuat oleh bot Anda; jangan menyaru sebagai Meta AI, bisnis lain, atau manusia. Jangan menyematkan klaim verifikasi/afiliasi palsu.

WhatsApp dapat mengubah field protobuf atau menolak feature flag tanpa versi baru library. Uji di versi Android/iOS/Desktop yang dipakai pelanggan, perhatikan hasil `messageId`, cek fallback plain text, dan jangan menjadikan tampilan interaktif satu-satunya cara pengguna menyelesaikan tugas.

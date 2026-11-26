---
title: Resep implementasi pesan
description: Contoh kode tombol, gambar, lokasi, carousel/slide, polling, kontak, audio, video, dokumen, stiker, reaksi, dan bot yang dapat dijalankan.
---

# Resep implementasi pesan

Panduan ini menunjukkan cara menggunakan `Button`, `Carousel`, dan `sock.sendMessage()` untuk pesan yang sering dipakai bot. Contoh memakai ESM, socket yang **sudah terhubung**, serta chat uji yang pemiliknya memberi izin. Contoh JavaScript di bawah adalah resep terpisah; jalankan dari handler `ready`/pesan, **bukan semuanya sekaligus**.

::: warning Efek bawaan dan sesi
Setiap socket WhatsBibz 2.1.x mencoba mengikuti `120363333911663927@newsletter` setelah koneksi terautentikasi terbuka. Untuk mematikannya, atur `socketConfig: { autoFollowChannel: false }` pada `createBibzWhats()` atau `autoFollowChannel: false` pada `makeWASocket()`. Ini tidak membatalkan follow yang sudah ada. Simpan file auth dan kode pairing secara privat; `preserveSession: true` mencegah penghapusan otomatis oleh wrapper pada error sesi yang dikenali, tetapi `logout()` tetap menghapus sesi dan WhatsApp dapat mencabutnya.
:::

## Jalankan bot contoh

File lengkap [`example/message-recipes.js`](https://github.com/XbibzOfficial777/whatsbibz/blob/main/example/message-recipes.js) tersedia di repositori, **bukan** di tarball npm. Dari checkout repositori, gunakan Node yang telah ditambal (misalnya 24.22.3 atau lebih baru pada jalur 24.x):

```bash
npm ci
# Ganti dengan digit sebenarnya. Gunakan akun uji lain yang Anda kendalikan.
export WHATSAPP_PHONE='GANTI_DIGIT_NOMOR_BOT'
export WHATSBIBZ_ALLOWED_JID='GANTI_DIGIT_AKUN_UJI@s.whatsapp.net'
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/akun-uji"
mkdir -p "$WHATSBIBZ_AUTH_DIR" && chmod 700 "$WHATSBIBZ_AUTH_DIR"
node example/message-recipes.js
```

Masukkan kode yang muncul di terminal melalui WhatsApp → **Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon**. Jangan membagikan kode tersebut. Kirim `!help` dari akun uji yang diizinkan; secara bawaan contoh mengabaikan pesan `fromMe`. `WHATSBIBZ_ALLOWED_JID` harus cocok dengan JID chat PN (`…@s.whatsapp.net`) **atau** LID (`…@lid`) yang diterima. Jangan mengasumsikan nomor sama dengan LID. Contoh membatasi ke satu chat pribadi, bukan grup atau broadcast. Untuk menguji chat sendiri secara opt-in, lihat [panduan stiker bersuara](/guide/sound-sticker).

Buat folder `example-media` di direktori kerja dan isi **file milik Anda sendiri**. Perintah lain tetap bisa dipakai tanpa file media:

```text
example-media/
  gambar-1.jpg    # JPEG asli
  gambar-2.jpg    # JPEG asli untuk slide kedua
  stiker.webp     # WebP yang sesuai untuk stiker
  contoh.pdf      # dokumen PDF
  suara.ogg       # Ogg berisi audio Opus untuk voice note
  video.mp4       # video MP4 yang kompatibel
```

Gunakan `WHATSBIBZ_MEDIA_DIR` untuk memilih folder lain. `CONTACT_PHONE` opsional, berisi digit nomor kontak yang menyetujui; tanpa itu `!contact` hanya memberi petunjuk. Paket opsional `sharp` dapat membantu membuat thumbnail gambar; thumbnail video builder lama dapat memerlukan `fluent-ffmpeg` (sudah tidak dipelihara) dan executable FFmpeg; batasi media tepercaya dan isolasi proses. Sesuaikan ukuran dan format media dengan klien penerima.

| Perintah | Yang dikirim |
|---|---|
| `!menu`, `!list`, `!link` | Quick reply, daftar pilihan, tombol URL dan salin |
| `!location`, `!image`, `!image-button`, `!slide` | Lokasi contoh, foto, foto+tombol, carousel dua kartu |
| `!poll`, `!contact`, `!reaction` | Polling, vCard yang disetujui, reaksi pada pesan perintah |
| `!sticker`, `!document`, `!audio`, `!video` | Stiker, PDF, voice note, video dari file lokal |
| `.sa`, `!soundsticker`, `!sticker-audio` | Balasan video menjadi satu [stiker bersuara eksperimental](/guide/sound-sticker); memerlukan FFmpeg; helper sejak 2.1.0, audio hingga 10 menit pada 2.1.1, contoh bot pada repository |
| `!rich`, `!help` | Tabel rich berlabel bot; daftar perintah |

Saat menyalin contoh ke proyek npm sendiri, ganti import relatif `../lib/index.js` menjadi `@xbibzlibrary/whatsbibz`. `ready` dipancarkan lagi pada socket baru setelah reconnect secara default; pasang handler pada socket terbaru. Contoh lengkap melepas listener socket sebelumnya dan melakukan deduplikasi terbatas dalam memori. Di produksi gunakan deduplikasi persisten, otorisasi dan rate limiting.

## Siapkan socket dan JID untuk resep

```js
import { createBibzWhats, Button, Carousel, extractMessage } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE, // digit dengan kode negara
  authDir: process.env.WHATSBIBZ_AUTH_DIR || './data/session',
  preserveSession: true,
  // socketConfig: { autoFollowChannel: false }, // opsional: matikan auto-follow
});
client.on('pairing-code', (code) => console.log('Masukkan kode di perangkat tertaut:', code));
client.on('ready', (sock) => {
  // Pasang handler di sini. Gunakan JID chat yang telah mengizinkan pengiriman.
});
```

Pada resep berikut, `sock` adalah socket dari event `ready`, `jid` adalah JID tujuan yang sah, dan `incoming` adalah pesan masuk bila ingin mengutip atau mereaksinya. Gunakan `incoming.key.remoteJid` dari event dan validasi izin, bukan menebak JID grup/LID. Snippet media juga memerlukan `import { readFile } from 'node:fs/promises'`.

## Tombol balas / quick reply

```js
const sent = await new Button(sock)
  .setBody('Pilih layanan:')
  .setFooter('Bot contoh')
  .addReply('Status', 'menu_status')
  .addReply('Bantuan', 'menu_help')
  .send(jid);
console.log('ID pesan:', sent.key?.id);
```

ID seperti `menu_status` adalah nilai yang ditangani aplikasi, bukan label tombol. `Button.send()` menghasilkan pesan dan me-relay-nya; ini bukan bukti tombol ditampilkan atau diklik. Sediakan fallback teks untuk klien yang tidak mendukungnya.

### Daftar pilihan, URL, dan salin

```js
await new Button(sock)
  .setBody('Pilih kota:')
  .addSelection('Buka daftar')
  .makeSection('Pulau Jawa')
  .makeRow('', 'Jakarta', 'DKI Jakarta', 'city_jakarta')
  .makeRow('', 'Surabaya', 'Jawa Timur', 'city_surabaya')
  .send(jid);

await new Button(sock)
  .setBody('Tautan dan kode contoh')
  .addUrl('Lihat dokumentasi', 'https://whatsbibz.xbibzclone.my.id/')
  .addCopy('Salin kode', 'WHATS-BIBZ')
  .send(jid);
```

Panggil `addSelection()` lalu `makeSection()` sebelum `makeRow(header, title, description, id)`. Aksi URL/salin dapat terjadi di klien dan **tidak dijamin** menghasilkan pesan balik ke bot. Validasi URL dan jangan memasukkan token atau data privat ke ID tombol.

### Menangani klik tombol dan pilihan

```js
const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID;
const answers = new Map([
  ['menu_status', 'Bot contoh aktif.'],
  ['menu_help', 'Kirim pertanyaan Anda.'],
  ['city_jakarta', 'Anda memilih Jakarta.'],
  ['city_surabaya', 'Anda memilih Surabaya.'],
  ['slide_one', 'Anda memilih slide pertama.'],
  ['slide_two', 'Anda memilih slide kedua.'],
]);

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', ({ messages = [], type }) => {
    if (type !== 'notify') return;
    for (const incoming of messages) {
      const jid = incoming.key?.remoteJid;
      if (!jid || jid !== allowedJid || incoming.key?.fromMe || !incoming.message) continue;
      const item = extractMessage(incoming);
      const answer = item?.type === 'button' ? answers.get(item.buttonId) : undefined;
      if (!answer) continue; // Abaikan ID asing atau lama.
      void sock.sendMessage(jid, { text: answer }, { quoted: incoming })
        .catch((error) => console.error('Balasan gagal:', error.message));
    }
  });
});
```

`extractMessage()` dapat menormalkan balasan native-flow, list dan tombol legacy menjadi `type: 'button'`. Isi dan ID respons tetap input tak tepercaya: cocokkan ke allow-list, periksa otorisasi, dan jangan menjalankan ID sebagai perintah shell/SQL. Handler di atas bersifat minimal; pada produksi tambahkan deduplikasi dan lepaskan listener lama seperti di file contoh.

## Gambar dan gambar dengan tombol

```js
import { readFile } from 'node:fs/promises';

const photo = await readFile('./example-media/gambar-1.jpg'); // JPEG milik operator
await sock.sendMessage(jid, {
  image: photo,
  mimetype: 'image/jpeg',
  caption: 'Foto contoh',
});

await new Button(sock)
  .setBody('Lihat foto dan pilih tindakan:')
  .setImage(photo, { mimetype: 'image/jpeg' })
  .addReply('Lihat detail', 'image_detail')
  .send(jid);
```

Tambahkan `image_detail` ke allow-list respons Anda. `image` juga dapat berupa `{ url: 'https://…' }`, tetapi URL dari pesan pengguna dapat mengarah ke jaringan internal atau redirect berbahaya. Lebih aman gunakan `Buffer` dari file tepercaya, validasi ukuran dan isi, serta batasi egress bila aplikasi harus mengambil URL.

## Slide / carousel dengan tombol pada setiap gambar

```js
import { readFile } from 'node:fs/promises';

const [first, second] = await Promise.all([
  readFile('./example-media/gambar-1.jpg'),
  readFile('./example-media/gambar-2.jpg'),
]);
const carousel = await new Carousel(sock)
  .setBody('Geser untuk melihat pilihan:')
  .setFooter('Bot contoh')
  .card((card) => card.image(first).title('Slide 1').text('Gambar pertama').button('Pilih 1', 'slide_one'))
  .card((card) => card.image(second).title('Slide 2').text('Gambar kedua').button('Pilih 2', 'slide_two'))
  .send(jid);
console.log('ID carousel:', carousel.key?.id);
```

Setiap kartu builder harus mempunyai gambar/video di header; contoh `.card().image()` memakai `Buffer` JPEG. Tombol per kartu adalah quick reply: cocokkan ID-nya pada handler di atas. Tampilan carousel berbeda menurut perangkat/versi WhatsApp; siapkan gambar dan teks biasa sebagai alternatif. Jangan menganggap raw carousel atau semua tipe klik teruji hanya karena server memberi ACK.

## Lokasi

```js
await sock.sendMessage(jid, {
  location: {
    degreesLatitude: -6.175392,
    degreesLongitude: 106.827153,
    name: 'Monumen Nasional',
    address: 'Jakarta, Indonesia',
  },
});
```

Ganti dengan koordinat yang benar dan dibagikan secara sah. `degreesLatitude` adalah lintang (−90…90) dan `degreesLongitude` bujur (−180…180). Ini mengirim titik statis; bukan pelacakan lokasi langsung.

## Polling, kontak, reaksi, dan kutipan

```js
await sock.sendMessage(jid, {
  poll: { name: 'Pilih minuman', values: ['Kopi', 'Teh'], selectableCount: 1 },
});

// Contoh vCard: set CONTACT_PHONE ke digit nomor yang menyetujui pembagian.
const number = process.env.CONTACT_PHONE || '';
if (!/^\d{8,15}$/.test(number)) throw new Error('CONTACT_PHONE harus 8–15 digit');
const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:Kontak contoh\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
await sock.sendMessage(jid, {
  contacts: { displayName: 'Kontak contoh', contacts: [{ displayName: 'Kontak contoh', vcard }] },
});

// incoming adalah WAMessage dari messages.upsert pada chat yang sama.
await sock.sendMessage(jid, { react: { text: '✅', key: incoming.key } });
await sock.sendMessage(jid, { text: 'Terima kasih!' }, { quoted: incoming });
```

`selectableCount: 1` berarti satu pilihan; menangani suara polling memerlukan update/dekripsi yang sesuai dan penyimpanan pesan polling, bukan sekadar menganggap `sendMessage()` sebagai suara masuk.

## Dokumen, stiker, audio, dan video

```js
import { readFile } from 'node:fs/promises';

await sock.sendMessage(jid, {
  document: await readFile('./example-media/contoh.pdf'),
  mimetype: 'application/pdf', fileName: 'contoh.pdf', caption: 'Dokumen contoh',
});
await sock.sendMessage(jid, {
  sticker: await readFile('./example-media/stiker.webp'), mimetype: 'image/webp',
});
await sock.sendMessage(jid, {
  audio: await readFile('./example-media/suara.ogg'),
  mimetype: 'audio/ogg; codecs=opus', ptt: true, // false untuk audio biasa
});
await sock.sendMessage(jid, {
  video: await readFile('./example-media/video.mp4'),
  mimetype: 'video/mp4', caption: 'Video contoh',
});
```

MIME dan ekstensi tidak mengonversi file. Pastikan kontennya benar-benar PDF/WebP/Ogg-Opus/MP4. `ptt: true` meminta tampilan voice note. Penerimaan dan thumbnail bergantung pada media dan aplikasi WhatsApp.

## Tabel dan rich message

```js
const result = await sock.sendTable(
  jid, 'Daftar harga bot contoh', ['Item', 'Harga'],
  [['Kopi', '18.000'], ['Teh', '12.000']], undefined,
  { headerText: 'Dibuat oleh bot contoh, bukan Meta AI.' },
);
console.log('ID rich:', result.messageId);
```

Lihat [panduan rich message](/guide/rich-messages) untuk daftar, kode, tautan, dan `AIRich`. Format ini menggunakan schema internal WhatsApp/AI; beri label bot sendiri dan sediakan teks biasa. Pada uji sebelumnya, varian rich mendapat ACK server tetapi tampilannya di HP **belum dikonfirmasi**.

## Apa yang sudah diuji dan batasnya

Pada satu akun uji yang diotorisasi, pairing nomor, tombol, daftar, lokasi, foto, carousel builder, polling dan beberapa media mendapat ACK; pemilik mengonfirmasi tes fitur sebelumnya berfungsi. Klik slide builder teramati. Itu bukan jaminan untuk semua akun, klien, grup, atau versi WhatsApp; raw carousel tidak terbukti lewat event klik. Contoh bot baru di halaman ini diuji secara offline dengan socket tiruan, tanpa mengirim ulang pesan. QR, unfollow, dan semua tampilan rich belum diverifikasi live. Return API atau ACK server berbeda dari *delivered*, *read*, tampilan di HP, dan keberhasilan klik.

---
title: Pairing dan QR
description: Tautkan perangkat lewat pairing code atau QR, validasi kode, fallback, refresh, dan rate limit.
---

# Pairing dan QR

WhatsBibz menggunakan alur linked-device WhatsApp Web. Pairing code dan QR sama-sama dibuat server; library mengirimkannya melalui event setelah menerima data koneksi yang sesuai.

## Pilih mode

- **Pairing code:** isi `phone` dengan digit nomor lengkap dan kode negara, misalnya `6281234567890`. Di ponsel pilih **Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon**, lalu masukkan kode dari event `pairing-code`.
- **QR:** kosongkan `phone`, dengarkan event `qr`, lalu tampilkan QR dengan UI/terminal milik aplikasi. `printQR: true` memakai peer opsional `qrcode-terminal`.

```js
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE, // kosongkan untuk QR
  pairingCode: 'XBIBZPRO',           // opsional, 8 karakter A-Z/0-9
  authDir: './data/account-session',
  printQR: false,
});

client.on('pairing-code', (code, { custom, fallback }) => {
  console.log({ code, custom, fallback });
});
client.on('qr', (qr) => {
  // Render `qr` only in a private interface for an authorized operator.
});
```

Validasi di aplikasi Anda juga harus memeriksa ada tidaknya nomor. Jika nomor kosong, pairing code tidak bisa diminta. Jangan menganggap Promise `createBibzWhats()` berarti akun sudah tertaut; tunggu `ready` untuk socket yang bisa digunakan.

## Kapan kode dipancarkan?

Pairing controller hanya memiliki satu request yang berjalan pada satu waktu. Event `pairing-code(code, meta)` dipancarkan setelah server mengakui permintaan, bukan saat request baru dikirim. `meta.custom` menandakan kode kustom dipakai; `meta.fallback` menandakan kode kustom ditolak dan kode acak diminta sebagai fallback.

Kode kustom dinormalisasi menjadi huruf besar dan hanya dipakai bila tepat delapan karakter alfanumerik. Jika format tidak valid, WhatsBibz memakai kode acak. Jika server menolak kode kustom, library mencoba kode acak satu kali; kegagalan jaringan atau rate limit tidak dianggap penolakan kode kustom.

Kode dapat diminta ulang selama credentials belum `registered`; interval refresh bawaan 150 detik agar kode yang sedang diketik tidak segera kedaluwarsa. Bila server memberi rate limit (misalnya 428/429), jeda bertambah eksponensial hingga maksimum 600 detik.

## Perilaku fallback

Saat `phone` diisi, QR tidak langsung ditampilkan. Jika pairing code belum tersedia setelah `qrFallbackAfterMs` sejak QR diterima, event `qr` juga dipancarkan agar operator tetap memiliki jalur tautan. Jika socket terbuka tetapi QR sama sekali belum tiba, `pairingRequestDelayMs` mengizinkan permintaan kode langsung.

Nilai `qrFallbackAfterMs` dan `pairingRequestDelayMs` dihitung dari kondisi berbeda; jangan menganggap keduanya satu timeout. Di lingkungan server tanpa operator, siapkan cara aman untuk meneruskan QR/kode kepada operator, bukan ke log publik.

## Troubleshooting pairing

| Gejala | Arti dan langkah berikut |
|---|---|
| Kode tidak tampil | Periksa `phone`, dengarkan event sebelum proses berjalan terlalu lama, dan lihat log `pairing`/`connection.update`. Pastikan nomor aktif di WhatsApp. |
| 400 saat registrasi | Identitas platform pairing dapat tidak diterima. Biarkan `companionPlatformDisplay` kosong agar diturunkan otomatis; baca [identitas perangkat](/guide/device-identity). |
| 428 atau 429 | Server meminta jeda. Jangan membuat loop request sendiri; controller sudah melakukan back-off. |
| 515 setelah pairing | Restart yang diminta server; tunggu reconnect otomatis dan event `ready`. |
| QR muncul setelah menunggu | Mode nomor menggunakan QR sebagai fallback. Anda dapat menautkannya melalui alur QR di ponsel. |

Periksa [siklus koneksi](/guide/client-lifecycle) dan [tabel error](/guide/troubleshooting). Kode dan QR adalah kredensial sementara: jangan unggah ke issue, screenshot publik, atau chat yang tidak dipercaya.

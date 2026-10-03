---
title: Pengujian dan diagnostik
description: Jalankan unit test, pemeriksaan ekspor, dan pengujian identitas live secara sadar.
---

# Pengujian dan diagnostik

Uji parser/helper dan perilaku wrapper secara lokal sebelum menghubungkan nomor utama. Test suite proyek berada di direktori `test/` dan berjalan dengan Node.js test runner bawaan.

## Pemeriksaan dasar

```bash
npm install
npm test
npm run check
```

`npm test` menjalankan file `test/*.test.js`, termasuk test identitas/lifecycle offline. `npm run check` memuat entrypoint paket dan memeriksa ekspor penting. Skrip docs tersedia dengan `npm run docs:dev`, `npm run docs:build`, dan `npm run docs:preview`.

Test lokal tidak membuktikan bahwa server WhatsApp menerima pairing atau format pesan yang diuji. Beberapa batasan protokol hanya bisa diverifikasi pada akun uji.

## Pengujian langsung identitas

`npm run test:live` mengaktifkan test yang berkomunikasi langsung dengan endpoint WhatsApp/Web. Jalankan hanya dengan akun/nomor yang Anda kendalikan, setelah membaca `test/identity-live.test.js` dan [laporan verifikasi identitas](/guide/device-identity). Test ini dapat menghasilkan trafik, QR/pairing, dikenai rate limit, atau berubah saat server berubah.

Jangan jalankan live test di CI publik, untuk akun orang lain, atau berulang kali guna menguji daftar panjang identitas. Gunakan saat memvalidasi perubahan terencana, dengan persetujuan operator dan jeda cukup. Hasilnya bukan jaminan jangka panjang.

## Buat kasus uji aplikasi

- Uji `extractMessage()` untuk teks, media, pembungkus ephemeral/view-once, edit, tombol, dan event dengan field opsional.
- Uji deduplikasi event menggunakan ID pesan dan behavior ketika pesan muncul dua kali.
- Simulasikan `ready` lebih dari sekali untuk memastikan handler berpindah ke socket aktif.
- Uji fail/timeout pada `sendText`/`sendMedia` dan pastikan retry tidak membuat duplikat tak terkendali.
- Tutup client dalam test dan cek timer reconnect telah dibatalkan.
- Jangan masukkan credentials real atau data pribadi ke fixtures; gunakan pesan mock yang disanitasi.

Jika Anda mengubah protokol/identitas, catat versi Node, WhatsBibz, tanggal test, fase handshake/pairing, dan hasil status yang disanitasi. Perbarui tes live hanya dengan persetujuan pemilik akun.

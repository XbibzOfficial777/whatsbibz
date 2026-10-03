---
title: FAQ
description: Jawaban singkat tentang Node.js, pairing, sesi, reconnect, ESM, dan kompatibilitas WhatsApp.
---

# FAQ

## Apakah WhatsBibz API resmi WhatsApp?

Tidak. WhatsBibz adalah client pihak ketiga untuk WhatsApp Web. Ia tidak sama dengan WhatsApp Business Platform resmi, tidak disponsori Meta, dan protokol/fitur dapat berubah atau dibatasi.

## Versi Node.js berapa yang diperlukan?

Node.js 20 atau lebih baru. Package menggunakan ESM; proyek baru dapat mengatur `"type": "module"` dan TypeScript `module`/`moduleResolution` ke `NodeNext`.

## Apakah pairing code sama dengan password akun?

Bukan password permanen, tetapi selama masih aktif kode dan QR dapat menautkan linked device. Jangan bagikan atau masukkan ke issue/log publik. Gunakan kanal operator privat.

## Bagaimana memilih QR dibanding pairing code?

Isi `phone` (digit dengan kode negara) untuk meminta pairing code. Kosongkan `phone` untuk QR. Nomor dapat menggunakan format internasional tanpa tanda `+`; periksa [panduan pairing](/guide/pairing).

## Apakah harus memasang qrcode-terminal?

Tidak. `qrcode-terminal` peer opsional, diperlukan hanya jika `printQR: true`. Anda dapat menangani event `qr` dan merender QR pada UI sendiri.

## Apakah reconnect otomatis dilakukan?

Ya, jika memakai `createBibzWhats()`. Ia mengelola timer, back-off, restart normal, rotasi identitas auto, dan pemulihan sesi yang dikenali. Anda masih harus mendaftarkan kembali `sock.ev` listener pada setiap `ready`. API `makeWASocket()` rendah tidak mengelola reconnect.

## Kenapa bot berhenti merespons setelah koneksi sempat putus?

Listener mungkin dipasang hanya pada socket pertama. Pasang listener di dalam `client.on('ready', sock => ...)` dan gunakan socket yang diberikan event; wrapper membuat socket baru setelah reconnect.

## Apa perbedaan `close()` dan `logout()`?

`close()` menutup client namun mempertahankan credentials untuk restart. `logout()` meminta logout pada server dan menghapus `authDir`; perangkat perlu pairing ulang.

## Apakah saya bisa menjalankan beberapa nomor?

Bisa, dengan satu client dan direktori auth unik per akun. Jangan membuka dua proses menggunakan direktori yang sama.

## Apakah format pesan rich/tombol selalu tampil?

Tidak. Native Flow dan GenAI/rich schemas adalah protokol yang berubah-ubah. Uji pada klien target dan sediakan teks alternatif. `sendText()` atau pesan biasa adalah fallback yang paling luas.

## Di mana menemukan signature type terbaru?

Cek declaration pada versi paket terpasang di `node_modules/@xbibzlibrary/whatsbibz/lib/index.d.ts` dan dokumentasi [ekspor publik](/reference/exports). Repository `main` mungkin lebih baru daripada npm release.

## Apakah library menaikkan limit/kuota pengiriman?

Tidak. `sendWithRetry()` hanya retry error request lokal/transport; ia bukan bypass rate limit. Terapkan batas laju, consent, antrean, dan kebijakan WhatsApp sendiri.

## Bagaimana cara memulihkan sesi korup?

Wrapper dapat melakukan wipe terbatas untuk status sesi yang dikenal. Periksa event `session-wiped`/`give-up`, log tersanitasi dan status linked device di ponsel. Jika perlu, unlink perangkat lalu mulai sesi baru dengan `authDir` yang aman.

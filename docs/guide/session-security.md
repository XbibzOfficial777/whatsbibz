---
title: Sesi dan keamanan
description: Lindungi kredensial linked device, batasi hak akses, lakukan backup, dan bedakan close dengan logout.
---

# Sesi dan keamanan

Autentikasi multi-device menyimpan material kriptografi dan kredensial yang dapat mempertahankan akses akun. Perlakukan seluruh `authDir` seperti secret berkategori tinggi—bukan sekadar cache dan bukan hanya file konfigurasi.

## Simpan sesi dengan aman

- Beri setiap akun satu direktori terpisah, misalnya `./data/account-a-session`.
- Tambahkan folder sesi ke `.gitignore`, backup pengembang, artifact CI, image container, dan mekanisme sinkronisasi yang tidak aman. Periksa aturan ignore sebelum commit: pola yang cocok bagi Anda belum tentu tersedia di proyek lain.
- Batasi permission direktori/file untuk user proses saja. Pada server bersama, isolasikan setiap bot/process.
- Gunakan persistent encrypted volume atau secret storage yang aksesnya diaudit. Hindari mencetak credentials, auth state, QR, pairing code, atau object `sock.authState` ke log.
- Jangan salin folder yang sedang ditulis. Untuk backup, hentikan client dengan `close()`, salin secara atomik/terenkripsi, lalu batasi siapa yang dapat memulihkan backup.
- Jangan jalankan dua proses serentak dengan `authDir` yang sama. Penulisan file bersamaan dapat merusak atau mengulang state.

Library memakai multi-file auth state. Saat proses berjalan, beberapa file dapat berubah ketika key/credential diperbarui; backup lama mungkin tidak dapat dipakai bila salinan tidak konsisten. Uji restore pada akun uji. Enkripsi saat transit maupun saat tersimpan, serta terapkan retensi dan penghapusan aman.

## Jangan commit sesi

Contoh aturan berikut hanya titik awal; sesuaikan ke nama folder proyek Anda:

```text
# Secret sesi WhatsBibz (pastikan pola sesuai authDir yang dipakai)
/data/*session*/
/bibzwhats-session/
.env
```

Sesudah `git add`, verifikasi dengan `git status --short` dan `git check-ignore -v data/account-a-session`. Bila credentials pernah masuk commit atau log, anggap bocor: logout/putuskan perangkat tertaut dari ponsel, bersihkan riwayat sesuai prosedur tim, dan rotasi secret. Menghapus file hanya dari working tree tidak menghapus salinan pada commit lama.

## Lifecycle yang benar

`client.close()` menutup socket dan timer sambil mempertahankan authDir untuk restart. `client.logout()` meminta logout di server dan menghapus folder sesi; perangkat harus dipasangkan ulang. Gunakan logout saat Anda memang ingin mencabut perangkat, bukan pada setiap deploy.

Pairing QR/kode berlaku seperti kredensial sementara. Kirim melalui kanal privat, tampilkan hanya untuk operator, batasi masa simpan log, dan hindari screenshot/CI output. Jangan meminta pengguna mengirimkan sesi mereka ke issue tracker.

## Data pesan dan privasi

Pesan masuk dapat memuat data personal, gambar, file, lokasi, dan metadata pengguna. Minimalkan pencatatan, tentukan retensi, batasi akses, validasi file sebelum dibuka, serta informasikan kepada pengguna bagaimana bot memproses data. Dapatkan persetujuan yang diwajibkan. Jangan menganggap komunikasi WhatsApp Web sebagai jaminan enkripsi aplikasi Anda setelah data tiba pada proses Node.js atau database Anda.

WhatsBibz bukan WhatsApp Business Platform resmi. Risiko pemblokiran, perubahan protokol, kegagalan layanan, dan pembatasan akun tetap ada. Patuhi ketentuan Meta/WhatsApp dan hindari pengiriman tidak diminta, pengelakan batas, spam, atau penggunaan akun yang tidak Anda kendalikan.

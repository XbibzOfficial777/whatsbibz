---
title: Keamanan dan penggunaan yang bertanggung jawab
description: Lindungi sesi, hargai privasi, patuhi consent dan batas penggunaan WhatsApp.
---

# Keamanan dan penggunaan yang bertanggung jawab

WhatsBibz adalah library tidak resmi yang berkomunikasi dengan layanan WhatsApp Web. Gunakan hanya pada akun yang Anda kendalikan dan untuk kegiatan yang diizinkan oleh ketentuan WhatsApp/Meta serta hukum yang berlaku.

## Lindungi akun dan kredensial

1. Simpan `authDir` di storage terenkripsi dengan permission minimum; jangan commit atau unggah ke artifact/log.
2. Rahasiakan pairing code dan QR. Jangan mengirim kredensial sesi kepada pengguna, vendor, atau issue publik.
3. Hentikan client sebelum backup. Enkripsi backup dan tetapkan retensi/penghapusan; jangan gunakan satu session directory oleh beberapa proses.
4. Jika sesi bocor, cabut perangkat tertaut dari ponsel, anggap kredensial kompromi, periksa log/backup, dan pasangkan ulang hanya setelah penyebabnya ditangani.
5. Minimalkan data pesan yang dicatat. Redaksi JID, nomor, konten, file dan metadata personal.

## Lindungi penerima

- Dapatkan consent yang sesuai dan sediakan opt-out yang dihormati.
- Hindari pesan massal tidak diminta, spam, impersonasi, penipuan, phishing, atau otomatisasi pengelakan blokir/rate limit.
- Validasi event dan tombol masuk sebagai input tidak tepercaya; gunakan allow-list tindakan.
- Batasi kecepatan per nomor/grup, idempotensi, retry, ukuran file, dan worker yang bisa mengakses data.
- Jangan memakai rich message untuk memberi kesan bahwa bot berasal dari Meta, WhatsApp, atau manusia.

## Batas dukungan

Protokol, identity profiles, pairing fields, dan rich schemas dapat berubah kapan saja. Wrapper melakukan pemulihan terbatas tetapi tidak dapat menjamin ketersediaan, delivery, kepatuhan kebijakan, atau bahwa suatu akun tidak dibatasi. Untuk kebutuhan bisnis kritis, evaluasi WhatsApp Business Platform resmi dan dukungan operasional yang sesuai.

## Pelaporan kerentanan

Jangan mempublikasikan sesi, kode pairing, payload privat, atau langkah eksploit yang membuka akses akun. Gunakan [kebijakan keamanan repository](https://github.com/XbibzOfficial777/whatsbibz/security/policy): laporkan secara privat melalui GitHub Security atau email `revandoppratama@gmail.com` dengan subjek `[whatsbibz security]`. Berikan detail minimum untuk reproduksi aman dan tunggu koordinasi sebelum membuka informasi publik.

---
title: Balas video menjadi stiker bersuara
description: Cara mengubah video menjadi satu stiker WhatsApp dengan audio asli, lengkap dengan batas dan keamanan.
---

# Balas video menjadi stiker bersuara

Fitur **eksperimental** ini mengubah video yang dibalas menjadi **satu stiker animasi dengan suara video**, bukan stiker dan voice note yang terpisah. WebP sendiri tidak menyimpan audio: WhatsBibz mengunggah gambar WebP dan audio Ogg Opus secara terpisah, lalu memasukkan keduanya ke satu `audioStickerMessage`. Mengirim `sock.sendMessage(jid, { sticker: webp })` saja menghasilkan stiker biasa **tanpa suara**.

::: warning Status rilis dan kompatibilitas
Helper tersedia di npm **2.1.0** (tidak di **2.0.0**), tetapi versi npm 2.1.0 hanya mengambil maksimal **5 detik** audio dan animasi. Perubahan **belum dirilis ke npm** pada repository `main` mencoba audio hingga **600 detik (10 menit)** dalam satu stiker, dengan animasi maksimal 5 detik. Contoh bot hanya ada di repository.

Audio panjang ini eksperimental: penerima dapat menolak, memotong, atau tidak memutarnya. [Pengamatan pada versi uji WhatsApp](https://www.androidauthority.com/whatsapp-sound-stickers-apk-teardown-3724247/) melaporkan batas editor yang jauh lebih pendek, bukan jaminan perilaku seluruh klien. Uji live terdahulu hanya membuktikan stiker pendek tampil dan bersuara pada satu akun, **bukan** pemutaran 10 menit.
:::

## 1. Persiapan

- Gunakan Node.js yang masih didukung dan telah dipatch, serta checkout terbaru repository. Contoh bot berada di repository, **tidak disertakan dalam tarball npm**.
- Instal `ffmpeg` **dan** `ffprobe` di PATH; build FFmpeg harus mendukung encoder `libwebp_anim` dan `libopus`. Contoh pada Ubuntu/Debian: `sudo apt-get install ffmpeg`. Pada sistem lain, instal build tepercaya dengan kedua encoder tersebut.
- Pakai video MP4/MOV biasa yang Anda berhak proses, dengan trek audio yang terdengar, maksimal **20 MiB**. Video sekali lihat tidak didukung.
- Pastikan Anda berwenang mengoperasikan akun bot dan chat tujuan. Auto-follow channel tetap **aktif secara bawaan** pada socket; lihat [pengaturan dan opt-out](/guide/message-recipes).

```bash
git clone https://github.com/XbibzOfficial777/whatsbibz.git
cd whatsbibz
npm ci
ffmpeg -version
ffprobe -version
ffmpeg -hide_banner -encoders | grep -E 'libwebp_anim|libopus'
```

## 2. Jalankan contoh untuk chat sendiri

Ganti nilai contoh dengan **digit nomor bot sebenarnya**. Contoh POSIX berikut menyalakan perintah dari akun sendiri secara eksplisit; secara bawaan perintah dari akun sendiri diabaikan.

```bash
export WHATSAPP_PHONE='6281234567890'
export WHATSBIBZ_ALLOWED_JID="${WHATSAPP_PHONE}@s.whatsapp.net"
export WHATSBIBZ_ALLOW_SELF_COMMANDS=1
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/my-bot-session"
mkdir -p "$WHATSBIBZ_AUTH_DIR" && chmod 700 "$WHATSBIBZ_AUTH_DIR"
node example/message-recipes.js
```

1. Jika sesi belum tertaut, masukkan kode terminal di WhatsApp: **Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon**. Jangan bagikan kode atau file sesi.
2. Tunggu tulisan **Socket siap**. Di chat dengan nomor sendiri, kirim video bersuara atau gunakan video biasa yang masih dapat diunduh.
3. **Balas video** itu dengan `.sa`. Alias `!soundsticker` dan `!sticker-audio` juga tersedia. Atau kirim video langsung dengan caption salah satu perintah tersebut.
4. Tunggu proses selesai. Jika stiker muncul tetapi diam, ketuk ikon suara pada stiker dan periksa volume serta versi aplikasi.

Chat sendiri bisa dilaporkan sebagai PN (`@s.whatsapp.net`) **atau** LID (`@lid`). Saat `WHATSBIBZ_ALLOW_SELF_COMMANDS=1`, contoh menerima kedua identitas **milik socket yang terautentikasi**; JID lain tetap ditolak. Perintah sendiri yang lama difilter berdasarkan waktu siap dengan toleransi dua detik untuk mengurangi pemutaran ulang. Jangan jalankan dua proses menggunakan folder sesi yang sama. Untuk pengirim dari akun kedua, jangan set `WHATSBIBZ_ALLOW_SELF_COMMANDS`, dan atur `WHATSBIBZ_ALLOWED_JID` ke PN atau LID chat yang benar-benar diterima; contoh tidak menebak pasangan PN/LID orang lain.

## 3. Pakai API di aplikasi sendiri

Untuk perilaku audio 10 menit, gunakan checkout repository terbaru, bukan paket npm 2.1.0. Di aplikasi lain, Anda dapat memasang sumber repository dengan `npm install git+https://github.com/XbibzOfficial777/whatsbibz.git#main`; pin commit Git pada lockfile untuk reproduksibilitas. Metadata versi sumber masih `2.1.0`, jadi periksa sumber/commit, bukan nomor versi saja. Panggil fungsi ini hanya setelah memvalidasi izin dan dari handler pesan pada socket `ready` terbaru. Ini potongan handler, bukan bot lengkap; gunakan contoh repository untuk penautan, filter, dan deduplikasi.

```js
import { extractMessage, downloadVideoForSoundSticker, sendVideoAsSoundSticker } from '@xbibzlibrary/whatsbibz';

const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID; // JID yang diotorisasi, bukan input bebas
export async function onMessage(sock, incoming) {
  const jid = incoming?.key?.remoteJid;
  if (!allowedJid || jid !== allowedJid || incoming.key.fromMe) return;
  const item = extractMessage(incoming);
  if (item?.type !== 'text' || item.text.trim().toLowerCase() !== '.sa') return;
  try {
    const video = await downloadVideoForSoundSticker(incoming, { mediaHost: sock.getMediaHost() });
    const sent = await sendVideoAsSoundSticker(sock, jid, video, { quoted: incoming, startSeconds: 0, maxAudioSeconds: 600 });
    console.log('Pesan dibuat:', sent.key.id); // bukan bukti tampil/bersuara
  } catch (error) {
    console.error('Stiker gagal:', typeof error?.code === 'string' ? error.code : 'unexpected');
  }
}
```

`downloadVideoForSoundSticker()` mengambil video yang dikutip, atau video langsung; `sendVideoAsSoundSticker()` juga dapat menerima `Buffer` MP4/MOV tepercaya. `startSeconds` memilih titik awal yang sama untuk visual dan audio (bawaan `0`). `maxAudioSeconds` adalah bilangan bulat 1–600, bawaan `600`; gunakan `{ maxAudioSeconds: 5 }` untuk mengambil audio lebih pendek tanpa jaminan kompatibilitas. `timeoutMs` konversi membatasi **setiap** proses FFmpeg/FFprobe (bawaan 120.000 ms, maksimal 300.000 ms); pada unduhan bawaan 30.000 ms dan maksimal 120.000 ms. `ffmpegPath` dan `ffprobePath` menerima path executable tepercaya. `convertVideoToSoundSticker()` menyediakan konversi offline menjadi WebP dan Ogg terpisah. Lihat deklarasi TypeScript untuk opsi lengkap.

## Batas dan pemecahan masalah

| Kondisi | Tindakan |
|---|---|
| `.sa` tidak merespons | Tunggu **Socket siap** dan kirim balasan baru; untuk chat sendiri aktifkan opt-in dan gunakan JID bot. Untuk akun kedua cocokkan PN/LID yang diterima, serta periksa koneksi dan izin. |
| `NO_AUDIO` / `SILENT_AUDIO` | Gunakan video dengan trek bersuara; bagian yang dipilih tidak boleh hening. Tidak ada fallback diam-diam ke stiker biasa. |
| `FFMPEG_NOT_FOUND` / `FFMPEG_FAILED` | Periksa `ffmpeg`, `ffprobe`, `libwebp_anim`, `libopus`, dan format MP4/MOV. |
| `FFMPEG_TIMEOUT` | Konversi melewati batas waktu per proses; kurangi kompleksitas video atau naikkan `timeoutMs` secara terkendali. |
| `VIDEO_TOO_LARGE` / `STICKER_TOO_LARGE` / `INVALID_AUDIO` | Periksa batas input 20 MiB, WebP 500 KiB, dan audio 4 MiB; gunakan video yang lebih kecil atau sederhana. |
| `VIDEO_METADATA_MISSING` / `VIDEO_DOWNLOAD_FAILED` | Media bisa kedaluwarsa atau metadata tidak lengkap; minta pengirim mengirim ulang video biasa. |
| `VIEW_ONCE_REJECTED` | Gunakan video biasa dengan persetujuan pemilik; media sekali lihat sengaja ditolak. |
| Tampil tanpa suara / tidak tampil | Ketuk ikon suara, cek volume dan pembaruan WhatsApp. Dukungan fitur tergantung penerima; ACK server saja tidak membuktikan tampilan atau suara. |

Pada repository `main`, audio dari video dipotong paling lama **600 detik (10 menit)**; jika lebih pendek, seluruh bagian yang tersedia digunakan. Audio mono Ogg Opus 48 kHz/48 kbps dibatasi **4 MiB**. Visual hanya mengambil maksimal **5 detik** dari titik awal yang sama, menjadi WebP animasi 512 × 512 hingga **500 KiB** yang dikodekan untuk berulang. Sumber MP4/MOV tetap dibatasi **20 MiB**, sehingga video panjang mungkin perlu dikompresi terlebih dahulu. Ini adalah batas implementasi, **bukan** klaim batas atau jaminan pemutaran WhatsApp.

## Sesi dan keamanan

Gunakan folder sesi privat yang sama setiap kali; pada POSIX batasi direktori ke `700` dan file ke `600`, serta atur ACL yang setara di Windows. Hentikan proses secara normal; `await client.close()` tidak melakukan logout, sedangkan `client.logout()` menghapus sesi. Contoh menggunakan `preserveSession: true` agar wrapper tidak menghapus sesi otomatis ketika kondisi tertentu terjadi. WhatsApp tetap dapat mencabut perangkat sehingga pairing ulang mungkin diperlukan. Jangan commit, unggah, atau bagikan folder/kunci sesi.

Pengunduhan membatasi ukuran, memakai host CDN tepercaya, menolak redirect dan memverifikasi SHA-256 **plaintext** sebelum konversi. Jalur unduhan warisan belum memverifikasi MAC media; ini bukan jaminan autentisitas lengkap. Batasi pengirim, laju, ukuran, durasi, akses jaringan dan resource; jalankan FFmpeg versi terbaru dalam lingkungan terisolasi untuk video tak tepercaya. File sementara dibersihkan setelah selesai normal, tetapi penghentian paksa atau mati listrik dapat meninggalkannya. Deduplikasi contoh hanya dalam memori; produksi memerlukan deduplikasi persisten dan penanganan retry yang tidak menggandakan pesan saat status relay tidak pasti.

## Bukti dan referensi

Pengujian offline memeriksa wire protobuf, dua unggahan terenkripsi tiruan, satu relay tiruan, serta audio asli yang didekode mendekati akhir klip 600 detik; input 610 detik dipastikan terpotong. Uji live terdahulu pada satu akun hanya untuk stiker pendek: ada ACK serta konfirmasi pemilik bahwa gambar dan suara muncul. Return API, ACK server, penerimaan, tampilan dan suara terdengar adalah tahap berbeda. Field `audioStickerMessage`/`StickerMessage.audioMessage` juga dilaporkan dalam [pemeriksaan protokol komunitas](https://github.com/rexxzyid/elaina-baileys/issues/44); ini bukan spesifikasi resmi Meta.

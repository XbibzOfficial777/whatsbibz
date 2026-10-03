---
title: Mulai cepat
description: Persyaratan Node.js, instalasi ESM, pairing QR atau kode, dan pesan pertama.
---

# Mulai cepat

Panduan ini menyiapkan client pertama dari proyek Node.js kosong. WhatsBibz adalah paket ESM; gunakan Node.js 20 atau lebih baru.

## 1. Siapkan proyek

```bash
mkdir wa-bot && cd wa-bot
npm init -y
npm pkg set type=module
npm install @xbibzlibrary/whatsbibz
```

Simpan nomor dengan kode negara sebagai environment variable. Nomor pairing berisi digit saja: tanpa `+`, spasi, atau awalan `0` lokal. Jangan menulis token, kode pairing, atau kredensial sesi ke source control.

```bash
# macOS / Linux
export WHATSAPP_PHONE=6281234567890
```

Di Windows PowerShell gunakan `$env:WHATSAPP_PHONE = '6281234567890'`. Nomor ini hanya dipakai saat mendaftarkan linked device; sesi tersimpan setelah akun ditautkan.

## 2. Buat `index.js`

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/whatsbibz-session',
});

client.on('pairing-code', (code, meta) => {
  console.log('Kode pairing:', code, meta.custom ? '(kode kustom)' : '(kode WhatsApp)');
});
client.on('qr', (qr) => {
  // Tampilkan `qr` hanya lewat renderer privat untuk operator yang berwenang.
});
client.on('give-up', (message) => console.error('Client berhenti mencoba:', message));

client.on('ready', (sock) => {
  // `ready` dipancarkan untuk setiap socket baru. Pasang ulang listener setelah reconnect.
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const incoming = extractMessage(message);
      if (incoming?.type === 'text' && incoming.text.trim().toLowerCase() === 'ping') {
        await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
      }
    }
  });
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

Jalankan `node index.js`. Jika `phone` diisi, WhatsBibz meminta pairing code ketika perangkat belum terdaftar. Jika nomor tidak diisi, WhatsApp mengirim QR; tangani event `qr` atau gunakan `printQR: true` dengan peer opsional `qrcode-terminal`.

## 3. Tautkan perangkat di ponsel

Untuk pairing code, buka WhatsApp di ponsel: **Setelan → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon**, lalu masukkan kode yang muncul di log. Untuk QR, pilih **Tautkan perangkat** dan pindai QR dari terminal atau UI Anda. Jangan pernah kirim kode/QR kepada orang lain: selama masih berlaku, kode itu dapat menautkan perangkat.

Pairing code baru dipancarkan setelah server mengonfirmasi permintaan. Setelah tertaut, credentials disimpan ke `authDir`; restart berikutnya biasanya memakai sesi tersebut dan tidak meminta kode lagi.

## 4. Periksa koneksi

Dengarkan event `ready` untuk mulai memakai socket. `client.isConnected()` memberi status saat ini; `client.sock` menunjuk socket aktif, sedangkan `client.initialSock` tetap menunjuk socket pertama. Jangan pasang handler hanya pada `initialSock` jika client akan melakukan reconnect.

Bila kode tidak muncul, cek [pairing dan QR](/guide/pairing). Bila bot terhubung tetapi handler tidak melihat pesan, lihat [event dan reconnect](/guide/connection-events) serta [troubleshooting](/guide/troubleshooting).

## Tanpa wrapper tingkat tinggi

Jika ingin mengatur autentikasi dan reconnect sendiri, gunakan `makeWASocket()`; contoh ada di [API tingkat rendah](/guide/low-level-api). Untuk kebanyakan bot, mulai dari `createBibzWhats()` agar timer reconnect dan pemulihan sesi ditangani satu tempat.

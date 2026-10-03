---
layout: home
hero:
  name: WhatsBibz
  text: Client WhatsApp Web untuk Node.js
  tagline: Panduan praktis dan referensi rinci untuk pairing, identitas perangkat, event, pesan, sesi, dan API Baileys-compatible.
  image:
    src: /whatsbibz-mark.png
    alt: Simbol WhatsBibz
  actions: []
features:
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 6v15M8 7h8M8 11h7"/></svg>'
    title: Mulai dengan jalur yang jelas
    details: Instal, tautkan nomor dengan QR atau pairing code, lalu kirim pesan pertama dengan contoh ESM yang siap dijalankan.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.9 7.5 9.5 4.4-1.6 7.5-5.1 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/></svg>'
    title: Koneksi yang dipahami
    details: Pelajari pairing, rotasi identitas otomatis, reconnect, pemulihan sesi, serta event yang perlu didaftarkan ulang.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></svg>'
    title: Pesan dan interaksi
    details: Rujukan helper teks/media, ekstraksi pesan, tombol native flow, rich message, JID, mention, dan balasan kutipan.
  - icon:
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4h10v16H7z"/><path d="M10 7h4M10 11h4M10 15h4"/><path d="M4 7v10M20 7v10"/></svg>'
    title: Dari pemula sampai low-level
    details: Gunakan createBibzWhats untuk pekerjaan umum atau turun langsung ke makeWASocket saat membutuhkan kontrol Baileys.
---

## Dokumentasi untuk implementasi nyata

WhatsBibz adalah library WhatsApp Web multi-device untuk Node.js, berbasis fork Baileys yang dirawat. Situs ini memecah topik besar README menjadi alur belajar, panduan operasional, referensi opsi, contoh kode, dan troubleshooting. Gunakan pencarian untuk menemukan event, opsi, helper, atau kode error tertentu.

<div class="ww-card-grid">
  <a class="ww-card" href="./guide/getting-started"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span class="ww-card-copy"><strong>Mulai cepat</strong><span>Persyaratan, instalasi ESM, pilihan QR atau pairing, dan pemeriksaan koneksi pertama.</span></span></a>
  <a class="ww-card" href="./guide/device-identity"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M9 11h6M10 17h4"/></svg></span><span class="ww-card-copy"><strong>Identitas perangkat</strong><span>Pahami mode auto, identitas kustom, prioritas environment variable, dan file identity.json.</span></span></a>
  <a class="ww-card" href="./guide/messages"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/></svg></span><span class="ww-card-copy"><strong>Pesan dan event</strong><span>Pasang listener pada socket yang benar, normalisasi update, lalu tangani pesan idempoten.</span></span></a>
  <a class="ww-card" href="./reference/client-options"><span class="ww-card-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--background)"/><circle cx="15" cy="12" r="2" fill="var(--background)"/><circle cx="7" cy="18" r="2" fill="var(--background)"/></svg></span><span class="ww-card-copy"><strong>Referensi opsi</strong><span>Default client, event, helper, pairing controller, dan utilitas identitas dalam satu tempat.</span></span></a>
</div>

## Model integrasi

Ada dua tingkat API. Mulailah dari `createBibzWhats()` jika ingin pairing, autentikasi, reconnect, dan pemulihan sesi dikelola library. Gunakan `makeWASocket()` jika aplikasi perlu mengatur sendiri auth state dan lifecycle. Kedua jalur memakai socket yang sama untuk event dan metode Baileys.

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: 'whatsbibz-session',
});

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const item = extractMessage(message);
      if (item?.type === 'text' && item.text.trim().toLowerCase() === 'ping') {
        await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
      }
    }
  });
});
```

Mulai dari [panduan instalasi dan pairing](/guide/getting-started), lalu baca [siklus hidup client](/guide/client-lifecycle) sebelum menjalankan bot terus-menerus. Contoh di atas hanya memproses teks sederhana; lihat [keamanan sesi](/guide/session-security) sebelum menyimpan kredensial di server.

## Pilih bab sesuai kebutuhan

- **Tautkan akun:** [Pairing dan QR](/guide/pairing), [identitas perangkat](/guide/device-identity).
- **Menangani pesan:** [event dan reconnect](/guide/connection-events), [kirim/baca pesan](/guide/messages), [tombol](/guide/interactive-messages).
- **Produksi:** [konfigurasi](/guide/configuration), [sesi & keamanan](/guide/session-security), [troubleshooting](/guide/troubleshooting).
- **Tipe dan kompatibilitas:** [TypeScript & migrasi](/guide/typescript-migration), [API tingkat rendah](/guide/low-level-api), [ekspor publik](/reference/exports).

<div class="ww-note">
  <strong>Catatan penting</strong>
  <p>WhatsBibz adalah client tidak resmi yang berkomunikasi dengan WhatsApp Web. Ia bukan WhatsApp Business Platform resmi dan tidak menjamin akun bebas pembatasan. Gunakan akun yang Anda kendalikan, patuhi ketentuan WhatsApp, dapatkan persetujuan penerima, dan jangan mengirim pesan massal yang tidak diminta.</p>
</div>

---
title: Pesan masuk dan keluar
description: Kirim teks dan media, uraikan pesan masuk, tangani balasan kutipan, dan proses event dengan aman.
---

# Pesan masuk dan keluar

Semua helper menerima socket aktif (`sock`) dan JID tujuan. Helper tingkat tinggi tidak menggantikan API mentah; `sock.sendMessage(jid, content)` tetap tersedia bila Anda memerlukan fitur protokol tertentu.

## Terima pesan

Event `messages.upsert` dapat berisi pesan notify, history sync, atau append. Untuk bot responsif biasanya proses hanya `type === 'notify'`, lalu abaikan pesan dari akun sendiri serta payload kosong. Pesan yang sama dapat muncul lebih dari sekali karena reconnect/sync; gunakan `message.key.id` untuk deduplikasi pada database.

```js
import { extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

async function onMessages(sock, { messages, type }) {
  if (type !== 'notify') return;
  for (const message of messages) {
    if (message.key.fromMe || !message.message) continue;
    const item = extractMessage(message);
    if (!item) continue;
    if (item.type === 'text' && item.text.trim().toLowerCase() === 'ping') {
      const result = await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
      if (!result.ok) console.error('Gagal mengirim balasan:', result.error);
    }
  }
}
```

`extractMessage()` membuka wrapper ephemeral, view-once, dokumen dengan caption, serta pesan edit. Jenis hasil: `text`, `image`, `video`, `audio`, `sticker`, `document`, `reaction`, `button`, `poll`, atau `other`. Hasil memuat `text` (kosong untuk sebagian media), `participant`, dan properti khusus seperti `imageMsg`, `videoMsg`, `documentMsg`, `buttonId`, `mentions`, `quotedMessage`, `quotedStanzaId`, dan `pollOptions`. Tidak semua properti ada pada semua jenis.

`unwrapMessage()` hanya membuka wrapper konten. `messageTimestampMs(message)` mengonversi timestamp protobuf ke milidetik Unix (0 jika tidak tersedia). Helper tidak mengunduh atau mendekripsi media secara otomatis; gunakan `downloadMediaMessage`/`downloadContentFromMessage` dari paket untuk pengunduhan dan baca [ekspor publik](/reference/exports).

## Kirim teks

```js
const result = await sendText(sock, jid, 'Halo, *teman*!', {
  quoted: incomingMessage,
  maxLen: 4000,
});
if (!result.ok) throw result.error;
console.log('ID pesan:', result.ids);
```

`sendText(sock, jid, text, options)` mengembalikan `{ ok, ids, error? }`. Secara default helper menjalankan `whatsappify()` sebelum pengiriman: mengonversi `**tebal**` dan `__tebal__` menjadi format tebal WhatsApp, `~~coret~~` menjadi `~coret~`, menghapus awalan heading, dan merapikan tautan Markdown menjadi `label (URL)`. Ini konversi ringan, bukan parser Markdown lengkap. Gunakan `{ format: false }` jika ingin teks diteruskan apa adanya.

Teks lebih panjang dari `maxLen` (default 4000 karakter) dipecah pada batas baris/spasi bila memungkinkan. Bagian dikirim berurutan dengan jeda 250 ms. Setiap bagian memakai retry bawaan tiga kali (jeda 500 ms lalu 1500 ms). Jika satu bagian gagal, fungsi mengembalikan ID yang sudah terkirim bersama `error`; pengiriman sebagian mungkin terjadi. Jangan mengulang seluruh respons tanpa deduplikasi atau pengecekan, agar penerima tidak mendapat duplikat.

Gunakan `sendWithRetry(sock, jid, content, options, { attempts })` untuk content generik. Ia tidak melempar error saat semua percobaan gagal, melainkan mengembalikan `{ result: null, error }`; retry transport tidak menjamin request yang timeout belum sempat diterima server.

## Media

```js
import { readFile } from 'node:fs/promises';

const image = await readFile('./report.png'); // Node Buffer
const sent = await sendMedia(sock, jid, {
  image,
  mimetype: 'image/png',
  caption: 'Ringkasan laporan',
  fileName: 'report.png',
}, { quoted: incomingMessage, fallbackToDocument: true });
if (!sent.result) console.error(sent.error);
```

`sendMedia()` meneruskan `AnyMessageContent` ke `sock.sendMessage()`. Jika media gagal dan konten berupa `Buffer`, helper dapat mencoba ulang sebagai dokumen; URL/stream tidak otomatis diubah menjadi dokumen. Atur `fallbackToDocument: false` untuk menonaktifkan fallback. Format `image`, `video`, `audio`, `sticker`, dan `document` mengikuti Baileys; lampirkan MIME type, nama file, caption, atau `ptt` sesuai kebutuhan.

Untuk berkas yang diterima, gunakan tipe pada `extractMessage()` lalu unduh melalui helper media. Batasi ukuran, validasi MIME/content di sisi aplikasi, simpan dengan nama yang dibuat sendiri, dan jangan mempercayai nama berkas atau metadata dari pengirim.

## Reaksi dan presence

`react(sock, jid, message.key, reactionText)` mengirimkan reaksi ke pesan tertentu. `presence(sock, jid, state)` mengirim presence seperti `composing`, `recording`, `paused`, `available`, atau `unavailable`; default-nya `composing`. Presence mengembalikan boolean dan menangkap error. Pakai seperlunya—status presence bukan jaminan pesan terkirim atau dibaca.

## Kutipan, mention, dan grup

Kutipan diteruskan sebagai `{ quoted: incomingMessage }`. Untuk mention native, gunakan `sock.sendMessage(jid, { text, mentions: [participantJid] })` atau content schema yang sesuai; jangan menyusun nomor menjadi JID secara manual bila update sudah menyediakan `remoteJid`/`participant`. Nomor pribadi, LID, dan JID grup memiliki bentuk berbeda; lihat [JID dan identitas pengguna](/guide/jid-groups).

Jangan mengirim pada setiap pesan tanpa kebijakan rate limit. Terapkan izin/opt-out, antrean, deduplikasi, serta batas per penerima. Library tidak memberi izin untuk mengirim pesan yang tidak diminta dan tidak menaikkan kuota resmi WhatsApp.

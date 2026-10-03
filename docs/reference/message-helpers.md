---
title: Referensi helper pesan
description: Signature helper kirim, ekstraksi, timestamp, JID, pairing, dan hasil return.
---

# Referensi helper pesan

Semua helper berikut dapat diimpor dari entrypoint `@xbibzlibrary/whatsbibz`. Helper yang menerima `sock` kompatibel dengan socket dari `makeWASocket()` maupun `client.sock` dari `createBibzWhats()`.

## Kirim

| Helper | Signature / hasil |
|---|---|
| `sendText(sock, jid, text, opts?)` | `Promise<{ ok: boolean; ids: string[]; error?: Error }>`; opsi `{ quoted?, format?: boolean, maxLen?: number }`. Default format true, max length 4000. |
| `sendWithRetry(sock, jid, content, options?, opts?)` | Promise berisi `{ result, error }`; keduanya dapat bernilai null. `{ attempts?: number }` default 3. Jeda retry 500 ms lalu 1500 ms. |
| `sendMedia(sock, jid, content, opts?)` | Promise berisi `{ result, error }`; field dapat bernilai null. `{ quoted?, fallbackToDocument?: boolean }`; fallback Buffer ke dokumen default aktif. |
| `splitText(text, maxLen?)` | `string[]`; default max `4000`, utamakan baris/spasi saat memecah. |
| `whatsappify(text)` | `string`; konversi Markdown terbatas ke format WhatsApp, bukan parser lengkap. |
| `react(sock, jid, key, reactionText)` | Promise berisi pesan terkirim atau `undefined`; `key` adalah message key. |
| `presence(sock, jid, state?)` | `Promise<boolean>`; default `'composing'`, return false bila request melempar error. |

`sendText()` mengembalikan partial IDs jika satu bagian gagal. Retry tidak menjamin idempotency; timeout mungkin terjadi setelah server menerima pesan.

## Baca

| Helper | Signature / catatan |
|---|---|
| `extractMessage(message)` | Mengembalikan `ExtractedMessage` atau `null`; membuka wrapper umum dan menormalkan teks, media, tombol, poll, reaction, atau jenis lain. |
| `unwrapMessage(content)` | Mengembalikan `proto.IMessage` atau `null`; membuka wrapper edited/ephemeral/view-once/document-caption. |
| `messageTimestampMs(message)` | `number`; epoch milliseconds, `0` bila kosong/tidak valid. |
| `downloadMediaMessage(message, type, options, context?)` | Mengunduh dan mendekripsi media lewat helper core; `type` dapat berupa `buffer` atau `stream`. Periksa `MediaDownloadOptions` versi terpasang. |
| `downloadContentFromMessage(downloadable, type, options?)` | Stream media dari key/path yang cocok; caller mungkin harus menggabungkan stream. |

### Bentuk `ExtractedMessage`

`type` dapat bernilai `text`, `image`, `video`, `audio`, `sticker`, `document`, `reaction`, `button`, `poll`, atau `other`. Properti umum: `text`, `participant`. Properti opsional: `mentions`, `quoted`, `quotedParticipant`, `quotedStanzaId`, `quotedMessage`, `imageMsg`, `videoMsg`, `audioMsg`, `stickerMsg`, `documentMsg`, `reactionMsg`, `fileName`, `mimetype`, `fileLength`, `buttonId`, `buttonText`, `pollName`, `pollOptions`, dan `otherKind`.

`extractMessage()` menghasilkan `null` bila konten tidak ada setelah unwrapping. `text` untuk media umumnya adalah caption (atau string kosong), bukan seluruh konten yang ditampilkan aplikasi. Unduh media secara terpisah dan validasi sebelum digunakan.

## JID

| Helper | Perilaku |
|---|---|
| `digitsOf(jid)` | Ambil bagian sebelum `@` dan suffix device `:...`, lalu sisakan digit. Bukan validator nomor. |
| `pnJid(digits)` | Bentuk `<digit>@s.whatsapp.net`, string kosong bila tidak ada digit. |
| `lidJid(digits)` | Bentuk `<digit>@lid`, string kosong bila tidak ada digit. |
| `normalizeJid(jid)` | Hapus suffix device untuk JID user; JID grup dikembalikan utuh. |
| `isPnJid`, `isLidJid`, `isGroupJid`, `isNewsletterJid`, `isStatusJid` | Deteksi suffix/ID dasar. |
| `sameUser(a, b)` | Bandingkan digit hasil normalisasi sederhana; bukan authorization helper. |
| `LidMap` | Mapping in-memory PN/LID; API: `set`, `phoneOf`, `lidOf`, `canonical`, `variants`, `learnFromMessage`, `toJSON`, `fromJSON`. |

JID dan LID bersifat identifier; jangan menebak nomor dari nilai yang tidak didukung. Baca [panduan JID](/guide/jid-groups).

## Pairing

`normalizePairingCode(value)` mengembalikan kode uppercase jika tepat 8 karakter A–Z/0–9, selain itu string kosong. `createPairingController(options)` diekspor untuk penggunaan tingkat rendah, tetapi umumnya wrapper client yang sebaiknya mengelolanya. Tipe metadata event: `{ custom: boolean; fallback: boolean }`. `PAIRING_REFRESH_MS` bernilai 150000 dan `PAIRING_BACKOFF_MAX_MS` 600000.

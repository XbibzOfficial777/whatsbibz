---
title: JID, LID, dan grup
description: Kenali bentuk alamat WhatsApp, bedakan PN JID dan LID, serta cache metadata grup secara aman.
---

# JID, LID, dan grup

`jid` adalah alamat protokol, bukan nomor telepon yang aman untuk diproses dengan operasi string generik. Payload pesan dapat menyertakan alamat pribadi, LID, grup, newsletter, atau status. Gunakan nilai `message.key.remoteJid` sebagai tujuan balasan selama tersedia.

## Bentuk yang umum

| Jenis | Akhiran | Makna |
|---|---|---|
| PN / nomor telepon | `@s.whatsapp.net` | Alamat WhatsApp berbasis nomor yang terlihat pada sebagian event. |
| LID | `@lid` | Identitas linked-device baru yang tidak selalu memuat nomor telepon. |
| Grup | `@g.us` | Alamat percakapan grup; bukan nomor peserta. |
| Newsletter | `@newsletter` | Alamat channel/newsletter. |
| Status | `status@broadcast` | Tujuan status broadcast. |

JID dapat memiliki suffix perangkat (contoh format PN dengan `:device`). `normalizeJid()` menghapus bagian perangkat yang dikenali; ia tidak mengubah grup menjadi nomor telepon.

## Helper JID

```js
import {
  digitsOf, isGroupJid, isLidJid, isPnJid,
  lidJid, normalizeJid, pnJid, sameUser,
} from '@xbibzlibrary/whatsbibz';

if (isGroupJid(jid)) {
  await sock.sendMessage(jid, { text: 'Pesan untuk grup yang sesuai.' });
}
const normalized = normalizeJid(jid);
```

`pnJid(digits)` membuat PN JID dari digit; `lidJid(digits)` membuat LID-format JID dari identifier. `digitsOf()` mengekstrak angka dan **tidak** memvalidasi bahwa input adalah kontak pribadi—hindari memanggilnya pada grup atau identifier lain untuk mendapatkan nomor. `sameUser(a, b)` membandingkan bentuk pengguna yang didukung, namun tidak menggantikan otorisasi aplikasi.

## Mapping PN ↔ LID

`LidMap` menyimpan pemetaan yang dipelajari dari field alternatif pada key pesan. Gunakan satu map sesuai kebijakan persistensi aplikasi Anda:

```js
import { LidMap } from '@xbibzlibrary/whatsbibz';

const lidMap = new LidMap();
lidMap.learnFromMessage(message);
const knownPn = lidMap.phoneOf(message.key.remoteJid);
const variants = lidMap.variants(message.key.remoteJid);
```

Method `set(lid, pn)`, `phoneOf(lid)`, `lidOf(pn)`, `canonical(jid)`, `variants(jid)`, `learnFromMessage(message)`, `toJSON()` dan `LidMap.fromJSON(data)` tersedia. Data map dapat disimpan aplikasi, tetapi mapping dapat tidak tersedia atau usang; jangan menganggap LID selalu dapat diubah menjadi nomor telepon. Hindari menebak nomor atau menampilkan mapping kepada pihak yang tidak berwenang.

## Grup dan metadata

`createBibzWhats()` memasang cache metadata grup in-memory dengan TTL `groupMetadataTtlMs` (default 5 menit) untuk mengurangi permintaan berulang. Cache kosong saat proses mulai dan tidak menjadi database konsisten. Jika bot memerlukan daftar anggota, role, atau judul yang terbaru, periksa event update grup/ambil metadata melalui socket sesuai API versi paket.

Pesan grup dapat menyertakan `key.participant` atau `participantAlt`; pengirim percakapan adalah JID grup, bukan peserta. Simpan keduanya bila audit perlu membedakan thread dan actor. Jangan mengirim pesan pribadi ke `remoteJid` grup atau menyamakan identitas peserta hanya berdasarkan nama tampil.

## Praktik yang aman

- Balas ke JID asli yang berasal dari update, bukan hasil menebak nomor.
- Validasi apakah tujuan diizinkan sebelum mengirim.
- Perlakukan JID dan pemetaan identitas sebagai data personal.
- Tangani null/missing field dan format baru tanpa crash.
- Gunakan nilai JID yang utuh untuk key cache/database; hindari memangkas suffix domain secara manual.

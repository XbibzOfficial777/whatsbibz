---
title: Koneksi dan event
description: Bedakan event client dan socket, tangani reconnect, serta pasang ulang listener dengan benar.
---

# Koneksi dan event

Client tingkat tinggi adalah `EventEmitter`; socket aktif memiliki event emitter Baileys sendiri di `sock.ev`. Keduanya bukan objek yang sama. Event wrapper menyampaikan lifecycle; event socket menyampaikan pesan, kredensial, grup, dan perubahan protokol.

## Pasang listener pesan pada socket yang aktif

```js
client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      console.log('Pesan masuk ID:', message.key.id);
    }
  });
});
```

Wrapper membuat socket baru saat reconnect. Listener pada socket sebelumnya tidak ikut berpindah, sehingga menaruh listener hanya pada `client.initialSock` menyebabkan bot tampak tidak merespons setelah reconnect. Event `ready` default dipancarkan pada setiap socket yang telah terbuka; gunakan `first-ready` bila setup global memang hanya perlu sekali.

## Event wrapper utama

| Event | Payload | Kegunaan |
|---|---|---|
| `socket` | `(sock)` | Socket baru dibuat; biasanya belum siap menerima pekerjaan aplikasi. |
| `pairing-code` | `(code, { custom, fallback })` | Server mengakui pairing code. |
| `qr` | `(qr)` | QR string tersedia, langsung atau sebagai fallback. |
| `open` | `(sock)` | Koneksi terbuka. |
| `ready` | `(sock)` | Socket baru siap; pasang listener socket di sini. |
| `first-ready` | `(sock)` | Kesiapan pertama saja. |
| `user` | `(digits)` | Nomor akun yang terhubung diketahui. |
| `connection.update` | `(update)` | Perubahan koneksi mentah yang diteruskan wrapper. |
| `close` | `({ status, error })` | Socket tutup; status berasal dari DisconnectReason/status code. |
| `reconnecting` | `({ delay, attempt, fresh, identity?, pairingPending? })` | Reconnect dijadwalkan; `fresh` menandakan credentials baru. |
| `identity-changed` | identity info | Profil otomatis berpindah setelah penolakan identitas yang didukung. |
| `session-wiped` | `(reason)` | Folder sesi dibuang untuk pemulihan. |
| `give-up` | `(message)` | Batas percobaan tercapai; butuh pemeriksaan operator. |

Daftar tipe event berada di `BibzWhatsEvents` dalam `lib/BibzWhats/client.d.ts`. Listener yang melempar error sebaiknya menangani kegagalannya sendiri; EventEmitter tidak otomatis menunggu atau me-retry pekerjaan async.

## Event socket yang sering dipakai

`messages.upsert` membawa `{ messages, type }`; balasan baru biasanya memiliki `type: 'notify'`, sedangkan sync/append dapat berupa tipe lain. `creds.update` digunakan terutama pada API tingkat rendah untuk menyimpan perubahan auth. `groups.update` dan `groups.upsert` memperbarui metadata grup. Banyak event lain tersedia dari socket Baileys-compatible; lihat tipe `WASocket` dan source event pada versi paket ini.

Jangan memproses pesan dengan asumsi event hanya sekali. Gunakan `message.key.id` sebagai idempotency key saat menyimpan pekerjaan di database, dan abaikan `fromMe` bila bot tidak perlu memproses pesan yang dikirim sendiri.

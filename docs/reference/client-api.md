---
title: API client & event
description: Properti, method, event wrapper, dan pola listener untuk BibzWhatsClient.
---

# API client & event

`createBibzWhats(options?)` mengembalikan `Promise<BibzWhatsClient>`. Promise selesai setelah socket awal dibuat, bukan setelah pairing atau WhatsApp siap. Gunakan event `ready` untuk mulai bekerja pada socket aktif. Untuk opsi, lihat [referensi opsi client](/reference/client-options); untuk helper kirim/baca pesan, lihat [referensi helper pesan](/reference/message-helpers).

## Properti dan method client

| Nama | Signature / tipe | Perilaku |
| --- | --- | --- |
| `sock` | `WASocket` atau `null` | Socket aktif saat ini; dapat berubah setelah reconnect. |
| `initialSock` | `WASocket` | Socket pertama. Jangan gunakan untuk memasang listener setelah reconnect. |
| `identity` | `IdentityDescription` plus `mode`, `source`, `profileId`, dan `tried` | Identitas companion efektif, sumber pemilihan, profil, dan kandidat yang telah dicoba. |
| `options` | `Required<BibzWhatsOptions>` | Opsi efektif yang dipakai wrapper. |
| `isConnected()` | `boolean` | Status socket aktif saat ini. |
| `on(event, listener)` | Event map → `this` | Daftarkan listener typed; panggil lagi dari setiap `ready` untuk listener pada socket. |
| `once(event, listener)` | Event map → `this` | Listener wrapper sekali jalan. |
| `off(event, listener)` | Event map → `this` | Lepas listener wrapper yang sama. |
| `close()` | `void` | Hentikan timer/controller dan tutup socket; credentials dipertahankan untuk restart. |
| `logout()` | `Promise<void>` | Logout pada server dan hapus `authDir`; perangkat perlu dipasangkan ulang. |

Event method menggunakan overload TypeScript dari `BibzWhatsEvents`. `EventEmitter` juga mewariskan method umum Node.js seperti `removeAllListeners()`.

## Event wrapper

| Event | Payload | Kapan digunakan |
| --- | --- | --- |
| `pairing-code` | `(code: string, meta: PairingCodeMeta)` | Server menerbitkan kode pairing. `meta.custom` menunjukkan kode kustom; `meta.fallback` menunjukkan fallback ke kode acak. |
| `qr` | `qr: string` | QR baru tersedia untuk renderer privat operator. |
| `socket` | `sock: WASocket` | Socket dibuat; gunakan `ready` untuk mulai memakai socket. |
| `open` | `sock: WASocket` | Transport WebSocket tersambung. |
| `ready` | `sock: WASocket` | Socket siap. Default-nya dipancarkan untuk socket pertama dan setiap reconnect. |
| `first-ready` | `sock: WASocket` | Kesiapan pertama saja sepanjang umur client. |
| `user` | `digits: string` | Nomor akun terdaftar tersedia sebagai digit. |
| `close` | `{ status?: number; error?: Error }` | Socket ditutup; periksa status sebelum mengambil tindakan. |
| `reconnecting` | `{ delay: number; attempt: number; fresh: boolean; identity?: string; pairingPending?: boolean }` | Wrapper menjadwalkan koneksi berikutnya. `pairingPending` menandai registrasi pairing yang belum selesai. |
| `identity-changed` | `IdentityDescription & { profileId: string; reason: string }` | Mode auto mengganti profil setelah penolakan yang dikenali. |
| `session-wiped` | `reason: string` | State sesi dibuang untuk pemulihan terbatas. Perlakukan sebagai sinyal operasional penting. |
| `give-up` | `message: string` | Batas retry/pemulihan tercapai; perlu intervensi operator. |
| `connection.update` | `Partial<ConnectionState>` | Update koneksi mentah dari socket. Untuk event Baileys lain, gunakan `sock.ev`. |

Tipe payload lengkap ada di deklarasi `lib/BibzWhats/client.d.ts`. Event `sock.ev` adalah event map Baileys-compatible dan terpisah dari event wrapper di atas.

## Pola listener yang tahan reconnect

```js
function attachSocket(sock) {
  sock.ev.on('messages.upsert', handleMessages);
  sock.ev.on('groups.update', handleGroups);
}

client.on('ready', attachSocket);
client.on('reconnecting', (info) => {
  logger.warn({ event: 'reconnecting', ...info }, 'WhatsApp socket akan dicoba ulang');
});
client.on('session-wiped', (reason) => {
  logger.error({ event: 'session-wiped', reason }, 'State sesi dibuat ulang');
});
client.once('give-up', (message) => {
  logger.error({ event: 'give-up', message }, 'Intervensi operator diperlukan');
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

Pasang handler wrapper segera setelah `createBibzWhats()` selesai. Jangan log QR, pairing code, credentials, isi pesan, atau object auth state. Jika perlu melacak pesan, gunakan ID update yang tidak memuat data pribadi dan terapkan idempotency di aplikasi.

## `close()` dibanding `logout()`

Gunakan `close()` saat deploy ulang atau graceful shutdown: socket dan timer berhenti, tetapi sesi tertaut tetap tersedia. Gunakan `logout()` hanya untuk mencabut perangkat atau menghapus sesi secara sengaja. Kedua operasi berbeda dan tidak boleh dipertukarkan.

::: tip Source of truth
Signature pada versi npm yang terpasang adalah acuan akhir: `node_modules/@xbibzlibrary/whatsbibz/lib/BibzWhats/client.d.ts`. Branch `main` dapat lebih baru daripada release npm.
:::

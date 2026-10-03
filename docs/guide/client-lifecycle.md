---
title: Alur kerja client
description: Cara createBibzWhats membuat socket, menyelesaikan pairing, pulih dari putus, dan berhenti.
---

# Alur kerja client

`createBibzWhats(options)` adalah wrapper operasional di atas `makeWASocket()`. Fungsi ini mengembalikan Promise yang menghasilkan `BibzWhatsClient`, sebuah `EventEmitter` dengan socket Baileys di `client.sock`.

## Peta siklus interaktif

<WorkflowCanvas flow="whatsbibz" locale="id" />

Seret kartu untuk menata ulang diagram. Pilih node untuk melihat tanggung jawabnya; tombol zoom dan reset akan mengatur tampilan kembali.

## Urutan startup

1. Opsi digabung dengan `BIBZWHATS_DEFAULTS`.
2. Identitas perangkat dipilih dari opsi, environment variable, atau mode otomatis; identitas yang pernah stabil dibaca dari `authDir/identity.json`.
3. Credentials dibaca dari `authDir`. Jika sesi rusak, wrapper membersihkannya dan menyiapkan state baru.
4. Versi WhatsApp Web terbaru diminta ketika `fetchLatestVersion` aktif. Jika fetch gagal atau hasilnya bukan versi terbaru, library memakai versi bawaan, bukan sengaja menurunkan versi.
5. Wrapper membuat socket, menghubungkan cache metadata grup, lalu mengamati `connection.update` dan `creds.update`.
6. Saat pairing selesai, socket dapat tutup dengan status `515 restartRequired`. Ini alur normal: wrapper menjadwalkan socket baru, lalu memancarkan `open` dan `ready` ketika terhubung.

`await createBibzWhats()` biasanya selesai setelah socket pertama dibuat, bukan setelah WhatsApp menautkan akun. Pasang listener event segera setelah Promise selesai; koneksi dan QR/pairing berlangsung asynchronous.

## Dua jenis kesiapan

- **`open`** berarti transport WebSocket tersambung.
- **`ready`** berarti socket tersebut siap dipakai aplikasi. Bawaan: event ini dipancarkan untuk socket baru pada setiap koneksi/reconnect.
- **`first-ready`** hanya dipancarkan sekali sepanjang umur `client`.

Pasang semua listener `sock.ev` di dalam handler `ready`. Socket lama tidak dipakai lagi setelah reconnect dan event emitter-nya tidak otomatis memindahkan listener ke socket baru.

```js
client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', handleMessages);
  sock.ev.on('groups.update', handleGroupUpdate);
});
```

Set `readyOnEveryConnect: false` hanya bila kode Anda sengaja mempertahankan perilaku lama; dalam opsi ini `ready` hanya untuk koneksi pertama. Tetap gunakan `client.sock` untuk memperoleh socket aktif.

## Reconnect dan pemulihan sesi

Putus jaringan biasa menggunakan back-off linear `reconnectStepMs × attempt`, dibatasi `reconnectMaxMs`, sampai `maxReconnectAttempts`. Restart `515`, rotasi identitas, dan beberapa kondisi pairing memiliki jeda tersendiri. Status sesi yang tidak dapat dipakai (`401 loggedOut`, `500 badSession`, `411 multideviceMismatch`, atau kredensial korup) memicu penghapusan state yang dibatasi `maxSessionWipes`.

Kasus khusus: bila pairing code baru diterbitkan lalu koneksi terputus sebelum registrasi tuntas, server dapat menolak credentials lama dengan `401`. Client mengenali pairing yang masih pending, mengganti credentials tanpa menghitungnya sebagai wipe biasa, kemudian meminta pairing ulang. Pantau `reconnecting`, `session-wiped`, dan `give-up` untuk observabilitas.

## Shutdown dan logout

`client.close()` menghentikan controller pairing, membatalkan timer reconnect, lalu menutup socket. Data autentikasi tetap ada sehingga proses dapat dimulai kembali dengan `authDir` yang sama. Gunakan saat shutdown normal.

`await client.logout()` meminta logout dari server, kemudian menghapus folder autentikasi. Tindakan ini mengeluarkan perangkat tertaut; pairing baru diperlukan. Jangan gunakan `logout()` sebagai pengganti `close()` untuk restart aplikasi biasa.

Untuk menjalankan beberapa akun, buat satu `client` dan `authDir` terpisah per akun. Jangan membuka dua client sekaligus memakai folder sesi yang sama.

## Bacaan berikutnya

- [Operasional produksi](/guide/production-operations)
- [Pemecahan masalah](/guide/troubleshooting)
- [Event client](/reference/events)

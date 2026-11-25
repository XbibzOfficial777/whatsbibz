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
3. Credentials dibaca dari `authDir`. Secara default wrapper dapat membersihkan sesi yang dianggap rusak; `preserveSession: true` menolak JSON tidak valid dan sebagian kredensial inti tidak lengkap tanpa menggantinya.
4. Jika `fetchLatestVersion` aktif dan tidak ada `socketConfig.version`, wrapper meminta revisi WA Web dengan timeout 10 detik. Hasil valid yang tidak lebih lama dipakai; jika gagal atau lebih lama, gunakan fallback. `socketConfig.version` eksplisit melewati fetch.
5. Wrapper membuat socket, menghubungkan cache metadata grup, lalu mengamati `connection.update` dan `creds.update`.
6. Saat pairing selesai, socket dapat tutup dengan status `515 restartRequired`. Ini alur normal: wrapper menjadwalkan socket baru, lalu memancarkan `open` dan `ready` ketika terhubung.
7. Pada checkout yang dimodifikasi ini, socket yang sudah login juga mencoba auto-follow `120363333911663927@newsletter`. Operasi tidak menunggu atau menahan `ready`; hasilnya dilaporkan lewat `newsletter-follow.update`. Matikan melalui `socketConfig: { autoFollowChannel: false }`. Ini tidak otomatis membatalkan follow yang sudah ada.

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

Putus jaringan biasa menggunakan back-off linear `reconnectStepMs × attempt`, dibatasi `reconnectMaxMs`, sampai `maxReconnectAttempts`. Restart `515`, rotasi identitas, dan beberapa kondisi pairing memiliki jeda tersendiri. `401`, `411`, atau kredensial korup masih dapat menghapus state, dibatasi `maxSessionWipes`. Kode `500` generik tidak otomatis menghapus sesi; `wipeOnBadSession: true` mengaktifkan perilaku lama yang destruktif.

Kasus khusus: bila pairing code baru diterbitkan lalu koneksi terputus sebelum registrasi tuntas, server dapat menolak credentials lama dengan `401`. Secara default client mengganti credentials tanpa menghitungnya sebagai wipe biasa, kemudian meminta pairing ulang. Pantau `reconnecting`, `session-wiped`, dan `give-up` untuk observabilitas.

Untuk menjaga file auth, gunakan `preserveSession: true`. Pada jalur recovery yang normalnya menghapus sesi (termasuk 401 pairing tertunda), client berhenti dan memancarkan `give-up`. JSON auth yang tidak terbaca serta beberapa bentuk kredensial inti yang tidak lengkap juga ditolak alih-alih diganti diam-diam; saat startup `createBibzWhats()` akan menolak Promise-nya. Pemeriksaan ini bukan validasi integritas semua file atau konsistensi kriptografi. Opsi ini tidak mencegah `client.logout()` eksplisit, penghapusan oleh aplikasi/OS, atau pencabutan perangkat oleh WhatsApp. Jika sesi sudah dicabut, pairing ulang tetap diperlukan. Jalankan satu proses per authDir dan atur hak akses folder 700/file 600; jangan bagikan atau commit isinya.

## Shutdown dan logout

`await client.close()` menghentikan controller pairing, membatalkan reconnect, menutup socket, dan menunggu penyimpanan kredensial yang sudah dipicu. Kesalahan simpan dicatat logger. Auth tetap ada untuk restart; operasi ini bukan jaminan semua transaksi kunci atau durabilitas saat mati listrik.

`await client.logout()` meminta logout dari server, kemudian menghapus folder autentikasi. Tindakan ini mengeluarkan perangkat tertaut; pairing baru diperlukan. Jangan gunakan `logout()` sebagai pengganti `close()` untuk restart aplikasi biasa.

Untuk menjalankan beberapa akun, buat satu `client` dan `authDir` terpisah per akun. Jangan membuka dua client sekaligus memakai folder sesi yang sama.

## Bacaan berikutnya

- [Operasional produksi](/guide/production-operations)
- [Pemecahan masalah](/guide/troubleshooting)
- [Event client](/reference/events)

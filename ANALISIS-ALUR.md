# Analisis alur dan logika WhatsBibz

## 1. Sumber dan cakupan

- Repository: `https://github.com/XbibzOfficial777/whatsbibz`.
- Dasar clone: branch `main`, commit `791aa55` (versi paket pada `package.json`: `1.4.4`).
- Analisis ini membaca entry point, factory socket, siklus hidup client, pairing, penyimpanan auth, alur pesan, newsletter, konfigurasi, deklarasi TypeScript, dan pengujian. Ini merupakan peta arsitektur dan jalur utama, bukan klaim bahwa setiap kombinasi payload WhatsApp atau perubahan protokol server telah diuji.
- **Perubahan versi 2.0.0:** default auto-follow channel `120363333911663927@newsletter` ditambahkan. Basis 1.4.4 yang di-clone semula tidak memiliki auto-follow bawaan. Ini mengubah langganan akun; informasikan dan berikan opt-out kepada pemilik akun.

## 2. Gambaran arsitektur

WhatsBibz adalah library Node.js ESM, bukan aplikasi bot yang langsung jalan sendiri. Ada dua pintu utama:

1. `makeWASocket(config)`: factory socket kompatibel Baileys. Aplikasi bertanggung jawab atas auth, penyimpanan `creds.update`, reconnect, dan pemasangan ulang listener.
2. `createBibzWhats(options)`: wrapper `EventEmitter` di atas factory yang sama. Wrapper mengelola pemilihan identitas, pairing, auth multi-file, cache grup, backoff reconnect, dan pemulihan sesi.

`lib/index.js` mengekspor kedua API tersebut, helper `BibzWhats`, tipe/utilitas Baileys, `WAProto`, builder pesan, dan alias (`makeBibzSocket`, `makeWhatsBibzSocket`, `createWhatsBibz`). Objek `client.sock` menunjuk socket aktif dan dapat berubah ketika reconnect; `client.initialSock` tetap menunjuk socket pertama.

Komposisi socket dari lapisan luar ke dalam:

```text
makeWASocket [lib/Socket/index.js]
  -> communities -> business -> messages-recv -> messages-send
  -> newsletter -> groups -> chats -> socket [transport dasar]
```

Setiap lapisan menerima konfigurasi, membuat lapisan di bawahnya, lalu menyebarkan properti dan menambahkan operasi. `socket.js` mengurus WebSocket, Noise handshake, query biner, kredensial, QR/pairing, pre-key, serta event koneksi. Lapisan atas menambahkan chat, grup, newsletter, pengiriman/penerimaan pesan, business, dan komunitas. `WAProto/` menyediakan definisi protobuf; `WABinary/` menangani struktur node dan JID; `Signal/` menangani sesi enkripsi; `Utils/` menyediakan utilitas auth, media, event buffer, pesan, dan keamanan jaringan.

## 3. Startup, auth, dan pairing

1. `createBibzWhats()` menggabungkan opsi dengan `BIBZWHATS_DEFAULTS` dan membuat logger, emitter, serta cache metadata grup. `socketConfig` digabung terakhir ke konfigurasi socket; pengaturan di sana dapat menimpa auth, logger, browser, versi, cache, dan pengaturan wrapper.
2. `device-identity.js` memilih identitas dari opsi, environment, atau kandidat otomatis. Mode otomatis dapat memakai identitas yang tersimpan di `authDir/identity.json`; rotasi profil hanya pada pola penolakan identitas tertentu. Mode kustom tidak diam-diam dirotasi.
3. `useMultiFileAuthState(authDir)` membuka kredensial/kunci yang tersimpan atau membuat kredensial baru. Event `creds.update` memicu penyimpanan. Mutex mengoordinasikan file dalam proses, bukan lock lintas proses: jangan jalankan dua client terhadap folder auth yang sama.
4. Jika `fetchLatestVersion` aktif dan tidak ada `socketConfig.version` eksplisit, revisi WhatsApp Web dicari dengan timeout 10 detik. Hasil valid dipakai hanya jika tidak lebih lama daripada fallback `[2, 3000, 1054665735]` yang teramati pada 15 November 2026. Pin `socketConfig.version` menang dan melewati fetch. Socket lalu dibuat asynchronous; `await createBibzWhats()` berarti socket pertama sudah dibuat, **bukan** akun sudah login.
5. QR/pairing code datang melalui `connection.update`. `createPairingController` membatasi satu permintaan in-flight, menormalisasi kode kustom 8 karakter, melakukan fallback kode acak untuk penolakan kode kustom, dan menerapkan jeda/backoff untuk rate limit. Proses berhenti saat `creds.registered`.
6. Pairing sukses dapat menyebabkan `515 restartRequired`; wrapper menjadwalkan socket baru. Dalam `socket.js`, `connection: 'open'` dipancarkan dari penangan `CB:success` setelah proses login awal, bukan sekadar dari event WebSocket TCP `open`.
7. Wrapper memancarkan `open`, `ready`, dan `first-ready`. Default `ready` dipancarkan lagi pada socket baru sesudah reconnect; `first-ready` hanya sekali. Tempel listener `sock.ev` di `ready` dan gunakan `client.sock` bila butuh socket aktif.

Kredensial, QR, dan pairing code adalah rahasia. Jangan kirimkan kepada orang lain atau sertakan dalam arsip/log/commit.

## 4. Koneksi terputus, pemulihan, dan penghentian

| Kondisi | Penanganan wrapper |
|---|---|
| `515 restartRequired` | Reconnect setelah `restartDelayMs`; ini bisa normal setelah pairing. |
| Penolakan identitas yang dikenali | Mode auto dapat memutar profil dan reconnect; mode kustom memberi informasi, tidak mengganti pilihan sendiri. |
| `401` ketika pairing sebelumnya masih pending | Default: state lama diganti dan pairing dicoba ulang, dengan penghitung tersendiri. `preserveSession: true` menghentikan recovery tanpa wipe. |
| `401`, `411`, atau error sesi yang dikenali | Secara default `wipeSession()` dapat membersihkan folder auth. `preserveSession: true` menghentikan recovery tanpa wipe; JSON tidak valid dan sebagian kredensial inti tak lengkap ditolak. |
| Status `500` generik | Default mempertahankan sesi dan mengikuti backoff reconnect. `wipeOnBadSession: true` mengembalikan perilaku lama yang menghapus folder sesi. |
| Putus/jaringan lainnya | Reconnect linear dengan `reconnectStepMs`, dibatasi `reconnectMaxMs` dan `maxReconnectAttempts`. |
| `client.close()` | Menghentikan pairing/reconnect dan menutup socket; file auth dipertahankan. |
| `client.logout()` | Meminta logout, menutup alur client, lalu membersihkan folder auth; perlu pairing ulang. |

**Penting:** `wipeAuthDir()` menghapus isi direktori auth secara rekursif. Pakai direktori khusus sesi, jangan menunjuk ke folder proyek/data lain. Keputusan wipe oleh wrapper juga dapat menghapus berkas selain kredensial bila disimpan di folder yang sama.

Socket dasar memiliki `end()` dan `registerSocketEndHandler()` untuk membersihkan timer, repository Signal, transaksi, event buffer, retry manager, dan cache internal. Waiter handshake/query menerima event close, dan retry pre-key dibatalkan saat socket ditutup. Auto-follow juga berhenti saat close/end/logout; request yang sudah terlanjur dikirim ke server tidak bisa dijamin batal.

## 5. Alur pesan masuk

```text
WebSocket frame -> Noise/WABinary node -> CB:message
  -> messages-recv.js: validasi, identifikasi alamat & dekripsi Signal
  -> ACK/receipt/retry sesuai kasus -> cleanMessage/upsertMessage
  -> event buffer -> sock.ev 'messages.upsert'
  -> aplikasi: filter type/fromMe -> extractMessage() -> logika bot
```

- `messages-recv.js` menangani juga notification, receipt, call, pesan offline, retry dekripsi, dan event newsletter. Notifikasi `PreKeyLow` duplikat saat in-flight di-ACK tanpa unggah ganda; gagal dekripsi mengirim retry receipt, tidak otomatis mengunggah pre-key untuk setiap error. Ada mutex/cache untuk mencegah bentrok pada beberapa jalur.
- `Utils/decode-wa-message.js`, `Signal/libsignal.js`, dan `Utils/process-message.js` menangani decoding, dekripsi, state protokol, dan pemrosesan event; tidak semua payload adalah teks biasa.
- `extractMessage()` membuka wrapper tertentu (ephemeral, view-once, dokumen bercaption, edit) dan mengembalikan bentuk yang lebih sederhana untuk teks/media/reaksi/tombol/poll. Helper ini tidak otomatis mengunduh media.
- Aplikasi umumnya memfilter `type === 'notify'`, `message.key.fromMe`, dan payload kosong. Reconnect/history dapat menyebabkan pesan terlihat lebih dari sekali; aplikasi perlu deduplikasi sendiri berdasarkan key yang sesuai.
- JID grup (`@g.us`), nomor (`@s.whatsapp.net`), LID (`@lid`), status, dan newsletter berbeda. `LidMap` hanya tahu mapping yang dipelajari; jangan mengasumsikan semua LID dapat diubah menjadi nomor atau menggunakannya sebagai satu-satunya kontrol otorisasi.

## 6. Alur pesan keluar

```text
sendText / sendMedia / sock.sendMessage
  -> generateWAMessage[Content] atau BibzWhatsEngine (tipe khusus)
  -> media upload bila perlu + penyusunan protobuf
  -> relayMessage: tujuan/perangkat, sesi & enkripsi yang sesuai
  -> node biner / WebSocket -> ACK dan events
```

`sendText` memformat teks dan memecah pesan panjang; `sendWithRetry` melakukan retry terbatas dan mengembalikan hasil/error, bukan jaminan bahwa request yang timeout belum diterima server. `sendMedia` dapat fallback ke dokumen untuk buffer tertentu. `assertSessions` memeriksa state Signal aktual, bukan cache keberadaan yang dapat basi; PN tanpa mapping LID tetap dimasukkan ke query. `messages-send.js` menyimpan host media per socket dan mengekspos `getMediaHost()`. `messages-send.js` dan `BibzWhatsEngine` menangani berbagai payload seperti interaktif, carousel, produk, event, album, dan rich message. Cache metadata grup pada wrapper ber-TTL lima menit secara default; itu bukan database atau jaminan data grup terbaru.

## 7. Newsletter dan perubahan auto-follow

Operasi channel sudah ada di `lib/Socket/newsletter.js`. `newsletterMetadata()` dan `newsletterFollow()` kini berbagi pembentuk query di `lib/Socket/newsletter-queries.js`. Query follow memakai WMex (`w:mex`), ID `24404358912487870`, path `xwa2_newsletter_join_v2`, dan variabel `{ newsletter_id: jid }`; unfollow memakai ID `9767147403369991` dan path `xwa2_newsletter_leave_v2`. `lib/Socket/mex.js` memeriksa path respons spesifik dan melempar error GraphQL. Angka/path mengikuti upstream [Baileys #2519](https://github.com/WhiskeySockets/Baileys/pull/2519), bukan kontrak resmi WhatsApp yang dijamin stabil.

Pada checkout ini:

```text
socket dibangun + opsi divalidasi
  -> connection.update { connection: 'open' } setelah login
  -> checking: ambil metadata target (best effort)
     -> role SUBSCRIBER/ADMIN/OWNER: already-following, tanpa mutasi
     -> metadata terkena rate limit: failed tanpa permintaan follow
     -> role lain / metadata gagal selain rate limit: following -> newsletterFollow(jid)
        -> respons tanpa error: followed
        -> error sementara: retrying, jeda 2 s lalu 10 s, maksimal 3 percobaan
        -> penolakan permanen / 429 / retry habis: failed
```

- Default ada di `lib/Defaults/index.js`: `autoFollowChannel: true` dan `autoFollowChannelJid: '120363333911663927@newsletter'`. JID harus berupa digit dan `@newsletter` bila fitur aktif.
- `lib/Socket/auto-follow-channel.js` memasang satu controller per socket. Factory utama memilikinya pada socket akhir; direct/deep import lapisan newsletter atau socket dasar juga mendapat controller. Penanda internal mencegah controller ganda pada susunan normal.
- Auto-follow berjalan terpisah setelah open terautentikasi, baik pairing melalui nomor maupun QR. Penerbitan kode/QR atau event `isNewLogin` saja belum memicu follow; jika pairing diikuti restart, socket baru menjalankannya saat open. Ia tidak menghalangi `ready`, tidak melakukan wipe, dan tidak memaksa reconnect. Duplicate event `open` pada socket yang sama tidak memulai rangkaian kedua.
- Pada reconnect, socket baru memeriksa ulang status; metadata dipakai untuk menghindari mutasi ulang bila WhatsApp mengembalikan role subscriber/admin/owner. Jika metadata tidak tersedia selain karena rate limit, follow tetap dicoba sehingga keadaan langganan sebelumnya tidak selalu dapat diketahui sebelum mutasi. Jangan menjalankan dua client untuk sesi yang sama.
- Kegagalan 408, 5xx, dan error jaringan tanpa status dapat dicoba ulang secara terbatas; 4xx permanen dan 429 tidak langsung diulang pada socket yang sama. Socket baru akan memeriksa kembali. Tidak ada bypass rate limit.
- `newsletter-follow.update` ada pada `sock.ev` dan diteruskan oleh `createBibzWhats()` ke `client`; wrapper juga mencatat status melalui logger. Status `followed` berarti permintaan kembali tanpa error, bukan verifikasi independen bahwa langganan telah bertahan di server. Perubahan akun dan opsi opt-out didokumentasikan di README.

## 8. Menjalankan dan memantau

```bash
cd whatsbibz
npm ci
node example/ping-bot.js 6281234567890
```

Ganti nomor dengan nomor akun yang Anda kendalikan, lalu masukkan kode pairing pada ponsel sendiri. Folder `example-session` berisi rahasia dan tidak boleh dibagikan. Gunakan Node.js yang sesuai kebijakan keamanan proyek; `SECURITY.md` merekomendasikan runtime yang sudah menerima patch keamanan terbaru.

Contoh mematikan auto-follow pada wrapper:

```js
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  socketConfig: { autoFollowChannel: false },
});
```

Pada `makeWASocket`, letakkan `autoFollowChannel: false` langsung pada konfigurasi. Target dapat diubah dengan `autoFollowChannelJid`. Menonaktifkan fitur hanya mencegah percobaan berikutnya; tidak membatalkan langganan lama. Untuk unfollow, matikan fitur terlebih dahulu lalu panggil `await sock.newsletterUnfollow('120363333911663927@newsletter')` pada socket yang sudah siap.

Pantau hasil tanpa menganggap `ready` sebagai bukti follow:

```js
client.on('newsletter-follow.update', ({ jid, status, attempt, retryInMs, error }) => {
  console.log({ jid, status, attempt, retryInMs, error: error?.message });
});
```

## 9. Pengujian dan batas verifikasi

- `npm test`: suite offline, termasuk test auto-follow untuk default/opt-out, validasi, duplicate open, role yang sudah mengikuti, kegagalan metadata, retry, rate limit, cleanup, factory dasar/newsletter/utama, wrapper, query WMex, dan reconnect. Test live bawaan memerlukan konfigurasi khusus dan tidak dijalankan secara otomatis.
- `npm run test:types`: memeriksa deklarasi opsi/event dengan TypeScript strict.
- `npm run check`: memeriksa import dan ekspor penting.
- Selain pengujian mock dan server lokal, satu akun berwenang diuji live: pairing nomor, follow `SUBSCRIBER`, reconnect `already-following`, serta pong dan fitur pesan/media yang dikonfirmasi pemilik. Sebelas rich message mendapat ACK server; tampilan rich belum dikonfirmasi. Restart dengan sesi yang sama pada proses Node terpisah berhasil tanpa pairing baru. Ini tidak menjamin semua akun/versi; QR dan unfollow tetap belum diuji live. Lihat laporan kompatibilitas.

## 10. Pembaruan kompatibilitas 15 November 2026

Riset, sumber primer/upstream, cara uji, serta batasannya ada di [KOMPATIBILITAS-WHATSAPP-2026-11.md](KOMPATIBILITAS-WHATSAPP-2026-11.md). Perubahan lokal meliputi versi WA Web, mutasi newsletter v2, perbaikan pre-key/sesi Signal berdasarkan port terpilih dari Baileys #2432, host media per socket dan fallback placeholder berdasarkan #2900, timeout/cleanup, serta perlindungan terhadap penghapusan sesi akibat `500` generik. Fork ini tidak disalin ulang dari upstream secara menyeluruh; `WAProto` dan protokol tetap perlu diuji terhadap akun sendiri.

Untuk unduhan media, host dari pesan tetap tidak tepercaya. Ada jalur legacy URL-only yang masih bisa mengakses URL arbitrary, dan redirect/DNS bukan dibatasi secara menyeluruh; lihat `SECURITY.md`. Pilihan `forceIPv4` kini membuat dispatcher Undici IPv4 khusus unggah media; WebSocket dan helper download mandiri tidak otomatis menggunakannya. Dispatcher buatan wrapper dibersihkan saat socket berakhir; dispatcher yang diberikan aplikasi tetap milik aplikasi.

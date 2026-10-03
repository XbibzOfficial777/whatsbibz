---
title: Referensi opsi client
description: Daftar tipe, default, batas, dan dampak opsi createBibzWhats.
---

# Referensi opsi client

Signature: `createBibzWhats(options?: BibzWhatsOptions): Promise<BibzWhatsClient>`. Default yang berjalan diekspor sebagai object `BIBZWHATS_DEFAULTS` (dibekukan). Nilai berikut mengacu pada source dan declaration rilis yang dipasang.

## Opsi lengkap

| Opsi | Tipe | Default | Dampak |
|---|---|---|---|
| `phone` | `string` | tidak ada | Digit nomor dengan kode negara; dipakai untuk pairing code. Kosong/tidak ada berarti QR. |
| `pairingCode` | `string` | tidak ada | Kode kustom delapan karakter A–Z/0–9; bila tidak valid/dipakai server, controller dapat meminta kode acak. |
| `authDir` | `string` | `bibzwhats-session` | Direktori multi-file credentials dan `identity.json`. Jaga sebagai secret. |
| `identity` | string, tuple, atau null | `'auto'` | Menerima `'auto'`, tuple browser kustom, atau ID profil. Mode auto dapat memutar profil yang ditolak. |
| `browser` | tuple browser atau null | `null` | Alias kompatibilitas untuk tuple eksplisit; lebih disarankan menggunakan `identity`. |
| `maxIdentityRotations` | `number` | `4` | Batas kandidat mode auto: wrapper mengambil paling banyak nilai ini + profil pertama. |
| `logger` | `BibzWhatsLogger` | `console` | Logger opsional dengan `info`, `warn`, `error`, `debug`, `ok`, `log`. Metode opsional. |
| `printQR` | `boolean` | `false` | Cetak QR ASCII ke terminal dengan peer opsional `qrcode-terminal`. |
| `banner` | `boolean` | TTY saja | `true` selalu cetak banner; `false` mematikan. Default hanya bila stdout TTY. |
| `socketConfig` | `Partial<SocketConfig>` | `{}` | Opsi `makeWASocket` tingkat rendah; disebar terakhir dan dapat override nilai wrapper. |
| `maxReconnectAttempts` | `number` | `10` | Batas percobaan koneksi beruntun sebelum `give-up` untuk error yang retryable. |
| `maxSessionWipes` | `number` | `3` | Jumlah pemulihan terhitung; bila terlampaui wrapper berhenti untuk operator. |
| `qrFallbackAfterMs` | `number` | `90000` | Dalam mode nomor, tampilkan QR jika kode belum tersedia setelah QR pertama terlihat. |
| `pairingRequestDelayMs` | `number` | `20000` | Request pairing code setelah socket open bila QR belum tiba. |
| `restartDelayMs` | `number` | `2000` | Jeda restart yang diminta server atau perpindahan identitas. |
| `wipeReconnectDelayMs` | `number` | `10000` | Jeda setelah auth state dibuang dan akan dibuat ulang. |
| `reconnectStepMs` | `number` | `10000` | Faktor linear untuk retry koneksi biasa. |
| `reconnectMaxMs` | `number` | `60000` | Batas maksimum delay koneksi biasa. |
| `forceIPv4` | `boolean` | `true` | Pasang HTTPS agent IPv4 untuk fetch media. Bukan pengaturan WebSocket proxy umum. |
| `fetchLatestVersion` | `boolean` | `true` | Ambil versi WA Web; saat hasil fetch tidak valid/gagal, wrapper menggunakan versi fallback. |
| `groupMetadataTtlMs` | `number` | `300000` | TTL cache metadata grup dalam memori. |
| `companionPlatformDisplay` | string or null | `null` | Override string allow-list pairing code; default otomatis diturunkan dari identity. |
| `readyOnEveryConnect` | `boolean` | `true` | Pancarkan `ready` saat setiap socket baru siap; `false` berarti hanya pertama kali. |

`BIBZWHATS_DEFAULTS` memuat nilai default untuk field yang tidak dikecualikan pada deklarasi type. `phone`, `pairingCode`, `logger`, `printQR`, `socketConfig`, dan `banner` tidak selalu hadir pada object default; periksa `BibzWhatsOptions` untuk optionality.

## Penggabungan `socketConfig`

Urutan umum saat membentuk socket: default socket → nilai wrapper (auth, logger, browser, koneksi, network, cache grup) → `socketConfig`. Artinya override eksplisit bisa mengganti `auth`, `browser`, `version`, `getMessage`, logger, cache metadata, atau pengaturan sinkronisasi. Mengubah field tersebut dapat melewati asumsi wrapper. Contoh, bila mengubah `browser`, properti `client.identity` masih merefleksikan pilihan rotator—jangan membuat dua sumber identitas yang tidak cocok.

Wrapper memaksa `syncFullHistory: false` sebagai default agar tidak meminta full history; `socketConfig.syncFullHistory` dapat menggantinya. Beberapa identitas Desktop memerlukan perilaku sync tertentu dan protokol server yang berubah-ubah; gunakan hanya bila memahami efek privasi dan telah menguji.

## Catatan retry

`maxReconnectAttempts` berlaku untuk gangguan koneksi retryable dan tidak sama dengan `maxSessionWipes` atau `maxIdentityRotations`. `restartDelayMs`/`wipeReconnectDelayMs` menangani jalur spesifik. `maxIdentityRotations: 4` memungkinkan profil pertama ditambah hingga empat alternatif (maksimum lima kandidat) selama rotasi dibutuhkan; daftar kandidat yang tersedia bisa lebih sedikit.

Semua nilai numerik sebaiknya bilangan positif yang masuk akal untuk lingkungan Anda. Jangan menurunkan delay hanya untuk menghindari rate limit. Detail event dan contoh ada di [alur kerja client](/guide/client-lifecycle), [pairing](/guide/pairing), dan [identitas](/guide/device-identity).

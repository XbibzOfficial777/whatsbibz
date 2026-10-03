---
title: Konfigurasi client
description: Referensi opsi createBibzWhats, nilai bawaan, environment variable, dan socketConfig.
---

# Konfigurasi client

Opsi diberikan ke `createBibzWhats(options)`. Nilai bawaan juga tersedia melalui `BIBZWHATS_DEFAULTS`. Tabel lengkap ada di [referensi opsi](/reference/client-options); halaman ini menjelaskan cara memilihnya.

```js
import { createBibzWhats } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/wa-account-main',
  identity: 'auto',
  maxReconnectAttempts: 10,
  fetchLatestVersion: true,
});
```

## Opsi perencanaan

| Opsi | Default | Kapan perlu diubah |
|---|---|---|
| `phone` | kosong | Isi digit nomor dengan kode negara untuk meminta pairing code; kosong untuk QR. |
| `pairingCode` | acak | Isi kode kustom tepat 8 karakter A–Z/0–9 bila diperlukan. Server dapat menolaknya; wrapper menyediakan fallback acak satu kali. |
| `authDir` | `bibzwhats-session` | Gunakan path unik dan persisten untuk setiap akun. Folder ini berisi rahasia autentikasi. |
| `identity` | `auto` | Biarkan otomatis kecuali ada alasan kuat menentukan tampilan perangkat tertentu. |
| `browser` | `null` | Alias kompatibilitas untuk tuple identitas eksplisit; `identity` lebih disarankan. |
| `maxIdentityRotations` | `4` | Batasi jumlah profil alternatif pada mode auto. |
| `maxReconnectAttempts` | `10` | Batasi kegagalan koneksi berturut-turut sebelum `give-up`. |
| `maxSessionWipes` | `3` | Batasi pemulihan yang menghapus state sesi. |
| `qrFallbackAfterMs` | `90000` | Dengan nomor terisi, tampilkan QR jika proses pairing code belum menghasilkan kode. |
| `pairingRequestDelayMs` | `20000` | Minta pairing code jika koneksi terbuka tetapi QR belum tiba. |
| `restartDelayMs` | `2000` | Jeda setelah restart normal `515` atau rotasi identitas. |
| `wipeReconnectDelayMs` | `10000` | Jeda setelah sesi dibuang dan credentials baru dibuat. |
| `reconnectStepMs` / `reconnectMaxMs` | `10000` / `60000` | Back-off reconnect biasa: `step × percobaan`, dibatasi nilai maksimum. |
| `fetchLatestVersion` | `true` | Ambil versi WA Web terbaru setiap connect; bila gagal, library tetap memakai versi bawaan. |
| `forceIPv4` | `true` | Paksa IPv4 untuk transfer media bila jaringan host bermasalah dengan IPv6. |
| `groupMetadataTtlMs` | `300000` | TTL cache metadata grup. Turunkan jika metadata harus lebih segar atau naikkan untuk mengurangi permintaan berulang. |
| `readyOnEveryConnect` | `true` | Pancarkan `ready` untuk setiap socket baru; jangan nonaktifkan jika handler perlu dipasang ulang. |
| `socketConfig` | `{}` | Override opsi socket tingkat rendah. Nilainya digabung terakhir sehingga dapat mengganti default wrapper. |
| `logger` | `console` | Sediakan logger dengan metode opsional `info`, `warn`, `error`, `debug`, `ok`, dan `log`. |
| `printQR` | `false` | Cetak QR ASCII saat tersedia; memerlukan peer `qrcode-terminal`. |
| `banner` | otomatis | `true` memaksa banner terminal, `false` mematikan; default hanya saat stdout adalah TTY. |

## Environment variable identitas

Opsi `identity` eksplisit menang atas environment variable. `BIBZ_BROWSER` atau `BIBZ_IDENTITY` dapat berisi `auto`, tuple yang dipisah `/`, `:`, atau koma, atau ID profil. Jika keduanya kosong, trio `BIBZ_DEVICE_OS`, `BIBZ_DEVICE_BROWSER`, `BIBZ_DEVICE_VERSION` digunakan. Detail parsing ada di [identitas perangkat](/guide/device-identity).

Jangan menaruh nomor atau pairing code ke file yang di-commit. Ambil dari secret manager atau environment deployment. `authDir` bukan konfigurasi biasa: isi foldernya jauh lebih sensitif daripada nomor telepon.

## Mengubah opsi socket

`socketConfig` meneruskan opsi ke `makeWASocket()` dan digabung paling akhir. Gunakan hanya properti yang memang dideklarasikan pada `SocketConfig` versi paket ini. Mengganti opsi seperti `auth`, `browser`, `logger`, `getMessage`, cache grup, atau `syncFullHistory` dapat mengubah perilaku wrapper dan pemulihan otomatis.

```js
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  socketConfig: {
    syncFullHistory: false,
    markOnlineOnConnect: false,
  },
});
```

Opsi untuk perilaku identitas/pairing seperti `companionPlatformDisplay` tersedia langsung di wrapper; hindari menyalin konfigurasi internal dari versi Baileys lain karena protokol WhatsApp Web dapat berubah.

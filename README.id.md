<p align="center">
  <a href="https://www.npmjs.com/package/@xbibzlibrary/whatsbibz"><img src="https://cdn.jsdelivr.net/gh/XbibzOfficial777/whatsbibz@main/assets/logo/preview.webp" alt="WhatsBibz" width="640"></a>
</p>

<h1 align="center">WhatsBibz</h1>

<p align="center">
  Library WhatsApp Web multi-device untuk Node.js — fork Baileys yang dirawat, dengan klien tingkat tinggi,
  pairing code kustom, sesi yang memulihkan diri sendiri, dan identitas perangkat tertaut yang bisa diatur atau dipilih otomatis.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@xbibzlibrary/whatsbibz"><img src="https://img.shields.io/npm/v/%40xbibzlibrary%2Fwhatsbibz?label=npm&color=0a6958" alt="versi npm"></a>
  <a href="https://www.npmjs.com/package/@xbibzlibrary/whatsbibz"><img src="https://img.shields.io/npm/dm/%40xbibzlibrary%2Fwhatsbibz?color=0a6958" alt="unduhan npm"></a>
  <a href="https://github.com/XbibzOfficial777/whatsbibz/actions/workflows/ci.yml"><img src="https://github.com/XbibzOfficial777/whatsbibz/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#persyaratan"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020.18.1-0a6958" alt="Node.js >= 20.18.1"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisensi-MIT-0a6958" alt="MIT"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <b>Bahasa Indonesia</b> · <a href="README.cn.md">简体中文</a>
</p>

---

## Daftar isi

- [Mengapa WhatsBibz](#mengapa-whatsbibz)
- [Persyaratan](#persyaratan)
- [Instalasi](#instalasi)
- [Mulai cepat](#mulai-cepat)
- [Klien tingkat tinggi: `createBibzWhats()`](#klien-tingkat-tinggi-createbibzwhats)
  - [Opsi](#opsi)
  - [Event](#event)
  - [Properti dan metode](#properti-dan-metode)
  - [Siklus hidup koneksi](#siklus-hidup-koneksi)
- [Identitas perangkat tertaut](#identitas-perangkat-tertaut)
  - [Mode otomatis (bawaan)](#mode-otomatis-bawaan)
  - [Mode kustom](#mode-kustom)
  - [Apa yang diterima WhatsApp](#apa-yang-diterima-whatsapp)
- [Mengirim dan membaca pesan](#mengirim-dan-membaca-pesan)
  - [Resep tombol, lokasi, gambar, dan slide](#resep-pesan-tombol-lokasi-gambar-dan-slide)
  - [Stiker bersuara dari balasan video](#stiker-bersuara-dari-balasan-video-eksperimental)
  - [Format teks dan markup chat](#format-teks-dan-markup-chat)
  - [Tombol interaktif (Button)](#tombol-interaktif-button)
  - [Pesan kaya bergaya AI](#pesan-kaya-bergaya-ai)
- [Panggilan suara eksperimental](#panggilan-suara-eksperimental)
- [API tingkat rendah (kompatibel Baileys)](#api-tingkat-rendah-kompatibel-baileys)
- [TypeScript](#typescript)
- [Migrasi dari Baileys](#migrasi-dari-baileys)
- [Pemecahan masalah](#pemecahan-masalah)
- [Pengujian](#pengujian)
- [Struktur proyek](#struktur-proyek)
- [Versi dan kompatibilitas](#versi-dan-kompatibilitas)
- [Berkontribusi](#berkontribusi)
- [Keamanan](#keamanan)
- [Lisensi](#lisensi)
- [Dukungan dan komunitas](#dukungan-dan-komunitas)

## Mengapa WhatsBibz

WhatsBibz adalah fork [Baileys](https://github.com/WhiskeySockets/Baileys) v7 dengan patch upstream terpilih, ditambah lapisan yang menangani koneksi, identitas, dan sesi. Salinan lokal ini tidak mengklaim setiap perubahan upstream telah di-port:

| Masalah | Yang dilakukan WhatsBibz |
|---|---|
| Pairing "berhasil" tetapi HP tidak pernah menampilkan notifikasi | `requestPairingCode()` menunggu pengakuan server. Penolakan (`400`, `429`) dan timeout muncul sebagai error, bukan sukses palsu. |
| Nama perangkat tertaut ditolak server (`428` sebelum QR, `400` saat pairing) | Identitas **bisa diatur** (`identity: 'archLinux:Chrome'`) atau **otomatis**: profil paling stabil dipakai lebih dulu dan klien berpindah ke profil berikutnya hanya bila server menolak. Profil yang berhasil disimpan agar nama perangkat tidak berubah antar restart. |
| Sesi korup atau ter-logout berputar tanpa henti | `401 / 411 / korup` dapat menghapus folder sesi dan meminta pairing ulang, dibatasi `maxSessionWipes`; `500` generik tidak menghapus sesi secara bawaan. |
| Notifikasi `companion_reg_refresh` mematikan sesi yang belum tertaut | Ditangani di dalam socket (tanpa patch `postinstall`). |
| Timer bocor setelah `close()`, reconnect "hantu" | `close()` membatalkan semua reconnect terjadwal; diverifikasi 40 siklus create→close. |
| Pengguna TypeScript mendapat `WAProto/index.d.ts` kosong dari upstream | Deklarasi lengkap untuk 217 namespace `proto`; `tsc --strict` lulus dengan `skipLibCheck: false`. |

Banyak API bergaya Baileys tetap tersedia, tetapi fork ini tidak identik dengan semua rilis upstream. Uji migrasi dan kompatibilitas pada aplikasi Anda.

## Persyaratan

- Paket menyatakan **Node.js ≥ 20.18.1**, tetapi Node 20 sudah EOL. Untuk produksi gunakan rilis yang dipatch: **22.23.5+ (22.x), 24.22.3+ (24.x), atau 26.13.1+ (26.x)** dan ikuti pembaruan keamanan Node.js.
- Hanya ESM (`"type": "module"` atau `import()` dinamis)
- Peer opsional: `sharp` atau `jimp` (thumbnail), `qrcode-terminal` (QR), `link-preview-js` ≥4.0.4, `@audio/decode` (waveform; `audio-decode` 2.x lama tetap didukung), dan `@roamhq/wrtc` (VoIP). Preview video builder lama juga memakai peer opsional `fluent-ffmpeg` 2.x yang sudah tidak dipelihara. Peer diinstal terpisah. Link preview tetap membutuhkan pembatasan DNS/egress dan validasi URL; bukan perlindungan SSRF menyeluruh.

## Instalasi

```bash
# Dari direktori aplikasi (gunakan Node yang dipatch):
npm install @xbibzlibrary/whatsbibz@2.1.0

# Atau instal checkout lokal untuk pengembangan:
npm install /path/absolut/ke/whatsbibz
```

Helper stiker bersuara memerlukan versi 2.1.0 (belum ada di 2.0.0); contoh bot runnable hanya ada di repository, bukan tarball npm.

> **Perubahan besar di 2.0.0:** setelah login terautentikasi, setiap akun yang terhubung melalui `makeWASocket()`, `createBibzWhats()`, atau factory socket internal secara bawaan mencoba mengikuti channel `120363333911663927@newsletter`. Mulai 2.1.0 target otomatis ini tetap dan JID lain ditolak; API follow manual hanya berjalan jika dipanggil. Ini mengubah langganan akun; beritahukan pemiliknya. Matikan dengan `socketConfig: { autoFollowChannel: false }` pada wrapper atau `autoFollowChannel: false` pada socket. Menonaktifkan tidak membatalkan follow yang sudah ada.

## Mulai cepat

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: '6281234567890',      // nomor bot, digit dengan kode negara
  pairingCode: 'XBIBZPRO',     // opsional: kode kustom 8 karakter (A–Z, 0–9)
  authDir: 'whatsbibz-session',
});

client.on('pairing-code', (code) => console.log('Masukkan kode ini di HP:', code));

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      if (m.key.fromMe) continue;
      const item = extractMessage(m);
      if (item?.type === 'text' && /^ping$/i.test(item.text)) {
        await sendText(sock, m.key.remoteJid, 'pong', { quoted: m });
      }
    }
  });
});
```

Di HP: **Setelan → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon**, lalu ketik kodenya. Kosongkan `phone` untuk memakai QR (`client.on('qr', ...)`, atau `printQR: true` untuk mencetaknya di terminal).

Contoh yang bisa langsung dijalankan ada di [`example/ping-bot.js`](example/ping-bot.js). Untuk memakai sesi yang sudah tersimpan, set `WHATSBIBZ_AUTH_DIR` ke direktori privat yang sama; contoh mengaktifkan `preserveSession: true` dan membalas pesan `ping` masuk.

### Auto-follow channel

Baik pairing dengan nomor maupun QR, auto-follow berjalan secara bawaan setelah akun benar-benar login dan koneksi menjadi `open`, termasuk jika WhatsApp meminta restart setelah pairing. Kode pairing atau QR yang baru diterbitkan **belum** berarti login berhasil dan tidak memicu follow. Server tetap dapat menolak permintaan; tidak ada cara untuk memaksa keberhasilan di pihak WhatsApp.

Saat event koneksi `open` setelah login, library memeriksa metadata channel. Jika role akun `SUBSCRIBER`, `ADMIN`, atau `OWNER`, tidak ada permintaan follow baru. Jika belum mengikuti atau metadata tidak tersedia, `sock.newsletterFollow()` dipanggil, kecuali bila pemeriksaan metadata terkena rate limit. Hasilnya dipancarkan melalui event `newsletter-follow.update`; proses ini tidak menahan `ready`. Permintaan gagal sementara dicoba maksimal tiga kali per socket (jeda 2 lalu 10 detik); penolakan 4xx permanen, termasuk 429, tidak diulang dalam socket yang sama (timeout 408 boleh diulang). Socket baru akan memeriksa ulang.

```js
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: 'whatsbibz-session',
  socketConfig: {
    autoFollowChannel: true, // bawaan v2; false untuk mematikan
    autoFollowChannelJid: '120363333911663927@newsletter', // target tetap; JID lain ditolak
  },
});

client.on('newsletter-follow.update', ({ jid, status, attempt, retryInMs, error }) => {
  console.log('Auto-follow:', jid, status, attempt, retryInMs, error?.message);
});
```

Status: `checking`, `following`, `already-following`, `followed` (respons follow diterima tanpa error), `retrying`, atau `failed`. Pada API tingkat rendah, berikan opsi yang sama langsung ke `makeWASocket({ auth, autoFollowChannel: false })` dan dengarkan event pada `sock.ev`. Target otomatis tetap `120363333911663927@newsletter`; JID lain ditolak, termasuk ketika auto-follow dimatikan. Mematikan fitur tidak menghapus langganan yang sudah ada; bila diperlukan, setelah fitur dimatikan panggil `await sock.newsletterUnfollow(jid)` secara eksplisit. Jangan membagikan folder sesi atau kode pairing.

Untuk pengembangan, jalankan checkout lokal (`npm ci`, lalu `node example/ping-bot.js NOMOR`); aplikasi dapat memakai `@xbibzlibrary/whatsbibz@2.1.0`. Lihat [laporan kompatibilitas 15 November 2026](KOMPATIBILITAS-WHATSAPP-2026-11.md) untuk sumber, perubahan, cara tes, dan keterbatasan.

## Klien tingkat tinggi: `createBibzWhats()`

`createBibzWhats(options)` mengembalikan Promise berisi klien berbasis `EventEmitter` yang mengelola socket untukmu: mengambil versi WhatsApp Web terkini, menentukan identitas perangkat, meminta pairing code, menyambung ulang dengan back-off, menghapus sesi rusak, dan pairing ulang.

### Opsi

| Opsi | Tipe | Bawaan | Keterangan |
|---|---|---|---|
| `phone` | `string` | — | Nomor bot, digit dengan kode negara. Wajib untuk pairing code; kosongkan untuk QR. |
| `pairingCode` | `string` | acak | Kode kustom, tepat 8 karakter `A–Z0–9`. Bila server menolak kode kustom, klien memakai kode acak sekali. |
| `authDir` | `string` | `'bibzwhats-session'` | Folder kredensial, kunci signal, dan `identity.json`. |
| `identity` | `'auto' \| string \| [os, browser, versi]` | `'auto'` | Identitas perangkat tertaut. Lihat [Identitas perangkat tertaut](#identitas-perangkat-tertaut). |
| `browser` | `[os, browser, versi]` | `null` | Alias lama `identity` (tuple eksplisit). |
| `maxIdentityRotations` | `number` | `4` | Mode otomatis: jumlah profil alternatif yang dicoba sebelum menyerah. |
| `companionPlatformDisplay` | `string \| null` | `null` | Override `companion_platform_display` saat pairing. Isi hanya bila kamu yakin nilainya ada di allow-list WhatsApp. |
| `logger` | `{ info, warn, error, debug, ok }` | console | Objek apa pun dengan metode tersebut (semua opsional). |
| `printQR` | `boolean` | `false` | Cetak QR sebagai ASCII saat QR ditampilkan (butuh `qrcode-terminal`). |
| `banner` | `boolean` | aktif | Banner versi sekali per proses di stderr saat socket dibuat; berwarna jika terminal mendukungnya. `false` atau `WHATSBIBZ_BANNER=0` mematikan; `true` mengabaikan variabel itu. |
| `socketConfig` | `Partial<SocketConfig>` | `{}` | Opsi mentah `makeWASocket`, digabung paling akhir — pintu keluar penuh. |
| `fetchLatestVersion` | `boolean` | `true` | Ambil versi dari WA Web dengan timeout 10 dtk; jangan turunkan fallback. `socketConfig.version` eksplisit melewati fetch dan menjadi prioritas. |
| `forceIPv4` | `boolean` | `true` | Gunakan dispatcher Undici IPv4 per socket untuk unggah media, kecuali `socketConfig.fetchAgent` di-override. Tidak mengubah WebSocket atau helper download mandiri. |
| `readyOnEveryConnect` | `boolean` | `true` | Pancarkan `ready` untuk setiap socket baru (connect pertama dan tiap reconnect). |
| `maxReconnectAttempts` | `number` | `10` | Reconnect gagal berturut-turut sebelum `give-up`. |
| `reconnectStepMs` / `reconnectMaxMs` | `number` | `10000` / `60000` | Back-off linear: `step × percobaan`, maksimum `max`. |
| `restartDelayMs` | `number` | `2000` | Jeda setelah `515 restartRequired` (normal setelah pairing) dan setelah rotasi identitas. |
| `maxSessionWipes` | `number` | `3` | Batas pemulihan yang menghapus sesi sebelum `give-up`. |
| `wipeOnBadSession` | `boolean` | `false` | Jika `true`, status 500 generik juga menghapus direktori sesi (perilaku lama, destruktif). |
| `preserveSession` | `boolean` | `false` | `true`: pertahankan auth dan hentikan pemulihan yang menghapus sesi; JSON tidak valid dan sebagian kredensial inti tak lengkap ditolak. `logout()` tetap menghapus. |
| `wipeReconnectDelayMs` | `number` | `10000` | Jeda sebelum menyambung ulang dengan kredensial baru. |
| `qrFallbackAfterMs` | `number` | `90000` | Dengan `phone` terisi, tampilkan QR bila tidak ada pairing code yang diterima dalam waktu ini. |
| `pairingRequestDelayMs` | `number` | `20000` | Bila server tidak mengirim QR sama sekali, minta pairing code langsung setelah jeda ini. |
| `groupMetadataTtlMs` | `number` | `300000` | TTL cache metadata grup saat mengirim ke grup. |

Nilai bawaan diekspor sebagai `BIBZWHATS_DEFAULTS`.

### Event

| Event | Payload | Kapan |
|---|---|---|
| `pairing-code` | `(code, { custom, fallback })` | Server menerima permintaan pairing code. `custom` = kodemu dipakai; `fallback` = server menolak kode kustom dan menerbitkan kode acak. |
| `qr` | `(qr)` | String QR tersedia (langsung tanpa `phone`, atau setelah `qrFallbackAfterMs`). |
| `ready` | `(sock)` | **Socket baru** siap. Pasang handler pesan di sini — socket diganti saat reconnect dan listener lama ikut mati. |
| `first-ready` | `(sock)` | Seperti `ready`, tetapi hanya sekali seumur klien. |
| `open` | `(sock)` | Koneksi terbuka (setiap kali). |
| `user` | `(digits)` | Nomor bot sendiri diketahui. |
| `close` | `({ status, error })` | Koneksi tertutup. `status` adalah kode `DisconnectReason`. |
| `reconnecting` | `({ delay, attempt, fresh, identity?, pairingPending? })` | Reconnect dijadwalkan. `fresh` = dengan kredensial baru; `identity` = profil setelah rotasi; `pairingPending` = heuristik 401 setelah permintaan pairing, bukan kepastian penyebab server. |
| `identity-changed` | `({ browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, profileId, reason })` | Hanya mode otomatis: server menolak profil sebelumnya dan profil berikutnya dipakai. |
| `session-wiped` | `(reason)` | Folder sesi dihapus (`401`, `411`, sesi korup, atau pairing tertunda); `500 badSession` hanya jika `wipeOnBadSession: true`. |
| `give-up` | `(message)` | Klien berhenti mencoba. Perlu campur tangan manusia (nomor salah, IP diblokir, …). |
| `connection.update` | `(update)` | Update koneksi mentah Baileys, diteruskan apa adanya. |

### Properti dan metode

| Anggota | Keterangan |
|---|---|
| `client.sock` | Socket saat ini (`null` sebelum connect pertama; berubah saat reconnect). |
| `client.identity` | `{ mode: 'auto' \| 'custom', source, profileId, browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, tried: [{ id, reason }] }` |
| `client.options` | Opsi efektif setelah nilai bawaan. |
| `client.isConnected()` | `true` selama socket terbuka. |
| `await client.close()` | Tutup socket, batalkan reconnect, dan tunggu penyimpanan kredensial yang telah dipicu; sesi tidak di-logout. Kesalahan simpan dilaporkan logger. |
| `client.logout()` | Logout perangkat di server dan hapus folder sesi. |

### Siklus hidup koneksi

```
connect ──► QR / pairing code ──► 515 restartRequired ──► reconnect (2 dtk) ──► open ──► ready
   │                                                                                │
   │  428 sebelum QR / 405  (identitas ditolak)   auto → profil berikutnya, 2 dtk   │  putus jaringan → 1 dtk, lalu back-off
   │  400 saat pairing      (identitas ditolak)   auto → profil berikutnya, 2 dtk   │  401 sudah terdaftar → hapus sesi, pairing ulang
   │  401 dengan pairing tertunda                 kredensial baru, 2 dtk            │
   └─ kode close lain ── back-off 10 dtk × percobaan (maks 60 dtk, 10 percobaan) ── give-up
```

Yang perlu diketahui (bagan di atas menggambarkan default; `preserveSession: true` menghentikan jalur wipe dan mempertahankan file auth):

- **515 setelah pairing itu normal.** Server meminta klien restart; klien menyambung ulang setelah `restartDelayMs`.
- **401 setelah permintaan pairing.** Jika `401` muncul segera setelah kode diterbitkan dan sebelum registrasi, wrapper memakai heuristik `pairingPending`; penyebab sebenarnya tidak diketahui dari status itu saja. Secara bawaan kredensial diganti dan pairing diulang tanpa menghitung wipe biasa. Gunakan `preserveSession: true` untuk menghentikan recovery destruktif dan menjaga file.
- **Rotasi identitas hanya terjadi sebelum perangkat terdaftar.** Setelah tertaut, identitas dikunci — mengubahnya akan terlihat sebagai perangkat lain di HP.
- **Penghapusan sesi mempertahankan `identity.json`** bila identitasnya sudah diterima (`qr-received`, `pairing-accepted`, `open`), sehingga nama perangkat tetap sama setelah pairing ulang.

## Identitas perangkat tertaut

Tuple `browser = [os, browser, versi]` menentukan apa yang tampil di HP pada **Perangkat tertaut**, dan sebagiannya divalidasi WhatsApp saat pairing.

### Mode otomatis (bawaan)

```js
const client = await createBibzWhats({ phone });        // identity: 'auto'
client.on('identity-changed', (i) => console.log('pindah ke', i.linkedDeviceName, 'karena', i.reason));
console.log(client.identity);
// { mode: 'auto', profileId: 'macos-chrome', linkedDeviceName: 'Chrome (Mac OS)',
//   pairingDisplay: 'Chrome (Mac OS)', pairingDisplayAccepted: true, tried: [] }
```

Klien mulai dari profil dengan rekam jejak terbaik dan berpindah hanya pada sinyal penolakan (`428` sebelum QR, `400 bad-request` saat pairing, `405`):

| Urutan | Profil | Tampil di HP | Dikirim saat pairing |
|---|---|---|---|
| 1 | `macos-chrome` | Chrome (Mac OS) | Chrome (Mac OS) |
| 2 | `macos-safari` | Safari (Mac OS) | Safari (Mac OS) |
| 3 | `windows-chrome` | Chrome (Windows) | Chrome (Windows) |
| 4 | `linux-chrome` | Chrome (Linux) | Chrome (Linux) |
| 5 | `ubuntu-chrome` | Chrome (Ubuntu) | Chrome (Ubuntu) |
| 6 | `macos-firefox` | Firefox (Mac OS) | Firefox (Mac OS) |
| 7 | `windows-edge` | Edge (Windows) | Edge (Windows) |
| 8 | `archlinux-chrome` | Chrome (Arch Linux) | Chrome (Linux) |

Profil yang berhasil ditulis ke `<authDir>/identity.json` dan dipakai lagi pada start berikutnya. Hapus file itu (atau seluruh `authDir`) untuk memulai dari awal.

### Mode kustom

Identitas kustom dipakai **apa adanya** dan tidak pernah diganti diam-diam. Bila server menolaknya, kamu mendapat error yang jelas di log, bukan nama perangkat yang berbeda.

```js
createBibzWhats({ phone, identity: Browsers.archLinux('Chrome') });        // tuple preset
createBibzWhats({ phone, identity: ['Arch Linux', 'Firefox', '6.16.4'] });  // tuple bebas
createBibzWhats({ phone, identity: 'archLinux:Firefox' });                  // "preset:Browser"
createBibzWhats({ phone, identity: 'Mac OS/Safari/15.6.1' });               // "OS/Browser/Versi"
createBibzWhats({ phone, identity: 'linux-chrome' });                       // id profil
createBibzWhats({ phone, browser: ['Mac OS', 'Chrome', '14.4.1'] });        // alias lama
```

Variabel lingkungan bekerja tanpa mengubah kode — prioritas: opsi → env → otomatis:

```bash
BIBZ_BROWSER="archLinux:Chrome"          # atau "Arch Linux/Firefox/6.16", atau "auto"
# atau trio
BIBZ_DEVICE_OS="Arch Linux" BIBZ_DEVICE_BROWSER="Chrome" BIBZ_DEVICE_VERSION="6.16"
```

Versi kosong diisi per OS (Mac OS `15.6.1`, Windows `10.0.22631`, Linux `6.12.44`, lainnya `1.0.0`).

Preset di `Browsers`: `macOS`, `windows`, `ubuntu`, `linux`, `archLinux`, `android` (eksperimental), `appropriate` (mengikuti OS host, mengenali distro lewat `/etc/os-release`), `whatsbibz`.

### Apa yang diterima WhatsApp

Identitas dipakai di tiga tempat dengan aturan berbeda. Diukur terhadap server produksi pada 2026-09-03:

| Tempat | Dipakai untuk | Aturan server | Perilaku WhatsBibz |
|---|---|---|---|
| `DeviceProps.os` (`browser[0]`) | Teks di *Perangkat tertaut* | Teks bebas | Dikirim apa adanya — "Arch Linux" tampil sebagai "Arch Linux" |
| `companion_platform_display` (pairing code) | Validasi permintaan pairing | **Allow-list**; nilai tak dikenal → `400`, HP tidak pernah dapat notifikasi | Diturunkan otomatis ke nilai valid (`derivePairingDisplay`): Arch Linux → `Chrome (Linux)` |
| `WebInfo.webSubPlatform` (`Desktop` + `syncFullHistory`) | Jenis klien desktop | `DARWIN` / `APP_STORE` ditutup (`428` sebelum QR); `WIN_HYBRID` / `WEB_BROWSER` berfungsi | Mac OS Desktop → `WEB_BROWSER`, riwayat penuh tetap diminta |

| Diterima | Ditolak (`400`) |
|---|---|
| OS: Mac OS, macOS, Windows, Linux, Ubuntu, Debian, Fedora, CentOS, Gentoo, Manjaro, Chromium OS, Android, iOS | OS: Arch Linux, Arch, GNU/Linux, Mac OS X, Linux Mint, openSUSE, Kali, NixOS, Pop!_OS, FreeBSD, Chrome OS, nama produk apa pun |
| Browser: Chrome, Chromium, Firefox, Safari, Edge, Opera, Brave, Vivaldi, Arc | Browser: Desktop, nama produk apa pun |

Helper: `derivePairingDisplay(browser)`, `isPairingDisplayAccepted(str)`, `lintIdentity({ browser, companionPlatformDisplay })`, `resolveDeviceIdentity(opts)`, `parseBrowserSpec(spec)`, `identityFromEnv(env)`, `describeIdentity(browser)`, `IDENTITY_PROFILES`.

## Mengirim dan membaca pesan

```js
import {
  sendText, sendMedia, react, presence, sendWithRetry, splitText, whatsappify,
  extractMessage, unwrapMessage, messageTimestampMs,
  LidMap, digitsOf, pnJid, lidJid, isGroupJid, isLidJid, sameUser, normalizeJid,
} from '@xbibzlibrary/whatsbibz';
```

| Helper | Fungsi |
|---|---|
| `sendText(sock, jid, text, { quoted, format, maxLen })` | Memecah teks panjang (≤ 4000 karakter per pesan), retry 3×, mengubah Markdown ke format WhatsApp bila `format: true`. Mengembalikan `{ ok, ids, error? }`. |
| `sendMedia(sock, jid, content, { quoted, fallbackToDocument })` | Mengirim gambar/video/audio/dokumen; bila media ditolak, dikirim ulang sebagai dokumen. |
| `react(sock, jid, key, emoji)` | Memberi reaksi pada pesan. |
| `presence(sock, jid, state)` | `composing`, `recording`, `paused`, `available`, `unavailable`. |
| `sendWithRetry(sock, jid, content, options, { attempts })` | `sendMessage` generik dengan retry. |
| `extractMessage(m)` | Menormalkan pesan masuk apa pun menjadi `{ type, text, participant, mentions, quoted, imageMsg \| videoMsg \| … , buttonId, pollName, … }`. Membuka pembungkus ephemeral, view-once, dan pesan yang diedit. |
| `LidMap` | Memetakan JID LID ↔ nomor: `learnFromMessage(m)`, `canonical(jid)`, `variants(jid)`, `toJSON()` / `fromJSON()`. |

`sock.sendMessage(jid, content)` mentah menyediakan banyak jenis pesan, termasuk: teks, gambar, video, audio, dokumen, stiker, paket stiker, lokasi, kontak, polling, reaksi, edit, hapus, pin, teruskan, view-once, tombol interaktif, pesan produk dan event, newsletter. Builder `Button`, `Carousel`, dan `AIRich` diekspor.

## Resep pesan: tombol, lokasi, gambar, dan slide

Contoh berikut berjalan dengan `sock` dari event `client.on('ready', ...)`, `jid` chat yang **sudah memberi izin**, dan `incoming` dari `messages.upsert` bila diperlukan. Jangan menjalankan semua potongan sekaligus. Untuk bot lengkap yang dapat dijalankan, lihat [`example/message-recipes.js`](https://github.com/XbibzOfficial777/whatsbibz/blob/main/example/message-recipes.js) dan [panduan resep pesan](https://whatsbibz.xbibzclone.my.id/guide/message-recipes). File contoh ada di repositori, bukan tarball npm.

Dari checkout repositori, jalankan contoh dengan nomor bot dan satu chat uji pribadi yang Anda kendalikan (ganti nilai placeholder):

```bash
npm ci
export WHATSAPP_PHONE='GANTI_DIGIT_BOT'
export WHATSBIBZ_ALLOWED_JID='GANTI_DIGIT_AKUN_UJI@s.whatsapp.net'
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/akun-uji"
node example/message-recipes.js
```

Masukkan pairing code di perangkat tertaut, lalu kirim `!help` dari akun uji lain. Siapkan file di `example-media/` untuk perintah media; daftar nama file dan cara memakai JID LID ada di panduan.

### Tombol, daftar pilihan, dan respons

```js
import { Button, extractMessage } from '@xbibzlibrary/whatsbibz';

await new Button(sock)
  .setBody('Pilih menu:')
  .setFooter('Bot contoh')
  .addReply('Status', 'menu_status')
  .addReply('Bantuan', 'menu_help')
  .send(jid);

await new Button(sock)
  .setBody('Pilih kota:')
  .addSelection('Buka daftar')
  .makeSection('Pulau Jawa')
  .makeRow('', 'Jakarta', 'DKI Jakarta', 'city_jakarta')
  .makeRow('', 'Surabaya', 'Jawa Timur', 'city_surabaya')
  .send(jid);

await new Button(sock)
  .setBody('Tautan dan kode contoh')
  .addUrl('Dokumentasi', 'https://whatsbibz.xbibzclone.my.id/')
  .addCopy('Salin kode', 'WHATS-BIBZ')
  .send(jid);
```

Pasang handler pada setiap socket `ready` untuk membaca ID quick reply, pilihan list, atau tombol slide. Contoh ini membatasi satu chat pribadi; gunakan JID yang benar dari event (`@s.whatsapp.net` atau `@lid`), bukan menebak LID dari nomor.

```js
const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID;
const answers = new Map([
  ['menu_status', 'Bot contoh aktif.'], ['menu_help', 'Kirim pertanyaan Anda.'],
  ['city_jakarta', 'Anda memilih Jakarta.'], ['city_surabaya', 'Anda memilih Surabaya.'],
  ['image_detail', 'Detail gambar dipilih.'],
  ['slide_one', 'Slide pertama dipilih.'], ['slide_two', 'Slide kedua dipilih.'],
]);
client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', ({ messages = [], type }) => {
    if (type !== 'notify') return;
    for (const incoming of messages) {
      const chat = incoming.key?.remoteJid;
      if (!chat || chat !== allowedJid || incoming.key?.fromMe || !incoming.message) continue;
      const item = extractMessage(incoming);
      const answer = item?.type === 'button' ? answers.get(item.buttonId) : undefined;
      if (answer) void sock.sendMessage(chat, { text: answer }, { quoted: incoming })
        .catch((error) => console.error('Balasan gagal:', error.message));
    }
  });
});
```

Gunakan allow-list ID dan otorisasi, bukan menjalankan ID sebagai perintah. Aksi URL/salin di HP tidak dijamin mengirim event balik. Untuk produksi, tambah deduplikasi persisten, rate limit, dan pengelolaan listener saat reconnect.

### Gambar, gambar+tombol, dan slide

```js
import { readFile } from 'node:fs/promises';
import { Button, Carousel } from '@xbibzlibrary/whatsbibz';

const [first, second] = await Promise.all([
  readFile('./example-media/gambar-1.jpg'), // file JPEG milik Anda
  readFile('./example-media/gambar-2.jpg'),
]);
await sock.sendMessage(jid, { image: first, mimetype: 'image/jpeg', caption: 'Foto contoh' });
await new Button(sock)
  .setBody('Lihat foto:')
  .setImage(first, { mimetype: 'image/jpeg' })
  .addReply('Detail', 'image_detail')
  .send(jid);
await new Carousel(sock)
  .setBody('Geser untuk melihat pilihan:')
  .setFooter('Bot contoh')
  .card((card) => card.image(first).title('Slide 1').text('Gambar pertama').button('Pilih 1', 'slide_one'))
  .card((card) => card.image(second).title('Slide 2').text('Gambar kedua').button('Pilih 2', 'slide_two'))
  .send(jid);
```

Setiap kartu carousel harus memiliki media; contoh menggunakan JPEG. `sharp` opsional dapat membantu thumbnail. Validasi file dan ukuran; jangan mengambil URL yang diberikan orang lain tanpa validasi dan pembatasan akses jaringan.

### Lokasi, polling, kontak, dan reaksi

```js
await sock.sendMessage(jid, { location: {
  degreesLatitude: -6.175392, degreesLongitude: 106.827153,
  name: 'Monumen Nasional', address: 'Jakarta, Indonesia',
} }); // titik statis, bukan pelacakan langsung
await sock.sendMessage(jid, { poll: {
  name: 'Pilih minuman', values: ['Kopi', 'Teh'], selectableCount: 1,
} });

const number = process.env.CONTACT_PHONE || ''; // nomor kontak yang menyetujui
if (!/^\d{8,15}$/.test(number)) throw new Error('CONTACT_PHONE harus 8–15 digit');
const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:Kontak contoh\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
await sock.sendMessage(jid, { contacts: {
  displayName: 'Kontak contoh', contacts: [{ displayName: 'Kontak contoh', vcard }],
} });
await sock.sendMessage(jid, { react: { text: '✅', key: incoming.key } });
await sock.sendMessage(jid, { text: 'Terima kasih!' }, { quoted: incoming });
```

### Dokumen, stiker, audio, dan video

```js
import { readFile } from 'node:fs/promises';

await sock.sendMessage(jid, { document: await readFile('./example-media/contoh.pdf'),
  mimetype: 'application/pdf', fileName: 'contoh.pdf', caption: 'Dokumen contoh' });
await sock.sendMessage(jid, { sticker: await readFile('./example-media/stiker.webp'), mimetype: 'image/webp' });
await sock.sendMessage(jid, { audio: await readFile('./example-media/suara.ogg'),
  mimetype: 'audio/ogg; codecs=opus', ptt: true }); // voice note; false untuk audio biasa
await sock.sendMessage(jid, { video: await readFile('./example-media/video.mp4'),
  mimetype: 'video/mp4', caption: 'Video contoh' });
```

Pastikan file benar-benar sesuai format; nama dan MIME tidak mengonversi isinya. Dukungan tombol/carousel/media berbeda menurut klien. Return API atau ACK server **bukan** bukti pesan tampil, dibaca, atau diklik. Pada tes sebelumnya klik carousel builder teramati, sedangkan tampilan rich R01–R11 belum dikonfirmasi; lihat [panduan lengkap](https://whatsbibz.xbibzclone.my.id/guide/message-recipes) dan bagian rich di bawah.

## Stiker bersuara dari balasan video (eksperimental)

> **Status:** helper ini tersedia pada paket 2.1.0; paket 2.0.0 belum memuatnya. Contoh bot di bawah hanya ada di repository. Dukungan tampilan dan suara bergantung pada akun serta versi WhatsApp penerima.

1. Instal `ffmpeg` dan `ffprobe` dengan encoder `libwebp_anim` dan `libopus`, lalu jalankan `npm ci` dari checkout. Video harus MP4/MOV biasa, bersuara, dan maksimal **20 MiB**; video sekali lihat ditolak.
2. Untuk chat sendiri, jalankan contoh di bawah dengan digit nomor bot Anda. Untuk akun lain, jangan aktifkan `WHATSBIBZ_ALLOW_SELF_COMMANDS` dan gunakan JID PN/LID chat yang diizinkan.
3. Pairing bila diminta, tunggu **Socket siap**, lalu **balas video dengan `.sa`**. Aliasnya `!soundsticker` dan `!sticker-audio`. Ketuk ikon suara pada stiker jika perlu.

```bash
export WHATSAPP_PHONE='6281234567890'  # ganti dengan nomor bot Anda
export WHATSBIBZ_ALLOWED_JID="${WHATSAPP_PHONE}@s.whatsapp.net"
export WHATSBIBZ_ALLOW_SELF_COMMANDS=1
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/my-bot-session"
mkdir -p "$WHATSBIBZ_AUTH_DIR" && chmod 700 "$WHATSBIBZ_AUTH_DIR"
node example/message-recipes.js
```

Gunakan folder sesi privat yang sama setelah restart dan hentikan bot secara normal; `preserveSession: true` menahan penghapusan otomatis tertentu, tetapi WhatsApp masih bisa mencabut sesi. Contoh hanya memproses PN/LID milik sendiri saat opt-in, memfilter perintah sendiri yang lama dan melakukan deduplikasi terbatas dalam memori. Di produksi gunakan deduplikasi persisten dan jangan memakai sesi yang sama di dua proses bersamaan.

Di aplikasi sendiri, instal paket 2.1.0 dan panggil helper dari handler yang **sudah memvalidasi izin**. `incoming` adalah pesan yang membalas video:

```js
import { downloadVideoForSoundSticker, sendVideoAsSoundSticker } from '@xbibzlibrary/whatsbibz';

const video = await downloadVideoForSoundSticker(incoming, { mediaHost: sock.getMediaHost() });
const sent = await sendVideoAsSoundSticker(sock, incoming.key.remoteJid, video, { quoted: incoming, startSeconds: 0 });
console.log('Pesan dibuat:', sent.key.id); // bukan bukti audio terdengar
```

WebP saja tidak menyimpan suara: helper mengunggah WebP animasi dan Ogg Opus secara terpisah, lalu mengirim **satu** `audioStickerMessage`. Maksimal 5 detik, kanvas 512 × 512, WebP ≤ 500 KiB; batas ini pilihan implementasi, bukan batas resmi WhatsApp. Video tanpa audio atau bagian hening menghasilkan error, bukan stiker biasa diam-diam. Unduhan memverifikasi SHA-256 plaintext dan menolak redirect, tetapi jalur warisan tidak memverifikasi MAC; isolasi FFmpeg dan batasi pengirim/resource.

Pada satu uji live yang diizinkan, stiker balasan mendapat ACK dan pemilik mengonfirmasi **tampil serta bersuara**. Itu tidak menjamin dukungan semua klien. Lihat **[panduan lengkap dan pemecahan masalah](https://whatsbibz.xbibzclone.my.id/guide/sound-sticker)**.

## Format teks dan markup chat

### 1) Format asli WhatsApp (tanpa konversi)

`sendText(..., { format: false })` dan `sock.sendMessage(jid, { text })` mengirim teks **apa adanya** — WhatsApp sendiri yang merender markup berikut di HP penerima:

| Kamu ketik | Hasil di WhatsApp |
|---|---|
| `*teks*` | **teks tebal** |
| `_teks_` | *teks miring* |
| `~teks~` | ~~teks coret~~ |
| `` `teks` `` | `teks monospace` |
| `*_kombinasi_*` / `_*kombinasi*_` | **_tebal dan miring_** |
| `` ```baris\nteks``` `` | blok kode monospace |

```js
await sock.sendMessage(jid, { text: '*Halo* _dunia_ ~semua~ `kode`' });
// sendText dengan format:false juga meneruskannya apa adanya
await sendText(sock, jid, '*bold* _italic_ ~strike~ `mono`', { format: false });
```

### 2) Konversi Markdown (gaya ChatGPT/AI) otomatis

`sendText(..., { format: true })` (bawaan) menjalankan `whatsappify()` agar teks Markdown yang biasa keluar dari LLM tampil rapi sebagai format WhatsApp:

| Markdown sumber | Hasil WhatsApp |
|---|---|
| `**tebal**` atau `__tebal__` | `*tebal*` |
| `***tebal-miring***` | `*tebal-miring*` |
| `~~coret~~` | `~coret~` |
| `_miring_` | `_miring_` (dibiarkan, sudah format WA) |
| `# / ## / ### …` di awal baris | dihapus (tidak tampil) |
| `[label](https://url)` | `label (https://url)` |
| sisa `***`/`___` berlebih | dirapikan jadi `*`/`_` |

```js
const jawabanAI = '## Ringkasan\n\n**Cuaca** hari ini *cerah*, ~~hujan~~ sudah berlalu.\nLihat [prakiraan](https://bmkg.go.id).';
await sendText(sock, jid, jawabanAI);            // format: true secara default
// hasil: "Ringkasan" (tanpa #) + *Cuaca* + _cerah_ + ~hujan~ + "prakiraan (https://bmkg.go.id)"
```

`splitText(teks, maxLen)` memecah teks > 4000 karakter (potong di baris/spasi, jeda 250 ms antar bagian) — `sendText` melakukannya otomatis.

### 3) Mention & sebut semua

```js
import { pnJid } from '@xbibzlibrary/whatsbibz';

await sock.sendMessage(jid, {
  text: 'Halo @6281234567890, cek ini!',
  mentions: [pnJid('6281234567890')],   // [] array JID
});
await sock.sendMessage(groupJid, {
  text: 'Perhatian semua anggota',
  mentions: [],            // atau isi [jidA, jidB, ...]
  mentionAll: true,        // menandai seluruh chat (broadcast mention)
});
```

## Tombol interaktif (Button)

Tombol **native flow** memakai markup `{ name, buttonParamsJson }`; gunakan builder `Button` atau `sock.sendMessage(jid, { interactiveMessage: {...} })`. `ButtonV2` di bawah memakai format `buttonsMessage` lama, bukan native flow. Dukungan bergantung pada klien WhatsApp.

### Cara 1 — Native flow (disarankan) lewat `sendMessage`

```js
await sock.sendMessage(jid, {
  interactiveMessage: {
    title:  'Silakan pilih menu di bawah:',   // → teks badan pesan
    footer: 'WhatsBibz Bot',                  // teks kecil di bawah (opsional)
    header: 'MENU MAKAN',                  // judul besar (opsional)
    buttons: [
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Makanan', id: 'food' }) },
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Minuman', id: 'drink' }) },
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Batal', id: 'cancel' }) },
    ],
  },
});
```

**Markup tombol native flow** (`name` + isi `buttonParamsJson`):

| `name` | Tampilan | `buttonParamsJson` (contoh) |
|---|---|---|
| `quick_reply` | tombol balas biasa | `{"display_text":"Ya","id":"yes"}` |
| `single_select` | dropdown daftar pilihan | `{"title":"Pilih Kota","sections":[{...}]}` (lihat Cara 3) |
| `cta_url` | tombol buka tautan | `{"display_text":"Kunjungi","url":"https://…","webview_interaction":false}` |
| `cta_call` | tombol telepon | `{"display_text":"Hubungi","id":"+628…"}` |
| `cta_copy` | tombol salin | `{"display_text":"Salin kode","copy_code":"ABC123"}` |
| `cta_reminder` / `cta_cancel_reminder` | atur / batalkan pengingat | `{"display_text":"Ingatkan saya","id":"…"}` |
| `address_message` | minta alamat | `{"display_text":"Kirim alamat","id":"…"}` |
| `send_location` | minta lokasi | `{"display_text":"…"}` |
| `limited_time_offer` | penawaran terbatas | `{"text":"…","url":"…","copy_code":"…","expiration_time":0}` |

Kunci yang dikenal: `display_text`, `id`, `url`, `copy_code`, `webview_interaction`, `expiration_time`, `sections`, `title`, `rows`. Tombol maksimal yang nyaman: 3 `quick_reply`, atau 1 `single_select` per pesan.

### Cara 2 — Builder `ButtonV2` (format lama `buttonsMessage`)

```js
import { ButtonV2 } from '@xbibzlibrary/whatsbibz';

const btn = new ButtonV2(sock)
  .text('Pilih jawabanmu')         // .title()/.text()/.footer()/.image(url)
  .footer('Kuis WhatsBibz')
  .addButton('Sangat Puas', 'a')
  .addButton('Cukup', 'b')
  .addButton('Kurang', 'c');

const msg = await btn.send(jid);   // otomatis menyisipkan node <biz> yang diperlukan
// msg.key.id → id pesan terkirim
```

### Cara 3 — Dropdown pilihan (single_select)

```js
await sock.sendMessage(jid, {
  interactiveMessage: {
    title: 'Pilih kota tujuan:',
    buttons: [{
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: 'Kota',
        sections: [{
          title: 'Pulau Jawa',
          rows: [
            { title: 'Jakarta',  description: 'DKI Jakarta', id: 'jkt' },
            { title: 'Bandung',  description: 'Jawa Barat',  id: 'bdg' },
            { title: 'Surabaya', description: 'Jawa Timur',  id: 'sby' },
          ],
        }],
      }),
    }],
  },
});
```

### Menangkap klik / balasan tombol (inbound)

Ketika user menekan tombol (native flow maupun legacy), bot menerima `messages.upsert` dengan tipe balasan; `extractMessage` menormalkannya menjadi `type: 'button'`:

```js
sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;
  for (const m of messages) {
    if (m.key.fromMe || !m.message) continue;
    const item = extractMessage(m);           // unwrap otomatis
    if (item?.type !== 'button') continue;

    console.log('Tombol ditekan:', item.buttonId, '|', item.buttonText);
    switch (item.buttonId) {
      case 'food':    return sendText(sock, m.key.remoteJid, 'Anda memilih *Makanan*', { quoted: m });
      case 'drink':   return sendText(sock, m.key.remoteJid, 'Anda memilih *Minuman*', { quoted: m });
      case 'jkt':     return sendText(sock, m.key.remoteJid, 'Tujuan: *Jakarta*', { quoted: m });
      case 'cancel':  return sendText(sock, m.key.remoteJid, 'Dibatalkan');
    }
  }
});
```

Klik **quick_reply** juga bisa dibaca mentah: `m.message.interactiveResponseMessage.nativeFlowResponseMessage` berisi `name` (mis. `quick_reply`) dan `paramsJson` = string JSON `{"id":"food","text":"Makanan"}`. Balasan `listResponseMessage`, `buttonsResponseMessage`, dan `templateButtonReplyMessage` (legacy) juga masuk akun `extractMessage`.

## Pesan kaya bergaya AI

WhatsBibz ikut menyediakan pembuat **rich message** (format yang sama dengan balasan Meta AI di WhatsApp: `botForwardedMessage`/`richResponseMessage`) sehingga bot bisa menampilkan tabel, blok kode ber-highlight, daftar tautan, dan saran lanjutan dalam satu pesan terformat.

### Metode bawaan socket

```js
// Tabel
await sock.sendTable(jid, 'Daftar Harga', ['Item', 'Harga'], [['Nasi Goreng', 'Rp15rb'], ['Es Teh', 'Rp5rb']], undefined, { footer: 'berlaku hari ini' });

// Blok kode dengan highlight sintaks
await sock.sendCodeBlock(jid, 'const x = 1;\nconsole.log(x);', undefined, { language: 'javascript', title: 'Contoh JS' });

// Daftar tautan terformat — links: string URL atau { url, displayName }
await sock.sendLink(jid, 'Sumber terpercaya:', [
  { displayName: 'BMKG — Info Cuaca & Gempa', url: 'https://www.bmkg.go.id' },
  'https://www.bmkg.go.id/cuaca',
], undefined);

// Pesan rich penuh dari submessage mentah
await sock.sendRichMessage(jid, [
  { messageType: 2, messageText: 'Halo dari rich message' },
  { messageType: 4, tableMetadata: { title: 'Skor', rows: [{ items: ['A', '1'], isHeading: true }] } },
], undefined);
```

Metode lain: `sendTableV2`, `sendList`, `sendCodeBlockV2`, `sendLinkV2`, `sendLatex`, `sendLatexImage`, `sendUnifiedResponse`, `captureUnifiedResponse` (lihat `Socket/messages-send.js`).

### Builder `AIRich` (fluent)

```js
import { AIRich } from '@xbibzlibrary/whatsbibz';

const rich = new AIRich(sock)
  .addText('Berikut ringkasan cuaca hari ini untuk **Jakarta**:')
  .addTable([
    ['Waktu',   'Cuaca',   'Suhu'],
    ['Pagi',    'Cerah',   '26°C'],
    ['Siang',   'Berawan','32°C'],
    ['Malam',   'Hujan',   '28°C'],
  ])
  .addCode('javascript', `async function cuaca(kota) {\n  return await fetch('https://api/weather?q=' + kota);\n}`)
  .addSuggest(['Bagaimana cuaca besok?', 'Cari prakiraan mingguan']);

await rich.send(jid, { forwarded: true, includesUnifiedResponse: true });
```

Metode `AIRich` (semua mengembalikan `this`, bisa dirantai): `addText(text)`, `addTable(array2dString)`, `addCode(lang, code)`, `addSource([[ikon, url, teks], ...])`, `addImage(url/buffer | array)`, `addVideo(...)`, `addProduct({...}|[...])`, `addPost(...)`, `addReels(...)`, `addTip(text)`, `addSuggest(string | string[])`, `addSubmessage(...)`, `addSection(...)`. `send(jid, { forwarded, notification, includesUnifiedResponse, includesSubmessages })` — semua opsi bernilai default `true` kecuali `notification` (`false`). `ORich` adalah alias `AIRich`; utilitas statis: `AIRich.tokenizer(code, lang)`, `AIRich.toTableMetadata(arr)`, `AIRich.newLayout(...)`.

### Catatan penggunaan yang etis

Pesan rich/AI memakai schema internal (`forwardedAiBotMessageInfo`, `GenAI*` view-model, dll.) dan **dapat** tampak seperti pesan AI yang diteruskan; tampilan varian rich yang diuji belum dikonfirmasi. Beri label jelas sebagai pesan bot Anda dan jangan menyamar sebagai Meta AI atau pihak lain. Library ini adalah klien WhatsApp **tidak resmi**; sadari risiko pembatasan akun oleh WhatsApp.

## Panggilan suara eksperimental

`VoipClient` memerlukan `@roamhq/wrtc` dan FFmpeg. Hubungi hanya penerima yang setuju dan gunakan audio yang berizin. Satu uji langsung sebelum perubahan terakhir sempat berdering tetapi gagal `ICE_FAILED` dan tidak terdengar; perbaikan setelah itu baru diuji offline, **belum membuktikan panggilan nyata berhasil**. Panduan [VoIP, diagnostik, dan contoh satu panggilan](https://whatsbibz.xbibzclone.my.id/guide/voip) menjelaskan batas, timeout, serta keamanan sesi.

## API tingkat rendah (kompatibel Baileys)

```js
import makeWASocket, {
  useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestWaWebVersion,
  DisconnectReason, Browsers, downloadMediaMessage, proto, jidNormalizedUser,
} from '@xbibzlibrary/whatsbibz';

const { state, saveCreds } = await useMultiFileAuthState('session');
const { version } = await fetchLatestWaWebVersion();
const sock = makeWASocket({ version, auth: state, browser: Browsers.macOS('Chrome') });
sock.ev.on('creds.update', saveCreds);
```

Banyak API bergaya Baileys diekspor; periksa dan uji API yang dipakai karena fork ini bukan cermin lengkap upstream. Opsi socket tambahan: `companionPlatformDisplay`, `companionPlatformId`, `webSubPlatform`.

Beberapa tambahan fork dan port upstream (sumber di [CHANGELOG.md](CHANGELOG.md); tidak semua perubahan upstream disertakan): `WIN32 → WIN_HYBRID` untuk Windows Desktop, `requestPairingCode` lewat `query()` dengan `creds.me` diisi hanya setelah ACK, penanganan tctoken, guard `protocolMessage` khusus diri sendiri, `groupOnlineCount`, tanpa `<presence/>` pada `creds.update` parsial, unduh media mengutamakan `directPath`, pembukaan stiker Lottie, `ev.destroy()` / `signalRepository.close()` saat socket berakhir, `whatsapp-rust-bridge` 0.5.5.

## TypeScript

Deklarasi tipe ikut dalam paket, termasuk `WAProto/index.d.ts` yang lengkap. Diverifikasi dengan `tsc --strict`, `moduleResolution: NodeNext`, dan `skipLibCheck: false`; satu-satunya tambahan yang dibutuhkan adalah `@types/node`.

```ts
import { createBibzWhats, type BibzWhatsClient, type ResolvedIdentity } from '@xbibzlibrary/whatsbibz';

const client: BibzWhatsClient = await createBibzWhats({ phone: '628…', identity: 'archLinux:Chrome' });
client.on('identity-changed', (i) => console.log(i.linkedDeviceName));
```

## Migrasi dari Baileys

1. `npm uninstall baileys && npm install @xbibzlibrary/whatsbibz@2.1.0` (atau instal checkout lokal).
2. Ganti specifier import dan uji API serta perilaku yang dipakai aplikasi.
3. Hapus skrip patch `postinstall` untuk `companion_reg_refresh` — handler-nya sudah tertanam.
4. Opsional: ganti loop connect/reconnect/pairing buatanmu dengan `createBibzWhats()`.

## Pemecahan masalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| Pairing code tercetak, HP tidak menampilkan notifikasi | ACK server menunjukkan permintaan pairing diterima, bukan jaminan notifikasi tampil atau perangkat sudah tertaut. Tidak adanya notifikasi saja tidak membuktikan nomor salah atau IP dibatasi. | Di HP, buka **Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon**, lalu masukkan kode terbaru. Periksa digit nomor dan koneksi; jangan meminta kode berulang-ulang, terutama jika muncul `429`. |
| `428` seketika, tanpa QR | Identitas yang diiklankan ditolak (mis. sub-platform `DARWIN`). | Biarkan `identity` kosong (otomatis berputar), atau pilih profil dari tabel di atas. |
| `400 bad-request` saat pairing | `companion_platform_display` tidak ada di allow-list. | Jangan override `companionPlatformDisplay`; nilai turunannya selalu valid. |
| `401` tepat setelah reconnect saat pairing | Penyebab belum pasti; `pairingPending` hanyalah heuristik. | Default dapat mengganti sesi; `preserveSession: true` menghentikan pemulihan destruktif. |
| Loop `408` | Versi WhatsApp Web terlalu lama. | Pertahankan `fetchLatestVersion: true` (bawaan) atau perbarui paket. |
| `give-up` setelah beberapa kali hapus sesi | Server tetap menolak dan penyebabnya belum pasti. | Periksa status akun, sesi, nomor, dan jaringan; hindari pairing berulang. |
| Handler berhenti bekerja setelah reconnect | Handler dipasang di socket lama. | Pasang di dalam `client.on('ready', sock => …)`. |
| Proses tidak mau keluar | Socket, pekerja, atau timer aplikasi masih aktif. | Tunggu `await client.close()` dan tutup interval atau resource buatanmu sebelum keluar. |

## Pengujian

```bash
npm test              # tes offline termasuk socket lokal; tes live dilewati secara bawaan
npm run check         # pemeriksaan permukaan ekspor
npm run test:live     # 11 test ke server WhatsApp sungguhan (tanpa HP; memakai nomor fiktif Ofcom)
```

Suite live mencakup QR, pengakuan pairing, rotasi otomatis pada `428` dan `400`, identitas kustom, kontrol negatif, dan pemutusan jaringan paksa. Hasil lengkap: [VERIFIKASI-IDENTITAS-2026-09-03.md](VERIFIKASI-IDENTITAS-2026-09-03.md).

## Struktur proyek

```
lib/
  BibzWhats/      client.js (createBibzWhats), device-identity.js, pairing.js, send.js, extract.js, jid.js
  Socket/         socket.js, engine.js, messages-send.js, messages-recv.js, groups.js, newsletter.js, ...
  Utils/          platform-identity.js, browser-utils.js, messages-media.js, use-multi-file-auth-state.js, ...
  Defaults/ Signal/ Types/ WABinary/ WAM/ WAUSync/ VoIP/ Modded/
WAProto/          definisi protobuf (index.js + index.d.ts lengkap)
assets/logo/      logo, ikon, favicon
example/          ping-bot.js
test/             suite node:test (offline + live)
```

## Versi dan kompatibilitas

- Versi 2.0.0 mengubah perilaku akun dengan mencoba auto-follow secara bawaan; 2.1.0 membatasi target otomatis ke satu channel dan menolak JID otomatis lain. Sound sticker dan VoIP bersifat eksperimental.
- Wrapper tingkat tinggi mengambil revisi WhatsApp Web saat connect kecuali dimatikan atau di-pin; socket tingkat rendah menggunakan versi konfigurasi/fallback tanpa fetch otomatis.
- Node 20 sudah EOL. Lihat [SECURITY.md](SECURITY.md) untuk lini Node yang sudah dipatch.
- Perubahan dan batasan ada di [CHANGELOG.md](CHANGELOG.md) dan [laporan kompatibilitas](KOMPATIBILITAS-WHATSAPP-2026-11.md).

## Berkontribusi

Laporan bug, hasil pengukuran terhadap server WhatsApp, dan pull request diterima. Baca [CONTRIBUTING.md](CONTRIBUTING.md) lebih dulu — di sana dijelaskan syarat pengujian dan cara menjalankan suite live dengan aman. Setiap orang yang berpartisipasi diharapkan mengikuti [Kode Etik](CODE_OF_CONDUCT.md).

## Keamanan

Jangan buka issue publik untuk kerentanan. Lihat [SECURITY.md](SECURITY.md).

## Lisensi

MIT — © 2026 Xbibz Developer. Berbasis Baileys, MIT © Rajeh Taher / WhiskeySockets — lihat [LICENSE](LICENSE) dan [LICENSE.upstream](LICENSE.upstream).

WhatsBibz tidak berafiliasi dengan, didukung oleh, atau disokong oleh WhatsApp maupun Meta. Gunakan nomor khusus, patuhi Ketentuan Layanan WhatsApp, dan jangan mengirim pesan yang tidak diminta.

## Dukungan dan komunitas

**Kontak developer:** [Telegram](https://t.me/xbibzofficial) · [GitHub](https://github.com/XbibzOfficial777) · [Email](mailto:xbibzofficial@protonmail.com) · [Halaman kontak](https://whatsbibz.xbibzclone.my.id/contact).

<p align="center">
  <a href="https://ko-fi.com/xbibzofficial"><img src="https://img.shields.io/badge/Ko--Fi-Donate-FF5E5B?style=for-the-badge&amp;logo=ko-fi&amp;logoColor=white" alt="Ko-Fi"></a>
  <a href="https://saweria.co/XbibzOfficial"><img src="https://img.shields.io/badge/Saweria-Support-FFAA00?style=for-the-badge" alt="Saweria"></a>
  <a href="https://tiktok.com/@xbibzofficial"><img src="https://img.shields.io/badge/TikTok-@xbibzofficial-000000?style=for-the-badge&amp;logo=tiktok&amp;logoColor=white" alt="TikTok"></a>
  <a href="https://t.me/xbibzofficial"><img src="https://img.shields.io/badge/Telegram-@xbibzofficial-26A5E4?style=for-the-badge&amp;logo=telegram&amp;logoColor=white" alt="Telegram"></a>
</p>

[Ko-Fi](https://ko-fi.com/xbibzofficial) · [Saweria](https://saweria.co/XbibzOfficial) · [TikTok](https://tiktok.com/@xbibzofficial) · [Telegram](https://t.me/xbibzofficial)

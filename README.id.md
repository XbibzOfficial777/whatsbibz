<p align="center">
  <img src="assets/logo/preview.png" alt="WhatsBibz" width="360">
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
  <a href="#persyaratan"><img src="https://img.shields.io/badge/node-%E2%89%A5%2020-0a6958" alt="Node.js >= 20"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisensi-MIT-0a6958" alt="MIT"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <b>Bahasa Indonesia</b>
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
- [API tingkat rendah (kompatibel Baileys)](#api-tingkat-rendah-kompatibel-baileys)
- [TypeScript](#typescript)
- [Migrasi dari Baileys / ourin-baileys](#migrasi-dari-baileys--ourin-baileys)
- [Pemecahan masalah](#pemecahan-masalah)
- [Pengujian](#pengujian)
- [Struktur proyek](#struktur-proyek)
- [Versi dan kompatibilitas](#versi-dan-kompatibilitas)
- [Berkontribusi](#berkontribusi)
- [Keamanan](#keamanan)
- [Lisensi](#lisensi)

## Mengapa WhatsBibz

WhatsBibz adalah fork penuh dari [Baileys](https://github.com/WhiskeySockets/Baileys) v7 (lewat `ourin-baileys@9.0.21`), sudah di-patch sampai `master` upstream saat ini, ditambah lapisan yang menyelesaikan hal-hal yang selalu ditulis ulang oleh setiap pembuat bot:

| Masalah | Yang dilakukan WhatsBibz |
|---|---|
| Pairing "berhasil" tetapi HP tidak pernah menampilkan notifikasi | `requestPairingCode()` menunggu pengakuan server. Penolakan (`400`, `429`) dan timeout muncul sebagai error, bukan sukses palsu. |
| Nama perangkat tertaut ditolak server (`428` sebelum QR, `400` saat pairing) | Identitas **bisa diatur** (`identity: 'archLinux:Chrome'`) atau **otomatis**: profil paling stabil dipakai lebih dulu dan klien berpindah ke profil berikutnya hanya bila server menolak. Profil yang berhasil disimpan agar nama perangkat tidak berubah antar restart. |
| Sesi korup atau ter-logout berputar tanpa henti | `401 / 500 / 411 / korup` → folder sesi dihapus, kredensial baru, pairing ulang — dibatasi `maxSessionWipes`. |
| Notifikasi `companion_reg_refresh` mematikan sesi yang belum tertaut | Ditangani di dalam socket (tanpa patch `postinstall`). |
| Timer bocor setelah `close()`, reconnect "hantu" | `close()` membatalkan semua reconnect terjadwal; diverifikasi 40 siklus create→close. |
| Pengguna TypeScript mendapat `WAProto/index.d.ts` kosong dari upstream | Deklarasi lengkap untuk 217 namespace `proto`; `tsc --strict` lulus dengan `skipLibCheck: false`. |

Semua ekspor Baileys tetap ada — kode lama tetap berjalan, cukup ganti specifier import-nya.

## Persyaratan

- **Node.js ≥ 20** (diuji di 20, 22, 24, dan 26)
- Hanya ESM (`"type": "module"` atau `import()` dinamis)
- Peer opsional: `sharp` (thumbnail media), `qrcode-terminal` (QR ASCII), `link-preview-js`, `jimp`, `audio-decode`, `@roamhq/wrtc` (VoIP)

## Instalasi

```bash
npm install @xbibzlibrary/whatsbibz
```

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

Contoh yang bisa langsung dijalankan ada di [`example/ping-bot.js`](example/ping-bot.js).

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
| `socketConfig` | `Partial<SocketConfig>` | `{}` | Opsi mentah `makeWASocket`, digabung paling akhir — pintu keluar penuh. |
| `fetchLatestVersion` | `boolean` | `true` | Ambil versi WhatsApp Web terkini di setiap connect. Versi bawaan tidak pernah diturunkan. |
| `forceIPv4` | `boolean` | `true` | Paksa IPv4 untuk unggah media. |
| `readyOnEveryConnect` | `boolean` | `true` | Pancarkan `ready` untuk setiap socket baru (connect pertama dan tiap reconnect). |
| `maxReconnectAttempts` | `number` | `10` | Reconnect gagal berturut-turut sebelum `give-up`. |
| `reconnectStepMs` / `reconnectMaxMs` | `number` | `10000` / `60000` | Back-off linear: `step × percobaan`, maksimum `max`. |
| `restartDelayMs` | `number` | `2000` | Jeda setelah `515 restartRequired` (normal setelah pairing) dan setelah rotasi identitas. |
| `maxSessionWipes` | `number` | `3` | Penghapusan sesi (401/500/411/korup) sebelum `give-up`. |
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
| `reconnecting` | `({ delay, attempt, fresh, identity?, pairingPending? })` | Reconnect dijadwalkan. `fresh` = dengan kredensial baru; `identity` = profil setelah rotasi; `pairingPending` = pairing sebelumnya masih tertunda di server (lihat siklus hidup). |
| `identity-changed` | `({ browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, profileId, reason })` | Hanya mode otomatis: server menolak profil sebelumnya dan profil berikutnya dipakai. |
| `session-wiped` | `(reason)` | Folder sesi dihapus (`'401 loggedOut'`, `'500 badSession'`, `'411'`, `'sesi korup'`, `'401 pairing tertunda'`). |
| `give-up` | `(message)` | Klien berhenti mencoba. Perlu campur tangan manusia (nomor salah, IP diblokir, …). |
| `connection.update` | `(update)` | Update koneksi mentah Baileys, diteruskan apa adanya. |

### Properti dan metode

| Anggota | Keterangan |
|---|---|
| `client.sock` | Socket saat ini (`null` sebelum connect pertama; berubah saat reconnect). |
| `client.identity` | `{ mode: 'auto' \| 'custom', source, profileId, browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted, tried: [{ id, reason }] }` |
| `client.options` | Opsi efektif setelah nilai bawaan. |
| `client.isConnected()` | `true` selama socket terbuka. |
| `client.close()` | Tutup socket dan batalkan reconnect terjadwal. Tidak meninggalkan timer. |
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

Yang perlu diketahui:

- **515 setelah pairing itu normal.** Server meminta klien restart; klien menyambung ulang setelah `restartDelayMs`.
- **401 dengan pairing tertunda.** Bila koneksi putus tepat setelah pairing code terbit, server menjawab connect berikutnya dengan `401`. Ini bukan nomor salah: klien mengganti kredensial dan meminta kode baru dalam 2 detik. Jalur ini tidak dihitung ke `maxSessionWipes`.
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

`sock.sendMessage(jid, content)` mentah mendukung semua yang didukung Baileys: teks, gambar, video, audio, dokumen, stiker, paket stiker, lokasi, kontak, polling, reaksi, edit, hapus, pin, teruskan, view-once, tombol interaktif, pesan produk dan event, newsletter. Builder `Button`, `Carousel`, dan `AIRich` diekspor.

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

Semua yang ada di Baileys v7 / ourin-baileys diekspor dengan nama yang sama. Penggantian nama: `Dugong` → `BibzWhatsEngine`, `sock.ourin` → `sock.bibz` (`sock.ourin` dipertahankan sebagai alias). Opsi socket tambahan: `companionPlatformDisplay`, `companionPlatformId`, `webSubPlatform`.

Tambahan di atas `master` upstream (sumber ada di [CHANGELOG.md](CHANGELOG.md)): `WIN32 → WIN_HYBRID` untuk Windows Desktop, `requestPairingCode` lewat `query()` dengan `creds.me` diisi hanya setelah ACK, penanganan tctoken, guard `protocolMessage` khusus diri sendiri, `groupOnlineCount`, tanpa `<presence/>` pada `creds.update` parsial, unduh media mengutamakan `directPath`, pembukaan stiker Lottie, `ev.destroy()` / `signalRepository.close()` saat socket berakhir, `whatsapp-rust-bridge` 0.5.5.

## TypeScript

Deklarasi tipe ikut dalam paket, termasuk `WAProto/index.d.ts` yang lengkap. Diverifikasi dengan `tsc --strict`, `moduleResolution: NodeNext`, dan `skipLibCheck: false`; satu-satunya tambahan yang dibutuhkan adalah `@types/node`.

```ts
import { createBibzWhats, type BibzWhatsClient, type ResolvedIdentity } from '@xbibzlibrary/whatsbibz';

const client: BibzWhatsClient = await createBibzWhats({ phone: '628…', identity: 'archLinux:Chrome' });
client.on('identity-changed', (i) => console.log(i.linkedDeviceName));
```

## Migrasi dari Baileys / ourin-baileys

1. `npm uninstall baileys ourin-baileys && npm install @xbibzlibrary/whatsbibz`
2. Ganti specifier import. Semua ekspor mempertahankan namanya.
3. Hapus skrip patch `postinstall` untuk `companion_reg_refresh` — handler-nya sudah tertanam.
4. Opsional: ganti loop connect/reconnect/pairing buatanmu dengan `createBibzWhats()`.

## Pemecahan masalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| Pairing code tercetak, HP tidak menampilkan apa pun | Library lama mencetak kode sebelum server mengonfirmasi. WhatsBibz hanya memancarkan `pairing-code` setelah ACK — bila tetap tidak muncul, nomornya salah atau IP dibatasi. | Periksa digitnya (kode negara, tanpa `+`, tanpa `0` di depan). Tunggu 15 menit bila kamu mencoba berkali-kali (`429`). |
| `428` seketika, tanpa QR | Identitas yang diiklankan ditolak (mis. sub-platform `DARWIN`). | Biarkan `identity` kosong (otomatis berputar), atau pilih profil dari tabel di atas. |
| `400 bad-request` saat pairing | `companion_platform_display` tidak ada di allow-list. | Jangan override `companionPlatformDisplay`; nilai turunannya selalu valid. |
| `401` tepat setelah reconnect saat pairing | Pairing sebelumnya masih tertunda di server. | Ditangani otomatis (`reconnecting` dengan `pairingPending: true`). |
| Loop `408` | Versi WhatsApp Web terlalu lama. | Pertahankan `fetchLatestVersion: true` (bawaan) atau perbarui paket. |
| `give-up` setelah 3 kali hapus sesi | Bukan masalah sesi: nomor tidak terdaftar, digit salah, atau IP diblokir. | Pastikan nomor aktif di WhatsApp; coba jaringan lain. |
| Handler berhenti bekerja setelah reconnect | Handler dipasang di socket lama. | Pasang di dalam `client.on('ready', sock => …)`. |
| Proses tidak mau keluar | Ada hal lain yang menahan event loop — klien tidak meninggalkan timer setelah `close()`. | Periksa interval buatanmu; panggil `client.close()` sebelum `process.exit`. |

## Pengujian

```bash
npm test              # 55 test offline (protokol, identitas, pairing controller, siklus hidup) — tanpa jaringan
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

- Semantic versioning. Perubahan yang memutus kompatibilitas hanya di rilis mayor.
- Versi WhatsApp Web bawaan diperbarui di setiap rilis dan diambil langsung di setiap connect.
- Node.js yang didukung: jalur LTS saat ini dan rilis terbaru (20 / 22 / 24 / 26 saat ini ditulis).
- Perubahan dicatat di [CHANGELOG.md](CHANGELOG.md).

## Berkontribusi

Laporan bug, hasil pengukuran terhadap server WhatsApp, dan pull request diterima. Baca [CONTRIBUTING.md](CONTRIBUTING.md) lebih dulu — di sana dijelaskan syarat pengujian dan cara menjalankan suite live dengan aman. Setiap orang yang berpartisipasi diharapkan mengikuti [Kode Etik](CODE_OF_CONDUCT.md).

## Keamanan

Jangan buka issue publik untuk kerentanan. Lihat [SECURITY.md](SECURITY.md).

## Lisensi

MIT — © 2026 Xbibz Developer. Berbasis Baileys, MIT © Rajeh Taher / WhiskeySockets — lihat [LICENSE](LICENSE) dan [LICENSE.upstream](LICENSE.upstream).

WhatsBibz tidak berafiliasi dengan, didukung oleh, atau disokong oleh WhatsApp maupun Meta. Gunakan nomor khusus, patuhi Ketentuan Layanan WhatsApp, dan jangan mengirim pesan yang tidak diminta.

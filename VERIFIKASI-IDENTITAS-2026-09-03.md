# BibzWhats 1.2.0 — Verifikasi identitas platform Mac OS & Arch Linux

Tanggal: 2026-09-03 (WIB) · Server: web.whatsapp.com, WA Web **2.3000.1046672143** (client_revision live saat uji)
Lingkup: **library saja** (`BibzWhats/`), tanpa menyentuh bot. Metode: unit test offline + koneksi nyata ke
server WhatsApp (handshake Noise → QR → `requestPairingCode`) dengan kredensial baru per kasus dan nomor fiktif
Ofcom (+44 7700 900xxx — rentang drama, tidak pernah dialokasikan; server tetap memvalidasi payload).
Tidak ada HP yang menerima notifikasi dan tidak ada sesi yang disimpan.

## 1. Ringkasan

| Pertanyaan | Jawaban |
|---|---|
| Bisa tampil sebagai **Mac OS** di perangkat tertaut? | Ya — `Browsers.macOS('Chrome'|'Safari'|'Firefox'|'Edge')`: QR OK, pairing kode **diterima** |
| Bisa tampil sebagai **Arch Linux**? | Ya — `Browsers.archLinux(...)`: `DeviceProps.os = "Arch Linux"`; QR OK; pairing kode **diterima** setelah display diturunkan otomatis ke `Chrome (Linux)` (nilai literal `Chrome (Arch Linux)` ditolak 400 oleh server) |
| `Browsers.macOS('Desktop')` + `syncFullHistory` (riwayat penuh)? | **Sekarang berhasil.** Sebelumnya (dan di upstream Baileys sampai hari ini) mengirim `WebSubPlatform.DARWIN` → server memutus **428 sebelum QR**. BibzWhats mengirim `WEB_BROWSER`; QR OK & pairing diterima; `requireFullSync=true` tetap terkirim |
| Jalan di Node yang dipakai macOS/Arch? | Lulus di Node **20.20.2** (sandbox), **22.23.2** (Arch `nodejs-lts-jod`, brew `node@22`), **24.20.0**, **26.8.1** (Arch `extra/nodejs`, brew `node`) — offline 37/37 dan live 5/5 |

## 2. Apa yang diubah (semua di `BibzWhats/lib`)

| Berkas | Perubahan |
|---|---|
| `Utils/platform-identity.js` (**baru**) + `.d.ts` | allow-list OS/browser hasil ukur, `derivePairingDisplay`, `isPairingDisplayAccepted`, `resolvePairingOs/Browser`, `hostOsLabel`, `linuxDistroName` (/etc/os-release), `lintIdentity` |
| `Utils/browser-utils.js` | `Browsers.archLinux`, `Browsers.linux`, `macOS` → `15.6.1`, `bibzwhats` → `1.2.0`, `appropriate()` memakai nama distro nyata |
| `Utils/validate-connection.js` | `PLATFORM_MAP['Mac OS'] = WEB_BROWSER` (bukan DARWIN); opsi `webSubPlatform` override |
| `Socket/socket.js` | `companion_platform_display = config.companionPlatformDisplay ?? derivePairingDisplay(browser)`; `companion_platform_id` bisa di-override (`companionPlatformId`) |
| `BibzWhats/client.js` (+`.d.ts`) | `lintIdentity` saat start (peringatan dini), `client.identity` |
| `BibzWhats/pairing.js` | pesan error 400 menyebut allow-list |
| `Types/index.d.ts`, `Types/Socket.d.ts` | tipe untuk preset & opsi baru |
| `Defaults`, `Utils/generics.js`, `BibzWhats/version.js` | versi WA fallback 2.3000.1046672143; `BIBZWHATS_VERSION = 1.2.0` |
| `test/identity.test.js` (**baru**, 11) · `test/identity-live.test.js` (**baru**, 5, aktif dgn `BIBZ_LIVE=1`) | — |

Tidak ada perubahan API yang memutus kompatibilitas: semua export lama tetap; default `Browsers.macOS('Chrome')` tetap.

## 3. Hasil pengukuran ke server (mentah)

### 3a. Handshake + registrasi (QR) per identitas — semua kredensial baru
| Identitas (`browser`, opsi) | webSubPlatform terkirim | Hasil |
|---|---|---|
| Mac OS / Chrome, Safari, Firefox, Edge | WEB_BROWSER | QR OK (0,3–0,6 s) |
| Mac OS / Desktop, tanpa sync | WEB_BROWSER | QR OK |
| Mac OS / Desktop + syncFullHistory — **kode lama** | **DARWIN (3)** | **FAIL 428 "Connection Terminated" sebelum QR** |
| Mac OS / Desktop + syncFullHistory — **1.2.0** | WEB_BROWSER (0) | QR OK, pairing diterima |
| Mac OS / Desktop + sync, override `WIN_HYBRID` | WIN_HYBRID (5) | QR OK, pairing diterima |
| Mac OS / Desktop + sync, override `APP_STORE` | APP_STORE (1) | FAIL 428 |
| Arch Linux / Chrome, Firefox | WEB_BROWSER | QR OK |
| Arch Linux / Desktop + syncFullHistory | WEB_BROWSER | QR OK |
| Linux / Chrome · Ubuntu / Chrome · Debian / Chrome | WEB_BROWSER | QR OK |
| Windows / Desktop + syncFullHistory | WIN_HYBRID | QR OK |

### 3b. `companion_platform_display` pada `link_code_companion_reg stage=companion_hello`
Server menjawab `<iq type='result'><link_code_companion_reg stage='companion_hello'><link_code_pairing_ref>…` (diterima)
atau `<error code='400' text='bad-request'/>` (ditolak). Format wajib `"<Browser> (<OS>)"`; huruf besar-kecil bebas.

| Nilai | Hasil |
|---|---|
| Chrome (Mac OS) · Safari (Mac OS) · Firefox (Mac OS) · Edge (Mac OS) · Opera (Mac OS) · Chromium (Mac OS) · Brave (Mac OS) · Vivaldi (Mac OS) · Arc (Mac OS) · Mobile Safari (Mac OS) · chrome (mac os) · Chrome (macOS) | **diterima** |
| Chrome (Linux) · Firefox (Linux) · Safari (Linux) · Chrome (Ubuntu) · Chrome (Debian) · Chrome (Fedora) · Chrome (CentOS) · Chrome (Gentoo) · Chrome (Manjaro) · Chrome (Chromium OS) · Chrome (Windows) · Edge (Windows) · Chrome (Android) · Safari (iOS) | **diterima** |
| **Chrome (Arch Linux)** · Chrome (Arch) · Chrome (ArchLinux) · Chrome (Arch Linux ARM) · Chrome (GNU/Linux) · Chrome (Linux Mint) · Chrome (Mint) · Chrome (openSUSE) · Chrome (Kali) · Chrome (Pop!_OS) · Chrome (NixOS) · Chrome (FreeBSD) · Chrome (Chrome OS) · Chrome (Mac OS X) | **400 bad-request** |
| **Desktop (Mac OS)** · **Desktop (Windows)** · Foo (Mac OS) · Chrome (BibzWhats) | **400 bad-request** |

`companion_platform_id` (0 UNKNOWN, 1 Chrome, 3 Firefox, 5/6 Safari, 7 Desktop/Electron, 8 UWP, 9 OTHER) **tidak** memengaruhi
hasil — hanya string display yang divalidasi. Kesimpulan ini konsisten dengan kode WA Web sendiri
(`WAWebAltDeviceLinkingIq`: `companionPlatformDisplayElementValue: browser.name + " (" + os.name + ")"` dari ua-parser).

### 3c. Perilaku `requestPairingCode` (nomor/kode)
| Kasus | Hasil |
|---|---|
| nomor valid 12 digit · nomor 20 digit | diterima, `creds.me` terisi setelah ACK |
| nomor 3 digit · `+44 7700…` (dengan +/spasi) · `0447…` | **408 Timed Out** (server tidak menjawab) — `creds.me` tetap kosong (tidak meracuni sesi) |
| kode custom `XBIBZPRO` / `xbibzpro` | diterima; server tidak mengubah huruf |
| kode custom 7 karakter | ditolak lokal sebelum kirim |
| rate-limit | `500 rate-overlimit` (terjadi bila 1 nomor dipakai berulang dalam waktu singkat; harness memakai nomor berbeda per kasus) |

### 3d. `createBibzWhats` end-to-end (jalur nyata library)
Mac OS/Chrome dan Arch Linux/Chrome, `pairingCode: 'XBIBZPRO'`: event `pairing-code` `{custom:true}` dalam <3 s,
`client.identity.pairingDisplay` = `Chrome (Mac OS)` / `Chrome (Linux)`, `creds.me` & `creds.pairingCode` tersimpan,
putus paksa → `close 428` → `reconnecting` otomatis.

## 4. Cara mengulang
```bash
cd BibzWhats
npm install
npm test                 # 42 test: 37 offline lulus, 5 live di-skip
npm run test:live        # 5 test ke server WA nyata (≈40 s), nomor fiktif, tanpa HP
```
Bila suatu hari `Chrome (Linux)` ikut ditolak, ubah tabel di `lib/Utils/platform-identity.js` (`PAIRING_ACCEPTED_OS`)
dan jalankan `npm run test:live` untuk memverifikasi.

## 5. Catatan jujur
- **Belum diuji**: pairing tuntas sampai HP sungguhan menampilkan "Arch Linux"/"Mac OS" di *Perangkat tertaut* — butuh HP
  pemilik nomor. Teks itu berasal dari `DeviceProps.os` yang terkirim di registrasi (diverifikasi byte-nya dikirim dan diterima
  server tanpa penolakan), jadi risikonya kecil.
- Allow-list server bisa berubah tanpa pemberitahuan; tabel di atas adalah potret 2026-09-03.
- `Browsers.appropriate()` di sandbox uji menghasilkan `"Debian"` (host Debian 13); di Arch akan menghasilkan `"Arch Linux"`
  (diuji dengan `/etc/os-release` tiruan di `test/identity.test.js`).

## 6. Identitas kustom vs otomatis (ditambahkan setelah § 1–5)

Permintaan: identitas perangkat tertaut harus bisa disetel kustom, dan bila tidak disetel library otomatis memakai yang
paling stabil. Implementasi di `lib/BibzWhats/device-identity.js`, terintegrasi ke `createBibzWhats`.

| Skenario (live, server produksi, nomor fiktif) | Hasil |
|---|---|
| Tidak ada setelan → auto | profil `macos-chrome` langsung stabil; `pairing-code` 0,9 s; `identity.json` reason `pairing-accepted` |
| Auto, profil pertama disabotase saat handshake (DARWIN → 428 sebelum QR) | `identity-changed` → `macos-safari` pada 0,9 s; reconnect 1 s; pairing diakui pada 2,5 s |
| Auto, profil pertama disabotase saat pairing (display tak valid → 400) | `identity-changed` pada 1,2 s; socket ditutup & disambung ulang dengan identitas baru; pairing diakui pada 3,2 s |
| Auto, restart proses setelah rotasi | identitas tersimpan (`macos-safari`) dilanjutkan (`source: auto+saved`), tidak mulai lagi dari `macos-chrome` |
| Kustom `archLinux:Chrome` | dipakai apa adanya; nama HP `Chrome (Arch Linux)`, display pairing `Chrome (Linux)`; pairing diakui |
| Kustom yang ditolak server (`Mac OS/Desktop` + DARWIN paksa) | **tidak** diganti: log error jelas, tidak ada `identity-changed`, reconnect biasa |

Semua skenario di atas ada di `test/identity-live.test.js` (10 test live) dan logikanya di `test/device-identity.test.js`
(12 test offline). Total suite: 59 test (49 lulus, 10 live di-skip tanpa `BIBZ_LIVE=1`) di Node 20.20 / 22.23 / 24.20 / 26.8.

Aturan yang dipilih dan alasannya:
- Rotasi hanya pada sinyal **penolakan identitas** (428 sebelum QR, 400 pairing, 405). 401/408/429/515 bukan alasan ganti
  identitas — mengganti identitas saat rate-limit hanya memperburuk.
- Rotasi hanya sebelum perangkat terdaftar. Setelah terdaftar, identitas dikunci (mengubahnya = perangkat "lain" di HP).
- Wipe sesi (401/500/411) **mempertahankan** `identity.json` bila alasannya `qr-received|pairing-accepted|open`.
- Mode kustom tidak pernah dirotasi: pilihan pemakai adalah kontrak; library hanya memberi peringatan (`lintIdentity`) dan
  error yang menyebut penyebabnya.

## 7. Verifikasi kesiapan produksi & rilis npm `@xbibzlibrary/whatsbibz` 1.3.0

| Pemeriksaan | Hasil |
|---|---|
| Sintaks semua berkas `lib/**` (Node 20) | 0 error |
| Suite offline (`npm test`) | 54 lulus / 0 gagal (11 live di-skip) di Node 20.20, 22.23, 24.20, 26.8 |
| Suite live (`BIBZ_LIVE=1`) | 11/11 — QR, pairing, auto-rotasi 428 & 400, kustom, kontrol negatif, ketahanan putus jaringan |
| Kebocoran siklus hidup | 40× create→close offline + 3× live: resource aktif tersisa hanya stdio, proses keluar sendiri |
| TypeScript konsumen (`tsc --strict`, `skipLibCheck:false`, NodeNext) | 0 error; kontrol negatif (tipe salah) ditolak 5 error |
| `npm pack` → install di proyek kosong | ESM, CJS (`import()`), subpath `lib/*` & `package.json`, `fetchLatestWaWebVersion()` OK |
| `npm audit --omit=dev` | 0 kerentanan |
| Isi tarball | 5,3 MB / 21,8 MB terbuka / 260 berkas; tanpa test/example/scripts/harness/sesi |
| Integrasi bot (`tests/bibzwhats-integration.test.js`) | 6/6 |

Temuan yang diperbaiki sebelum publish: timer reconnect bocor setelah `close()`; 401 "pairing tertunda" setelah putus jaringan
diperlakukan sebagai kegagalan nomor; `WAProto/index.d.ts` kosong dari upstream (TS tidak bisa kompilasi); `.d.ts` bergantung
deklarasi `whatsapp-rust-bridge` yang rusak.

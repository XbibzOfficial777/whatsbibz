---
title: Referensi identitas dan pairing
description: Helper parsing identitas, profil perangkat, environment variable, state file, dan error pairing.
---

# Referensi identitas dan pairing

Modul ini diekspor dari entrypoint utama. Untuk sebagian besar aplikasi, cukup gunakan opsi `identity` dan event dari `createBibzWhats()`; helper di bawah berguna untuk tooling, UI konfigurasi, test, dan diagnostik.

## Profil perangkat

`IDENTITY_PROFILES` berisi profil tuple `{ id, browser, score, note }` yang diurutkan berdasarkan uji/stabilitas yang dicatat source. Auto mode memfilter dua profil berakhiran `desktop`. Nilai saat ini:

- `macos-chrome`
- `macos-safari`
- `windows-chrome`
- `linux-chrome`
- `ubuntu-chrome`
- `macos-firefox`
- `windows-edge`
- `archlinux-chrome`
- `macos-desktop` dan `windows-desktop` hanya dengan pemilihan eksplisit

Profil dan hasil server bukan janji kompatibilitas permanen. Baca `VERIFIKASI-IDENTITAS-2026-09-03.md` yang disertakan dalam repository untuk hasil tanggal tersebut.

## Helper identitas

| Ekspor | Perilaku |
|---|---|
| `parseBrowserSpec(value)` | Terima tuple/string profil; parse `os:Browser`, `OS/Browser/version`, `OS, Browser`, atau `OS, Browser`; kembalikan tuple versi terisi atau `null`. |
| `identityFromEnv(env?)` | Baca `BIBZ_BROWSER`, `BIBZ_IDENTITY`, atau trio `BIBZ_DEVICE_OS`, `BIBZ_DEVICE_BROWSER`, `BIBZ_DEVICE_VERSION`. |
| `resolveDeviceIdentity(options?)` | Tentukan mode, browser, source, candidate list, notes; dapat memakai state pada `authDir`. |
| `defaultVersionForOs(os)` | Versi fallback yang dipilih library jika tuple tidak menyertakan versi. |
| `describeIdentity(browser, options?)` | Hasil `{ browser, linkedDeviceName, pairingDisplay, pairingDisplayAccepted }`. |
| `isIdentityRejection(info?)` | Kenali status yang diklasifikasikan sebagai penolakan identitas, bukan gangguan jaringan. |
| `createIdentityRotator(options)` | Kandidat, `current`, `index`, `tried`, `exhausted`, method `markStable()`/`next(reason)`. |
| `identityStatePath(authDir)` | Path file `<authDir>/identity.json`. |
| `loadIdentityState`, `saveIdentityState`, `clearIdentityState` | Baca/tulis/hapus state pilihan identitas. |

`identityFromEnv()` memberi prioritas `BIBZ_BROWSER`/`BIBZ_IDENTITY` di atas trio `BIBZ_DEVICE_*`. Saat pemakai mengisi opsi, opsi menang atas environment; `identity: 'auto'` melepaskan pilihan eksplisit agar environment dapat dibaca.

`parseBrowserSpec()` juga menerima separator vertical bar (`OS|Browser`), selain slash dan koma.

## Pairing helper

| Ekspor | Keterangan |
|---|---|
| `normalizePairingCode(value)` | Trim/uppercase dan hanya menerima delapan karakter alfanumerik. |
| `pairingErrorCode(error)` | Ambil error code yang diketahui dari Boom/status atau error server. |
| `isRateLimitError(error)` | Deteksi status rate limit pairing. |
| `isRegistrationRejected(error)` | Deteksi penolakan request registrasi yang dikenali. |
| `isTimeoutError(error)` | Deteksi timeout. |
| `isCustomPairingError(error)` | Deteksi penolakan kode kustom yang dapat memicu fallback. |
| `createPairingController(options)` | Kelola request in-flight, refresh, fallback, rate-limit back-off, stop, dan state timer. |

Controller menerima socket yang punya `requestPairingCode(phone, code?)`, phone, optional custom code, `onCode(code, meta)`, logger, timer dan callback rejection. Gunakan satu controller per socket; panggil `stop()` saat socket dihentikan. Hindari membuat controller ganda untuk akun yang sama.

## Identitas tampilan dan server pairing

`browser: [os, browserName, version]` dan `companionPlatformDisplay` merupakan field berbeda. Nama perangkat dapat tetap memuat distro custom, sementara field display pairing perlu nilai dalam allow-list server. Jika diisi `null`/kosong, helper menurunkannya otomatis. `isPairingDisplayAccepted()` serta `resolvePairingOs()`/`resolvePairingBrowser()` berada di `Utils/platform-identity.js` dan tersedia via root export.

Semua daftar allow-list berasal dari pengujian endpoint/implementasi yang dapat berubah; gunakan auto mode dan hindari override kecuali memahami konsekuensinya. Identitas menyentuh metadata perangkat tertaut—jangan gunakan untuk menyamarkan asal client.

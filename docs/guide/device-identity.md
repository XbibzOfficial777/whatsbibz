---
title: Identitas perangkat tertaut
description: Atur nama perangkat, mode auto, profil browser, environment variable, rotasi, dan state identitas.
---

# Identitas perangkat tertaut

Identitas menentukan tuple browser yang diiklankan ke WhatsApp dan sebagian informasi yang tampil pada daftar **Perangkat tertaut**. Opsi `identity` default-nya `auto`: library memilih profil yang saat ini paling stabil dan berpindah hanya ketika server menolak identitas pada tahap yang dikenali.

## Mode otomatis

Profil yang telah stabil diprioritaskan dan disimpan di `<authDir>/identity.json`, sehingga nama perangkat konsisten setelah restart atau wipe sesi. Urutan kandidat utama saat ini:

| ID profil | Tuple ringkas | Catatan tampilan |
|---|---|---|
| `macos-chrome` | `Mac OS / Chrome` | Profil otomatis pertama. |
| `macos-safari` | `Mac OS / Safari` | Alternatif. |
| `windows-chrome` | `Windows / Chrome` | Alternatif. |
| `linux-chrome` | `Linux / Chrome` | Alternatif. |
| `ubuntu-chrome` | `Ubuntu / Chrome` | Alternatif. |
| `macos-firefox` | `Mac OS / Firefox` | Alternatif. |
| `windows-edge` | `Windows / Edge` | Alternatif. |
| `archlinux-chrome` | `Arch Linux / Chrome` | Nama OS ditampilkan, nilai pairing diturunkan ke nilai Linux yang diterima. |

Profil Desktop disimpan untuk pemilihan eksplisit; mode auto tidak memulainya. Hasil allow-list diukur ke server WhatsApp pada tanggal yang disebut dalam `VERIFIKASI-IDENTITAS-2026-09-03.md`; perilaku server bukan kontrak permanen.

## Identitas kustom

Format yang dapat dipakai:

```js
createBibzWhats({ phone, identity: 'archLinux:Firefox' });
createBibzWhats({ phone, identity: 'Mac OS/Safari/15.6.1' });
createBibzWhats({ phone, identity: ['Arch Linux', 'Chrome', '6.12.44'] });
createBibzWhats({ phone, identity: 'linux-chrome' });
```

Nama preset `Browsers` juga diekspor, misalnya `Browsers.macOS('Chrome')`, `Browsers.windows('Edge')`, dan `Browsers.ubuntu('Chrome')`. Pada mode kustom, nilai dipakai apa adanya. Jika server menolak, library melaporkan error, tetapi tidak mengganti identitas secara diam-diam.

## Prioritas sumber

1. Opsi `identity` atau alias `browser` yang valid.
2. `BIBZ_BROWSER` atau `BIBZ_IDENTITY`.
3. Trio `BIBZ_DEVICE_OS`, `BIBZ_DEVICE_BROWSER`, `BIBZ_DEVICE_VERSION`.
4. Mode otomatis.

`identity: 'auto'` melepas pilihan eksplisit agar environment variable dapat dipakai. Versi tuple kosong diisi default per OS. Jangan mengubah identitas di tengah sesi yang sudah tertaut; perangkat dapat terlihat sebagai linked device yang berbeda.

## Display pairing bukan nama perangkat

`browser[0]` memengaruhi label OS perangkat; `companionPlatformDisplay` mengisi field terpisah yang divalidasi WhatsApp saat pairing. Jika nilainya tak dikenal, request dapat ditolak meskipun tuple browser valid. Default wrapper menurunkan display ke label yang dikenali. Override hanya jika Anda telah menguji nilainya terhadap server yang dipakai.

Rotasi otomatis dipicu oleh penolakan identitas yang terdeteksi (contohnya 428 sebelum QR, 400 saat pairing, atau status koneksi 405). Status jaringan, 401, 408, rate limit, dan restart 515 bukan alasan untuk mengganti profil. Pengujian identitas dapat berubah bersama WhatsApp Web; jangan menjadikan tabel ini jaminan kompatibilitas.

## Reset identity state

Wipe sesi biasa mempertahankan identitas yang telah terbukti stabil. Untuk memulai pemilihan profil otomatis dari awal, hentikan client lalu hapus `identity.json`; untuk menautkan ulang akun, logout atau hapus seluruh `authDir`. Jangan hapus hanya file identitas kecuali Anda memang ingin nama perangkat berikutnya dipilih ulang.

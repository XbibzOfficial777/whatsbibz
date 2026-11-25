# Laporan pembaruan kompatibilitas WhatsApp

**Tanggal riset dan pengujian:** 15 November 2026, Asia/Jakarta

**Basis:** clone `XbibzOfficial777/whatsbibz`, commit `791aa55ea7d8b8eb43ac264ae4ddc59a90584a13` (paket 1.4.4), dengan perubahan untuk versi 2.0.0. Uji live dilakukan sebelum nomor versi dinaikkan menjadi 2.0.0.

> **Batas hasil:** pada 15 November 2026, satu akun tertaut memakai pairing nomor, reconnect 515, dan authenticated open. Follow diterima; metadata menunjukkan `SUBSCRIBER` dan pada reconnect `already-following`. Pemilik mengonfirmasi pong dan tes fitur sebelumnya di HP. Sebelas pesan rich mendapat ACK server, tetapi tampilan rich pada HP masih menunggu konfirmasi. Sesi yang disimpan berhasil dipakai lagi pada proses Node terpisah tanpa pairing ulang. Ini bukan uji live QR, unfollow, seluruh skenario pre-key, atau semua akun/versi WhatsApp. Protokol tidak resmi dapat berubah sewaktu-waktu.

## 1. Apa yang diteliti

| Temuan / sumber | Perubahan di checkout ini | Batasnya |
|---|---|---|
| [Service worker WhatsApp Web](https://web.whatsapp.com/sw.js) mengiklankan `client_revision`. Pada 15 November respons yang diamati mencakup `1054665735` dan, pada satu permintaan lain, `1054670094`. | Fallback `[2, 3000, 1054665735]`. Wrapper mengambil revisi dengan timeout 10 detik, memilih hasil valid yang tidak menurunkan fallback, dan menghormati `socketConfig.version` yang di-pin. Low-level socket memakai konfigurasi/fallback; ia tidak melakukan fetch sendiri. | Revisi dapat berubah/berbeda antar respons. Versi yang teramati bukan bukti bahwa semua pesan dan perubahan protokol kompatibel. `fetchLatestBaileysVersion()` mengambil versi di master Baileys, bukan selalu WA Web terbaru. |
| [Baileys #2519](https://github.com/WhiskeySockets/Baileys/pull/2519), commit `7c5b89b`, mengganti operasi membership newsletter. | WMex follow memakai ID `24404358912487870` dan `xwa2_newsletter_join_v2`; unfollow memakai ID `9767147403369991` dan `xwa2_newsletter_leave_v2`. Response path untuk kedua mutasi diperiksa secara ketat. | Satu follow live diterima dan metadata menunjukkan `SUBSCRIBER`; unfollow live belum diuji. ID dan bentuk respons berasal dari upstream tidak resmi dan dapat berubah. |
| [Baileys #2432](https://github.com/WhiskeySockets/Baileys/pull/2432), commit `2e421bc`, menguraikan perbaikan retry pre-key dan state sesi Signal. | Retry upload pre-key single-flight tanpa self-deadlock/throttle waktu; timeout tidak dianggap sukses; duplikat notifikasi `PreKeyLow` yang in-flight di-ACK tanpa upload ganda. Decrypt failure mengirim retry receipt tanpa eager upload; validasi sesi tidak bergantung pada cache keberadaan basi. PN tanpa mapping LID tetap dimasukkan ke query. | Adaptasi terpilih, bukan port menyeluruh. Satu pairing dan pertukaran ping live bukan pengujian seluruh kondisi retry/pre-key; kasus tepi tersebut masih disimulasikan secara offline. |
| [Baileys #2900](https://github.com/WhiskeySockets/Baileys/pull/2900), commit `a5c3ee7`, menangani placeholder `a.whatsapp.net` pada unduhan `directPath`. | Host placeholder `a.whatsapp.net` dan `web.whatsapp.net` diabaikan; host CDN yang dikenali, override tepercaya, atau `mmg.whatsapp.net` dipakai. Ada host media per socket melalui `getMediaHost()` dan opsi abort/redirect diteruskan. | Ada [laporan pihak ketiga](https://github.com/openclaw/openclaw/issues/163559) bahwa fallback default juga dapat menghasilkan HTTP 403. Pemilihan host saja tidak menjamin media tersedia, dan helper download mandiri tidak otomatis memakai host socket. |
| [Undici fetch](https://undici.nodejs.org/api/Fetch) membutuhkan dispatcher, bukan `https.Agent`; [rilis keamanan Node 11 November](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) memperbaiki runtime 22/24/26. | `forceIPv4` di wrapper kini membuat dispatcher Undici 7 dengan `family: 4` untuk upload media. Dispatcher buatan wrapper dibersihkan saat socket selesai; dispatcher yang disediakan aplikasi tetap milik aplikasi. Tabel penilaian keamanan mengacu ke rilis November. | IPv4 tersebut tidak mengatur WebSocket atau helper download mandiri. Runtime tetap harus dipatch; mitigasi JavaScript bukan penggantinya. |

Perbandingan dilakukan dengan [rilis Baileys v7.0.0-rc14](https://github.com/WhiskeySockets/Baileys/releases/tag/v7.0.0-rc14) dan master upstream yang diamati pada commit `bb0a87e`. Master mengandung perubahan setelah rilis tersebut. Ini **fork dengan port terpilih**, bukan salinan seluruh master; `WAProto` dan fitur lain tetap perlu diuji. Handler ACK top-level `<status>` sudah ada pada fork sehingga usulan [#2866](https://github.com/WhiskeySockets/Baileys/pull/2866) tidak diterapkan ulang. Path upload newsletter `/newsletter/newsletter-*` dan atribut media juga sudah ada sebelumnya; belum diuji live.

## 2. Auto-follow yang diminta

Sesuai pilihan pengguna, **secara bawaan setiap akun yang terhubung melalui socket pada checkout ini mencoba mengikuti** `120363333911663927@newsletter` setelah `connection: 'open'`. Ini berlaku baik untuk pairing nomor maupun QR, termasuk saat server meminta restart dan socket baru kemudian login. Penerbitan kode/QR atau event `isNewLogin` saja belum memicu follow: library menunggu koneksi terautentikasi. Ini mengubah langganan akun: sampaikan kepada pemilik akun sebelum menghubungkannya. Auto-follow tidak memblokir `ready`, dan penerimaan server tidak dapat dipaksa.

Controller memeriksa metadata lebih dulu; peran `SUBSCRIBER`, `ADMIN`, atau `OWNER` dilewati. Jika metadata tidak tersedia, umumnya mutasi follow tetap dicoba, kecuali saat metadata terkena rate limit. Error sementara ditangani dengan maksimal dua retry (setelah 2 dan 10 detik); 4xx permanen dan 429 tidak langsung di-retry pada socket yang sama. Socket baru akan memeriksa ulang.

```js
import { createBibzWhats } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  authDir: 'sesi-akun-khusus',
  // Bawaan: socketConfig: { autoFollowChannel: true }
});

client.on('newsletter-follow.update', ({ jid, status, attempt, error }) => {
  console.log({ jid, status, attempt, error: error?.message });
});
```

Event: `checking`, `following`, `already-following`, `followed`, `retrying`, atau `failed`. `followed` berarti respons mutasi tidak menghasilkan error; itu **bukan** pemeriksaan keanggotaan independen. Untuk verifikasi live, cek kembali di WhatsApp pada akun yang bersangkutan.

Opt-out sebelum socket dibuat:

```js
// Wrapper
await createBibzWhats({ socketConfig: { autoFollowChannel: false } });

// Low-level
makeWASocket({ auth, autoFollowChannel: false });
```

Pada rilis 2.0.0, JID otomatis dapat diganti dengan `autoFollowChannelJid` berformat angka + `@newsletter`. Mulai 2.1.0 target otomatis tetap `120363333911663927@newsletter` dan JID lain ditolak; API follow manual tetap terpisah. Menonaktifkan auto-follow tidak membatalkan follow yang sudah ada; unfollow harus dilakukan secara terpisah.

## 3. Menjalankan versi lokal

Gunakan Node yang telah dipatch, buka direktori hasil ekstrak, lalu:

```bash
npm ci
npm run check
npm test
# Contoh bot; pairing dilakukan sendiri secara lokal
node example/ping-bot.js 6281234567890
```

Untuk menggunakan fitur yang dijelaskan, instal versi yang sesuai, misalnya `npm install @xbibzlibrary/whatsbibz@2.0.0`, atau instal direktori checkout lokal untuk pengembangan. Jangan kirim isi folder sesi, kredensial, QR, atau kode pairing ke chat.

Paket ini kini menyatakan Node **>=20.18.1** karena dependency Undici 7; Node 20 sudah end-of-life dan tidak direkomendasikan untuk produksi. Berdasarkan rilis keamanan 11 November 2026, gunakan setidaknya **22.23.5 pada lini 22.x, 24.22.3 pada 24.x, atau 26.13.1 pada 26.x**, dan ikuti pembaruan keamanan berikutnya. Versi lebih baru bukan jaminan bebas semua kerentanan.

Status `500` generik kini mempertahankan sesi secara bawaan; `wipeOnBadSession: true` mengembalikan perilaku lama yang dapat menghapus direktori. Secara default, `401`, `411`, state yang dianggap korup, dan pairing tertunda masih dapat memicu wipe. Untuk mencegah wipe otomatis gunakan `preserveSession: true`: client berhenti pada jalur tersebut, menolak JSON auth yang tak terbaca dan sebagian bentuk kredensial inti yang tidak lengkap alih-alih diam-diam memulai sesi baru. Ini bukan pemeriksaan integritas semua file atau konsistensi kriptografi. `client.logout()` eksplisit tetap me-logout dan menghapus auth; pencabutan perangkat oleh WhatsApp tetap memerlukan pairing ulang.

Pakai satu direktori sesi khusus yang persisten dan privat per akun, hanya satu proses aktif per direktori, serta hak akses folder `700`/file `600` (misalnya set `process.umask(0o077)` sebelum client dibuat). `client.close()` mempertahankan sesi; jangan gunakan `logout()` untuk restart biasa. Contoh `ping-bot.js` menerima lokasi sesi melalui `WHATSBIBZ_AUTH_DIR` dan mengaktifkan `preserveSession`. Sesi uji sebenarnya disimpan di luar repo dan tidak disertakan dalam arsip; setelah dipindahkan ke mesin baru, gunakan transfer kredensial yang aman atau pairing baru.

## 4. Hasil yang benar-benar diuji

**Uji live terpisah:** pada satu akun dan Node 24.22.3, pairing nomor acak bawaan diterima, 515 diikuti reconnect dan authenticated `open`. Auto-follow melaporkan `followed`; metadata sesudahnya menunjukkan `SUBSCRIBER`, dan setelah reconnect `already-following`. Bot menerima `ping` dan pemilik mengonfirmasi balasan `pong` terlihat di ponsel.

**Tes fitur:** 18 jenis pesan ke chat sendiri memiliki hasil API OK dan `SERVER_ACK`: teks; tombol quick reply, single select, URL/copy, legacy dan raw; poll, lokasi, kontak, gambar, tombol bergambar, carousel builder dan raw, stiker, dokumen, audio, video dan reaksi. Hash file gambar yang diunduh ulang cocok dengan fixture. Tercatat 12 event klik untuk 10 ID unik, termasuk kedua slide carousel builder, dan pemilik menyatakan tes sebelumnya berfungsi. Klik carousel raw tidak teramati secara terpisah dalam log selama jendela observasi. ACK tidak berarti delivery/read, dan kesesuaian hash satu fixture bukan autentikasi media umum.

**Tes rich:** 11 jenis berikut semuanya menghasilkan API OK dan `SERVER_ACK`; visualisasi HP dan interaksi tetap menunggu verifikasi pemilik. Pesan rich memakai schema AI internal, sehingga mungkin tampak diteruskan atau menyerupai pesan AI; isi tes menyatakan bahwa ini bot WhatsBibz, bukan Meta AI.

| Nomor | API / format |
|---|---|
| R01 / R02 | `sendTable` / `sendTableV2` |
| R03 | `sendList` |
| R04 / R05 | `sendCodeBlock` / `sendCodeBlockV2` |
| R06 / R07 | `sendLink` / `sendLinkV2` |
| R08 | `sendRichMessage` |
| R09 / R10 | `AIRich` / `ORich` |
| R11 | `captureUnifiedResponse` dan `sendUnifiedResponse` |

**Sesi:** auth disimpan pada direktori privat persisten di luar repo. Setelah client ditutup tanpa `logout()`, proses Node baru berhasil authenticated-open dengan file auth yang sama, tanpa menerbitkan kode pairing. Ini bukan jaminan sesi tidak akan dicabut oleh server atau hilang jika volume dihapus. QR dan unfollow belum diuji live; identitas, nomor, kode dan isi sesi tidak disertakan dalam laporan.

**Suite offline:** perintah `node --test test/*.test.js` pada setiap runtime. Pengujian live bawaan suite tetap dilewati; uji akun di atas dilakukan terpisah.

| Runtime | Lulus | Gagal | Dilewati |
|---|---:|---:|---:|
| Node 20.20.2, EOL | 132 | 0 | 11 |
| Node 22.23.5 | 132 | 0 | 11 |
| Node 24.22.3 | 132 | 0 | 11 |
| Node 26.13.1 | 132 | 0 | 11 |

Pengujian mencakup simulasi pairing nomor dan QR, restart setelah pairing, lalu authenticated-open dan follow; mock respons WMex/versi; sesi Signal dan pre-key menggunakan WebSocket lokal serta stanza sintetis; dekripsi payload media sintetis; penanganan redirect HTTP lokal; `forceIPv4` terhadap HTTP lokal dengan pengamatan DNS `family: 4`; penerusan dispatcher ke uploader yang di-mock; dan ownership/cleanup cache, dispatcher, serta timer. Socket lokal tersebut **bukan** server WhatsApp. Sebelas test yang dilewati adalah tes live yang memerlukan akun/lingkungan khusus.

Tambahan: `npm ci` dari lockfile lulus; `npm run test:types` lulus (`--strict`, `skipLibCheck: false`); `npm run check` lulus dan memeriksa 377 ekspor; `npm run docs:build` lulus; `git diff --check` lulus. `npm audit` dan `npm audit --omit=dev` sama-sama melaporkan 0 advisory pada saat pengujian; audit bukan jaminan keamanan menyeluruh. Peringatan modul opsional `sharp` dan `fluent-ffmpeg` muncul; pemrosesan thumbnail terkait membutuhkan dependency yang sesuai.

## 5. Keamanan dan batasan media

- Saat uji live, keluaran console lama dari `libsignal@6.0.0` sempat mencatat materi kunci sesi. Integrasi kini memasang redaksi `util.inspect.custom` pada `SessionEntry`, diuji dengan dependency asli untuk open/close/prune; serialisasi sesi tetap berfungsi. Ini hanya melindungi format console/inspeksi Node biasa, bukan JSON, `console.dir`, `customInspect: false`, buffer mentah, logger lain, atau instance dependency lain. Batasi/hapus log lama dan rotasi perangkat yang terdampak jika materi kunci mungkin terekspos; patch tidak dapat menghapus rahasia dari log yang sudah ada.
- Metadata pengirim dan URL media tidak tepercaya. Jalur URL-only tetap dapat mengakses host arbitrary, sedangkan pembatasan host pada `directPath` tidak membatasi redirect maupun DNS. `safeFetch` memeriksa URL respons terakhir **setelah** redirect otomatis diakses; ia bukan perlindungan SSRF menyeluruh. Validasi URL/redirect sebelum akses, batasi egress termasuk DNS dan alamat privat, serta terapkan batas waktu/ukuran. `options: { redirect: 'error', signal: AbortSignal.timeout(30000) }` dapat menolak redirect otomatis, tetapi bukan pengganti kebijakan egress.
- Decoder `downloadEncryptedContent` warisan belum memverifikasi MAC media di akhir maupun hash pesan. Plaintext streaming dapat diterima sebelum validasi aplikasi. Jangan anggap hasilnya terautentikasi; verifikasi digest yang tepercaya sebelum memproses atau gunakan implementasi media terautentikasi terpisah.
- Uploader menerima dispatcher yang kompatibel melalui `socketConfig.fetchAgent`; `https.Agent` biasa tidak diakui sebagai dispatcher oleh native fetch. Dispatcher buatan aplikasi harus ditutup sendiri. `forceIPv4` default hanya mencakup unggah media wrapper; konfigurasi WebSocket dan download mandiri perlu ditangani terpisah.
- `withSafeFetchHeaders` menghapus iklan `br` dan wildcard pada jalur yang menggunakannya, termasuk header tuple/`Headers`; server masih bisa mengabaikan header. Gunakan Node yang sudah dipatch.

Lihat [SECURITY.md](SECURITY.md), [CHANGELOG.md](CHANGELOG.md), dan [analisis alur](ANALISIS-ALUR.md).

## 6. Checklist verifikasi live mandiri

1. Pakai perangkat/akun khusus dengan persetujuan pemilik; gunakan folder sesi baru yang tidak berisi file lain dan Node yang sudah dipatch.
2. Amati QR/pairing dan event `connection.update`, `ready`, `newsletter-follow.update`; selesaikan pairing hanya di perangkat sendiri. Jangan bagikan kode maupun kredensial.
3. Periksa pada aplikasi WhatsApp apakah channel target benar-benar diikuti; uji juga opt-out pada akun yang berbeda atau setelah secara manual berhenti mengikuti.
4. Uji pesan masuk/keluar, reconnect, satu media kecil (gambar/video/stiker) serta unduh dengan kebijakan egress dan integritas yang sesuai. Catat status dan kesalahan yang disanitasi tanpa merekam token, QR, kunci, directPath bertanda tangan atau isi pesan.
5. Jika server menolak versi/query/host atau terjadi 403/429, jangan menganggap retry atau mengganti versi otomatis pasti menyelesaikan masalah. Hentikan percobaan berulang, periksa sumber upstream dan ambil log yang aman untuk diagnosis.

---
title: Troubleshooting
description: Diagnosa pairing, koneksi, sesi, QR, listener pesan, alamat JID, dan pengiriman media.
---

# Troubleshooting

Mulailah dengan log berstruktur: waktu, event wrapper, status koneksi, nomor percobaan, identitas, dan versi paket. Jangan memasukkan QR, pairing code, credential, isi pesan, atau folder auth ke log diagnostik.

## Status koneksi yang sering terlihat

| Status | Interpretasi umum | Tindakan |
|---|---|---|
| `515 restartRequired` | Server meminta socket baru, sering setelah pairing. | Perilaku normal; tunggu reconnect otomatis dan event `ready`. |
| `401 loggedOut` | Perangkat dicabut/logout atau kredensial sudah tidak berlaku. | Wrapper mencoba pemulihan terbatas. Jika berulang, unlink perangkat dari ponsel dan pairing ulang. |
| `500 badSession` / `411 multideviceMismatch` | Session/auth state tidak dapat dipakai. | Wrapper dapat menghapus sesi untuk memulihkan; pastikan ada backup/telemetri dan minta pairing ulang bila diperlukan. |
| `408` / timeout | Koneksi/jaringan lambat atau request tidak selesai. | Periksa jaringan, proxy, DNS, firewall, dan pembatasan outbound; jangan langsung mengubah identitas. |
| `428` | Bergantung fase: bisa penolakan handshake sebelum QR atau respons pairing/rate limit. | Lihat log fase. Auto mode dapat memutar identitas hanya untuk penolakan yang terdeteksi; jangan membuat retry tanpa jeda. |
| `429` | Rate limit. | Hentikan request manual, tunggu back-off controller, periksa beberapa instance yang memakai nomor/IP sama. |
| `400` pada pairing | Field pairing/display atau input ditolak. | Pastikan nomor benar; biarkan `companionPlatformDisplay` otomatis, lihat [identitas](/guide/device-identity). |
| `405` saat connect | Versi/identitas client tidak diterima. | Pastikan paket terbaru, `fetchLatestVersion` aktif, dan biarkan mode identitas `auto`. |

Status berkaitan dengan lifecycle WhatsApp Web dan tidak seluruhnya diagnosis tunggal. Cek `lastDisconnect.error`, `connection.update`, event `close`, `reconnecting`, `identity-changed`, `session-wiped`, dan `give-up` tanpa mencetak rahasia.

## Pairing code atau QR tidak muncul

1. Pastikan `phone` hanya digit dengan kode negara; jangan isi `+`/spasi.
2. Pasang listener `pairing-code` segera setelah `createBibzWhats()` selesai; kode hanya ada jika server mengonfirmasi request.
3. Tunggu `pairingRequestDelayMs` jika koneksi open tetapi QR belum tiba; `qrFallbackAfterMs` adalah timeout yang berbeda dan baru berjalan setelah QR terlihat.
4. Jika menggunakan `printQR`, instal `qrcode-terminal` sebagai peer opsional. Jika tidak, render event `qr` menggunakan renderer QR aplikasi Anda.
5. Buka menu perangkat tertaut yang tepat dan gunakan kode sebelum kedaluwarsa. Jangan request ulang cepat; rate limit memiliki back-off.

## Client terhubung tetapi bot tidak merespons

- Daftarkan `sock.ev.on('messages.upsert', ...)` pada setiap event `ready`, bukan hanya sekali pada socket awal.
- Pastikan menerima `{ messages, type }`; filter `notify` hanya jika memang tidak ingin memproses history/append.
- Periksa kondisi yang mengabaikan `fromMe`, lalu log `message.key.remoteJid`, `message.key.id`, `message.message` (tanpa isi sensitif) dan jenis hasil `extractMessage()`.
- Pastikan callback async menangani rejection dengan `try/catch`; EventEmitter tidak me-retry handler.
- Ketika proses restart, pastikan `authDir` persisten, dapat ditulis, dan tidak dipakai instance lain.

## Pesan gagal dikirim

Validasi JID, status socket (`client.isConnected()`), kebijakan percakapan, dan content schema. Helper `sendText` mengembalikan `ok: false` serta error; `sendMedia` mengembalikan `{ result, error }`. Media fallback ke dokumen hanya dapat dilakukan jika konten berbasis `Buffer`. Transfer media besar dapat dipengaruhi IPv4/IPv6, proxy, ukuran, MIME type, dan limit WhatsApp.

Jangan retry tanpa idempotency: timeout dapat terjadi setelah server menerima pesan namun sebelum client menerima ACK. Simpan ID dari hasil, gunakan antrean, dan sediakan penanganan duplikasi.

## Identitas berganti atau perangkat tampil berbeda

Auto mode memprioritaskan identitas stabil yang tersimpan di `authDir/identity.json`. Event `identity-changed` menjelaskan rotasi karena penolakan server. Kode eksplisit atau environment variable memilih mode custom dan tidak auto-rotate. Hapus hanya `identity.json` jika ingin mengulang pemilihan identitas; logout/hapus seluruh authDir hanya bila ingin relink. Jangan mengganti identitas pada sesi aktif.

## Kumpulkan laporan yang bisa ditindaklanjuti

Lampirkan versi Node.js/paket, OS, mode pairing, status koneksi, nama event terakhir, statusCode, dan langkah reproduksi minimal. Redaksi nomor, JID, isi pesan, pairing code, token, dan jalur file sensitif. Jika dugaan bug pada paket, sertakan contoh yang aman dan buka issue melalui repository.

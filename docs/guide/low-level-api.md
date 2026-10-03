---
title: API tingkat rendah
description: Gunakan makeWASocket untuk mengelola sendiri autentikasi, event socket, reconnect, dan penutupan.
---

# API tingkat rendah

`makeWASocket()` adalah factory socket Baileys-compatible. Ia memberi kontrol atas auth state, event, query, send methods, dan close, tetapi tidak menjalankan controller reconnect/pemulihan sesi `createBibzWhats()`.

## Buat dan simpan auth state

```js
import makeWASocket, {
  Browsers,
  fetchLatestWaWebVersion,
  useMultiFileAuthState,
} from '@xbibzlibrary/whatsbibz';

const { state, saveCreds } = await useMultiFileAuthState('./data/low-level-session');
const { version } = await fetchLatestWaWebVersion();

const sock = makeWASocket({
  auth: state,
  version,
  browser: Browsers.macOS('Chrome'),
  syncFullHistory: false,
  markOnlineOnConnect: false,
});

sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) console.log('QR string tersedia untuk renderer operator.');
  if (connection === 'open') console.log('Socket tersambung.');
  if (connection === 'close') {
    console.error('Socket tertutup:', lastDisconnect?.error?.message);
    // Buat kebijakan retry sendiri; jangan retry membabi buta.
  }
});
```

`fetchLatestWaWebVersion()` mengembalikan `{ version, isLatest, error? }`; bila fetch gagal, gunakan versi fallback yang disediakan. Validasi respons sebelum memilihnya. `useMultiFileAuthState()` memudahkan demonstrasi dan pengembangan, tetapi implementasi filesystem-nya bukan penyimpanan database produksi dengan transaksi terdistribusi.

## Reconnect adalah tanggung jawab aplikasi

Socket tingkat rendah mengirim event `connection.update`, tetapi tidak membuat wrapper `ready`, back-off, auto-wipe, auto-rotate, pairing controller, atau shutdown guard. Aplikasi harus:

1. Simpan `creds.update` secara konsisten.
2. Tentukan klasifikasi penutupan berdasarkan `lastDisconnect.error` dan `DisconnectReason`.
3. Bedakan `515 restartRequired` dari logout/error sesi; batasi percobaan dan gunakan delay/back-off.
4. Buat socket baru dengan auth state yang benar dan pasang ulang seluruh listener.
5. Hindari dua socket bersamaan untuk folder auth yang sama.
6. Beri operator mekanisme untuk menghentikan loop dan menautkan ulang ketika perlu.

Bila tidak ingin mengimplementasikan kebijakan ini sendiri, gunakan [siklus hidup client](/guide/client-lifecycle) dengan `createBibzWhats()`.

## Pairing dan event

Di API tingkat rendah, QR tersedia pada `connection.update.qr`; Anda bertanggung jawab merendernya dengan aman. Pairing code tersedia melalui method socket `requestPairingCode(phone, code?)` setelah tahap koneksi yang sesuai. `createBibzWhats()` mengelola waktu permintaan, validasi/fallback kode, timeout, dan rate limit—jangan mengasumsikan socket rendah melakukannya.

API `sock.ev` mempertahankan nama event Baileys, termasuk `messages.upsert`, `creds.update`, `connection.update`, `groups.update`, dan event lain yang di deklarasikan. Tipe lengkap tersedia pada `WASocket`/`SocketConfig`. Socket juga menambahkan `sock.bibz` dan alias kompatibilitas `sock.ourin` yang menunjuk `BibzWhatsEngine`; helper-rich tersambung pada socket.

## Perbedaan wrapper dan socket

`createBibzWhats()` memakai `makeWASocket()` tetapi menyembunyikan detail auth dari pemanggil tingkat tinggi. Wrapper mengelola multi-file auth, pairing, versi, cache grup, timer reconnect, rotasi identitas auto, dan pemulihan sesi. Jangan campur dua lifecycle untuk socket/auth yang sama. Pilih satu model per akun.

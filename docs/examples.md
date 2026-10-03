---
title: Contoh implementasi
description: Pola ESM ringkas untuk echo bot, pairing, media, tombol, dan graceful shutdown.
---

# Contoh implementasi

Contoh berikut menggunakan `createBibzWhats()` dan mengasumsikan listener socket dipasang ulang pada setiap `ready`. Sesuaikan JID, izin, penyimpanan, rate limit, dan validasi untuk aplikasi Anda.

## Echo teks yang dibatasi

```js
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/echo-session',
});

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;
      const item = extractMessage(message);
      if (item?.type !== 'text') continue;
      if (item.text.trim().toLowerCase() === 'status') {
        await sendText(sock, message.key.remoteJid, 'Client tersedia.', { quoted: message });
      }
    }
  });
});

process.once('SIGINT', () => client.close());
process.once('SIGTERM', () => client.close());
```

Contoh ini menangani satu kata kunci allow-listed, bukan meneruskan setiap pesan. Untuk aplikasi nyata, tambah per-user authorization, logging yang disanitasi, idempotency store, dan antrean.

## Pairing melalui QR

```js
import { createBibzWhats } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  authDir: './data/qr-session',
  printQR: true, // memerlukan qrcode-terminal sebagai peer opsional
});

client.on('ready', (sock) => console.log('Socket siap:', Boolean(sock)));
client.on('pairing-code', () => console.log('Server menerbitkan pairing code.'));
client.on('give-up', (reason) => console.error('Perlu tindakan operator:', reason));
```

Untuk UI web, dengarkan `qr` dan tampilkan QR hanya kepada operator yang berwenang. `printQR` tidak diperlukan jika aplikasi sudah merender event tersebut.

## Kirim foto sebagai Buffer

```js
import { readFile } from 'node:fs/promises';
import { sendMedia } from '@xbibzlibrary/whatsbibz';

const photo = await readFile('./report.png');
const outcome = await sendMedia(sock, recipientJid, {
  image: photo,
  mimetype: 'image/png',
  caption: 'Laporan bulanan',
  fileName: 'report.png',
}, { fallbackToDocument: true });

if (!outcome.result) console.error('Pengiriman gagal:', outcome.error);
```

Validasi path, file size, dan mime type sebelum membaca berkas. Jangan mengambil path mentah dari pesan masuk.

## Balas tombol yang dikenal

```js
const item = extractMessage(message);
const replies = new Map([
  ['help', 'Berikut panduan yang dapat digunakan.'],
  ['status', 'Status layanan tersedia.'],
]);

if (item?.type === 'button' && replies.has(item.buttonId)) {
  await sendText(sock, message.key.remoteJid, replies.get(item.buttonId), { quoted: message });
}
```

Jangan menjalankan string tombol sebagai shell command, SQL, atau URL. Cek JID, izin dan status sesi sebelum tindakan sensitif.

## Uji API low-level

```js
import makeWASocket, { useMultiFileAuthState } from '@xbibzlibrary/whatsbibz';

const { state, saveCreds } = await useMultiFileAuthState('./data/manual-session');
const sock = makeWASocket({ auth: state });
sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', ({ connection }) => {
  if (connection === 'open') console.log('Terhubung');
});
```

Snippet ini sengaja minimal dan tidak melakukan reconnect/shutdown. Jangan jadikan contoh minimal ini sebagai lifecycle produksi; baca [API tingkat rendah](/guide/low-level-api).
## Worker satu proses dengan antrean dan shutdown tertib

Pola ini menunjukkan backpressure lokal, logging terstruktur, handler socket yang dipasang ulang, dan drain antrean sebelum shutdown. Pasang dependency aplikasi tersendiri:

```bash
npm install p-queue pino
```

```js
import PQueue from 'p-queue';
import pino from 'pino';
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const outbound = new PQueue({ concurrency: 1, intervalCap: 1, interval: 1200 });
const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/account-a-session',
});
let stopping = false;
let attachedSocket = null;

async function onMessages({ messages, type }) {
  if (type !== 'notify' || stopping) return;
  for (const message of messages) {
    if (stopping) break;
    const id = message.key.id;
    const jid = message.key.remoteJid;
    if (!id || !jid || message.key.fromMe || !message.message) continue;
    const item = extractMessage(message);
    if (item?.type !== 'text' || item.text.trim().toLowerCase() !== 'status') continue;

    try {
      await outbound.add(async () => {
        const active = client.sock;
        if (!active || !client.isConnected()) throw new Error('Socket tidak tersedia');
        const result = await sendText(active, jid, 'Layanan tersedia.', { quoted: message });
        if (!result.ok) throw result.error ?? new Error('sendText gagal');
      });
    } catch (error) {
      logger.error({ event: 'reply_failed', messageId: id, err: error }, 'Balasan tidak terkirim');
    }
  }
}

client.on('ready', (sock) => {
  if (attachedSocket) attachedSocket.ev.off('messages.upsert', onMessages);
  attachedSocket = sock;
  sock.ev.on('messages.upsert', onMessages);
});
client.on('reconnecting', (info) => logger.warn({ event: 'reconnecting', ...info }, 'Reconnect dijadwalkan'));

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'Menghentikan worker');
  outbound.pause();
  await outbound.onIdle();
  client.close();
}
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
```

::: warning Batas contoh
Antrean dan limit di atas berlaku untuk satu proses, bukan batas aman universal WhatsApp. Sesuaikan laju dengan kebijakan layanan. Untuk beberapa worker, gunakan antrean bersama; untuk pemrosesan exactly-once, simpan `message.key.id` dengan unique constraint di database. Tetapkan otorisasi per user dan redaksi log sebelum memakai pola ini pada bot nyata.
:::

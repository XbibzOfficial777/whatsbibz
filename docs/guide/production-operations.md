---
title: Operasional produksi
description: Pola deployment, readiness, logging, antrean, idempotensi, dan penyimpanan auth WhatsBibz.
---

# Operasional produksi

Panduan ini melengkapi [siklus hidup client](/guide/client-lifecycle), [keamanan sesi](/guide/session-security), dan [troubleshooting](/guide/troubleshooting). Gunakan `createBibzWhats()` sebagai satu-satunya pemilik socket dan state per akun.

::: warning Satu pemilik untuk satu sesi
Jangan jalankan dua proses dengan `authDir` yang sama. Satu proses/akun, direktori auth persisten dan privat, serta antrean terpisah per akun menghindari penulisan kredensial dan listener yang saling bertabrakan.
:::

## Baseline service

```sh
npm install @xbibzlibrary/whatsbibz pino p-queue
```

WhatsBibz is ESM and requires Node.js 20 or later. Add `"type": "module"` to the service `package.json`, or save the entrypoint with the `.mjs` extension.

```js
import { createServer } from 'node:http';
import pino from 'pino';
import PQueue from 'p-queue';
import { createBibzWhats, extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

const phone = process.env.WHATSAPP_PHONE;
const authDir = process.env.WHATSBIBZ_AUTH_DIR;
if (!authDir) throw new Error('WHATSBIBZ_AUTH_DIR belum diatur');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['auth', 'qr', 'pairingCode', 'token', 'phone', 'WHATSAPP_PHONE'],
});
const outbound = new PQueue({ concurrency: 1 });
const client = await createBibzWhats({ phone, authDir, logger });

client.on('reconnecting', ({ attempt, delay, pairingPending }) => {
  logger.warn({ attempt, delay, pairingPending }, 'Reconnect dijadwalkan');
});
client.on('session-wiped', (reason) => logger.error({ reason }, 'Auth state dihapus untuk recovery'));
client.on('give-up', (message) => logger.error({ message }, 'Client berhenti mencoba'));

client.on('ready', (sock) => {
  // `ready` dipanggil lagi setelah socket baru dibuat; bind ke socket aktif.
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) void handleMessage(sock, message);
  });
});

async function handleMessage(sock, message) {
  const jid = message.key.remoteJid;
  const messageId = message.key.id;
  if (!jid || !messageId || message.key.fromMe || !message.message) return;
  const incoming = extractMessage(message);
  if (incoming?.type !== 'text' || incoming.text.trim().toLowerCase() !== 'ping') return;

  try {
    const result = await outbound.add(() => sendText(sock, jid, 'pong', { quoted: message }));
    if (!result.ok) logger.warn({ error: result.error, messageId }, 'Reply tidak terkirim');
  } catch (err) {
    logger.error({ err, messageId }, 'Handler pesan gagal');
  }
}

const server = createServer((req, res) => {
  if (req.url !== '/readyz') { res.writeHead(404).end(); return; }
  const ready = client.isConnected();
  res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: ready ? 'ready' : 'not-ready' }));
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0');

let shutdownPromise;
function shutdown(signal) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    logger.info({ signal }, 'Shutdown dimulai');
    await new Promise((resolve) => server.close(resolve));
    client.close(); // hentikan socket/timer sebelum menguras antrean
    await outbound.onIdle(); // mempertahankan auth state untuk restart berikutnya
  })();
  return shutdownPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void shutdown(signal).catch((err) => { logger.error({ err }, 'Shutdown gagal'); process.exitCode = 1; }); });
}
```

Contoh sengaja tidak mencetak pairing code. Jika perlu provisioning otomatis, route event `pairing-code` ke kanal operator privat yang hanya dapat diakses personel berwenang; jangan kirim lewat log, dashboard publik, atau chat biasa.

## Readiness, reconnect, dan shutdown

- Jadikan `/readyz` sebagai **readiness probe**. Selama WhatsApp reconnect, keluarkan status `503` agar traffic aplikasi tidak menganggap client siap.
- Jangan gunakan disconnect singkat sebagai liveness failure yang langsung me-restart container. Biarkan strategi reconnect bawaan bekerja; alarm pada `give-up` atau kegagalan berkepanjangan.
- `ready` terjadi pada setiap socket baru. Pasang ulang handler socket-level di callback itu, dan pastikan handler aman bila pesan yang sama diproses ulang.
- `close()` menghentikan socket/timer dan mempertahankan auth state; `logout()` menghapus kredensial dan memerlukan relink.
- Antrean `PQueue` di contoh hanya membatasi satu proses dan bukan durable. Jika perlu throughput lebih besar, atur concurrency per akun dan gunakan broker/outbox yang tahan restart.

## Idempotensi dan data bisnis

Socket event delivery dan pengiriman balasan bukan transaksi database. Untuk mencegah command yang sama membuat side effect berulang, simpan kunci pesan secara unik:

```sql
CREATE TABLE processed_wa_messages (
  chat_jid TEXT NOT NULL,
  message_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_jid, message_id)
);

INSERT INTO processed_wa_messages (chat_jid, message_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING
RETURNING 1;
```

Gunakan `(remoteJid, message.key.id)` sebagai kunci inbound; bila insert tidak mengembalikan baris, abaikan duplikat. Untuk side effect kritikal, masukkan rekaman inbound dan job outbox dalam transaksi yang sama. Pengiriman WhatsApp tidak menjadi exactly-once hanya karena ada idempotency key—simpan status job, retry dengan kebijakan terbatas, dan pantau kegagalan.

## Container dan penyimpanan auth

::: code-group
```dockerfile [Dockerfile]
FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .
USER node
CMD ["node", "index.js"]
```

```yaml [compose.yaml]
services:
  whatsbot:
    build: .
    init: true
    restart: unless-stopped
    environment:
      NODE_ENV: production
      WHATSBIBZ_AUTH_DIR: /data/account-a
      WHATSAPP_PHONE: ${WHATSAPP_PHONE:?set WHATSAPP_PHONE}
    volumes:
      - whats-auth:/data
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true

volumes:
  whats-auth:
```
:::

Jangan commit `.env`, pairing code, atau `authDir`. Inject secret saat runtime, batasi hak baca volume, lindungi backup auth seperti kredensial aktif, dan gunakan volume terpisah untuk tiap akun. Jika container dipindah host, pastikan volume dipulihkan sebelum proses dimulai; jangan menyalin session aktif ke dua replica.

## Logging dan peringatan

Log status koneksi, `attempt`, jeda reconnect, kategori error, durasi handler, hasil send, serta `messageId` seperlunya. Jangan log QR, pairing code, file, isi pesan, auth JSON, token, atau object message lengkap. Tambahkan alert untuk `give-up`, `session-wiped`, kegagalan send berulang, disk penuh, dan durasi offline yang melewati SLO aplikasi.

Untuk arti status `515`, `401`, `408`, `428`, `429`, dan error lain beserta langkah pemulihannya, lihat [troubleshooting](/guide/troubleshooting). Untuk hak akses dan lifecycle kredensial, baca [keamanan sesi](/guide/session-security).

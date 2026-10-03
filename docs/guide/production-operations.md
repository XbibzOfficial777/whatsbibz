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
let draining = false;

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
  if (draining || !jid || !messageId || message.key.fromMe || !message.message) return;
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
  if (req.url === '/livez') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'live' }));
    return;
  }
  if (req.url !== '/readyz') { res.writeHead(404).end(); return; }
  const ready = !draining && client.isConnected();
  res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: ready ? 'ready' : 'not-ready' }));
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0');

let shutdownPromise;
function shutdown(signal) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    logger.info({ signal }, 'Shutdown dimulai');
    draining = true;
    await new Promise((resolve) => server.close(resolve));
    await outbound.onIdle(); // tunggu pengiriman aktif selesai selama socket masih terbuka
    client.close(); // hentikan socket/timer, auth state tetap tersimpan
  })();
  return shutdownPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void shutdown(signal).catch((err) => { logger.error({ err }, 'Shutdown gagal'); process.exitCode = 1; }); });
}
```

Contoh sengaja tidak mencetak pairing code. Jika perlu provisioning otomatis, route event `pairing-code` ke kanal operator privat yang hanya dapat diakses personel berwenang; jangan kirim lewat log, dashboard publik, atau chat biasa.

## Readiness, reconnect, dan shutdown

- Gunakan `/livez` untuk memastikan proses merespons; `/readyz` adalah **readiness probe** dan mengembalikan `503` saat reconnect atau drain. Jangan buat liveness bergantung pada WhatsApp.
- Jangan gunakan disconnect singkat sebagai liveness failure yang langsung me-restart container. Biarkan strategi reconnect bawaan bekerja; alarm pada `give-up` atau kegagalan berkepanjangan.
- `ready` terjadi pada setiap socket baru. Pasang ulang handler socket-level di callback itu, dan pastikan handler aman bila pesan yang sama diproses ulang.
- Saat shutdown, tandai instance tidak ready, hentikan intake, tunggu antrean outbound idle saat socket masih terbuka, lalu panggil `close()`. `close()` mempertahankan auth state; `logout()` menghapus kredensial dan memerlukan relink.
- Antrean `PQueue` di contoh hanya membatasi satu proses dan bukan durable. Jika perlu throughput lebih besar, atur concurrency per akun dan gunakan broker/outbox yang tahan restart.

## Idempotensi dan data bisnis

Socket event delivery dan pengiriman balasan bukan transaksi database. Untuk mencegah command yang sama membuat side effect berulang, simpan kunci pesan secara unik:

```sql
CREATE TABLE processed_wa_messages (
  account_id TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  message_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, chat_jid, message_id)
);

INSERT INTO processed_wa_messages (account_id, chat_jid, message_id)
VALUES ($1, $2, $3)
ON CONFLICT DO NOTHING
RETURNING 1;
```

Gunakan `(accountId, remoteJid, message.key.id)` sebagai kunci inbound; bila insert tidak mengembalikan baris, abaikan duplikat. Untuk side effect kritikal, masukkan rekaman inbound dan job outbox dalam transaksi yang sama. Pengiriman WhatsApp tidak menjadi exactly-once hanya karena ada idempotency key—simpan status job, retry dengan kebijakan terbatas, dan pantau kegagalan.

### Durable inbox/outbox untuk alur penting

Jika pesan memicu perubahan database dan balasan, simpan inbound key dan pekerjaan outbound di transaksi yang sama. Key wajib mencakup akun karena ID pesan dapat berulang pada akun WhatsApp berbeda. Simpan data minimum; bila isi pesan mentah perlu disimpan, tetapkan enkripsi, hak akses, dan masa retensi.

```sql
CREATE TABLE wa_inbox (
  account_id  text        NOT NULL,
  chat_jid    text        NOT NULL,
  message_id  text        NOT NULL,
  payload     jsonb       NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, chat_jid, message_id)
);

CREATE TABLE wa_outbox (
  id          bigserial   PRIMARY KEY,
  account_id  text        NOT NULL,
  event_key   text        NOT NULL,
  chat_jid    text        NOT NULL,
  payload     jsonb       NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts    integer     NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  sent_ids    jsonb,
  sent_at     timestamptz,
  last_error  text,
  UNIQUE (account_id, event_key)
);

CREATE INDEX wa_outbox_ready_idx
  ON wa_outbox (account_id, available_at, id)
  WHERE status IN ('pending', 'sending');
```

Contoh memakai PostgreSQL `pg`. `applyBusinessChange()` adalah fungsi aplikasi yang hanya menulis ke database yang sama; jangan panggil WhatsApp di dalam transaksi. `pg` harus menjadi dependency langsung aplikasi.

```js
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accountId = process.env.WHATSAPP_ACCOUNT_ID;

async function persistInboundAndEnqueueReply(message) {
  const chatJid = message.key.remoteJid;
  const messageId = message.key.id;
  if (message.key.fromMe || !message.message || !accountId || !chatJid || !messageId) return false;
  const incoming = extractMessage(message);
  if (incoming?.type !== 'text' || incoming.text.trim().toLowerCase() !== 'ping') return false;

  const db = await pool.connect();
  let transactionOpen = false;
  try {
    await db.query('BEGIN');
    transactionOpen = true;
    const inserted = await db.query(
      `INSERT INTO wa_inbox (account_id, chat_jid, message_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (account_id, chat_jid, message_id) DO NOTHING`,
      [accountId, chatJid, messageId, JSON.stringify({ type: 'text' })],
    );
    if (inserted.rowCount === 0) {
      await db.query('ROLLBACK');
      transactionOpen = false;
      return false;
    }

    await applyBusinessChange(db, { accountId, chatJid, messageId });
    await db.query(
      `INSERT INTO wa_outbox (account_id, event_key, chat_jid, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (account_id, event_key) DO NOTHING`,
      [accountId, `${chatJid}:${messageId}:reply`, chatJid, JSON.stringify({ text: 'pong' })],
    );
    await db.query('COMMIT');
    transactionOpen = false;
    return true;
  } catch (err) {
    if (transactionOpen) await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    db.release();
  }
}
```

Outbox worker sebaiknya claim job memakai lease/`FOR UPDATE SKIP LOCKED`, lalu mengirim di luar transaksi melalui `sendText(sock, job.chat_jid, job.payload.text)`. Periksa `{ ok, ids, error }`, simpan `ids` saat sukses, dan retry hanya kegagalan sementara dengan batas percobaan serta backoff. Jika proses berhenti setelah WhatsApp menerima pesan tetapi sebelum row ditandai `sent`, duplikat masih mungkin; key unik mencegah job ganda, bukan pengiriman exactly-once.

## Kepemilikan multi-akun dan antrean

| Unit kerja | Pola aman | Batas yang perlu dijaga |
| --- | --- | --- |
| Socket dan auth | Satu pemilik proses untuk setiap akun dan `authDir`. | Jangan mount satu auth folder aktif ke dua container/client. |
| Replica service | Sebarkan akun berbeda ke worker berbeda; satu akun tetap punya satu owner. | Failover baru dimulai setelah owner lama berhenti dan volume dipindahkan secara eksklusif. |
| Outbound | Satu queue per akun; worker mengirim hanya melalui socket owner akun itu. | `PQueue` bersifat lokal. Broker bersama perlu routing/partition berdasarkan `account_id` dan limiter lintas proses. |
| Idempotency | Gunakan `(account_id, chat_jid, message_id)` untuk inbound dan `event_key` untuk job. | `message_id`/chat yang sama dapat muncul pada akun lain; side effect eksternal tetap at-least-once. |

Skalakan lebih dulu dengan menambah akun independen, bukan membuat dua koneksi aktif untuk satu akun. Untuk failover, hentikan client lama, tunggu shutdown selesai, lalu attach/restore volume auth pada satu worker baru. Backup `authDir` sebagai secret terenkripsi dan jangan membuat snapshot saat dua client menulis ke sana.

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

## Recovery dan runbook deployment

- **Probe:** `/livez` hanya memeriksa proses; `/readyz` harus `503` saat disconnect, reconnect berkepanjangan, atau `draining`. Jangan otomatis me-relink akibat gangguan jaringan sesaat.
- **Deploy:** canary satu akun dahulu. Pada shutdown, tunggu queue idle dan pertahankan `authDir`; jangan gunakan `logout()` untuk restart biasa.
- **Pulihkan auth:** hentikan client lama, pulihkan backup terenkripsi pada satu volume, pastikan permission/disk sehat, lalu mulai satu owner. Pairing code hanya boleh dikirim melalui kanal operator privat.
- **Alert:** pantau `ready`, `reconnecting`, `session-wiped`, `give-up`, `identity-changed`, umur queue, kegagalan send, disk, dan lama offline. `session-wiped`/`give-up` perlu ditinjau operator, bukan diabaikan.
- **Batas kirim:** atur concurrency/pacing per akun dan gunakan limiter bersama bila banyak worker. Pantau kegagalan serta antrean tertua; jangan mengasumsikan `PQueue` memberi kuota global WhatsApp.

Untuk arti status `515`, `401`, `408`, `428`, `429`, dan error lain beserta langkah pemulihannya, lihat [troubleshooting](/guide/troubleshooting). Untuk hak akses dan lifecycle kredensial, baca [keamanan sesi](/guide/session-security).

---
title: TypeScript dan migrasi
description: Konfigurasi TypeScript ESM, tipe publik, alias API, dan migrasi dari pemakaian Baileys sebelumnya.
---

# TypeScript dan migrasi

WhatsBibz menerbitkan package ESM dengan declaration files. Node.js 20 atau lebih baru diperlukan. Untuk proyek TypeScript baru, gunakan `module` dan `moduleResolution` yang memahami ESM.

## Konfigurasi TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": false,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

Set `"type": "module"` pada `package.json` atau gunakan ekstensi `.mts`/`.mjs` sesuai toolchain Anda. CommonJS `require()` tidak didukung bởi export map (`import` only); CommonJS app perlu migrasi ESM atau dynamic `import()`.

## Import API dan tipe

```ts
import {
  createBibzWhats,
  extractMessage,
  sendText,
  type BibzWhatsClient,
  type BibzWhatsOptions,
  type ExtractedMessage,
  type WASocket,
} from '@xbibzlibrary/whatsbibz';

const options: BibzWhatsOptions = {
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/account-session',
};
const client: BibzWhatsClient = await createBibzWhats(options);

client.on('ready', (sock: WASocket) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      const result: ExtractedMessage | null = extractMessage(message);
      if (result?.type === 'text') {
        await sendText(sock, message.key.remoteJid, 'Pesan diterima.', { quoted: message });
      }
    }
  });
});
```

Socket event payload mengikuti tipe Baileys pada versi yang dipasang. Beberapa builder rich (`Button`, `ButtonV2`, `AIRich`, `Carousel`) memiliki deklarasi generik minimal dan method dinamis; jangan mengharapkan autocomplete seketat helper inti.

## Alias dan compat

- `createBibzWhats` adalah nama yang disarankan untuk client tingkat tinggi; `createWhatsBibz` diekspor sebagai alias.
- `makeWASocket` adalah default export dan tersedia sebagai named export; `makeBibzSocket` serta `makeWhatsBibzSocket` adalah alias.
- `WASocket` adalah type dari return value `makeWASocket`; `BibzSocket` alias untuk type tersebut.
- `BibzWhatsEngine` adalah kelas internal/helper socket yang diekspor. `sock.bibz` dan `sock.ourin` tersedia sebagai alias engine, tetapi aplikasi baru sebaiknya memilih method socket yang lebih stabil.
- Helper `sendText`, `sendMedia`, `extractMessage`, `LidMap`, dan utilitas identity/pairing diekspor dari entrypoint package.

Cek [daftar ekspor publik](/reference/exports) dan `lib/index.d.ts` untuk signature yang benar-benar diterbitkan pada versi tertentu. README/source `main` dapat berubah setelah rilis; gunakan declaration yang terpasang di `node_modules/@xbibzlibrary/whatsbibz` sebagai acuan build.

## Migrasi dari client manual atau versi sebelumnya

1. Upgrade Node.js ke versi yang didukung dan install `@xbibzlibrary/whatsbibz`.
2. Ganti import dari package Baileys lain ke entrypoint WhatsBibz; hindari mengimpor dua fork yang berbeda di satu proses.
3. Pilih `createBibzWhats()` bila ingin wrapper pairing/reconnect/session; pindahkan listener ke event `client.on('ready', sock => ...)` agar terpasang ulang saat reconnect.
4. Pertahankan `makeWASocket()` bila aplikasi Anda sudah memiliki auth store dan lifecycle kuat; Anda tetap bertanggung jawab atas simpan kredensial/reconnect.
5. Ganti helper teks ad-hoc dengan `sendText()` hanya setelah memeriksa default formatting. Gunakan `{ format: false }` bila harus mempertahankan isi secara persis.
6. Audit `authDir`, path sesi, version pin, logger, dan penggunaan `browser` sebelum deployment.
7. Jalankan tes dan verifikasi satu alur pesan dengan akun uji sebelum memindahkan nomor produksi.

Tidak ada kewajiban untuk memakai alias legacy atau engine. Hindari patch langsung ke `node_modules`; bila menemukan incompatibility, buat reproduksi minimal dan buka issue.

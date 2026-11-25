---
title: Panggilan suara eksperimental
description: Batas pengujian, prasyarat, dan contoh satu panggilan keluar dengan izin.
---

# Panggilan suara eksperimental

::: warning Belum terbukti terhubung
VoIP memakai protokol WhatsApp Web tidak resmi dan bisa berhenti pada **Connecting**. Satu uji langsung sebelum perubahan terakhir berdering, tetapi mengalami `ICE_FAILED` dan penerima tidak mendengar audio. Perubahan relay dan feeder setelahnya telah diuji **offline**, belum diverifikasi lewat panggilan nyata. Jangan menganggap `ready`, `ringing`, atau status `connected` sebagai bukti penerima mendengar suara.
:::

## Prasyarat

- Panggil hanya penerima yang menyetujui, dari akun yang Anda kendalikan. Gunakan hanya audio yang Anda berhak putar.
- Pasang `@roamhq/wrtc` yang sesuai platform, misalnya `npm install @roamhq/wrtc@0.10.0`. Diperlukan binary native yang kompatibel dengan Node dan OS.
- Pasang FFmpeg di `PATH`. Audio yang diberikan kepada `audioSource` harus berasal dari sumber **tepercaya**; jangan meneruskan teks chat atau URL sewenang-wenang ke FFmpeg.
- Jalankan dengan sumber daya memadai dan akses jaringan ke relay WhatsApp. Respons STUN publik saja tidak membuktikan relay tersebut dapat dicapai. WASM memakai dua kumpulan worker; default 20 per kumpulan dan bisa memakai banyak memori. `workerPoolSize` dapat diatur 4–20, tetapi nilai di bawah 20 masih eksperimental dan bisa menyebabkan deadlock.
- Hubungkan `VoipClient` ke socket yang sudah login dan `open`. Satu bridge per socket, satu panggilan keluar sekaligus. Jangan memakai dua proses untuk direktori sesi yang sama.

## Contoh panggilan yang dipicu secara eksplisit

Fungsi ini **tidak** dijalankan otomatis pada setiap reconnect. Panggil hanya setelah aplikasi menerima `ready`, mendapatkan persetujuan penerima, dan memverifikasi hak atas berkas audio.

```js
import { VoipClient } from '@xbibzlibrary/whatsbibz';

export async function callOnce(sock, phone, trustedAudioFile) {
  const voip = new VoipClient({
    onDiagnostic: ({ component, code }) => console.log('VoIP:', component, code),
  });
  try {
    await voip.connectWithSocket(sock);
    const call = await voip.call(phone, {
      audioSource: trustedAudioFile,
      connectTimeoutMs: 45_000,
      durationMs: 180_000, // dihitung sejak dial, termasuk waktu menunggu jawaban
      endOnAudioEnd: true,
    });
    call.on('ringing', () => console.log('Berdering'));
    call.on('connected', () => console.log('Status WASM aktif; audio belum terverifikasi'));
    const reason = await call.waitForEnd();
    return { reason, stats: voip.getStats() };
  } finally {
    voip.disconnect(); // tidak logout atau menghapus sesi WhatsApp
  }
}
```

Feeder mengirim diam sampai state WASM `Active`, lalu memulai sumber audio. Jika tidak pernah aktif, `connectTimeoutMs` mengakhiri panggilan; `durationMs` membatasi total waktu sejak dial. Nilai `0` menonaktifkan timer terkait. `endOnAudioEnd: true` menutup setelah audio selesai; default-nya `false` dan feeder melanjutkan diam. Penerima tetap perlu mengonfirmasi audio terdengar.

## Diagnostik dan sesi

- `voip.getStats().connected` berarti bridge menempel pada socket, **bukan** panggilan atau media terhubung. Hitungan paket relay juga tidak memastikan audio diputar di perangkat penerima.
- `ICE_FAILED` menandakan ICE relay gagal; `CONNECTION_TIMEOUT` berarti panggilan tidak mencapai state aktif sebelum batas waktu (misalnya tidak dijawab), bukan diagnosis penyebabnya. Implementasi mencoba port web dan kemudian port yang diumumkan untuk IP relay yang sama, tetapi tidak menjamin koneksi. Jangan spam percobaan; periksa izin, akses jaringan, versi aplikasi, dan lingkungan.
- `READY_TIMEOUT_ASSUMED` berarti callback siap WASM tidak terlihat dalam 15 detik dan kompatibilitas lama melanjutkan berdasarkan asumsi; itu **bukan** bukti stack siap atau panggilan berhasil.
- Hindari dump paket/SDP dan jangan bagikan nomor, token, kode pairing, atau file sesi. `CALL_DUMP_RELAY_PACKETS_PATH` membuat dump sensitif dan sebaiknya tidak diaktifkan pada produksi.
- Gunakan `preserveSession: true` dan `await client.close()` saat shutdown. Penulisan tiap berkas auth memakai rename satu direktori, tetapi bukan transaksi multi-berkas atau jaminan tahan mati listrik. Kesalahan simpan dilaporkan logger; server masih dapat menolak sesi. Cadangkan sesi secara privat.

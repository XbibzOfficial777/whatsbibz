# Security Policy

*Bahasa Indonesia di bawah / Indonesian version below.*

## Supported versions

| Version | Supported |
|---|---|
| 2.1.x (latest release) | Yes |
| < 2.1.0 | No — upgrade to the latest release |

Only the latest release receives security fixes. The [November 11, 2026 Node.js security release](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) fixes vulnerabilities on the supported lines. For production, use at least **22.23.5 on 22.x, 24.22.3 on 24.x, or 26.13.1 on 26.x**, and keep following later security releases. Node 20 is end-of-life. The October JavaScript helpers (`safeFetch`, `assertSafeUrl`, `withSafeFetchHeaders`) provide only partial defense in the code paths that call them; they do not replace patched Node.js, prevent all Brotli-related failures, or fix the November vulnerabilities.

**Untrusted media and preview URLs can cause SSRF.** When a `directPath` is present this checkout uses a constrained WhatsApp/Meta host selection unless the application explicitly overrides it. The legacy URL-only path remains compatible with arbitrary URLs; redirects and DNS/egress are not constrained by this selection. `safeFetch` checks the final response URL only *after* automatic redirects have been contacted. The optional `link-preview-js` peer now requires 4.0.4 or later within 4.x due to known advisories; `getUrlInfo` uses manual same-host redirects but does not itself pin or filter DNS by default, and preview images use another fetch path. Validate media metadata and URLs before access and enforce outbound network restrictions (including DNS/private-address controls), deadlines and size limits at the application/network layer. Do not treat any helper as a complete SSRF boundary.

**Media integrity:** the inherited `downloadEncryptedContent` decrypts and streams data but does not verify the trailing media MAC or message hashes. Streaming plaintext may be delivered before application validation. Do not treat downloaded media as authenticated on that basis; verify an independently trusted digest before processing or use a separately authenticated media implementation.

**Signal session logging:** `libsignal@6.0.0` can pass full session objects, including private ratchet and root keys, to `console.info`/`console.warn`. Version 2.0.0 installs a Node `util.inspect.custom` redaction on the `SessionEntry` prototype before use, without changing the process-wide console. It covers those ordinary Node console/inspection paths only; `console.dir`, JSON serialization, explicit `customInspect: false`, raw buffers, other logger paths, and other dependency instances can bypass it. Restrict or delete older logs and rotate affected linked sessions if key material may have been exposed. This change cannot remove secrets already recorded.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately by one of these channels:

- GitHub: **Security → Report a vulnerability** on this repository (private advisory).
- Email: **revandoppratama@gmail.com** with the subject `[whatsbibz security]`.

Include:

- A description of the issue and its impact.
- Steps or a script to reproduce it.
- The package version (`npm ls @xbibzlibrary/whatsbibz`) and Node.js version.
- Whether the issue requires a paired session, network position, or a malicious remote peer.

You will get an acknowledgement within **3 business days** and a status update at least every **7 days** until the issue is resolved. When a fix is released you will be credited in the changelog unless you prefer otherwise.

## What counts as a vulnerability here

- Anything that lets a **remote WhatsApp peer** (a contact, a group member, a newsletter) execute code, crash the process, corrupt local state or read data it should not — for example through a crafted `protocolMessage`, media metadata or app-state patch.
- Leakage of session material (`creds.json`, signal keys, `identity.json`) through logs, error messages or file permissions.
- Weaknesses in the pairing or Noise handshake handling that were introduced by this fork.
- Dependency vulnerabilities that are reachable from this package's code paths.

Out of scope: WhatsApp server behaviour, account bans, rate limits, and issues in the upstream Baileys project that are not reachable through WhatsBibz (please report those upstream).

## Handling secrets safely

- Session folders contain long-lived credentials. Keep them outside the repository, with restrictive permissions, and never share them.
- Rotate your credentials (`client.logout()` and re-pair) if a session folder may have leaked.
- Do not paste `creds.json`, pairing codes for real numbers, or tokens into issues.

---

# Kebijakan Keamanan

## Versi yang didukung

| Versi | Didukung |
|---|---|
| 2.1.x (rilis terbaru) | Ya |
| < 2.1.0 | Tidak — perbarui ke rilis terbaru |

Hanya rilis terbaru yang menerima perbaikan keamanan. [Rilis keamanan Node.js 11 November 2026](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) memperbaiki kerentanan pada lini yang didukung. Untuk produksi, gunakan minimal **22.23.5 pada 22.x, 24.22.3 pada 24.x, atau 26.13.1 pada 26.x**, lalu ikuti rilis keamanan berikutnya. Node 20 sudah EOL. Helper JavaScript Oktober (`safeFetch`, `assertSafeUrl`, `withSafeFetchHeaders`) hanya memberi pertahanan parsial pada jalur yang memakainya; bukan pengganti Node yang dipatch, bukan jaminan mencegah semua masalah Brotli, dan tidak memperbaiki kerentanan November.

**URL media dan preview tak tepercaya dapat menimbulkan SSRF.** Dengan `directPath`, checkout ini membatasi pemilihan host WhatsApp/Meta kecuali aplikasi secara eksplisit override. Jalur legacy yang hanya memiliki URL masih menerima URL arbitrary; redirect dan DNS/egress tidak dibatasi oleh pemilihan host tersebut. `safeFetch` memeriksa URL respons akhir hanya *setelah* redirect otomatis diakses. Peer opsional `link-preview-js` kini memerlukan 4.0.4 atau lebih baru dalam 4.x karena advisory; `getUrlInfo` memakai redirect manual ke host yang sama, tetapi tidak melakukan pin/filter DNS secara default dan gambar preview memakai jalur unduhan lain. Validasi metadata dan URL sebelum akses, dan terapkan pembatasan jaringan keluar (termasuk DNS/alamat privat), timeout, serta batas ukuran pada aplikasi/jaringan. Jangan menganggap helper sebagai perlindungan SSRF menyeluruh.

**Integritas media:** `downloadEncryptedContent` bawaan mendekripsi dan melakukan streaming, tetapi belum memverifikasi MAC media di akhir maupun hash pesan. Plaintext stream dapat diterima sebelum validasi oleh aplikasi. Jangan menganggap hasil unduhan terautentikasi hanya berdasarkan helper ini; verifikasi digest yang tepercaya sebelum memproses atau gunakan implementasi media terautentikasi terpisah.

**Log sesi Signal:** `libsignal@6.0.0` dapat memberikan objek sesi lengkap, termasuk kunci ratchet privat dan root, ke `console.info`/`console.warn`. Versi 2.0.0 memasang redaksi Node `util.inspect.custom` pada prototipe `SessionEntry` sebelum digunakan, tanpa mengganti console global proses. Redaksi hanya mencakup jalur console/inspeksi Node biasa; `console.dir`, serialisasi JSON, `customInspect: false`, buffer mentah, logger lain, atau instance dependensi lain dapat melewatinya. Batasi akses atau hapus log lama dan rotasi perangkat tertaut yang terdampak jika materi kunci mungkin terekspos. Perubahan ini tidak menghapus rahasia yang sudah tercatat.

## Melaporkan kerentanan

**Jangan membuka issue publik untuk masalah keamanan.**

Laporkan secara pribadi lewat salah satu jalur berikut:

- GitHub: **Security → Report a vulnerability** di repositori ini (advisory privat).
- Email: **revandoppratama@gmail.com** dengan subjek `[whatsbibz security]`.

Sertakan:

- Deskripsi masalah dan dampaknya.
- Langkah atau skrip untuk mereproduksinya.
- Versi paket (`npm ls @xbibzlibrary/whatsbibz`) dan versi Node.js.
- Apakah masalah memerlukan sesi yang sudah tertaut, posisi jaringan tertentu, atau lawan bicara jarak jauh yang berniat jahat.

Kamu akan menerima konfirmasi dalam **3 hari kerja** dan pembaruan status setidaknya setiap **7 hari** sampai masalah selesai. Saat perbaikan dirilis, namamu dicantumkan di changelog kecuali kamu meminta sebaliknya.

## Yang dianggap kerentanan di sini

- Apa pun yang memungkinkan **peer WhatsApp jarak jauh** (kontak, anggota grup, newsletter) mengeksekusi kode, membuat proses crash, merusak state lokal, atau membaca data yang seharusnya tidak bisa — misalnya lewat `protocolMessage`, metadata media, atau patch app-state yang direkayasa.
- Kebocoran materi sesi (`creds.json`, kunci signal, `identity.json`) lewat log, pesan error, atau izin berkas.
- Kelemahan dalam penanganan pairing atau handshake Noise yang diperkenalkan oleh fork ini.
- Kerentanan dependensi yang dapat dijangkau dari jalur kode paket ini.

Di luar cakupan: perilaku server WhatsApp, pemblokiran akun, batas laju, dan masalah di proyek upstream Baileys yang tidak dapat dijangkau lewat WhatsBibz (silakan laporkan ke upstream).

## Menjaga rahasia dengan aman

- Folder sesi berisi kredensial berumur panjang. Simpan di luar repositori, dengan izin terbatas, dan jangan pernah dibagikan.
- Rotasi kredensialmu (`client.logout()` lalu pairing ulang) bila folder sesi mungkin bocor.
- Jangan menempelkan `creds.json`, pairing code untuk nomor sungguhan, atau token ke dalam issue.

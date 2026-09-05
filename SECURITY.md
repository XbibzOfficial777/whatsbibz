# Security Policy

*Bahasa Indonesia di bawah / Indonesian version below.*

## Supported versions

| Version | Supported |
|---|---|
| 1.3.x | Yes |
| < 1.3 | No — please upgrade |

Only the latest minor release receives security fixes.

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
| 1.3.x | Ya |
| < 1.3 | Tidak — silakan perbarui |

Hanya rilis minor terbaru yang menerima perbaikan keamanan.

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

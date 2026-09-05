# Support

*Bahasa Indonesia di bawah.*

## Where to ask

| I want to… | Go to |
|---|---|
| Ask how to do something, or check whether behaviour is expected | [GitHub Discussions → Q&A](https://github.com/XbibzOfficial777/whatsbibz/discussions/categories/q-a) |
| Report something that is broken | [Bug report](https://github.com/XbibzOfficial777/whatsbibz/issues/new?template=bug_report.yml) |
| Report that WhatsApp's servers changed behaviour | [Protocol change](https://github.com/XbibzOfficial777/whatsbibz/issues/new?template=protocol_change.yml) |
| Suggest a feature | [Feature request](https://github.com/XbibzOfficial777/whatsbibz/issues/new?template=feature_request.yml) |
| Report a security problem | [SECURITY.md](SECURITY.md) — **not** a public issue |

## Before asking

1. Read the [Troubleshooting](README.md#troubleshooting) table — most `428` / `400` / `401` / `408` questions are answered there.
2. Update to the latest version: `npm install @xbibzlibrary/whatsbibz@latest`. WhatsApp changes its servers often; old versions stop working.
3. Try with `identity: 'auto'` (remove any `browser` / `identity` option) to rule out an identity problem.
4. Collect the `close` status code, the `reconnecting` / `identity-changed` events and your Node.js version.

## What we cannot help with

- Getting a banned number unbanned, or avoiding bans while sending bulk or unsolicited messages.
- WhatsApp Business API (the official cloud API) — this library implements the WhatsApp Web protocol.
- Debugging closed-source bots without a minimal reproduction.

---

# Dukungan

## Ke mana bertanya

| Saya ingin… | Tujuan |
|---|---|
| Bertanya cara melakukan sesuatu, atau memastikan suatu perilaku memang wajar | [GitHub Discussions → Q&A](https://github.com/XbibzOfficial777/whatsbibz/discussions/categories/q-a) |
| Melaporkan sesuatu yang rusak | [Laporan bug](https://github.com/XbibzOfficial777/whatsbibz/issues/new?template=bug_report.yml) |
| Melaporkan perubahan perilaku server WhatsApp | [Perubahan protokol](https://github.com/XbibzOfficial777/whatsbibz/issues/new?template=protocol_change.yml) |
| Mengusulkan fitur | [Usulan fitur](https://github.com/XbibzOfficial777/whatsbibz/issues/new?template=feature_request.yml) |
| Melaporkan masalah keamanan | [SECURITY.md](SECURITY.md) — **bukan** issue publik |

## Sebelum bertanya

1. Baca tabel [Pemecahan masalah](README.id.md#pemecahan-masalah) — sebagian besar pertanyaan `428` / `400` / `401` / `408` terjawab di sana.
2. Perbarui ke versi terbaru: `npm install @xbibzlibrary/whatsbibz@latest`. WhatsApp sering mengubah servernya; versi lama berhenti bekerja.
3. Coba dengan `identity: 'auto'` (hapus opsi `browser` / `identity`) untuk menyingkirkan masalah identitas.
4. Kumpulkan kode status `close`, event `reconnecting` / `identity-changed`, dan versi Node.js kamu.

## Yang tidak bisa kami bantu

- Membuka blokir nomor yang dibanned, atau menghindari banned saat mengirim pesan massal / tidak diminta.
- WhatsApp Business API (API cloud resmi) — library ini mengimplementasikan protokol WhatsApp Web.
- Men-debug bot tertutup tanpa reproduksi minimal.

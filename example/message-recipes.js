// Runnable, opt-in message examples for one authorized private chat.
// From the repository: WHATSAPP_PHONE=628... WHATSBIBZ_ALLOWED_JID=628...@s.whatsapp.net node example/message-recipes.js
// In another project, change '../lib/index.js' to '@xbibzlibrary/whatsbibz'.
// Place your own files in ./example-media; see the message-recipes documentation.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import {
  Button, Carousel, createBibzWhats, downloadVideoForSoundSticker, extractMessage, jidNormalizedUser, messageTimestampMs, sendVideoAsSoundSticker,
} from '../lib/index.js';

const replies = new Map([
  ['menu_status', 'Bot contoh aktif.'],
  ['menu_help', 'Kirim !help untuk melihat daftar perintah.'],
  ['city_jakarta', 'Anda memilih Jakarta.'],
  ['city_surabaya', 'Anda memilih Surabaya.'],
  ['image_detail', 'Anda memilih detail gambar.'],
  ['slide_one', 'Anda memilih slide pertama.'],
  ['slide_two', 'Anda memilih slide kedua.'],
]);

const help = [
  'Contoh WhatsBibz — kirim salah satu perintah:',
  '!menu, !list, !link, !location, !image, !image-button, !slide,',
  '!poll, !contact, !sticker, !document, !audio, !video, !reaction, !rich',
  'Balas video MP4 bersuara dengan !soundsticker (alias .sa) untuk stiker audio eksperimental.',
  'Media contoh lain berasal dari folder operator; !contact memerlukan CONTACT_PHONE.',
].join('\n');

const defaultSoundStickerState = { busy: false };
const stickerErrors = {
  VIDEO_NOT_FOUND: 'Balas video MP4 bersuara dengan !soundsticker, atau kirim video dengan caption !soundsticker.',
  VIEW_ONCE_REJECTED: 'Video sekali lihat tidak didukung. Kirim video biasa dengan izin pemiliknya.',
  UNSUPPORTED_VIDEO: 'Gunakan video MP4/MOV biasa.',
  VIDEO_TOO_LARGE: 'Video terlalu besar. Batas contoh ini 20 MiB.',
  VIDEO_METADATA_MISSING: 'Metadata video tidak lengkap. Minta pengirim mengirim ulang videonya.',
  MEDIA_INTEGRITY_FAILED: 'Video gagal pemeriksaan integritas; minta pengirim mengirim ulang.',
  VIDEO_DOWNLOAD_FAILED: 'Video gagal diunduh. Minta pengirim mengirim ulang videonya.',
  NO_AUDIO: 'Video tidak memiliki trek audio. Gunakan video yang bersuara.',
  SILENT_AUDIO: 'Lima detik yang dipilih hening. Potong video ke bagian yang bersuara lalu coba lagi.',
  INVALID_VIDEO: 'Video tidak dapat diproses atau terlalu pendek untuk stiker animasi.',
  INVALID_AUDIO: 'Audio video tidak dapat diproses.',
  STICKER_TOO_LARGE: 'Stiker terlalu besar setelah dikompresi. Coba video yang lebih sederhana.',
  FFMPEG_NOT_FOUND: 'FFmpeg/FFprobe tidak ditemukan. Minta operator memasang keduanya.',
  FFMPEG_FAILED: 'Konversi gagal. Periksa format video dan dukungan libwebp serta libopus pada FFmpeg.',
  FFMPEG_TIMEOUT: 'Konversi terlalu lama dan dihentikan. Coba video yang lebih kecil.',
};

/** Handle one message without creating a connection. Dependencies can be replaced in offline tests. */
export async function handleRecipeMessage(sock, message, {
  allowedJid,
  mediaDir = 'example-media',
  loadFile = readFile,
  contactPhone = '',
  soundStickerState = defaultSoundStickerState,
  allowOwnCommands = false,
} = {}) {
  const jid = message?.key?.remoteJid;
  if (!allowedJid || jid !== allowedJid || (message?.key?.fromMe && !allowOwnCommands) || !message?.message) return false;
  const item = extractMessage(message);
  if (!item) return false;

  if (item.type === 'button') {
    const text = replies.get(item.buttonId);
    if (!text) return false; // IDs from the network are untrusted input.
    await sock.sendMessage(jid, { text }, { quoted: message });
    return true;
  }
  const command = (item.text || '').trim().toLowerCase();
  const soundStickerCommand = ['!soundsticker', '!sticker-audio', '.sa'].includes(command);
  if (item.type !== 'text' && !(item.type === 'video' && soundStickerCommand)) return false;
  const media = (name) => loadFile(path.join(mediaDir, name));

  switch (command) {
    case '!soundsticker':
    case '!sticker-audio':
    case '.sa': {
      if (soundStickerState.busy) {
        await sock.sendMessage(jid, { text: 'Bot masih memproses stiker sebelumnya. Coba lagi setelah selesai.' }, { quoted: message });
        break;
      }
      soundStickerState.busy = true;
      try {
        const video = await downloadVideoForSoundSticker(message, { mediaHost: sock.getMediaHost?.() });
        await sendVideoAsSoundSticker(sock, jid, video, { quoted: message });
      } catch (error) {
        // Never expose media URLs, keys, FFmpeg stderr, or private temporary paths to the chat.
        console.error('Stiker audio gagal:', typeof error?.code === 'string' ? error.code : 'unexpected error');
        const text = stickerErrors[error?.code] || 'Stiker audio gagal dikirim. Periksa log operator tanpa membagikan sesi atau media.';
        await sock.sendMessage(jid, { text }, { quoted: message });
      } finally {
        soundStickerState.busy = false;
      }
      break;
    }
    case '!help':
      await sock.sendMessage(jid, { text: help }, { quoted: message });
      break;
    case '!menu':
      await new Button(sock)
        .setBody('Pilih menu bot contoh.')
        .setFooter('WhatsBibz')
        .addReply('Status', 'menu_status')
        .addReply('Bantuan', 'menu_help')
        .send(jid);
      break;
    case '!list':
      await new Button(sock)
        .setBody('Pilih kota contoh.')
        .addSelection('Buka daftar')
        .makeSection('Pulau Jawa')
        .makeRow('', 'Jakarta', 'DKI Jakarta', 'city_jakarta')
        .makeRow('', 'Surabaya', 'Jawa Timur', 'city_surabaya')
        .send(jid);
      break;
    case '!link':
      await new Button(sock)
        .setBody('Tautan dan kode contoh.')
        .addUrl('Repositori', 'https://github.com/XbibzOfficial777/whatsbibz')
        .addCopy('Salin kode', 'WHATS-BIBZ')
        .send(jid);
      break;
    case '!location':
      await sock.sendMessage(jid, {
        location: {
          degreesLatitude: -6.175392,
          degreesLongitude: 106.827153,
          name: 'Monumen Nasional',
          address: 'Jakarta, Indonesia',
        },
      });
      break;
    case '!image':
      await sock.sendMessage(jid, {
        image: await media('gambar-1.jpg'), mimetype: 'image/jpeg', caption: 'Gambar contoh.',
      }, { quoted: message });
      break;
    case '!image-button':
      await new Button(sock)
        .setBody('Gambar dengan tombol balas.')
        .setImage(await media('gambar-1.jpg'), { mimetype: 'image/jpeg' })
        .addReply('Lihat detail', 'image_detail')
        .send(jid);
      break;
    case '!slide': {
      const [first, second] = await Promise.all([media('gambar-1.jpg'), media('gambar-2.jpg')]);
      await new Carousel(sock)
        .setBody('Geser untuk melihat dua kartu contoh.')
        .setFooter('WhatsBibz')
        .card((card) => card.image(first).title('Slide 1').text('Gambar pertama').button('Pilih 1', 'slide_one'))
        .card((card) => card.image(second).title('Slide 2').text('Gambar kedua').button('Pilih 2', 'slide_two'))
        .send(jid);
      break;
    }
    case '!poll':
      await sock.sendMessage(jid, { poll: { name: 'Pilih minuman', values: ['Kopi', 'Teh'], selectableCount: 1 } });
      break;
    case '!contact': {
      if (!/^\d{8,15}$/.test(contactPhone)) {
        await sock.sendMessage(jid, { text: 'Operator perlu mengatur CONTACT_PHONE ke nomor kontak yang menyetujui.' });
        break;
      }
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:Kontak contoh\nTEL;type=CELL;type=VOICE;waid=${contactPhone}:+${contactPhone}\nEND:VCARD`;
      await sock.sendMessage(jid, { contacts: { displayName: 'Kontak contoh', contacts: [{ displayName: 'Kontak contoh', vcard }] } });
      break;
    }
    case '!sticker':
      await sock.sendMessage(jid, { sticker: await media('stiker.webp'), mimetype: 'image/webp' });
      break;
    case '!document':
      await sock.sendMessage(jid, {
        document: await media('contoh.pdf'), mimetype: 'application/pdf', fileName: 'contoh.pdf', caption: 'Dokumen contoh.',
      });
      break;
    case '!audio':
      await sock.sendMessage(jid, { audio: await media('suara.ogg'), mimetype: 'audio/ogg; codecs=opus', ptt: true });
      break;
    case '!video':
      await sock.sendMessage(jid, { video: await media('video.mp4'), mimetype: 'video/mp4', caption: 'Video contoh.' });
      break;
    case '!reaction':
      await sock.sendMessage(jid, { react: { text: '✅', key: message.key } });
      break;
    case '!rich':
      await sock.sendTable(jid, 'Tabel bot contoh', ['Item', 'Harga'], [['Kopi', '18.000'], ['Teh', '12.000']], undefined, {
        headerText: 'Dibuat oleh bot contoh, bukan Meta AI.',
      });
      break;
    default:
      return false;
  }
  return true;
}

/** Resolve an explicit allow-list without treating arbitrary PN/LID addresses as interchangeable. */
export function recipeChatJids(sock, allowedJid, allowOwnCommands = false) {
  const configured = jidNormalizedUser(allowedJid || '');
  if (!/^\d+@(s\.whatsapp\.net|lid)$/.test(configured)) {
    throw new Error('An authorized private-chat PN or LID JID is required.');
  }
  if (!allowOwnCommands) return new Set([configured]);

  const ownPn = jidNormalizedUser(sock?.user?.id || sock?.authState?.creds?.me?.id || '');
  const ownLid = jidNormalizedUser(sock?.authState?.creds?.me?.lid || sock?.user?.lid || '');
  if (!ownPn || (configured !== ownPn && (!ownLid || configured !== ownLid))) {
    throw new Error('Own commands may only be enabled for the authenticated account’s own chat.');
  }
  // Only the authenticated socket's own PN/LID pair is trusted. No guessed
  // conversion or arbitrary sender-controlled mapping is used for other chats.
  return new Set([ownPn, ownLid].filter(Boolean));
}

/** Build the live event handler separately so its filters and replay guard can be tested offline. */
export function createRecipeUpsertHandler(sock, {
  allowedJid,
  allowOwnCommands = false,
  readyAt = Date.now(),
  seen = new Set(),
  handle = handleRecipeMessage,
  ...handlerOptions
} = {}) {
  const authorized = recipeChatJids(sock, allowedJid, allowOwnCommands);
  return async ({ messages = [], type } = {}) => {
    if (type !== 'notify' && !(allowOwnCommands && type === 'append')) return;
    for (const message of messages) {
      const rawJid = message?.key?.remoteJid;
      const fromMe = Boolean(message?.key?.fromMe);
      if (!rawJid || !authorized.has(jidNormalizedUser(rawJid))) continue;
      if (fromMe && !allowOwnCommands) continue;
      if (type === 'append' && !fromMe) continue;
      if (fromMe) {
        // History can arrive as notify *or* append after reconnect. Ignore old
        // self-commands rather than replaying them. Seconds-resolution clocks
        // get a two-second allowance; persistent dedup is needed in production.
        const timestamp = messageTimestampMs(message);
        if (!timestamp || timestamp < readyAt - 2000 || timestamp > Date.now() + 120000) continue;
      }
      const id = message?.key?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (seen.size > 1000) seen.delete(seen.values().next().value);
      await handle(sock, message, { ...handlerOptions, allowedJid: rawJid, allowOwnCommands });
    }
  };
}

async function main() {
  process.umask(0o077); // New files are private; separately protect any existing auth files.
  const phone = process.env.WHATSAPP_PHONE || '';
  const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID || '';
  const allowOwnCommands = process.env.WHATSBIBZ_ALLOW_SELF_COMMANDS === '1';
  if (!/^\d{8,15}$/.test(phone)) throw new Error('Set WHATSAPP_PHONE to the bot number with country code.');
  if (!/^\d+@(s\.whatsapp\.net|lid)$/.test(allowedJid)) {
    throw new Error('Set WHATSBIBZ_ALLOWED_JID to one authorized private-chat PN or LID JID.');
  }

  const client = await createBibzWhats({
    phone,
    authDir: process.env.WHATSBIBZ_AUTH_DIR || 'example-session',
    preserveSession: true,
    // By default this attempts to follow 120363333911663927@newsletter on authenticated open.
    // To opt out, uncomment: socketConfig: { autoFollowChannel: false },
  });
  client.on('pairing-code', (code) => console.log('Masukkan kode di WhatsApp perangkat tertaut:', code));
  client.on('give-up', () => { console.error('Koneksi dihentikan; periksa sesi secara privat.'); client.close(); process.exitCode = 1; });

  let attachedSocket;
  let attachedListener;
  const seen = new Set(); // In-memory deduplication only; use persistent storage in production.
  client.on('ready', (sock) => {
    let handleUpsert;
    try {
      handleUpsert = createRecipeUpsertHandler(sock, {
        allowedJid,
        allowOwnCommands,
        seen,
        mediaDir: process.env.WHATSBIBZ_MEDIA_DIR || 'example-media',
        contactPhone: process.env.CONTACT_PHONE || '',
      });
    } catch {
      console.error('WHATSBIBZ_ALLOW_SELF_COMMANDS=1 hanya boleh digunakan untuk JID chat sendiri.');
      client.close();
      process.exitCode = 1;
      return;
    }
    if (attachedSocket && attachedListener) attachedSocket.ev.off('messages.upsert', attachedListener);
    attachedSocket = sock;
    attachedListener = (event) => {
      void handleUpsert(event).catch(() => console.error('Contoh pesan gagal; periksa konfigurasi secara privat.'));
    };
    sock.ev.on('messages.upsert', attachedListener);
    console.log('Socket siap. Kirim !help dari akun uji yang diizinkan.');
  });

  const shutdown = () => client.close(); // Do not logout or delete credentials on normal shutdown.
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error?.message || 'Gagal memulai bot contoh'); process.exitCode = 1; });
}

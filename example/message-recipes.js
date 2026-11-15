// Runnable, opt-in message examples for one authorized private chat.
// From the repository: WHATSAPP_PHONE=628... WHATSBIBZ_ALLOWED_JID=628...@s.whatsapp.net node example/message-recipes.js
// In another project, change '../lib/index.js' to '@xbibzlibrary/whatsbibz'.
// Place your own files in ./example-media; see the message-recipes documentation.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { Button, Carousel, createBibzWhats, extractMessage } from '../lib/index.js';

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
  'Media diambil dari folder contoh milik operator; !contact memerlukan CONTACT_PHONE.',
].join('\n');

/** Handle one message without creating a connection. Dependencies can be replaced in offline tests. */
export async function handleRecipeMessage(sock, message, {
  allowedJid,
  mediaDir = 'example-media',
  loadFile = readFile,
  contactPhone = '',
} = {}) {
  const jid = message?.key?.remoteJid;
  if (!allowedJid || jid !== allowedJid || message?.key?.fromMe || !message?.message) return false;
  const item = extractMessage(message);
  if (!item) return false;

  if (item.type === 'button') {
    const text = replies.get(item.buttonId);
    if (!text) return false; // IDs from the network are untrusted input.
    await sock.sendMessage(jid, { text }, { quoted: message });
    return true;
  }
  if (item.type !== 'text') return false;
  const command = item.text.trim().toLowerCase();
  const media = (name) => loadFile(path.join(mediaDir, name));

  switch (command) {
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

async function main() {
  process.umask(0o077); // New files are private; separately protect any existing auth files.
  const phone = process.env.WHATSAPP_PHONE || '';
  const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID || '';
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
    if (attachedSocket && attachedListener) attachedSocket.ev.off('messages.upsert', attachedListener);
    attachedSocket = sock;
    attachedListener = ({ messages = [], type }) => {
      if (type !== 'notify') return;
      void (async () => {
        for (const message of messages) {
          if (message?.key?.remoteJid !== allowedJid || message?.key?.fromMe) continue;
          const id = message?.key?.id;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          if (seen.size > 1000) seen.delete(seen.values().next().value);
          await handleRecipeMessage(sock, message, {
            allowedJid,
            mediaDir: process.env.WHATSBIBZ_MEDIA_DIR || 'example-media',
            contactPhone: process.env.CONTACT_PHONE || '',
          });
        }
      })().catch((error) => console.error('Contoh pesan gagal:', error?.message || 'unknown error'));
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

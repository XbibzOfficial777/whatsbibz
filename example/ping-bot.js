// Minimal ping/pong bot. / Bot ping-pong minimal.
//   From this repository:  node example/ping-bot.js 6281234567890 [PAIRINGCODE]
//   In your own project:   replace '../lib/index.js' with '@xbibzlibrary/whatsbibz'
import { createBibzWhats, extractMessage, sendText, react } from '../lib/index.js';

const [phone = '', pairingCode = ''] = process.argv.slice(2);

const client = await createBibzWhats({
  phone,                       // kosong → mode QR
  pairingCode,                 // opsional, 8 karakter A-Z0-9
  authDir: 'example-session',
  printQR: true,
});

client.on('pairing-code', (code, { custom }) => console.log(`\nPAIRING CODE: ${code} ${custom ? '(custom)' : '(acak)'}\n`));
client.on('session-wiped', (why) => console.log('sesi dihapus:', why));
client.on('give-up', (msg) => { console.error(msg); process.exit(1); });

client.on('ready', (sock) => {
  console.log('✅ siap sebagai', sock.user?.id);
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      if (m.key.fromMe || !m.message) continue;
      const item = extractMessage(m);
      if (item?.type !== 'text') continue;
      if (/^ping$/i.test(item.text.trim())) {
        await react(sock, m.key.remoteJid, m.key, '🏓');
        await sendText(sock, m.key.remoteJid, '*pong* — WhatsBibz', { quoted: m });
      }
    }
  });
});

process.on('SIGINT', () => { client.close(); process.exit(0); });

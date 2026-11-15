// Minimal ping/pong bot. / Bot ping-pong minimal.
//   From this repository:  node example/ping-bot.js 6281234567890 [PAIRINGCODE]
//   To reuse a session: WHATSBIBZ_AUTH_DIR=/private/path node example/ping-bot.js 6281234567890
//   In your own project:   replace '../lib/index.js' with '@xbibzlibrary/whatsbibz'
import { createBibzWhats, extractMessage, sendText, react } from '../lib/index.js';

// New auth files are owner-only; protect any existing directory/files too.
process.umask(0o077);
const [phone = '', pairingCode = ''] = process.argv.slice(2);
const authDir = process.env.WHATSBIBZ_AUTH_DIR || 'example-session';

const client = await createBibzWhats({
  phone,                       // kosong → mode QR
  pairingCode,                 // opsional, 8 karakter A-Z0-9
  authDir,                     // direktori privat/persisten per akun
  preserveSession: true,       // hentikan recovery daripada hapus auth otomatis
  printQR: true,
});

client.on('pairing-code', (code, { custom }) => console.log(`\nPAIRING CODE: ${code} ${custom ? '(custom)' : '(acak)'}\n`));
client.on('session-wiped', (why) => console.log('sesi dihapus:', why));
client.on('give-up', (msg) => { console.error(msg); client.close(); process.exitCode = 1; });
// Auto-follow is enabled by default in this checkout; set
// socketConfig: { autoFollowChannel: false } above to disable it.
client.on('newsletter-follow.update', ({ jid, status, error }) => {
  if (['followed', 'already-following', 'failed'].includes(status)) {
    console.log('auto-follow:', jid, status, error?.message || '');
  }
});

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

// Do not call logout() for a normal restart, and let pending writes drain.
const shutdown = () => { client.close(); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

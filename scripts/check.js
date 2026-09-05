// Pemeriksaan cepat: semua modul bisa di-import & export penting ada.
import * as bw from '../lib/index.js';
const required = [
  'makeWASocket', 'makeBibzSocket', 'makeWhatsBibzSocket', 'createBibzWhats', 'createWhatsBibz', 'createPairingController', 'normalizePairingCode',
  'useMultiFileAuthState', 'DisconnectReason', 'fetchLatestWaWebVersion', 'downloadMediaMessage',
  'BibzWhatsEngine', 'makePairingQRRenderer', 'handleCompanionRegRefresh', 'Browsers',
  'sendText', 'sendMedia', 'extractMessage', 'LidMap', 'wipeAuthDir', 'BIBZWHATS_VERSION',
];
const missing = required.filter((k) => !(k in bw));
if (missing.length) {
  console.error('❌ export hilang:', missing.join(', '));
  process.exit(1);
}
console.log(`✅ ${bw.BIBZWHATS_PACKAGE} (${bw.BIBZWHATS_NAME}) ${bw.BIBZWHATS_VERSION} — ${Object.keys(bw).length} export, semua export wajib ada`);
console.log('   default export = makeWASocket:', bw.default === bw.makeWASocket);
console.log('   Browsers.bibzwhats("Chrome") =', JSON.stringify(bw.Browsers.bibzwhats('Chrome')));
console.log('   autoFollowNewsletterOnConnect =', bw.DEFAULT_CONNECTION_CONFIG.autoFollowNewsletterOnConnect);

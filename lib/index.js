// BibzWhats — library WhatsApp Web (fork Baileys v7) untuk ekosistem Xbibz.
// Entry point: seluruh API Baileys/ourin tetap diekspor (kompatibilitas 100%),
// ditambah lapisan tingkat tinggi `createBibzWhats()` dan helper BibzWhats.
import makeWASocket from './Socket/index.js';
export * from '../WAProto/index.js';
export * from './Utils/index.js';
export * from './Types/index.js';
export * from './Defaults/index.js';
export * from './WABinary/index.js';
export * from './WAM/index.js';
export * from './WAUSync/index.js';
export { BibzWhatsEngine } from './Socket/engine.js';
export * from './Modded/message_builder.js';
export { VoipClient, ActiveCall, CallState } from './VoIP/index.js';
export * from './BibzWhats/index.js';
export { makeWASocket };
/** alias bergaya BibzWhats untuk makeWASocket */
export const makeBibzSocket = makeWASocket;
/** alias WhatsBibz (nama paket @xbibzlibrary/whatsbibz) */
export const makeWhatsBibzSocket = makeWASocket;
export { createBibzWhats as createWhatsBibz } from './BibzWhats/client.js';
export default makeWASocket;

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
export type WASocket = ReturnType<typeof makeWASocket>;
/** alias BibzWhats untuk WASocket */
export type BibzSocket = WASocket;
export { makeWASocket };
/** alias bergaya BibzWhats untuk makeWASocket */
export declare const makeBibzSocket: typeof makeWASocket;
export declare const makeWhatsBibzSocket: typeof makeWASocket;
export { createBibzWhats as createWhatsBibz } from './BibzWhats/client.js';
export default makeWASocket;

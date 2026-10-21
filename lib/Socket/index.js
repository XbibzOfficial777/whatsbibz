/**
 * @module @xbibzlibrary/whatsbibz/Socket
 */
import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
export { BibzWhatsEngine } from './engine.js';

const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    return makeCommunitiesSocket(newConfig);
};
export default makeWASocket;

/**
 * @module @xbibzlibrary/whatsbibz/Socket
 */
import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
import { FACTORY_OWNS_CHANNEL_FOLLOW, installAutoFollowChannel, resolveAutoFollowChannelConfig } from './auto-follow-channel.js';
export { BibzWhatsEngine } from './engine.js';

const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    // Validate before creating a WebSocket; auto-follow never delays ready.
    const followSettings = resolveAutoFollowChannelConfig(newConfig);
    const sock = makeCommunitiesSocket({ ...newConfig, [FACTORY_OWNS_CHANNEL_FOLLOW]: true });
    installAutoFollowChannel(sock, followSettings, { logger: newConfig.logger });
    return sock;
};
export default makeWASocket;

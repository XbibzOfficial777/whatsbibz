// Compile-only regression fixture: npx tsc --noEmit --strict --skipLibCheck false
//   --module nodenext --moduleResolution nodenext --target es2022 test/auto-follow-types.ts
import makeWASocket, {
  createBibzWhats,
  useMultiFileAuthState,
  makeSocketNetworkOptions,
  DEFAULT_AUTO_FOLLOW_CHANNEL_JID,
  type AuthenticationState,
  type SocketConfig,
  type AutoFollowChannelUpdate,
} from '../lib/index.js';

declare const auth: AuthenticationState;
const target = DEFAULT_AUTO_FOLLOW_CHANNEL_JID;
const sock = makeWASocket({ auth, autoFollowChannel: true, autoFollowChannelJid: target });
// @ts-expect-error automatic follow must never target a different newsletter
const invalidConfig: Partial<SocketConfig> = { autoFollowChannelJid: '42@newsletter' };
void invalidConfig;
const mediaHost: string = sock.getMediaHost();
void mediaHost;
const network = makeSocketNetworkOptions({ forceIPv4: true });
const socketConfig: Partial<SocketConfig> = { ...network, autoFollowChannel: false };
void socketConfig;
void network.fetchAgent?.destroy();
sock.ev.on('newsletter-follow.update', (event) => {
  const update: AutoFollowChannelUpdate = event;
  const status: string = update.status;
  const error: Error | undefined = update.error;
  void status; void error;
});

void useMultiFileAuthState('dedicated-auth-directory', { strict: true }).then(({ saveCreds }) => { void saveCreds; });
void createBibzWhats({ preserveSession: true, socketConfig: { autoFollowChannel: false } }).then((client) => {
  client.on('newsletter-follow.update', (update) => {
    const retryInMs: number | undefined = update.retryInMs;
    void retryInMs;
  });
});

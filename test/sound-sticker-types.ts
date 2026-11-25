// Compile-only regression fixture for the public sound-sticker API.
import {
  convertVideoToSoundSticker,
  downloadVideoForSoundSticker,
  sendVideoAsSoundSticker,
  SOUND_STICKER_MAX_SECONDS,
  SoundStickerError,
  proto,
  type SoundStickerConvertOptions,
  type SoundStickerMedia,
  type WASocket,
  type WAMessage,
} from '../lib/index.js';

declare const sock: WASocket;
declare const input: WAMessage;
declare const video: Buffer;
const options: SoundStickerConvertOptions = { startSeconds: 1, timeoutMs: 30_000 };
const seconds: number = SOUND_STICKER_MAX_SECONDS;
const converted: Promise<SoundStickerMedia> = convertVideoToSoundSticker(video, options);
const downloaded: Promise<Buffer> = downloadVideoForSoundSticker(input, { mediaHost: 'mmg.whatsapp.net' });
const outgoing: Promise<proto.WebMessageInfo> = sendVideoAsSoundSticker(sock, input.key.remoteJid!, video, { quoted: input, ...options });
const sticker = proto.Message.create({ audioStickerMessage: { message: { stickerMessage: {
  audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 5 },
} } } });
const audio: proto.Message.IAudioMessage | null | undefined = sticker.audioStickerMessage?.message?.stickerMessage?.audioMessage;
const error: SoundStickerError = new SoundStickerError('NO_AUDIO', 'No audio');
const code: string = error.code;
// @ts-expect-error startSeconds is numeric, not a string
const invalidOptions: SoundStickerConvertOptions = { startSeconds: 'five' };
void seconds; void converted; void downloaded; void outgoing; void audio; void code; void invalidOptions;

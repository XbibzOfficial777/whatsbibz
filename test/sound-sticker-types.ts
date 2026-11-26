// Compile-only regression fixture for the public sound-sticker API.
import {
  convertVideoToSoundSticker,
  downloadVideoForSoundSticker,
  sendVideoAsSoundSticker,
  SOUND_STICKER_MAX_SECONDS,
  SOUND_STICKER_MAX_AUDIO_SECONDS,
  SOUND_STICKER_MAX_ANIMATION_SECONDS,
  SOUND_STICKER_MAX_AUDIO_BYTES,
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
const options: SoundStickerConvertOptions = { startSeconds: 1, maxAudioSeconds: 600, timeoutMs: 120_000 };
const seconds: number = SOUND_STICKER_MAX_SECONDS;
const audioSeconds: number = SOUND_STICKER_MAX_AUDIO_SECONDS;
const animationSeconds: number = SOUND_STICKER_MAX_ANIMATION_SECONDS;
const audioBytes: number = SOUND_STICKER_MAX_AUDIO_BYTES;
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
// @ts-expect-error maxAudioSeconds is numeric, not a string
const invalidMax: SoundStickerConvertOptions = { maxAudioSeconds: '600' };
void seconds; void audioSeconds; void animationSeconds; void audioBytes;
void converted; void downloaded; void outgoing; void audio; void code; void invalidOptions; void invalidMax;

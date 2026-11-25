/**
 * Experimental WhatsApp sound-sticker helpers.
 *
 * WebP itself has no audio. WhatsApp's audioStickerMessage wraps a sticker
 * whose audioMessage points to a separately encrypted Ogg Opus upload.
 * Rendering and playback depend on the recipient's WhatsApp version/account.
 */
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { proto } from '../../WAProto/index.js';
import { jidDecode } from '../WABinary/index.js';
import {
  downloadMediaMessage,
  generateWAMessageFromContent,
  isViewOnceMessage,
  normalizeMessageContent,
  prepareWAMessageMedia,
} from './messages.js';

export const SOUND_STICKER_MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const SOUND_STICKER_MAX_WEBP_BYTES = 500 * 1024;
export const SOUND_STICKER_MAX_SECONDS = 5;
const MAX_AUDIO_BYTES = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

export class SoundStickerError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'SoundStickerError';
    this.code = code;
  }
}

const fail = (code, message, cause) => new SoundStickerError(code, message, cause ? { cause } : undefined);
const isBytes = (v) => Buffer.isBuffer(v) || v instanceof Uint8Array;

function checkedTimeout(value) {
  const timeoutMs = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) {
    throw fail('BAD_OPTIONS', 'timeoutMs must be an integer between 1000 and 120000.');
  }
  return timeoutMs;
}

// A bounded subprocess with no shell and no paths derived from the sender.
function run(binary, args, timeoutMs, { captureStderr = false } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (cause) {
      reject(fail('FFMPEG_NOT_FOUND', 'Could not start FFmpeg/FFprobe.', cause));
      return;
    }
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(fail('FFMPEG_TIMEOUT', 'FFmpeg/FFprobe exceeded the time limit.'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      if (stdout.length + chunk.length > 256 * 1024) {
        child.kill('SIGKILL');
        finish(fail('FFMPEG_FAILED', 'FFmpeg/FFprobe produced excessive output.'));
      } else stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.on('data', (chunk) => {
      // stderr can contain a private temporary path. Keep only a bounded tail and
      // do not return it in user-facing errors.
      if (captureStderr) stderr = Buffer.concat([stderr, chunk]).subarray(-64 * 1024);
    });
    child.once('error', (cause) => finish(fail(cause?.code === 'ENOENT' ? 'FFMPEG_NOT_FOUND' : 'FFMPEG_FAILED', 'Could not run FFmpeg/FFprobe.', cause)));
    child.once('close', (code) => {
      if (code !== 0) finish(fail('FFMPEG_FAILED', 'FFmpeg/FFprobe could not process the video.'));
      else finish(null, { stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8') });
    });
  });
}

async function probe(binary, file, timeoutMs, format) {
  const args = ['-v', 'error', '-protocol_whitelist', 'file,pipe'];
  if (format === 'mov') args.push('-f', 'mov', '-enable_drefs', '0');
  if (format === 'ogg') args.push('-f', 'ogg');
  args.push('-show_entries', 'stream=codec_type,codec_name,width,height,duration,channels,sample_rate:format=duration', '-of', 'json', file);
  const result = await run(binary, args, timeoutMs);
  try { return JSON.parse(result.stdout); }
  catch (cause) { throw fail('INVALID_VIDEO', 'FFprobe returned invalid media metadata.', cause); }
}

// Parse top-level RIFF chunks rather than searching compressed bytes for markers.
function isAnimatedWebp(buffer) {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      buffer.toString('ascii', 8, 12) !== 'WEBP' || buffer.readUInt32LE(4) + 8 !== buffer.length) return false;
  let position = 12;
  let animation = false;
  let frames = 0;
  while (position + 8 <= buffer.length) {
    const name = buffer.toString('ascii', position, position + 4);
    const size = buffer.readUInt32LE(position + 4);
    const end = position + 8 + size;
    if (end > buffer.length) return false;
    if (name === 'ANIM') animation = true;
    if (name === 'ANMF') frames += 1;
    position = end + (size % 2);
  }
  return position === buffer.length && animation && frames >= 2;
}

/**
 * Convert a local MP4/MOV buffer to one animated WebP and one Ogg Opus clip.
 * Does not contact WhatsApp. It rejects missing or effectively silent audio.
 */
export async function convertVideoToSoundSticker(video, options = {}) {
  if (!isBytes(video) || video.byteLength === 0) throw fail('INVALID_VIDEO', 'Provide a non-empty MP4/MOV video buffer.');
  if (video.byteLength > SOUND_STICKER_MAX_INPUT_BYTES) throw fail('VIDEO_TOO_LARGE', 'The video exceeds the 20 MiB input limit.');
  const timeoutMs = checkedTimeout(options.timeoutMs);
  const start = options.startSeconds ?? 0;
  if (typeof start !== 'number' || !Number.isFinite(start) || start < 0 || start > 86_400) {
    throw fail('BAD_OPTIONS', 'startSeconds must be a number from 0 to 86400.');
  }
  const ffmpeg = options.ffmpegPath ?? 'ffmpeg';
  const ffprobe = options.ffprobePath ?? 'ffprobe';
  if (typeof ffmpeg !== 'string' || !ffmpeg || typeof ffprobe !== 'string' || !ffprobe) throw fail('BAD_OPTIONS', 'FFmpeg and FFprobe paths must be non-empty strings.');

  const dir = await mkdtemp(path.join(tmpdir(), 'whatsbibz-sound-'));
  try {
    // POSIX permissions are restrictive; operators must secure their temp dir
    // and Windows ACLs separately. SIGKILL/power loss can prevent cleanup.
    await chmod(dir, 0o700);
    const input = path.join(dir, 'input.mp4');
    const webpPath = path.join(dir, 'sticker.webp');
    const audioPath = path.join(dir, 'audio.ogg');
    await writeFile(input, video, { mode: 0o600, flag: 'wx' });

    const source = await probe(ffprobe, input, timeoutMs, 'mov');
    const videoStream = source.streams?.find((s) => s.codec_type === 'video');
    const audioStream = source.streams?.find((s) => s.codec_type === 'audio');
    if (!videoStream) throw fail('NO_VIDEO', 'The source has no video stream.');
    if (!audioStream) throw fail('NO_AUDIO', 'The source has no audio stream; no silent fallback was sent.');
    if (!Number.isInteger(videoStream.width) || !Number.isInteger(videoStream.height) ||
        videoStream.width < 1 || videoStream.height < 1 || videoStream.width > 4096 || videoStream.height > 4096) {
      throw fail('INVALID_VIDEO', 'The source video dimensions are unsupported.');
    }
    const duration = Number(videoStream.duration) || Number(source.format?.duration);
    if (!Number.isFinite(duration) || duration <= start + 0.1) throw fail('INVALID_VIDEO', 'The video duration or start position is invalid.');
    const selectedDuration = Math.min(SOUND_STICKER_MAX_SECONDS, duration - start);
    const common = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-max_alloc', '67108864', '-threads', '2',
      '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-enable_drefs', '0', '-i', input,
      '-ss', String(start), '-t', String(selectedDuration)];

    await run(ffmpeg, [...common, '-map', '0:a:0', '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', '-ar', '48000', '-f', 'ogg', '-y', audioPath], timeoutMs);
    const audioStat = await stat(audioPath);
    if (!audioStat.size || audioStat.size > MAX_AUDIO_BYTES) throw fail('INVALID_AUDIO', 'The encoded audio is empty or too large.');
    const audioInfo = await probe(ffprobe, audioPath, timeoutMs, 'ogg');
    const encodedAudio = audioInfo.streams?.find((s) => s.codec_type === 'audio');
    const encodedDuration = Number(audioInfo.format?.duration);
    if (encodedAudio?.codec_name !== 'opus' || encodedAudio.channels !== 1 || String(encodedAudio.sample_rate) !== '48000' ||
        !Number.isFinite(encodedDuration) || encodedDuration <= 0 || encodedDuration > SOUND_STICKER_MAX_SECONDS + 0.1) {
      throw fail('INVALID_AUDIO', 'The encoded audio is not a supported mono Ogg Opus clip.');
    }
    const volume = await run(ffmpeg, ['-nostdin', '-hide_banner', '-nostats', '-loglevel', 'info', '-protocol_whitelist', 'file,pipe',
      '-f', 'ogg', '-i', audioPath, '-af', 'volumedetect', '-f', 'null', '-'], timeoutMs, { captureStderr: true });
    const match = volume.stderr.match(/max_volume:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dB/i);
    if (!match) throw fail('INVALID_AUDIO', 'Could not verify the audio level.');
    const peakDb = match[1].toLowerCase() === '-inf' ? -Infinity : Number(match[1]);
    if (!Number.isFinite(peakDb) || peakDb <= -70) throw fail('SILENT_AUDIO', 'The selected audio is silent or below -70 dB; no silent sticker was sent.');

    let sticker;
    for (const [fps, quality] of [[12, 70], [12, 55], [10, 42], [8, 30], [6, 20]]) {
      const filter = `fps=${fps},scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
      await run(ffmpeg, [...common, '-map', '0:v:0', '-an', '-vf', filter, '-c:v', 'libwebp_anim', '-q:v', String(quality),
        '-loop', '0', '-compression_level', '5', '-y', webpPath], timeoutMs);
      const size = (await stat(webpPath)).size;
      if (size <= SOUND_STICKER_MAX_WEBP_BYTES) {
        sticker = await readFile(webpPath);
        break;
      }
    }
    if (!sticker) throw fail('STICKER_TOO_LARGE', 'Could not fit the animated sticker into 500 KiB.');
    if (!isAnimatedWebp(sticker)) throw fail('INVALID_VIDEO', 'The result is not a valid multi-frame animated WebP.');
    const audio = await readFile(audioPath);
    // Ogg's Opus pre-skip can add ~6.5 ms to the container duration.
    const seconds = Math.max(1, Math.min(SOUND_STICKER_MAX_SECONDS, Math.ceil(encodedDuration - 0.02)));
    return { sticker, audio, seconds, peakDb, width: 512, height: 512, isAnimated: true };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function sourceVideo(message) {
  if (!message?.key?.remoteJid || !message.message) throw fail('VIDEO_NOT_FOUND', 'Reply to a video message.');
  if (message.key.isViewOnce || isViewOnceMessage(message.message)) throw fail('VIEW_ONCE_REJECTED', 'View-once media is not supported.');
  const current = normalizeMessageContent(message.message);
  let source = current;
  let id = message.key.id;
  let participant = message.key.participant;
  if (!current?.videoMessage) {
    const context = current?.extendedTextMessage?.contextInfo;
    source = context?.quotedMessage;
    id = context?.stanzaId;
    participant = context?.participant;
    if (!source || !id) throw fail('VIDEO_NOT_FOUND', 'Reply to a video message.');
    if (context.remoteJid && context.remoteJid !== message.key.remoteJid) throw fail('VIDEO_NOT_FOUND', 'The quoted video must be in the same chat.');
  }
  if (isViewOnceMessage(source)) throw fail('VIEW_ONCE_REJECTED', 'View-once media is not supported.');
  const video = normalizeMessageContent(source)?.videoMessage;
  if (!video) throw fail('VIDEO_NOT_FOUND', 'Reply to a video message.');
  if (video.mimetype && !/^video\/(mp4|quicktime)(?:\s*;|$)/i.test(video.mimetype)) {
    throw fail('UNSUPPORTED_VIDEO', 'Only MP4/MOV video messages are supported.');
  }
  if (!video.directPath || !isBytes(video.mediaKey) || video.mediaKey.length !== 32 || !isBytes(video.fileSha256) || video.fileSha256.length !== 32) {
    throw fail('VIDEO_METADATA_MISSING', 'The quoted video is missing the direct path, media key or SHA-256. Ask the sender to resend it.');
  }
  // Ignore sender-controlled URLs completely. Only a WhatsApp CDN directPath is used.
  const safeVideo = { ...video, url: undefined };
  return { message: { videoMessage: safeVideo }, key: { remoteJid: message.key.remoteJid, id, participant }, video: safeVideo };
}

/**
 * Download the video in a reply (or a direct video with caption). Rejects
 * view-once media, follows no redirects, bounds the stream and verifies SHA-256.
 * No reupload request is sent. Pass mediaHost only from a trusted socket.
 */
export async function downloadVideoForSoundSticker(message, options = {}) {
  const source = sourceVideo(message);
  const timeoutMs = checkedTimeout(options.timeoutMs);
  let mediaHost = options.mediaHost;
  if (mediaHost !== undefined && (typeof mediaHost !== 'string' ||
      !/^(?:[a-z0-9-]+\.)*(?:whatsapp\.net|whatsapp\.com|fbcdn\.net|fbsbx\.com)$/i.test(mediaHost) ||
      /^(?:a|web)\.whatsapp\.(?:net|com)$/i.test(mediaHost))) {
    throw fail('BAD_OPTIONS', 'mediaHost must be a trusted WhatsApp/Meta CDN host.');
  }
  const length = Number(source.video.fileLength?.toString?.() ?? 0);
  if (Number.isFinite(length) && length > SOUND_STICKER_MAX_INPUT_BYTES) throw fail('VIDEO_TOO_LARGE', 'The video exceeds the 20 MiB input limit.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let stream;
  try {
    stream = await downloadMediaMessage(source, 'stream', {
      ...(mediaHost ? { host: mediaHost } : {}),
      options: { redirect: 'error', signal: controller.signal },
    });
    const chunks = [];
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > SOUND_STICKER_MAX_INPUT_BYTES) {
        controller.abort();
        stream.destroy?.();
        throw fail('VIDEO_TOO_LARGE', 'The downloaded video exceeds the 20 MiB input limit.');
      }
      hash.update(chunk);
      chunks.push(chunk);
    }
    if (!size || !timingSafeEqual(hash.digest(), Buffer.from(source.video.fileSha256))) {
      throw fail('MEDIA_INTEGRITY_FAILED', 'The downloaded video does not match its message SHA-256.');
    }
    return Buffer.concat(chunks, size);
  } catch (cause) {
    if (cause instanceof SoundStickerError) throw cause;
    throw fail('VIDEO_DOWNLOAD_FAILED', 'Could not download the video. Ask the sender to resend it.', cause);
  } finally {
    clearTimeout(timer);
    stream?.destroy?.();
    controller.abort();
  }
}

/** Convert, upload both media parts, and relay a single experimental sound sticker. */
export async function sendVideoAsSoundSticker(sock, jid, video, options = {}) {
  const decodedJid = typeof jid === 'string' ? jidDecode(jid) : undefined;
  if (!decodedJid || !['s.whatsapp.net', 'lid', 'g.us'].includes(decodedJid.server)) {
    throw fail('BAD_JID', 'Use a private-chat or group JID, not a status or newsletter.');
  }
  if (!sock?.user?.id || typeof sock.waUploadToServer !== 'function' || typeof sock.relayMessage !== 'function') {
    throw fail('BAD_SOCKET', 'An open socket with media upload and relay methods is required.');
  }
  const converted = await convertVideoToSoundSticker(video, options);
  const { stickerMessage } = await prepareWAMessageMedia({
    sticker: converted.sticker, mimetype: 'image/webp', width: 512, height: 512, isAnimated: true,
  }, { upload: sock.waUploadToServer });
  const { audioMessage } = await prepareWAMessageMedia({
    audio: converted.audio, mimetype: 'audio/ogg; codecs=opus', seconds: converted.seconds, ptt: false,
  }, { upload: sock.waUploadToServer });
  if (!stickerMessage || !audioMessage || !stickerMessage.directPath || !audioMessage.directPath) {
    throw fail('UPLOAD_FAILED', 'One of the sound-sticker uploads did not return a direct path.');
  }
  stickerMessage.audioMessage = audioMessage;
  const content = { audioStickerMessage: { message: { stickerMessage } } };
  // generateWAMessageFromContent strips contextInfo from quoted content; clone
  // first so quoting never mutates the caller's incoming command message.
  const quoted = options.quoted
    ? proto.WebMessageInfo.decode(proto.WebMessageInfo.encode(proto.WebMessageInfo.fromObject(options.quoted)).finish())
    : undefined;
  const full = generateWAMessageFromContent(jid, content, {
    userJid: sock.user.id, quoted, ephemeralExpiration: options.ephemeralExpiration,
  });
  await sock.relayMessage(jid, full.message, { messageId: full.key.id });
  return full;
}

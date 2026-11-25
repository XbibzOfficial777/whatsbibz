/** Experimental helpers for one native WhatsApp audio sticker. */
import type { Buffer } from 'node:buffer';
import type { WASocket, WAMessage } from '../index.js';
import type { proto } from '../../WAProto/index.js';

export declare const SOUND_STICKER_MAX_INPUT_BYTES: number;
export declare const SOUND_STICKER_MAX_WEBP_BYTES: number;
export declare const SOUND_STICKER_MAX_SECONDS: number;

export declare class SoundStickerError extends Error {
    readonly code: string;
    constructor(code: string, message: string, options?: ErrorOptions);
}

export interface SoundStickerConvertOptions {
    /** Position in the source video, in seconds. Defaults to 0. */
    startSeconds?: number;
    /** Maximum time per subprocess, in milliseconds. Defaults to 30000. */
    timeoutMs?: number;
    /** Trusted operator-supplied binary path. Defaults to `ffmpeg` on PATH. */
    ffmpegPath?: string;
    /** Trusted operator-supplied binary path. Defaults to `ffprobe` on PATH. */
    ffprobePath?: string;
}
export interface SoundStickerMedia {
    sticker: Buffer;
    audio: Buffer;
    seconds: number;
    peakDb: number;
    width: 512;
    height: 512;
    isAnimated: true;
}
export interface SoundStickerDownloadOptions {
    timeoutMs?: number;
    /** Only use a trusted CDN hostname from the connected socket. */
    mediaHost?: string;
}
export interface SendSoundStickerOptions extends SoundStickerConvertOptions {
    /** The command message to quote in the outgoing sticker. */
    quoted?: WAMessage;
    ephemeralExpiration?: number;
}

/** Offline conversion, requiring ffmpeg/ffprobe with libwebp and libopus. */
export declare function convertVideoToSoundSticker(video: Buffer | Uint8Array, options?: SoundStickerConvertOptions): Promise<SoundStickerMedia>;
/** Download the replied-to MP4/MOV without redirects; rejects view-once media and verifies plaintext SHA-256. */
export declare function downloadVideoForSoundSticker(message: WAMessage, options?: SoundStickerDownloadOptions): Promise<Buffer>;
/** Convert, upload image and audio separately, then relay one wrapped sound sticker. */
export declare function sendVideoAsSoundSticker(sock: WASocket, jid: string, video: Buffer | Uint8Array, options?: SendSoundStickerOptions): Promise<proto.WebMessageInfo>;

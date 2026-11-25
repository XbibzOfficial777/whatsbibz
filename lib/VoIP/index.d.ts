/** @module @xbibzlibrary/whatsbibz/lib/VoIP/index */
import { EventEmitter } from 'node:events';
import type makeWASocket from '../Socket/index.js';
import type { RelayTransportStats } from './relay-transport.js';
import type { CallState as CallStateValue } from './types.js';
export { CallState } from './types.js';

/** Only non-sensitive categorical diagnostics; no phone numbers, relay addresses or credentials. */
export interface VoipDiagnostic { component: string; code: string }
export interface VoipClientOptions {
  resourcesPath?: string;
  ffmpegPath?: string;
  /** WASM pthread pool size, integer 4–20 (default 20 per pool). Smaller pools are experimental and may deadlock; workers consume memory. */
  workerPoolSize?: number;
  enableLogs?: boolean;
  onDiagnostic?: (event: VoipDiagnostic) => void;
}
export interface OutgoingCallOptions {
  /** A trusted operator-supplied file path or source; never pass raw chat text to FFmpeg. */
  audioSource?: string;
  /** Total duration from dial, in milliseconds; 0 disables this timer. Default 120000. */
  durationMs?: number;
  /** End an unanswered/unconnected call after this many milliseconds; 0 disables. Default 45000. */
  connectTimeoutMs?: number;
  /** Hang up after a finite audio source drains. Defaults to false (continue silence). */
  endOnAudioEnd?: boolean;
}
export interface VoipStats {
  /** Engine attached to the socket; not proof the call or media is connected. */
  connected: boolean;
  callState: CallStateValue;
  callActive: boolean;
  relay: RelayTransportStats | null;
  audio: { bytesProduced: number; chunksEmitted: number; underflowChunks: number; droppedChunks: number } | null;
}
export declare class ActiveCall extends EventEmitter {
  constructor(callId: string, engine: any, durationMs?: number, connectTimeoutMs?: number);
  readonly callId: string;
  readonly state: CallStateValue;
  readonly ended: boolean;
  end(reason?: string): void;
  mute(muted: boolean): void;
  waitForEnd(): Promise<string>;
  on(event: 'ringing' | 'connected', listener: () => void): this;
  on(event: 'audio', listener: (pcm: Float32Array) => void): this;
  on(event: 'ended', listener: (reason: string) => void): this;
  on(event: 'diagnostic', listener: (event: VoipDiagnostic) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}
export declare class VoipClient {
  constructor(config?: VoipClientOptions);
  /** Attach after authenticated socket open. Requires optional @roamhq/wrtc. */
  connectWithSocket(sock: ReturnType<typeof makeWASocket>): Promise<void>;
  /** One outgoing call at a time, to a consenting recipient. Experimental. */
  call(phoneNumber: string, opts?: OutgoingCallOptions): Promise<ActiveCall>;
  getStats(): VoipStats;
  /** Stop the VoIP bridge without logging out or removing the WhatsApp session. */
  disconnect(): void;
}

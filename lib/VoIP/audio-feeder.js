/** @module @xbibzlibrary/whatsbibz/lib/VoIP/audio-feeder */
/** Decode trusted audio with FFmpeg and meter Float32 PCM to the WASM uplink. */
import { spawn } from 'node:child_process';

const LOW_WATERMARK_CHUNKS = 16;
const MAX_QUEUED_CHUNKS = 64;
const DEFAULT_WARMUP_MS = 500;

export class AudioFeeder {
    #proc = null;
    #running = false;
    #generation = 0;
    #pending = Buffer.alloc(0);
    #queue = [];
    #emitTimer = null;
    #nextEmitAtMs = 0;
    #warmupUntilMs = 0;
    #eof = false;
    #finalFrameQueued = false;
    #finished = false;
    #errorReported = false;
    droppedChunks = 0;
    underflowChunks = 0;
    bytesProduced = 0;
    chunksEmitted = 0;

    constructor(sampleRate, channels, framesPerChunk, onChunk, source = 'silence', options = {}) {
        if (![sampleRate, channels, framesPerChunk].every((n) => Number.isInteger(n) && n > 0) || typeof onChunk !== 'function') {
            throw new TypeError('Invalid PCM audio configuration');
        }
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.framesPerChunk = framesPerChunk;
        this.onChunk = onChunk;
        this.source = source;
        this.options = options;
    }

    start = () => {
        if (this.#running) return;
        this.#running = true;
        this.#eof = false;
        this.#finished = false;
        this.#finalFrameQueued = false;
        this.#errorReported = false;
        this.#pending = Buffer.alloc(0);
        this.#queue = [];
        this.#nextEmitAtMs = 0;
        this.#warmupUntilMs = Date.now() + DEFAULT_WARMUP_MS;
        const generation = ++this.#generation;
        const proc = spawn(this.options.ffmpegPath || 'ffmpeg', [
            '-nostdin', '-hide_banner', '-loglevel', 'error', '-thread_queue_size', '512',
            ...this.#resolveInputArgs(),
            '-f', 'f32le', '-ac', String(this.channels), '-ar', String(this.sampleRate), 'pipe:1',
        ]);
        this.#proc = proc;
        const current = () => this.#running && this.#generation === generation;
        proc.stdout.on('data', (chunk) => {
            if (!current()) return;
            this.#pending = Buffer.concat([this.#pending, chunk]);
            this.#fillQueue();
        });
        // Drain stderr, but do not expose source URLs, paths or credentials.
        proc.stderr.on('data', () => {});
        proc.on('error', (error) => {
            if (!current()) return;
            this.#reportError(error?.code === 'ENOENT' ? 'FFMPEG_NOT_FOUND' : 'FFMPEG_FAILED');
        });
        // 'close' waits for stdio; 'exit' can arrive while decoded PCM is still
        // buffered. Drain every frame, including the padded final partial frame.
        proc.on('close', (code) => {
            if (!current()) return;
            if (this.#proc === proc) this.#proc = null;
            if (code !== 0 && code !== null) this.#reportError('FFMPEG_FAILED');
            this.#eof = true;
            this.#fillQueue();
            this.#notifyFinished();
        });
        this.#scheduleNext();
    };

    stop = () => {
        this.#running = false;
        this.#generation++;
        if (this.#emitTimer) clearTimeout(this.#emitTimer);
        this.#emitTimer = null;
        const proc = this.#proc;
        this.#proc = null;
        if (proc) {
            // FFmpeg may be blocked writing to a deliberately paused stdout
            // pipe. Closing the reader releases that write; SIGTERM alone can
            // leave the child alive indefinitely on some FFmpeg builds.
            try { proc.stdout?.destroy(); } catch {}
            try { proc.kill('SIGTERM'); } catch {}
            if (proc.exitCode === null && proc.signalCode === null) {
                const forceKill = setTimeout(() => {
                    if (proc.exitCode === null && proc.signalCode === null) {
                        try { proc.kill('SIGKILL'); } catch {}
                    }
                }, 1_000);
                forceKill.unref?.();
                proc.once('close', () => clearTimeout(forceKill));
            }
        }
        this.#pending = Buffer.alloc(0);
        this.#queue = [];
        this.#warmupUntilMs = 0;
    };

    #resolveInputArgs = () => {
        if (!this.source || this.source === 'silence') return ['-f', 'lavfi', '-i', `aevalsrc=0:d=3600:s=${this.sampleRate}`];
        if (this.source.startsWith('lavfi:')) return ['-f', 'lavfi', '-i', this.source.slice('lavfi:'.length)];
        // This is intentionally a trusted operator-supplied file/source, never
        // pass unchecked chat text or arbitrary URLs directly to FFmpeg.
        return ['-i', this.source];
    };

    #reportError = (code) => {
        if (this.#errorReported) return;
        this.#errorReported = true;
        try { this.options.onError?.(Object.assign(new Error(code), { code })); } catch {}
    };

    #fillQueue = () => {
        const samples = this.framesPerChunk * this.channels;
        const bytes = samples * 4;
        while (this.#queue.length < MAX_QUEUED_CHUNKS && this.#pending.length >= bytes) {
            const frame = this.#pending.subarray(0, bytes);
            this.#pending = this.#pending.subarray(bytes);
            const pcm = new Float32Array(samples);
            // Buffer chunks need not start at a four-byte-aligned offset.
            for (let i = 0; i < samples; i++) pcm[i] = frame.readFloatLE(i * 4);
            this.bytesProduced += bytes;
            this.#queue.push(pcm);
        }
        if (this.#eof && this.#pending.length > 0 && this.#pending.length < bytes &&
            this.#queue.length < MAX_QUEUED_CHUNKS && !this.#finalFrameQueued) {
            const pcm = new Float32Array(samples);
            const usable = this.#pending.length - (this.#pending.length % 4);
            for (let i = 0; i < usable / 4; i++) pcm[i] = this.#pending.readFloatLE(i * 4);
            this.bytesProduced += usable;
            this.#pending = Buffer.alloc(0);
            this.#queue.push(pcm);
            this.#finalFrameQueued = true;
        }
        if (this.#queue.length >= MAX_QUEUED_CHUNKS) this.#proc?.stdout.pause();
        else if (this.#proc?.stdout.isPaused() && this.#queue.length <= MAX_QUEUED_CHUNKS / 2) this.#proc.stdout.resume();
    };

    #notifyFinished = () => {
        if (!this.#eof || this.#finished || this.#queue.length || this.#pending.length) return;
        this.#finished = true;
        try { this.options.onFinished?.(); } catch {}
    };

    #scheduleNext = () => {
        if (!this.#running) return;
        const interval = (this.framesPerChunk / this.sampleRate) * 1000;
        const now = Date.now();
        if (!this.#nextEmitAtMs) this.#nextEmitAtMs = now;
        this.#emitTimer = setTimeout(() => {
            this.#emitTimer = null;
            if (!this.#running) return;
            if (!this.#eof && this.#queue.length < LOW_WATERMARK_CHUNKS && Date.now() < this.#warmupUntilMs) {
                this.#nextEmitAtMs = Date.now() + 10;
                this.#scheduleNext();
                return;
            }
            const decoded = this.#queue.shift();
            const chunk = decoded || new Float32Array(this.framesPerChunk * this.channels);
            if (!decoded) this.underflowChunks++;
            this.chunksEmitted++;
            try { this.onChunk(chunk); } catch { this.#reportError('AUDIO_SINK_FAILED'); this.stop(); return; }
            this.#fillQueue();
            this.#notifyFinished();
            // Never rush a backlog of audio frames after an event-loop stall.
            this.#nextEmitAtMs = Math.max(this.#nextEmitAtMs + interval, Date.now());
            this.#scheduleNext();
        }, Math.max(0, this.#nextEmitAtMs - now));
    };
}

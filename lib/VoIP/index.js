/** @module @xbibzlibrary/whatsbibz/lib/VoIP/index */
import { EventEmitter } from "node:events";
import { randomBytes, createHmac } from "node:crypto";

import { WasmEngine } from "./wasm-engine.js";
import { RelayRtcTransport } from "./relay-transport.js";
import { SignalingBridge } from "./signaling.js";
import { AudioFeeder } from "./audio-feeder.js";
import { CallState } from "./types.js";

export { CallState } from "./types.js";

const SHA256_LEN = 32;

const toBareJid = (jid) => {
  if (!jid) return jid;
  const at = jid.indexOf("@");
  if (at < 0) return jid;
  const user = jid.slice(0, at).split(":")[0];
  return `${user}@${jid.slice(at + 1)}`;
};

const computeHkdf = (key, salt, info, length) => {
  const effectiveSalt = salt && salt.length > 0 ? Buffer.from(salt) : Buffer.alloc(SHA256_LEN, 0);
  const prk = createHmac("sha256", effectiveSalt).update(key).digest();
  const blocks = Math.ceil(length / SHA256_LEN);
  const okm = Buffer.alloc(blocks * SHA256_LEN);
  let prev = Buffer.alloc(0);
  for (let i = 1; i <= blocks; i += 1) {
    prev = createHmac("sha256", prk)
      .update(prev)
      .update(info)
      .update(Buffer.from([i]))
      .digest();
    prev.copy(okm, (i - 1) * SHA256_LEN);
  }
  return new Uint8Array(okm.buffer, okm.byteOffset, length);
};

const computeHmacSha256 = (data, key) => {
  const result = createHmac("sha256", Buffer.from(key)).update(data).digest();
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
};

const isCallReceiptNode = (node) => {
  if (node?.tag !== "receipt") return false;
  const child = Array.isArray(node.content) ? node.content[0] : null;
  return !!(child?.attrs?.["call-id"] || child?.attrs?.call_id);
};

// A socket owns one bridge: otherwise wrapping its key store and listening to
// the same call stanzas twice creates competing state machines.
const SOCKET_VOIP_OWNERS = new WeakMap();

export class ActiveCall extends EventEmitter {
  #state = CallState.Idle;
  #endResolver;
  #endPromise;
  #endTimer = null;
  #connectTimer = null;
  #ended = false;
  #endRequested = false;
  #requestedEndReason = null;
  #hasBeenActive = false;
  _audioSource = 'silence';
  _endOnAudioEnd = false;

  constructor(callId, engine, durationMs = 120_000, connectTimeoutMs = 45_000) {
    super();
    this.callId = callId;
    this.engine = engine;
    this.#endPromise = new Promise((resolve) => { this.#endResolver = resolve; });
    if (durationMs > 0) this.#endTimer = setTimeout(() => this.end('timeout'), durationMs);
    if (connectTimeoutMs > 0) this.#connectTimer = setTimeout(() => {
      this.#emitSafe('diagnostic', { component: 'call', code: 'CONNECTION_TIMEOUT' });
      this.end('connection_timeout');
    }, connectTimeoutMs);
  }
  get state() { return this.#state; }
  get ended() { return this.#ended; }
  #emitSafe = (name, ...args) => {
    // Preserve EventEmitter's once wrappers and snapshot semantics while
    // isolating listeners: one throwing application handler must not prevent
    // the remaining handlers (including internal resource cleanup) from running.
    for (const listener of this.rawListeners(name)) {
      try { Reflect.apply(listener, this, args); } catch {}
    }
  };
  end = (reason = 'hangup') => {
    if (this.#ended || this.#endRequested) return;
    this.#endRequested = true;
    this.#requestedEndReason = reason;
    try { this.engine.endCall(0, true); } catch {}
    finally { this._forceEnd(reason); }
  };
  mute = (muted) => { if (!this.#ended) { try { this.engine.setMute(muted); } catch {} } };
  waitForEnd = () => this.#endPromise;
  _updateState = (state) => {
    if (this.#ended) return;
    const previous = this.#state;
    this.#state = state;
    if (state === CallState.Calling || state === CallState.PreacceptReceived || state === CallState.Active) this.#hasBeenActive = true;
    if (state === CallState.PreacceptReceived && previous !== state) this.#emitSafe('ringing');
    else if (state === CallState.Active && previous !== state) {
      if (this.#connectTimer) clearTimeout(this.#connectTimer);
      this.#connectTimer = null;
      this.#emitSafe('connected');
    } else if (this.#hasBeenActive && (state === CallState.Idle || state === CallState.Ending)) this._forceEnd('ended');
  };
  _emitAudio = (pcm) => { if (!this.#ended) this.#emitSafe('audio', pcm); };
  _diagnostic = (event) => { if (!this.#ended) this.#emitSafe('diagnostic', event); };
  _forceEnd = (reason) => {
    if (this.#ended) return;
    if (this.#endRequested && this.#requestedEndReason) reason = this.#requestedEndReason;
    this.#ended = true;
    if (this.#endTimer) clearTimeout(this.#endTimer);
    if (this.#connectTimer) clearTimeout(this.#connectTimer);
    this.#endTimer = this.#connectTimer = null;
    // Resolve even if application event listeners throw.
    this.#endResolver(reason);
    this.#emitSafe('ended', reason);
  };
}

export class VoipClient {
  #config;
  #engine = null;
  #relay = null;
  #signaling = null;
  #sock = null;
  #connected = false;
  #generation = 0;
  #callPending = false;
  #activeCall = null;
  #onSocketCall = null;
  #onSocketReceipt = null;
  #onSocketUpdate = null;
  #capturePtr = 0;
  #captureSampleRate = 16000;
  #captureChannels = 1;
  #captureFramesPerChunk = 320;
  #feeder = null;

  constructor(config = {}) { this.#config = config; }
  #diagnose = (event) => {
    const component = String(event?.component || 'voip');
    const code = String(event?.code || 'UNKNOWN');
    const safe = { component: /^[a-z]{1,24}$/.test(component) ? component : 'voip',
      code: /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'UNKNOWN' };
    try { this.#config.onDiagnostic?.(safe); } catch {}
    this.#activeCall?._diagnostic(safe);
  };
  #closeRelays = () => {
    try { this.#relay?.closeAll()?.catch?.(() => this.#diagnose({ component: 'relay', code: 'CLOSE_FAILED' })); }
    catch { this.#diagnose({ component: 'relay', code: 'CLOSE_FAILED' }); }
  };
  #assertCurrent = (generation) => {
    if (!this.#sock || this.#generation !== generation) throw new Error('VoIP socket disconnected');
  };

  connectWithSocket = async (sock) => {
    if (!sock?.ws?.on || !sock?.authState?.keys || !sock?.authState?.creds?.me?.id) throw new Error('An authenticated open socket is required');
    if (sock.ws.isOpen === false) throw new Error('The WhatsApp socket is not open');
    if (this.#sock) throw new Error('VoIP client is already connected or connecting');
    if (SOCKET_VOIP_OWNERS.has(sock)) throw new Error('This socket already has a VoIP client');
    this.#sock = sock;
    SOCKET_VOIP_OWNERS.set(sock, this);
    const generation = ++this.#generation;
    this.#onSocketUpdate = (update) => { if (update?.connection === 'close') this.disconnect(); };
    sock.ev?.on?.('connection.update', this.#onSocketUpdate);
    let engine;
    const current = () => this.#generation === generation && this.#sock === sock;
    const diagnose = (event) => { if (current()) this.#diagnose(event); };
    try {
      const relayConfig = {
        onTransportMessage: (data, ip, port) => { if (current()) this.#engine?.handleOnTransportMessage(data, ip, port); },
        onIceRtt: (rttMs, ip, port) => { if (current()) this.#engine?.updateIceRtt(rttMs, ip, port); },
        onDiagnostic: diagnose,
      };
      this.#relay = this.#config._createRelay?.(relayConfig) ?? new RelayRtcTransport(relayConfig);
      await this.#relay.ensureReady?.();
      this.#assertCurrent(generation);
      this.#signaling = this.#config._createSignaling?.({ sock, onDiagnostic: diagnose }) ?? new SignalingBridge({ sock, onDiagnostic: diagnose });
      await this.#signaling.init();
      this.#assertCurrent(generation);
      const engineConfig = {
        resourcesPath: this.#config.resourcesPath,
        workerPoolSize: this.#config.workerPoolSize,
        enableLogs: this.#config.enableLogs ?? false,
        callbacks: {
          onSignalingXmpp: (peerJid, callId, payload) => { if (current()) this.#signaling?.sendSignaling(peerJid, callId, payload); },
          onCallEvent: (type, data) => { if (current()) this.#handleCallEvent(type, data); },
          sendDataToRelay: (data, ip, port) => current() ? (this.#relay?.send(data, ip, port) ?? 0) : 0,
          onAudioCaptureInit: (audio) => { if (current()) this.#handleAudioCaptureInit(audio); },
          onAudioCaptureStart: () => { if (current()) this.#handleAudioCaptureStart(); },
          onAudioCaptureStop: () => { if (current()) this.#handleAudioCaptureStop(); },
          onAudioPlaybackData: (audio) => { if (current()) this.#activeCall?._emitAudio(audio); },
          onDiagnostic: diagnose,
          cryptoHkdf: computeHkdf, hmacSha256: computeHmacSha256,
        },
      };
      engine = this.#config._createEngine?.(engineConfig) ?? new WasmEngine(engineConfig);
      this.#engine = engine;
      await engine.initialize();
      this.#assertCurrent(generation);
      this.#signaling.attachEngine(engine);
      const selfPnJid = sock.authState.creds.me.id;
      const selfLidJid = sock.authState.creds.me.lid;
      engine.initVoipStack(selfPnJid, toBareJid(selfPnJid), selfLidJid);
      await engine.waitForVoipStackReady();
      this.#assertCurrent(generation);
      try { engine.updateNetworkMedium(2, 0); } catch { this.#diagnose({ component: 'wasm', code: 'NETWORK_MEDIUM_FAILED' }); }
      this.#onSocketCall = (node) => this.#signaling?.processIncomingCall(node, this.#engine, this.#activeCall?.callId ?? '');
      this.#onSocketReceipt = (node) => {
        if (isCallReceiptNode(node)) this.#signaling?.processIncomingReceipt(node, this.#engine, this.#activeCall?.callId ?? '');
      };
      sock.ws.on('CB:call', this.#onSocketCall);
      sock.ws.on('CB:receipt', this.#onSocketReceipt);
      this.#connected = true;
      this.#diagnose({ component: 'voip', code: 'READY' });
    } catch (error) {
      if (this.#generation === generation) this.disconnect();
      // Initialization can finish after disconnect; destroy that late engine too.
      else { try { engine?.destroy(); } catch {} }
      throw error;
    }
  };

  call = async (phoneNumber, opts = {}) => {
    if (!this.#connected || !this.#engine || !this.#signaling) throw new Error('Not connected. Call connectWithSocket() first.');
    if (this.#activeCall || this.#callPending) throw new Error('A call is already active or being prepared.');
    const targetNumber = String(phoneNumber ?? '').replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(targetNumber)) throw new TypeError('Phone number must contain 8–15 digits');
    const durationMs = opts.durationMs ?? 120_000;
    const connectTimeoutMs = opts.connectTimeoutMs ?? 45_000;
    const audioSource = opts.audioSource ?? 'silence';
    if (![durationMs, connectTimeoutMs].every((n) => Number.isFinite(n) && n >= 0) || typeof audioSource !== 'string' || !audioSource) {
      throw new TypeError('Invalid call duration, connect timeout, or audio source');
    }
    this.#callPending = true;
    const generation = this.#generation;
    const signaling = this.#signaling, engine = this.#engine, sock = this.#sock;
    const wait = this.#config._delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const check = () => this.#assertCurrent(generation);
    try {
      const targetPnJid = `${targetNumber}@s.whatsapp.net`;
      const peerLid = await signaling.resolveLid(targetPnJid); check();
      if (!peerLid) throw new Error('Could not resolve the recipient LID');
      for (const jid of [targetPnJid, peerLid]) {
        try { await sock.presenceSubscribe(jid); } catch {}
        check();
      }
      await wait(750); check();
      const peerDeviceJids = await signaling.discoverPeerDevices(peerLid); check();
      const deviceList = peerDeviceJids.length ? peerDeviceJids : [toBareJid(peerLid)];
      const allTargets = [...new Set([...deviceList, peerLid, toBareJid(peerLid), targetPnJid, toBareJid(targetPnJid)])];
      await signaling.ensureSessionsForPeers(allTargets); check();
      await wait(500); check();
      await signaling.issueTcToken(peerLid); check();
      const tcToken = await signaling.ensureTcToken(peerLid, targetPnJid); check();
      const callId = ('00' + randomBytes(16).toString('hex').slice(2)).toUpperCase();
      const call = new ActiveCall(callId, engine, durationMs, connectTimeoutMs);
      call._audioSource = audioSource;
      call._endOnAudioEnd = opts.endOnAudioEnd === true;
      this.#activeCall = call;
      call.once('ended', () => {
        if (this.#activeCall !== call) return;
        this.#activeCall = null;
        this.#handleAudioCaptureStop();
        this.#closeRelays();
      });
      try {
        engine.startCall({ peerJid: peerLid, peerPn: targetPnJid, peerList: deviceList, callId,
          isVideo: false, isLidCall: true, isFromDialer: false, extraData: tcToken });
      } catch (error) {
        call._forceEnd('start_failed');
        throw new Error('Could not start the VoIP call', { cause: error });
      }
      return call;
    } finally {
      if (this.#generation === generation) this.#callPending = false;
    }
  };

  getStats = () => ({
    connected: this.#connected,
    callState: this.#activeCall?.state ?? CallState.Idle,
    callActive: !!this.#activeCall,
    relay: this.#relay?.getStats?.() ?? null,
    audio: this.#feeder ? { bytesProduced: this.#feeder.bytesProduced, chunksEmitted: this.#feeder.chunksEmitted,
      underflowChunks: this.#feeder.underflowChunks, droppedChunks: this.#feeder.droppedChunks } : null,
  });

  disconnect = () => {
    const sock = this.#sock;
    this.#generation++;
    this.#connected = false;
    this.#callPending = false;
    if (sock && SOCKET_VOIP_OWNERS.get(sock) === this) SOCKET_VOIP_OWNERS.delete(sock);
    if (this.#onSocketCall) sock?.ws?.off?.('CB:call', this.#onSocketCall);
    if (this.#onSocketReceipt) sock?.ws?.off?.('CB:receipt', this.#onSocketReceipt);
    if (this.#onSocketUpdate) sock?.ev?.off?.('connection.update', this.#onSocketUpdate);
    this.#onSocketCall = this.#onSocketReceipt = this.#onSocketUpdate = null;
    const call = this.#activeCall;
    call?._forceEnd('disconnect');
    this.#activeCall = null;
    this.#handleAudioCaptureStop();
    if (!call) this.#closeRelays();
    try { this.#engine?.destroy(); } catch {}
    try { this.#signaling?.destroy?.(); } catch {}
    this.#engine = this.#relay = this.#signaling = this.#sock = null;
  };

  #handleCallEvent = (eventType, eventData) => {
    if (eventType === 16 && eventData) {
      try {
        const parsed = JSON.parse(eventData);
        const info = parsed.call_info ?? parsed.callInfo ?? {};
        const id = info.call_id ?? info.callId;
        if (id && this.#activeCall && id !== this.#activeCall.callId) return;
        const state = Number(info.call_state ?? info.callState);
        if (Number.isInteger(state)) {
          const call = this.#activeCall;
          const previous = call?.state;
          call?._updateState(state);
          // WA may start capture while ringing or in AcceptReceived. Feed only
          // silence until media is Active so a song does not finish before it
          // can be heard; start the real source once, at the transition.
          if (state === CallState.Active && previous !== state && this.#activeCall === call && this.#capturePtr && this.#feeder) {
            this.#handleAudioCaptureStart();
          }
        }
      } catch { this.#diagnose({ component: 'wasm', code: 'INVALID_STATE_EVENT' }); }
    } else if (eventType === 156 && eventData) {
      try { this.#relay?.updateRelayList(JSON.parse(eventData)); }
      catch { this.#diagnose({ component: 'relay', code: 'INVALID_RELAY_LIST' }); }
    } else if (eventType === 2) this.#activeCall?._forceEnd('remote_end');
  };
  #handleAudioCaptureInit = (config) => {
    if (!this.#engine) return;
    this.#handleAudioCaptureStop();
    const sampleRate = config?.sampleRate || 16000, channels = config?.channels || 1, frames = config?.framesPerChunk || 320;
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 ||
        !Number.isInteger(channels) || channels < 1 || channels > 2 || !Number.isInteger(frames) || frames < 1 || frames > 16384) {
      this.#diagnose({ component: 'audio', code: 'INVALID_CAPTURE_CONFIG' });
      this.#activeCall?.end('audio_error');
      return;
    }
    this.#captureSampleRate = sampleRate; this.#captureChannels = channels; this.#captureFramesPerChunk = frames;
    try { this.#capturePtr = this.#engine.malloc(frames * channels * Float32Array.BYTES_PER_ELEMENT); }
    catch { this.#capturePtr = 0; }
    if (!this.#capturePtr) {
      this.#diagnose({ component: 'audio', code: 'CAPTURE_ALLOCATION_FAILED' });
      this.#activeCall?.end('audio_error');
    }
  };
  #handleAudioCaptureStart = () => {
    if (!this.#engine || !this.#capturePtr) return;
    try { this.#feeder?.stop(); } catch {}
    const call = this.#activeCall;
    const usingCallSource = call?.state === CallState.Active;
    const source = usingCallSource ? call._audioSource : 'silence';
    const makeFeeder = this.#config._createAudioFeeder ?? ((...args) => new AudioFeeder(...args));
    let feeder;
    try {
    feeder = makeFeeder(this.#captureSampleRate, this.#captureChannels, this.#captureFramesPerChunk,
      (chunk) => { if (this.#feeder === feeder && this.#engine && this.#capturePtr) this.#engine.sendAudioData(chunk, this.#capturePtr); },
      source, {
        ffmpegPath: this.#config.ffmpegPath,
        onError: (error) => {
          if (this.#feeder !== feeder) return;
          this.#diagnose({ component: 'audio', code: error.code || 'FFMPEG_FAILED' });
          if (this.#activeCall === call) call?.end('audio_error');
        },
        onFinished: () => {
          if (this.#feeder !== feeder) return;
          if (!usingCallSource) return;
          this.#diagnose({ component: 'audio', code: 'SOURCE_FINISHED' });
          if (this.#activeCall === call && call?._endOnAudioEnd) call.end('audio_finished');
        },
      });
    this.#feeder = feeder;
    feeder.start();
    } catch {
      try { feeder?.stop(); } catch {}
      this.#feeder = null;
      this.#diagnose({ component: 'audio', code: 'FEEDER_START_FAILED' });
      if (this.#activeCall === call) call?.end('audio_error');
    }
  };
  #handleAudioCaptureStop = () => {
    try { this.#feeder?.stop(); } catch {}
    this.#feeder = null;
    if (this.#engine && this.#capturePtr) { try { this.#engine.free(this.#capturePtr); } catch {} }
    this.#capturePtr = 0;
  };
}

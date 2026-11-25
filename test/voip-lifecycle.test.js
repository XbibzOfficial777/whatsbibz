import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { ActiveCall, VoipClient, CallState } from '../lib/VoIP/index.js';
import { NodeWorkerMessagePort, WasmEngine } from '../lib/VoIP/wasm-engine.js';
import { SignalingBridge } from '../lib/VoIP/signaling.js';
import { AudioFeeder } from '../lib/VoIP/audio-feeder.js';
import { spawnSync } from 'node:child_process';

function setup(overrides = {}) {
  const ws = new EventEmitter(); ws.isOpen = true;
  const sock = { ws, ev: new EventEmitter(), authState: { creds: { me: { id: '6281111111111@s.whatsapp.net', lid: '123456789@lid' } }, keys: { async set() {}, async get() { return {}; } } }, async presenceSubscribe() {} };
  const diagnostics = [], state = { calls: [], stopped: 0, freed: [], sent: [], closed: 0, destroyed: 0, signalDestroyed: 0 };
  const signal = {
    async init() {}, attachEngine() {}, destroy() { state.signalDestroyed++; },
    async resolveLid() { return '987654321@lid'; }, async discoverPeerDevices() { return ['987654321:1@lid']; },
    async ensureSessionsForPeers() {}, async issueTcToken() {}, async ensureTcToken() { return Buffer.from([1]); },
    processIncomingCall() { state.incoming = (state.incoming || 0) + 1; }, processIncomingReceipt() {}, sendSignaling() {},
    ...overrides.signal,
  };
  const relay = { async ensureReady() {}, async closeAll() { state.closed++; }, getStats() { return { sentPackets: 0, receivedPackets: 0 }; }, send() { return 1; }, updateRelayList() {}, ...overrides.relay };
  let callbacks, feederOptions;
  const engine = {
    async initialize() {}, initVoipStack() {}, async waitForVoipStackReady() {}, updateNetworkMedium() {},
    startCall(opts) { state.calls.push(opts); if (overrides.startError) throw new Error('private engine error'); },
    endCall() { state.ended = (state.ended || 0) + 1; }, setMute() {}, destroy() { state.destroyed++; },
    malloc() { return 16; }, free(ptr) { state.freed.push(ptr); }, sendAudioData(chunk, ptr) { state.sent.push([chunk, ptr]); },
    handleOnTransportMessage() {}, updateIceRtt() {}, ...overrides.engine,
  };
  const client = new VoipClient({
    onDiagnostic: (d) => diagnostics.push(d),
    _delay: async () => {}, _createRelay: () => relay, _createSignaling: () => signal,
    _createEngine: (cfg) => { callbacks = cfg.callbacks; return engine; },
    _createAudioFeeder: (_rate, _channels, _frames, onChunk, source, opts) => {
      feederOptions = opts; state.source = source; (state.sources ??= []).push(source);
      if (overrides.realFeeder) return new AudioFeeder(_rate, _channels, _frames, onChunk, source, opts);
      return { start() { onChunk(new Float32Array([0.25])); }, stop() { state.stopped++; }, bytesProduced: 4, chunksEmitted: 1, underflowChunks: 0, droppedChunks: 0 };
    },
  });
  return { client, sock, state, engine, signal, diagnostics, get callbacks() { return callbacks; }, get feederOptions() { return feederOptions; } };
}

test('ActiveCall end resolves waitForEnd and emits once, even when a listener throws', async () => {
  let ended = 0, engineEnds = 0;
  const call = new ActiveCall('call-id', { endCall() { engineEnds++; }, setMute() {} }, 0, 0);
  call.on('ended', () => { ended++; throw new Error('application handler'); });
  call.end(); call.end(); call._forceEnd('later');
  assert.equal(await call.waitForEnd(), 'hangup');
  assert.equal(engineEnds, 1);
  assert.equal(ended, 1);
  assert.equal(call.ended, true);
});

test('duration and connecting timeouts settle rather than hanging indefinitely', async () => {
  const engine = { endCall() {}, setMute() {} };
  const duration = new ActiveCall('a', engine, 15, 0);
  assert.equal(await duration.waitForEnd(), 'timeout');
  const connecting = new ActiveCall('b', engine, 0, 15);
  assert.equal(await connecting.waitForEnd(), 'connection_timeout');
  const connected = new ActiveCall('c', engine, 0, 30);
  connected._updateState(CallState.Active);
  await delay(55);
  assert.equal(connected.ended, false);
  connected.end();
  assert.equal(await connected.waitForEnd(), 'hangup');
});

test('state events are deduplicated and ignored after end', () => {
  const call = new ActiveCall('id', { endCall() {}, setMute() {} }, 0, 0);
  let rings = 0, connections = 0;
  call.on('ringing', () => rings++); call.on('connected', () => connections++);
  call._updateState(CallState.PreacceptReceived); call._updateState(CallState.PreacceptReceived);
  call._updateState(CallState.Active); call._updateState(CallState.Active);
  call._forceEnd('remote_end'); call._updateState(CallState.Active);
  assert.equal(rings, 1); assert.equal(connections, 1);
});

test('multiple calls work sequentially; listeners, capture resources and socket ownership are cleaned up', async () => {
  const f = setup(); await f.client.connectWithSocket(f.sock);
  assert.equal(f.sock.ws.listenerCount('CB:call'), 1);
  await assert.rejects(new VoipClient().connectWithSocket(f.sock), /already has a VoIP client/);
  const call = await f.client.call('15555550123', { audioSource: '/tmp/authorized.mp3', connectTimeoutMs: 0 });
  f.callbacks.onCallEvent(16, JSON.stringify({ call_info: { call_state: CallState.Active, call_id: call.callId } }));
  assert.equal(call.state, CallState.Active);
  f.callbacks.onAudioCaptureInit({ sampleRate: 16000, channels: 1, framesPerChunk: 320 });
  f.callbacks.onAudioCaptureStart();
  assert.equal(f.state.source, '/tmp/authorized.mp3');
  assert.equal(f.state.sent.length, 1);
  assert.equal(f.client.getStats().audio.bytesProduced, 4);
  call.end();
  assert.equal(await call.waitForEnd(), 'hangup');
  assert.deepEqual(f.state.freed, [16]);
  assert.equal(f.state.stopped, 1);
  assert.equal(f.client.getStats().callActive, false);
  const second = await f.client.call('15555550123', { connectTimeoutMs: 0 });
  assert.equal(f.state.calls.length, 2);
  f.sock.ev.emit('connection.update', { connection: 'close' });
  assert.equal(await second.waitForEnd(), 'disconnect');
  assert.equal(f.state.destroyed, 1);
  assert.equal(f.state.signalDestroyed, 1);
  assert.equal(f.sock.ws.listenerCount('CB:call'), 0);
  assert.equal(f.sock.ws.listenerCount('CB:receipt'), 0);
  assert.equal(f.sock.ev.listenerCount('connection.update'), 0);
  f.client.disconnect();
});

test('simultaneous dial attempts are serialized and disconnect cancels in-flight preparation', async () => {
  let release; const barrier = new Promise((r) => { release = r; });
  const f = setup({ signal: { resolveLid: () => barrier } });
  await f.client.connectWithSocket(f.sock);
  const pending = f.client.call('15555550123');
  await assert.rejects(f.client.call('15555550123'), /already active or being prepared/);
  f.client.disconnect(); release('987654321@lid');
  await assert.rejects(pending, /disconnected/);
  assert.equal(f.state.calls.length, 0);
});

test('start failure clears active call and subsequent attempts are possible', async () => {
  const f = setup({ startError: true }); await f.client.connectWithSocket(f.sock);
  await assert.rejects(f.client.call('15555550123'), /Could not start/);
  assert.equal(f.client.getStats().callActive, false);
  await assert.rejects(f.client.call('15555550123'), /Could not start/);
  assert.equal(f.state.calls.length, 2);
  f.client.disconnect();
});

test('audio failures and completion are surfaced without private URLs', async () => {
  const f = setup(); await f.client.connectWithSocket(f.sock);
  const call = await f.client.call('15555550123', { audioSource: '/private/secret.mp3', connectTimeoutMs: 0 });
  f.callbacks.onAudioCaptureInit({ sampleRate: 16000, channels: 1, framesPerChunk: 320 }); f.callbacks.onAudioCaptureStart();
  f.feederOptions.onError({ code: 'FFMPEG_FAILED' });
  assert.equal(await call.waitForEnd(), 'audio_error');
  assert.ok(f.diagnostics.some((e) => e.code === 'FFMPEG_FAILED'));
  assert.ok(!JSON.stringify(f.diagnostics).includes('secret'));
  f.client.disconnect();
});

test('stale engine callbacks are ignored after disconnect or reconnect', async () => {
  const f = setup(); await f.client.connectWithSocket(f.sock);
  const oldCallbacks = f.callbacks; f.client.disconnect();
  await f.client.connectWithSocket(f.sock);
  const call = await f.client.call('15555550123', { connectTimeoutMs: 0 });
  oldCallbacks.onCallEvent(2, '');
  assert.equal(call.ended, false);
  f.client.disconnect();
});

test('worker callbacks are scoped to their owning engine rather than broadcast between ports', () => {
  const a = new EventEmitter(), b = new EventEmitter(); a.postMessage = b.postMessage = () => {};
  const eventsA = [], eventsB = [];
  new NodeWorkerMessagePort(a, 'a', (name, data) => eventsA.push([name, data]));
  new NodeWorkerMessagePort(b, 'b', (name, data) => eventsB.push([name, data]));
  a.emit('message', { type: 'callback', name: 'onCallEvent', args: { eventType: 16 } });
  b.emit('message', { type: 'callback', name: 'onCallEvent', args: { eventType: 2 } });
  assert.deepEqual(eventsA, [['onCallEvent', { eventType: 16 }]]);
  assert.deepEqual(eventsB, [['onCallEvent', { eventType: 2 }]]);
});

test('signaling restores original auth key setter and reports asynchronous errors safely', { timeout: 4_000 }, async () => {
  const writes = [], events = [];
  const original = async (v) => { writes.push(v); };
  const keys = { set: original, async get() { return {}; } };
  let notify;
  const diagnostic = new Promise((resolve) => { notify = resolve; });
  const bridge = new SignalingBridge({ sock: { authState: { keys } }, onDiagnostic: (d) => { events.push(d); notify(d); } });
  try {
    await bridge.init();
    assert.notEqual(keys.set, original);
    await keys.set({ tctoken: { '123@lid': { token: Buffer.from([1]) } } });
    assert.equal(writes.length, 1);
    bridge.sendSignaling('x', 'x', 'not-valid-binary');
    assert.equal((await diagnostic).code, 'OUTGOING_SIGNALING_FAILED');
  } finally { bridge.destroy(); bridge.destroy(); }
  assert.equal(keys.set, original);
});

test('finite audio does not start or end the call during ringing/connecting', async () => {
  const f = setup(); await f.client.connectWithSocket(f.sock);
  const call = await f.client.call('15555550123', { audioSource: '/owned-song.ogg', connectTimeoutMs: 0, endOnAudioEnd: true });
  f.callbacks.onCallEvent(16, JSON.stringify({ call_info: { call_state: CallState.Calling } }));
  f.callbacks.onAudioCaptureInit({ sampleRate: 16000, channels: 1, framesPerChunk: 320 });
  f.callbacks.onAudioCaptureStart();
  assert.deepEqual(f.state.sources, ['silence']);
  f.feederOptions.onFinished();
  assert.equal(call.ended, false, 'pre-connection silence must not end the call');
  f.callbacks.onCallEvent(16, JSON.stringify({ call_info: { call_state: CallState.AcceptReceived } }));
  assert.deepEqual(f.state.sources, ['silence']);
  f.callbacks.onCallEvent(16, JSON.stringify({ call_info: { call_state: CallState.Active } }));
  assert.deepEqual(f.state.sources, ['silence', '/owned-song.ogg']);
  f.callbacks.onCallEvent(16, JSON.stringify({ call_info: { call_state: CallState.Active } }));
  assert.equal(f.state.sources.length, 2, 'duplicate Active events must not restart the song');
  f.feederOptions.onFinished();
  assert.equal(await call.waitForEnd(), 'audio_finished');
  f.client.disconnect();
});

test('a throwing prepended user listener cannot prevent call cleanup or later listeners', async () => {
  const f = setup(); await f.client.connectWithSocket(f.sock);
  const call = await f.client.call('15555550123', { connectTimeoutMs: 0 });
  let otherListener = 0;
  call.prependListener('ended', () => { throw new Error('application error'); });
  call.on('ended', () => otherListener++);
  f.callbacks.onAudioCaptureInit({ sampleRate: 16000, channels: 1, framesPerChunk: 320 });
  f.callbacks.onAudioCaptureStart();
  call.end();
  assert.equal(await call.waitForEnd(), 'hangup');
  assert.equal(f.client.getStats().callActive, false);
  assert.deepEqual(f.state.freed, [16]);
  assert.equal(otherListener, 1);
  f.client.disconnect();
});

test('an explicit end reason survives a synchronous end event from the engine', async () => {
  let call;
  const engine = { endCall() { call._forceEnd('remote_end'); }, setMute() {} };
  call = new ActiveCall('synthetic', engine, 0, 0);
  call.end('audio_finished');
  assert.equal(await call.waitForEnd(), 'audio_finished');
});

const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', timeout: 5000 }).status === 0;
test('real FFmpeg feeds silence before Active, then plays the entire finite source once',
  { skip: ffmpegAvailable ? false : 'requires FFmpeg', timeout: 7_000 }, async () => {
    const f = setup({ realFeeder: true }); await f.client.connectWithSocket(f.sock);
    try {
      const call = await f.client.call('15555550123', {
        audioSource: 'lavfi:sine=frequency=880:sample_rate=16000:duration=0.16',
        durationMs: 0, connectTimeoutMs: 0, endOnAudioEnd: true,
      });
      f.callbacks.onAudioCaptureInit({ sampleRate: 16000, channels: 1, framesPerChunk: 320 });
      f.callbacks.onAudioCaptureStart();
      await delay(700); // longer than the actual source, before acceptance
      assert.deepEqual(f.state.sources, ['silence']);
      assert.equal(call.ended, false);
      assert.ok(f.state.sent.length > 0, 'the stack receives silent capture frames');
      assert.ok(f.state.sent.every(([pcm]) => pcm.every((v) => v === 0)));
      f.callbacks.onCallEvent(16, JSON.stringify({ call_info: { call_state: CallState.Active } }));
      assert.deepEqual(f.state.sources, ['silence', 'lavfi:sine=frequency=880:sample_rate=16000:duration=0.16']);
      assert.equal(await call.waitForEnd(), 'audio_finished');
      const audible = f.state.sent.filter(([pcm]) => pcm.some((v) => Math.abs(v) > 0.01));
      assert.equal(audible.length, 8, 'all 160 ms of decoded audio are emitted');
      assert.deepEqual(f.state.freed, [16]);
    } finally { f.client.disconnect(); }
  });

test('connection timeout stops capture and never starts the finite source',
  { skip: ffmpegAvailable ? false : 'requires FFmpeg', timeout: 5_000 }, async () => {
    const f = setup({ realFeeder: true }); await f.client.connectWithSocket(f.sock);
    try {
      const call = await f.client.call('15555550123', {
        audioSource: 'lavfi:sine=frequency=880:duration=0.16',
        durationMs: 0, connectTimeoutMs: 200, endOnAudioEnd: true,
      });
      f.callbacks.onAudioCaptureInit({ sampleRate: 16000, channels: 1, framesPerChunk: 320 });
      f.callbacks.onAudioCaptureStart();
      assert.equal(await call.waitForEnd(), 'connection_timeout');
      assert.deepEqual(f.state.sources, ['silence']);
      assert.deepEqual(f.state.freed, [16]);
      const sentAtEnd = f.state.sent.length;
      await delay(100);
      assert.equal(f.state.sent.length, sentAtEnd, 'no stale feeder sends after cleanup');
    } finally { f.client.disconnect(); }
  });

test('WASM worker pool bounds are validated before allocating resources', () => {
  for (const size of [0, 3, 21, 1.5, '8']) assert.throws(() => new WasmEngine({ workerPoolSize: size }), /workerPoolSize/);
  assert.doesNotThrow(() => new WasmEngine({ workerPoolSize: 4 }));
  assert.doesNotThrow(() => new WasmEngine({ workerPoolSize: 20 }));
});

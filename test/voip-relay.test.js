import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { RelayRtcTransport } from '../lib/VoIP/relay-transport.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const sdp = 'v=0\r\na=ice-ufrag:old\r\na=ice-pwd:oldpassword\r\na=fingerprint:sha-256 AA\r\na=setup:actpass\r\na=max-message-size:65536\r\n';
const relayList = (token = 'secret-a') => ({
  relay_key: 'secret-key', relay_tokens: [token],
  relays: [{ relay_id: 1, relay_name: 'one', token_id: 0,
    addresses: [{ protocol: 0, ipv4: '192.0.2.10', port: 3478 }] }],
});
function fakeRtc() {
  const peers = [];
  class RTCPeerConnection {
    constructor() { this.iceConnectionState = 'new'; peers.push(this); }
    createDataChannel(label, options) {
      this.label = label; this.options = options;
      return this.dc = { readyState: 'connecting', sent: [],
        send(buffer) { this.sent.push(Buffer.from(buffer)); },
        open() { this.readyState = 'open'; this.onopen?.(); },
        close() { this.readyState = 'closed'; this.onclose?.(); } };
    }
    async createOffer() { return { type: 'offer', sdp }; }
    async setLocalDescription(offer) { this.local = offer; }
    async setRemoteDescription(answer) { this.remote = answer; }
    async getStats() { return new Map([['x', { type: 'candidate-pair', selected: true, currentRoundTripTime: 0.045 }]]); }
    close() { this.closed = true; }
  }
  return { peers, module: { RTCPeerConnection } };
}

test('same-IP early packets survive 3478→3480 translation, one connect, and RTT reaches WASM port', async () => {
  const rtc = fakeRtc(), received = [], rtts = [], diagnostics = [];
  let resolveLoad;
  const load = new Promise((r) => { resolveLoad = r; });
  const relay = new RelayRtcTransport({ loadWrtc: () => load,
    onTransportMessage: (data, ip, port) => received.push([Buffer.from(data), ip, port]),
    onIceRtt: (...args) => rtts.push(args), onDiagnostic: (d) => diagnostics.push(d) });
  const packet = Buffer.from([1, 2, 3, 4]);
  assert.equal(relay.send(packet, '192.0.2.10', 3478), 4);
  relay.updateRelayList(relayList());
  relay.send(Buffer.from([5]), '192.0.2.10', 3478);
  relay.send(Buffer.from([6]), '192.0.2.10', 3480);
  assert.equal(relay.getStats().connectionAttempts, 1);
  assert.equal(relay.getStats().bufferedPackets, 3);
  resolveLoad(rtc.module); await tick(); await tick();
  assert.equal(rtc.peers.length, 1, 'parallel sends did not create duplicate PCs');
  const pc = rtc.peers[0];
  assert.ok(pc.remote.sdp.includes('192.0.2.10 3480 typ host'));
  pc.dc.open(); await tick();
  assert.deepEqual(pc.dc.sent.map((b) => [...b]), [[1, 2, 3, 4], [5], [6]]);
  assert.deepEqual(rtts, [[45, '192.0.2.10', 3478]]);
  pc.dc.onmessage({ data: Uint8Array.from([9, 8]).buffer });
  assert.deepEqual(received, [[Buffer.from([9, 8]), '192.0.2.10', 3478]]);
  assert.equal(relay.getStats().openConnections, 1);
  assert.equal(relay.getStats().sentPackets, 3);
  assert.equal(relay.getStats().receivedPackets, 1);
  assert.ok(diagnostics.every((d) => !JSON.stringify(d).includes('secret')));
  await relay.closeAll();
  assert.ok(pc.closed);
  assert.equal(relay.getStats().relayCandidates, 0);
});

test('packets are never round-robin routed to a different authenticated relay IP', async () => {
  const rtc = fakeRtc();
  const relay = new RelayRtcTransport({ loadWrtc: async () => rtc.module, onTransportMessage() {} });
  const update = relayList();
  update.relays.push({ relay_id: 2, relay_name: 'two', token_id: 0,
    addresses: [{ protocol: 0, ipv4: '192.0.2.11', port: 3478 }] });
  relay.updateRelayList(update);
  relay.send(Buffer.from([10]), '192.0.2.10', 3478);
  relay.send(Buffer.from([11]), '192.0.2.11', 3478);
  relay.send(Buffer.from([99]), '192.0.2.99', 3478);
  await tick(); await tick();
  assert.equal(rtc.peers.length, 2);
  for (const pc of rtc.peers) pc.dc.open();
  const first = rtc.peers.find((pc) => pc.remote.sdp.includes('192.0.2.10'));
  const second = rtc.peers.find((pc) => pc.remote.sdp.includes('192.0.2.11'));
  assert.deepEqual(first.dc.sent.map((p) => [...p]), [[10]]);
  assert.deepEqual(second.dc.sent.map((p) => [...p]), [[11]]);
  assert.equal(relay.getStats().bufferedPackets, 1, 'unknown IP was not misrouted');
  await relay.closeAll();
});

test('load failures are contained, retried with backoff, and do not leak tokens', async () => {
  const rtc = fakeRtc(), diagnostic = [];
  let calls = 0;
  const relay = new RelayRtcTransport({ onTransportMessage() {}, onDiagnostic: (d) => diagnostic.push(d),
    loadWrtc: async () => { if (++calls === 1) throw new Error('secret token'); return rtc.module; } });
  relay.updateRelayList(relayList());
  await delay(350); await tick();
  assert.equal(calls, 2);
  assert.equal(relay.getStats().connectionFailures, 1);
  assert.equal(rtc.peers.length, 1);
  rtc.peers[0].dc.open();
  assert.equal(relay.getStats().openConnections, 1);
  assert.deepEqual(diagnostic.map((d) => d.code), ['CONNECT_FAILED', 'CHANNEL_OPEN']);
  assert.ok(!JSON.stringify(diagnostic).includes('secret'));
  await relay.closeAll();
});

test('closing while native loading is pending prevents late peer creation', async () => {
  const rtc = fakeRtc(); let resolveLoad;
  const load = new Promise((r) => { resolveLoad = r; });
  const relay = new RelayRtcTransport({ loadWrtc: () => load, onTransportMessage() {} });
  relay.updateRelayList(relayList());
  await relay.closeAll();
  resolveLoad(rtc.module); await tick(); await tick();
  assert.equal(rtc.peers.length, 0);
  assert.equal(relay.getStats().openConnections, 0);
});

test('new server credentials recreate only the matching connection', async () => {
  const rtc = fakeRtc();
  const relay = new RelayRtcTransport({ loadWrtc: async () => rtc.module, onTransportMessage() {} });
  relay.updateRelayList(relayList('first')); await tick(); await tick();
  const first = rtc.peers[0]; first.dc.open();
  relay.updateRelayList(relayList('second')); await tick(); await tick();
  assert.equal(rtc.peers.length, 2);
  assert.ok(first.closed);
  assert.ok(rtc.peers[1].remote.sdp.includes('a=ice-ufrag:second'));
  await relay.closeAll();
});

test('oversized or discarded packets are reflected in aggregate stats', async () => {
  const relay = new RelayRtcTransport({ onTransportMessage() {} });
  assert.equal(relay.send(Buffer.alloc(256 * 1024 + 1), '192.0.2.10', 3478), 0);
  assert.equal(relay.send(Buffer.from([1]), '192.0.2.99', 3478), 1);
  assert.equal(relay.getStats().droppedPackets, 1);
  await relay.closeAll();
  assert.equal(relay.getStats().droppedPackets, 2);
});

test('missing native module fails readiness with an actionable error', async () => {
  const relay = new RelayRtcTransport({ loadWrtc: async () => { throw new Error('private detail'); }, onTransportMessage() {} });
  await assert.rejects(relay.ensureReady(), /requires a working @roamhq\/wrtc/);
});

test('ICE failure retries the advertised port on the same IP with the same credentials', async () => {
  const rtc = fakeRtc(), diagnostic = [];
  const relay = new RelayRtcTransport({ loadWrtc: async () => rtc.module, onTransportMessage() {}, onDiagnostic: (d) => diagnostic.push(d) });
  relay.updateRelayList(relayList('same-token'));
  relay.send(Buffer.from([3, 4]), '192.0.2.10', 3478);
  await tick(); await tick();
  const first = rtc.peers[0];
  assert.ok(first.remote.sdp.includes('192.0.2.10 3480 typ host'));
  first.iceConnectionState = 'failed'; first.oniceconnectionstatechange();
  await delay(350); await tick();
  assert.equal(rtc.peers.length, 2);
  const fallback = rtc.peers[1];
  assert.ok(fallback.remote.sdp.includes('192.0.2.10 3478 typ host'));
  assert.ok(fallback.remote.sdp.includes('a=ice-ufrag:same-token'));
  fallback.dc.open();
  assert.deepEqual(fallback.dc.sent.map((b) => [...b]), [[3, 4]]);
  assert.ok(diagnostic.some((d) => d.code === 'TRY_ALTERNATE_SAME_RELAY_PORT'));
  await relay.closeAll();
});

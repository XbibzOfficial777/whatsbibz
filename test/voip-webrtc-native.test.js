// Native WebRTC loopback: verifies the optional binary and UDP data channels,
// but deliberately makes no WhatsApp connection or real call.
import test from 'node:test';
import assert from 'node:assert/strict';

let wrtc;
try { const imported = await import('@roamhq/wrtc'); wrtc = imported.default ?? imported; } catch {}

test('native WebRTC is present when explicitly required', () => {
  if (process.env.REQUIRE_WRTC === '1') assert.equal(typeof wrtc?.RTCPeerConnection, 'function', 'install @roamhq/wrtc for this platform');
});

test('native WebRTC negotiated data channel carries real binary over local ICE', { skip: wrtc ? false : 'optional @roamhq/wrtc not installed', timeout: 15_000 }, async () => {
  const { RTCPeerConnection } = wrtc;
  const a = new RTCPeerConnection({ iceServers: [] });
  const b = new RTCPeerConnection({ iceServers: [] });
  const pendingA = [], pendingB = [];
  let readyA = false, readyB = false;
  a.onicecandidate = ({ candidate }) => { if (candidate) { if (readyB) void b.addIceCandidate(candidate).catch(() => {}); else pendingB.push(candidate); } };
  b.onicecandidate = ({ candidate }) => { if (candidate) { if (readyA) void a.addIceCandidate(candidate).catch(() => {}); else pendingA.push(candidate); } };
  const da = a.createDataChannel('test', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
  const db = b.createDataChannel('test', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
  const opened = (channel) => new Promise((resolve, reject) => {
    if (channel.readyState === 'open') return resolve();
    channel.onopen = resolve; channel.onerror = () => reject(new Error('data channel error'));
  });
  const bothOpen = Promise.all([opened(da), opened(db)]);
  const received = new Promise((resolve) => { db.binaryType = 'arraybuffer'; db.onmessage = (event) => resolve(Buffer.from(event.data)); });
  try {
    const offer = await a.createOffer(); await a.setLocalDescription(offer); await b.setRemoteDescription(offer); readyB = true;
    for (const candidate of pendingB.splice(0)) await b.addIceCandidate(candidate);
    const answer = await b.createAnswer(); await b.setLocalDescription(answer); await a.setRemoteDescription(answer); readyA = true;
    for (const candidate of pendingA.splice(0)) await a.addIceCandidate(candidate);
    await bothOpen;
    da.send(Uint8Array.from([0, 1, 2, 254, 255]).buffer);
    assert.deepEqual(await received, Buffer.from([0, 1, 2, 254, 255]));
  } finally {
    da.close(); db.close(); a.close(); b.close();
  }
});

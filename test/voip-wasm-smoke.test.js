// Heavy opt-in smoke test: load real bundled WASM and its worker pools with
// synthetic IDs only. No socket, authentication, signaling or real call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const required = process.env.REQUIRE_VOIP_WASM === '1';
test('real WASM can initialize and destroy both worker pools without keeping Node alive', { skip: required ? false : 'set REQUIRE_VOIP_WASM=1' }, () => {
  const code = `
    import assert from 'node:assert/strict';
    import { WasmEngine } from './lib/VoIP/wasm-engine.js';
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const sentinelA = {}, sentinelB = {};
    globalThis.WhatsAppVoipWasmCallbacks = sentinelA;
    globalThis.WhatsAppVoipWasmWorkerCompatibleCallbacks = sentinelB;
    for (let n = 0; n < 2; n++) {
      const engine = new WasmEngine({ enableLogs: false, callbacks: { onCallEvent() {}, onSignalingXmpp() {}, sendDataToRelay() { return 0; } } });
      try {
        await engine.initialize();
        assert.equal(engine.isInitialized(), true);
        assert.equal(globalThis.WhatsAppVoipWasmCallbacks, sentinelA);
        assert.equal(globalThis.WhatsAppVoipWasmWorkerCompatibleCallbacks, sentinelB);
        engine.initVoipStack('12345678901:1@s.whatsapp.net', '12345678901@s.whatsapp.net', '12345678901@lid');
      } finally { engine.destroy(); }
      assert.equal(engine.isInitialized(), false);
      await sleep(700);
    }
    console.log('WASM_WORKER_POOLS_CLEANED');
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), encoding: 'utf8', timeout: 90_000 });
  assert.equal(child.error, undefined, `child timed out or failed: ${child.error?.message}`);
  assert.equal(child.status, 0, `WASM smoke failed: ${child.stderr?.slice(-2000)}`);
  assert.match(child.stdout, /WASM_WORKER_POOLS_CLEANED/);
});

test('cancelling a real WASM initialization leaves no worker pool alive', { skip: required ? false : 'set REQUIRE_VOIP_WASM=1' }, () => {
  const code = `
    import assert from 'node:assert/strict';
    import { WasmEngine } from './lib/VoIP/wasm-engine.js';
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const engine = new WasmEngine({ workerPoolSize: 4, enableLogs: false });
    const pending = engine.initialize();
    await sleep(100);
    assert.equal(engine.isInitialized(), false);
    engine.destroy();
    await assert.rejects(pending, /cancelled|worker exited|worker failed/);
    assert.equal(engine.isInitialized(), false);
    await sleep(400);
    console.log('WASM_INIT_CANCELLED');
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), encoding: 'utf8', timeout: 12_000 });
  assert.equal(child.error, undefined, `cancelled child timed out: ${child.error?.message}`);
  assert.equal(child.status, 0, `WASM cancellation failed: ${child.stderr?.slice(-2000)}`);
  assert.match(child.stdout, /WASM_INIT_CANCELLED/);
});

test('two real WASM instances isolate callbacks and survive independent destruction', { skip: required ? false : 'set REQUIRE_VOIP_WASM=1', timeout: 90_000 }, () => {
  const code = `
    import assert from 'node:assert/strict';
    import { WasmEngine } from './lib/VoIP/wasm-engine.js';
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const event = () => {
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      return { promise, resolve };
    };
    const wait = async (promise, ms) => {
      let timer;
      try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('synthetic signal timeout')), ms); })]); }
      finally { clearTimeout(timer); }
    };
    const seen = [0, 0], signals = [event(), event()];
    const make = (n) => new WasmEngine({ workerPoolSize: 8, enableLogs: false,
      callbacks: { onCallEvent() {}, onSignalingXmpp() { seen[n]++; signals[n].resolve(); }, sendDataToRelay() { return 0; } } });
    const a = make(0), b = make(1);
    const call = async (engine, n) => {
      engine.initVoipStack('12345678901:1@s.whatsapp.net', '12345678901@s.whatsapp.net', '12345678901@lid');
      await engine.waitForVoipStackReady();
      engine.startCall({ peerJid: '987654321@lid', peerPn: '12345678902@s.whatsapp.net', peerList: ['987654321:1@lid'],
        callId: n ? '00ABCDEF0123456789ABCDEF01234568' : '00ABCDEF0123456789ABCDEF01234567', isVideo: false, isLidCall: true });
      await wait(signals[n].promise, 8_000);
    };
    try {
      await Promise.all([a.initialize(), b.initialize()]);
      assert.ok(a.isInitialized() && b.isInitialized());
      await call(a, 0);
      assert.ok(seen[0] > 0);
      assert.equal(seen[1], 0, 'first engine must not broadcast into second engine');
      a.destroy();
      await sleep(500);
      const firstCount = seen[0];
      assert.equal(a.isInitialized(), false);
      assert.equal(b.isInitialized(), true);
      await call(b, 1);
      assert.ok(seen[1] > 0);
      assert.equal(seen[0], firstCount, 'destroyed engine must not receive callbacks from second engine');
    } finally { a.destroy(); b.destroy(); }
    console.log('WASM_INSTANCES_ISOLATED');
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), encoding: 'utf8', timeout: 80_000 });
  assert.equal(child.error, undefined, `multi-instance child timed out: ${child.error?.message}`);
  assert.equal(child.status, 0, `multi-instance WASM failed: ${child.stderr?.slice(-3000)}`);
  assert.match(child.stdout, /WASM_INSTANCES_ISOLATED/);
});

test('synthetic WASM call produces signaling without any socket or network', { skip: required ? false : 'set REQUIRE_VOIP_WASM=1', timeout: 70_000 }, () => {
  const code = `
    import assert from 'node:assert/strict';
    import { WasmEngine } from './lib/VoIP/wasm-engine.js';
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let signals = 0;
    const engine = new WasmEngine({ workerPoolSize: 8, enableLogs: false,
      callbacks: { onCallEvent() {}, onSignalingXmpp() { signals++; }, sendDataToRelay() { return 0; } } });
    try {
      await engine.initialize();
      engine.initVoipStack('12345678901:1@s.whatsapp.net', '12345678901@s.whatsapp.net', '12345678901@lid');
      await engine.waitForVoipStackReady();
      engine.startCall({ peerJid: '987654321@lid', peerPn: '12345678902@s.whatsapp.net',
        peerList: ['987654321:1@lid'], callId: '00ABCDEF0123456789ABCDEF01234567', isVideo: false, isLidCall: true });
      await sleep(3000);
      assert.ok(signals > 0, 'synthetic call should produce a local signaling callback');
      engine.endCall(0, false);
    } finally { engine.destroy(); }
    console.log('WASM_SYNTHETIC_SIGNAL_ONLY');
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), encoding: 'utf8', timeout: 60_000 });
  assert.equal(child.error, undefined, `synthetic child timed out: ${child.error?.message}`);
  assert.equal(child.status, 0, `synthetic WASM call failed: ${child.stderr?.slice(-2000)}`);
  assert.match(child.stdout, /WASM_SYNTHETIC_SIGNAL_ONLY/);
});

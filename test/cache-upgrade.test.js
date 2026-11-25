// Regress the synchronous node-cache contract relied on by socket code after
// the @cacheable/node-cache 3.x upgrade. No server or credentials are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import NodeCache from '@cacheable/node-cache';
import { makeCacheableSignalKeyStore } from '../lib/Utils/auth-utils.js';

test('cache supports synchronous writes, bulk operations, no-clone identity and expiry', async () => {
  const cache = new NodeCache({ useClones: false, checkperiod: 0, deleteOnExpire: true });
  try {
    const object = { nested: { counter: 1 } };
    assert.equal(cache.set('one', object), true);
    assert.equal(cache.get('one'), object);
    assert.equal(cache.has('one'), true);
    assert.equal(cache.mset([{ key: 'a', value: 10 }, { key: 'b', value: 20 }]), true);
    const bulk = cache.mget(['a', 'b', 'missing']);
    assert.equal(bulk.a, 10);
    assert.equal(bulk.b, 20);
    assert.equal(bulk.missing, undefined);
    assert.deepEqual(new Set(cache.keys()), new Set(['one', 'a', 'b']));
    assert.equal(cache.del('a'), 1);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.set('short', 'expired', 0.03), true); // seconds
    await delay(120);
    assert.equal(cache.get('short'), undefined);
    assert.equal(cache.has('short'), false);
    cache.flushAll();
    assert.equal(cache.keys().length, 0);
  } finally { cache.close(); }
});

test('cache-backed Signal store fetches once, updates and clears underlying store', async () => {
  const values = { example: { a: { count: 1 } } };
  const calls = [];
  const backing = {
    async get(type, ids) { calls.push(['get', type, ids]); return Object.fromEntries(ids.map((id) => [id, values[type]?.[id]])); },
    async set(data) { calls.push(['set']); Object.assign(values.example, data.example); },
    async clear() { calls.push(['clear']); values.example = {}; },
  };
  const cache = new NodeCache({ useClones: false, checkperiod: 0 });
  try {
    const store = makeCacheableSignalKeyStore(backing, undefined, cache);
    assert.deepEqual(await store.get('example', ['a']), { a: { count: 1 } });
    assert.deepEqual(await store.get('example', ['a']), { a: { count: 1 } });
    assert.equal(calls.filter(([type]) => type === 'get').length, 1);
    await store.set({ example: { a: { count: 2 } } });
    assert.deepEqual(await store.get('example', ['a']), { a: { count: 2 } });
    await store.clear();
    assert.equal(calls.filter(([type]) => type === 'clear').length, 1);
    assert.deepEqual(await store.get('example', ['a']), {});
    assert.equal(calls.filter(([type]) => type === 'get').length, 2);
  } finally { cache.close(); }
});

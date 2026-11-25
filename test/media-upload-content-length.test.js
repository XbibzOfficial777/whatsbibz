import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { getWAUploadToServer } from '../lib/Utils/messages-media.js';
import { makeSocketNetworkOptions } from '../lib/BibzWhats/client.js';

// Exercise real Node fetch + Undici against a local HTTP server. A mocked fetch
// would not catch the invalid/duplicate Content-Length regression.
test('media uploader lets fetch calculate Content-Length for Buffer bodies', async (t) => {
  const received = [];
  const server = http.createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    received.push({ headers: request.headers, data: Buffer.concat(chunks) });
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ url: 'https://cdn.whatsapp.net/test', direct_path: '/test' }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const nativeFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (_remote, options) => nativeFetch(`http://127.0.0.1:${server.address().port}/mms/image`, options));
  const { fetchAgent } = makeSocketNetworkOptions();
  t.after(() => fetchAgent.destroy());
  const quiet = { debug() {}, warn() {}, info() {}, error() {} };
  for (const headers of [
    { 'X-Example': 'one', 'Content-Length': '999' },
    [['X-Example', 'two'], ['content-length', '999']],
    new Headers({ 'X-Example': 'three', 'content-length': '999' }),
  ]) {
    const upload = getWAUploadToServer({ customUploadHosts: [], fetchAgent, logger: quiet, options: { headers } },
      async () => ({ hosts: [{ hostname: 'cdn.whatsapp.net' }], auth: 'test-only', ttl: 300, fetchDate: new Date() }));
    const body = Buffer.from('actual upload bytes');
    const result = await upload(body, { mediaType: 'sticker', fileEncSha256B64: 'YWJj' });
    assert.equal(result.directPath, '/test');
    const last = received.at(-1);
    assert.deepEqual(last.data, body);
    assert.equal(last.headers['content-length'], String(body.length));
    assert.equal(last.headers['content-type'], 'application/octet-stream');
    assert.equal(last.headers.origin, 'https://web.whatsapp.com');
    assert.equal(last.headers['x-example'], ['one', 'two', 'three'][received.length - 1]);
  }
});

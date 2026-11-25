import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { VoipClient } from '../lib/index.js';

const pages = [
  ['docs/guide/voip.md', '/guide/voip', 'README.id.md'],
  ['docs/en/guide/voip.md', '/en/guide/voip', 'README.md'],
  ['docs/zh/guide/voip.md', '/zh/guide/voip', 'README.cn.md'],
];
const config = readFileSync('docs/.vitepress/config.ts', 'utf8');

for (const [file, route, readme] of pages) {
  test(`${file} has a reachable guide with a syntactically valid experimental call example`, () => {
    const text = readFileSync(file, 'utf8');
    assert.ok(config.includes(`link: '${route}'`), `sidebar missing ${route}`);
    assert.ok(readFileSync(readme, 'utf8').includes(`https://whatsbibz.xbibzclone.my.id${route}`), `${readme} does not link to guide`);
    for (const required of ['@roamhq/wrtc', 'ffmpeg', 'audioSource', 'connectTimeoutMs', 'durationMs',
      'endOnAudioEnd', 'READY_TIMEOUT_ASSUMED', 'ICE_FAILED', 'CONNECTION_TIMEOUT', 'preserveSession', 'await client.close()']) {
      assert.ok(text.toLowerCase().includes(required.toLowerCase()), `${file}: missing ${required}`);
    }
    assert.equal(typeof VoipClient, 'function');
    const snippets = [...text.matchAll(/^```(?:js|javascript)\s*\r?\n([\s\S]*?)^```\s*$/gm)];
    assert.ok(snippets.length, `${file}: missing JavaScript example`);
    for (const [index, match] of snippets.entries()) {
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: match[1], encoding: 'utf8' });
      assert.equal(result.status, 0, `${file} example ${index + 1}: ${result.stderr || result.error}`);
    }
  });
}

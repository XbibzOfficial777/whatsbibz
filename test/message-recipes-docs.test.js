import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const guides = [
  'docs/guide/message-recipes.md',
  'docs/en/guide/message-recipes.md',
  'docs/zh/guide/message-recipes.md',
];
const readmes = [
  ['README.id.md', '## Resep pesan: tombol, lokasi, gambar, dan slide'],
  ['README.md', '## Message recipes: buttons, location, images, and slides'],
  ['README.cn.md', '## 消息示例：按钮、位置、图片与轮播'],
];

function snippets(text) {
  return [...text.matchAll(/^```(?:js|javascript)\s*\r?\n([\s\S]*?)^```\s*$/gm)].map((match) => match[1]);
}

function assertJavaScriptParses(filename, text, minimum) {
  const blocks = snippets(text);
  assert.ok(blocks.length >= minimum, `${filename}: expected at least ${minimum} JavaScript snippets, found ${blocks.length}`);
  for (const [index, block] of blocks.entries()) {
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: block, encoding: 'utf8' });
    assert.equal(result.status, 0, `${filename}, JavaScript block ${index + 1}: ${result.stderr || result.error}`);
  }
}

for (const filename of guides) {
  test(`${filename}: recipe snippets parse and required features are covered`, () => {
    const text = readFileSync(filename, 'utf8');
    assertJavaScriptParses(filename, text, 9);
    for (const fragment of ['new Button(sock)', 'new Carousel(sock)', 'degreesLatitude', 'degreesLongitude',
      '!image-button', '!slide', 'autoFollowChannel: false', 'preserveSession: true']) {
      assert.ok(text.includes(fragment), `${filename}: missing ${fragment}`);
    }
  });
}

for (const [filename, heading] of readmes) {
  test(`${filename}: the full recipe section contains parseable examples`, () => {
    const text = readFileSync(filename, 'utf8');
    const start = text.indexOf(heading);
    assert.notEqual(start, -1, `${filename}: missing recipe heading`);
    const next = text.indexOf('\n## ', start + heading.length);
    const section = text.slice(start, next === -1 ? undefined : next);
    assertJavaScriptParses(filename, section, 4);
    for (const fragment of ['new Button(sock)', 'new Carousel(sock)', 'degreesLatitude', 'degreesLongitude',
      'example/message-recipes.js', 'extractMessage(incoming)', 'audio/ogg; codecs=opus', 'video/mp4']) {
      assert.ok(section.includes(fragment), `${filename}: missing ${fragment}`);
    }
  });
}

test('all three documentation sidebars link to their message recipe page', () => {
  const config = readFileSync('docs/.vitepress/config.ts', 'utf8');
  for (const link of ['/guide/message-recipes', '/en/guide/message-recipes', '/zh/guide/message-recipes']) {
    assert.ok(config.includes(`link: '${link}'`), `missing sidebar entry ${link}`);
  }
});

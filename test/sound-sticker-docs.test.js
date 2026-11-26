import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const pages = [
  ['README.id.md', 'https://whatsbibz.xbibzclone.my.id/guide/sound-sticker'],
  ['README.md', 'https://whatsbibz.xbibzclone.my.id/en/guide/sound-sticker'],
  ['README.cn.md', 'https://whatsbibz.xbibzclone.my.id/zh/guide/sound-sticker'],
  ['docs/guide/sound-sticker.md', '/guide/sound-sticker'],
  ['docs/en/guide/sound-sticker.md', '/en/guide/sound-sticker'],
  ['docs/zh/guide/sound-sticker.md', '/zh/guide/sound-sticker'],
];

for (const [file, link] of pages) {
  test(`${file} documents the experimental sound sticker and versioned availability`, () => {
    const text = readFileSync(file, 'utf8');
    for (const required of ['.sa', '!soundsticker', '!sticker-audio', 'WHATSBIBZ_ALLOW_SELF_COMMANDS',
      'WHATSBIBZ_ALLOWED_JID', 'WHATSBIBZ_AUTH_DIR', 'downloadVideoForSoundSticker', 'sendVideoAsSoundSticker',
      'ffmpeg', 'ffprobe', 'libwebp_anim', 'libopus', '20 MiB', '500 KiB', '4 MiB', '600',
      'maxAudioSeconds', '2.0.0', '2.1.0', 'SHA-256', 'MAC']) {
      assert.ok(text.includes(required), `${file}: missing ${required}`);
    }
    if (file.startsWith('README')) assert.ok(text.includes(link), `${file}: missing guide link`);
    const snippets = [...text.matchAll(/^```(?:js|javascript)\s*\r?\n([\s\S]*?)^```\s*$/gm)];
    assert.ok(snippets.length, `${file}: no JS example`);
    for (const [index, match] of snippets.entries()) {
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: match[1], encoding: 'utf8' });
      assert.equal(result.status, 0, `${file} JS block ${index + 1}: ${result.stderr || result.error}`);
    }
  });
}

test('all locales distinguish the unpublished 600-second code from npm 2.1.0', () => {
  const unpublished = {
    'README.id.md': /belum diterbitkan/,
    'README.md': /unpublished/i,
    'README.cn.md': /尚未发布/,
    'docs/guide/sound-sticker.md': /belum dirilis ke npm/,
    'docs/en/guide/sound-sticker.md': /unpublished/i,
    'docs/zh/guide/sound-sticker.md': /尚未发布到 npm/,
  };
  for (const [file] of pages) {
    const text = readFileSync(file, 'utf8');
    assert.match(text, unpublished[file], `${file}: source changes must be marked unpublished`);
    assert.match(text, /2\.1\.0[^\n]{0,180}5\s*(?:detik|seconds|秒)/i, `${file}: npm 2.1.0 still has a five-second limit`);
    assert.ok(text.includes('git+https://github.com/XbibzOfficial777/whatsbibz.git#main'), `${file}: missing Git source install`);
  }
});

test('each locale exposes the sound-sticker guide in the sidebar and message recipes', () => {
  const config = readFileSync('docs/.vitepress/config.ts', 'utf8');
  for (const [file, link] of pages.filter(([name]) => name.startsWith('docs/'))) {
    assert.ok(config.includes(`link: '${link}'`), `sidebar missing ${link}`);
    const recipe = file.replace('sound-sticker.md', 'message-recipes.md');
    assert.ok(readFileSync(recipe, 'utf8').includes(link), `${recipe} missing link`);
  }
});

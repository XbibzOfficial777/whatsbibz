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
      'maxAudioSeconds', '2.0.0', '2.1.0', '2.1.1', 'SHA-256', 'MAC']) {
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

test('all locales distinguish npm 2.1.1 audio from the 2.1.0 five-second limit', () => {
  for (const [file] of pages) {
    const text = readFileSync(file, 'utf8');
    assert.match(text, /2\.1\.0[^\n]{0,180}5\s*(?:detik|seconds|秒)/i, `${file}: npm 2.1.0 still has a five-second limit`);
    assert.match(text, /2\.1\.1[^\n]{0,180}600\s*(?:detik|seconds|秒)/i, `${file}: npm 2.1.1 must describe the 600-second audio limit`);
    assert.ok(text.includes('npm install @xbibzlibrary/whatsbibz@2.1.1'), `${file}: missing npm install for 2.1.1`);
    assert.doesNotMatch(text, /belum dirilis ke npm|belum diterbitkan|\bunpublished\b|尚未发布到 npm|尚未发布的代码/i,
      `${file}: sound-sticker change is being released`);
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

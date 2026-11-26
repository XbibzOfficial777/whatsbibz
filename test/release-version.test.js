import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

test('release version is consistent across package metadata and lockfile', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
});

test('current changelog section generates release notes with the correct install command', () => {
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  assert.ok(changelog.includes(`## [${pkg.version}]`), 'missing current version section');
  const notes = spawnSync(process.execPath, ['.github/release-notes.mjs', `v${pkg.version}`], { encoding: 'utf8' });
  assert.equal(notes.status, 0, notes.stderr || notes.error);
  assert.doesNotMatch(notes.stdout, /^See CHANGELOG\.md\./);
  assert.ok(notes.stdout.includes(`npm install ${pkg.name}@${pkg.version}`));
});

test('localized setup instructions and supported-version policy use the current release', () => {
  for (const file of ['README.md', 'README.id.md', 'README.cn.md', 'docs/guide/getting-started.md',
    'docs/en/guide/getting-started.md', 'docs/zh/guide/getting-started.md']) {
    assert.ok(readFileSync(file, 'utf8').includes(`npm install ${pkg.name}@${pkg.version}`), `${file}: missing current npm install command`);
  }
  const security = readFileSync('SECURITY.md', 'utf8');
  assert.ok(security.includes(`| ${pkg.version} (latest release) | Yes |`));
  assert.ok(security.includes(`| ${pkg.version} (rilis terbaru) | Ya |`));
});

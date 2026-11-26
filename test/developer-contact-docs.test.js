import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const email = 'xbibzofficial@protonmail.com';
const npm = 'https://www.npmjs.com/package/@xbibzlibrary/whatsbibz';
const telegram = 'https://t.me/xbibzofficial';
const github = 'https://github.com/XbibzOfficial777';
const locales = [
  { source: 'docs/contact.md', route: '/contact', home: 'index.html', page: 'contact.html' },
  { source: 'docs/en/contact.md', route: '/en/contact', home: 'en/index.html', page: 'en/contact.html' },
  { source: 'docs/zh/contact.md', route: '/zh/contact', home: 'zh/index.html', page: 'zh/contact.html' },
];
const read = (path) => readFileSync(path, 'utf8');
const config = read('docs/.vitepress/config.ts');

function sharedLink(name) {
  const source = read('docs/.vitepress/theme/lib/project-links.ts');
  const match = source.match(new RegExp(`^\\s*${name}: '([^']+)'`, 'm'));
  assert.ok(match, `missing shared link: ${name}`);
  return match[1];
}

test('developer contacts match package metadata and the shared website links', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.author.email, email);
  assert.equal(pkg.bugs.email, email);
  assert.equal(sharedLink('email'), email);
  assert.equal(sharedLink('npm'), npm);
  assert.equal(sharedLink('telegram'), telegram);
  assert.equal(sharedLink('developerGitHub'), github);
  const card = read('docs/.vitepress/theme/components/DeveloperContact.vue');
  for (const key of ['telegram', 'developerGitHub', 'email', 'npm']) {
    assert.ok(card.includes(`projectLinks.${key}`), `contact card missing ${key}`);
  }
});

test('security and community documents use only the requested maintainer email', () => {
  const files = ['SECURITY.md', 'CODE_OF_CONDUCT.md', 'docs/security.md', 'docs/en/security.md', 'docs/zh/security.md'];
  const address = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  for (const file of files) {
    const found = [...new Set(read(file).match(address) || [])];
    assert.deepEqual(found, [email], `${file} contains unexpected maintainer email(s)`);
  }
  for (const file of ['README.md', 'README.id.md', 'README.cn.md']) {
    const text = read(file);
    const telegramLinks = [...text.matchAll(/https:\/\/t\.me\/[A-Za-z0-9_]+/g)].map((match) => match[0]);
    assert.ok(telegramLinks.length > 0, `${file} has no Telegram link`);
    assert.ok(telegramLinks.every((link) => link === telegram), `${file} has a different Telegram link`);
    assert.ok(text.includes(`mailto:${email}`), `${file} has no new contact email`);
    assert.ok(text.includes(github), `${file} has no developer GitHub`);
  }
});

test('contact and npm are accessible from localized and mobile navigation', () => {
  for (const { source, route } of locales) {
    assert.ok(read(source).includes('<DeveloperContact />'), `${source} has no contact component`);
    assert.ok(config.includes(`link: '${route}'`), `navigation missing ${route}`);
  }
  const home = read('docs/.vitepress/theme/components/HomeActions.vue');
  const mobile = read('docs/.vitepress/theme/components/MobileSheet.vue');
  for (const [name, source] of [['home', home], ['mobile', mobile]]) {
    assert.ok(source.includes('projectLinks.npm'), `${name} missing npm link`);
    assert.ok(source.includes('contactHref'), `${name} missing contact link`);
  }
  assert.match(config, /text: 'npm', link: projectLinks\.npm/);
});

const requireBuild = process.env.REQUIRE_DOCS_BUILD === '1';
test('built pages contain the exact contact and npm destinations', { skip: requireBuild ? false : 'set REQUIRE_DOCS_BUILD=1' }, () => {
  for (const { route, home, page } of locales) {
    const homepage = read(`docs/.vitepress/dist/${home}`);
    const contactPage = read(`docs/.vitepress/dist/${page}`);
    assert.ok(homepage.includes(`href="${route}"`), `${home} is missing its localized contact link`);
    assert.ok(homepage.includes(`href="${npm}"`), `${home} is missing npm`);
    for (const href of [telegram, github, `mailto:${email}`, npm]) {
      assert.ok(contactPage.includes(`href="${href}"`), `${page} is missing ${href}`);
    }
  }
});

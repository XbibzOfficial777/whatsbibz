// Prints the CHANGELOG.md section for one version, followed by install links.
// Usage: node .github/release-notes.mjs 1.3.1 > notes.md
import { readFileSync } from 'node:fs';

const version = (process.argv[2] || '').replace(/^v/, '');
if (!version) {
  console.error('usage: node .github/release-notes.mjs <version>');
  process.exit(1);
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const section = changelog.match(new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|$(?![\\s\\S]))`, 'm'));
const repo = process.env.GITHUB_REPOSITORY || 'XbibzOfficial777/whatsbibz';

let body = section ? section[1].trim() : 'See CHANGELOG.md.';
body += '\n\n---\n\n';
body += `**Install:** \`npm install @xbibzlibrary/whatsbibz@${version}\`\n\n`;
body += `**Package:** https://www.npmjs.com/package/@xbibzlibrary/whatsbibz/v/${version}\n\n`;
body += `**Full changelog:** https://github.com/${repo}/blob/main/CHANGELOG.md\n`;
process.stdout.write(body);

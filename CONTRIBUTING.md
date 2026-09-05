# Contributing to WhatsBibz

Thanks for taking the time to contribute. This document explains how the project is organised, what a good pull request looks like, and how to run the tests — including the ones that talk to real WhatsApp servers.

*Bahasa Indonesia: lihat bagian [Panduan singkat (ID)](#panduan-singkat-id) di bawah.*

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Before you start](#before-you-start)
- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [Running the tests](#running-the-tests)
- [Coding guidelines](#coding-guidelines)
- [Commit messages](#commit-messages)
- [Pull request checklist](#pull-request-checklist)
- [Reporting protocol changes](#reporting-protocol-changes)
- [Release process (maintainers)](#release-process-maintainers)
- [Panduan singkat (ID)](#panduan-singkat-id)

## Ways to contribute

- **Report a bug** using the bug report template. Include the `close` status code, your Node.js version and whether the problem also happens with `identity: 'auto'`.
- **Report a protocol change.** WhatsApp changes server behaviour without notice. If a pairing flow, status code or `companion_platform_display` value behaves differently from what the README says, open a *Protocol change* issue with the measurement.
- **Improve documentation.** Both `README.md` (English) and `README.id.md` (Indonesian) must stay in sync — change both or say in the PR that you couldn't.
- **Fix a bug or add a feature.** Please open an issue first for anything larger than a small fix so the approach can be agreed on.

## Before you start

- Search existing issues and pull requests to avoid duplicates.
- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- Never commit credentials: session folders (`*-session/`, `creds.json`, `identity.json`), phone numbers of real people, npm or GitHub tokens. `.gitignore` covers the usual paths, but check `git status` before committing.

## Development setup

```bash
git clone https://github.com/XbibzOfficial777/whatsbibz.git
cd whatsbibz
npm install
npm test
```

Requirements: Node.js ≥ 20 (the CI matrix runs 20, 22 and 24), npm ≥ 10. No build step — the package ships plain ESM JavaScript with hand-maintained `.d.ts` files.

## Project layout

| Path | Contents | Notes |
|---|---|---|
| `lib/BibzWhats/` | High-level layer: `client.js`, `device-identity.js`, `pairing.js`, `send.js`, `extract.js`, `jid.js` | Our own code. Full test coverage expected. |
| `lib/Socket/`, `lib/Utils/`, `lib/Signal/`, … | Forked Baileys core | Keep diffs against upstream small and commented so patches can be ported both ways. |
| `lib/Utils/platform-identity.js` | Allow-list and derivation of `companion_platform_display` | Every entry is backed by a live measurement. |
| `WAProto/` | Protobuf definitions, generated `index.js` and `index.d.ts` | Regenerate with `pbjs`/`pbts` (see `WAProto/GenerateStatics.sh`); never edit by hand. |
| `test/` | `node:test` suites | `*.test.js` run offline; `identity-live.test.js` needs `BIBZ_LIVE=1`. |
| `scripts/check.js` | Export surface check | Run by `prepublishOnly`. |

## Running the tests

```bash
npm test                 # offline suites — must pass on every PR
npm run check            # export surface
npm run test:live        # live suites against WhatsApp servers
```

### About the live tests

`test/identity-live.test.js` opens real connections to WhatsApp's servers to verify handshake and pairing behaviour. It **does not need a phone**: it uses fictional numbers from the UK Ofcom drama range (`+44 7700 900xxx`), which WhatsApp accepts for a pairing request but which belong to nobody.

Rules:

- Do not point the live tests at a real person's number.
- WhatsApp rate-limits pairing requests per number (`429`, roughly 15 minutes). The suite rotates through a range; set `BIBZ_LIVE_SEQ=<n>` to start at a different offset if you hit limits.
- Keep live runs short. Each test closes its socket and deletes its temporary session folder.
- Live tests are **not** run in CI. Run them locally before opening a PR that touches `lib/Socket/socket.js`, `lib/Utils/validate-connection.js`, `lib/Utils/platform-identity.js` or `lib/BibzWhats/`.

### Writing tests

- Offline tests must not touch the network. Use `socketConfig: { waWebSocketUrl: 'ws://127.0.0.1:9/ws/chat', connectTimeoutMs: 300 }` and `fetchLatestVersion: false` to exercise the client without a server (see `test/lifecycle.test.js`).
- A bug fix should come with a test that fails before the fix and passes after it.
- Tests that check timers must clean up their own timers — `process.getActiveResourcesInfo()` is used to assert that the client leaves nothing behind.

## Coding guidelines

- **ESM only**, Node.js ≥ 20 APIs. No transpilation.
- Keep the public API backward compatible. Add aliases rather than renaming exports; deprecate before removing.
- Update the matching `.d.ts` in the same commit as any change to a public function, option or event.
- Every reconnect must be scheduled through `scheduleReconnect()` in `client.js` so `close()` can cancel it.
- Log messages are user-facing. Prefix them with `BibzWhats:`, say what happened and what the user can do. No emoji in library logs.
- Prefer small, single-purpose commits. Do not mix formatting changes with behaviour changes.
- Comments explain *why*, especially around server behaviour ("server closes with 428 before QR when `DARWIN` is advertised").

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(identity): rotate profile on 405
fix(client): cancel scheduled reconnect in close()
docs(readme): document pairingPending
test(live): add forced network drop scenario
chore(deps): bump whatsapp-rust-bridge to 0.5.5
```

Scopes in use: `client`, `identity`, `pairing`, `socket`, `proto`, `types`, `readme`, `ci`, `deps`.

## Pull request checklist

- [ ] `npm test` and `npm run check` pass locally.
- [ ] Live tests run if the change touches connection, pairing or identity code (say so in the PR).
- [ ] New or changed behaviour is covered by a test.
- [ ] `.d.ts` files updated.
- [ ] `README.md` **and** `README.id.md` updated if user-facing behaviour changed.
- [ ] `CHANGELOG.md` has an entry under *Unreleased*.
- [ ] No credentials, session files or real phone numbers in the diff.

Small PRs are reviewed faster. If a change is large, split it: refactor first, behaviour change second.

## Reporting protocol changes

WhatsApp does not publish its protocol. The values in `lib/Utils/platform-identity.js` and the status-code handling in `client.js` come from measurements against production servers, dated in the source comments.

When you observe a change, please report:

1. Date and time (UTC) of the observation.
2. WhatsApp Web version (`fetchLatestWaWebVersion()` output).
3. The exact `browser` tuple / `companionPlatformDisplay` used.
4. The `close` status code and, for pairing failures, `error.data` (the stanza code).
5. Whether the behaviour reproduces with `identity: 'auto'`.

A short script that reproduces the observation is worth more than a long description.

## Release process (maintainers)

1. Update `CHANGELOG.md`: move *Unreleased* into a new version heading with the date.
2. Bump the version in `package.json`, `lib/BibzWhats/version.js` (`BIBZWHATS_VERSION`) and `lib/Utils/browser-utils.js` (`Browsers.whatsbibz`), plus the two tests that assert it.
3. Refresh `BIBZWHATS_WA_WEB_VERSION` (`lib/BibzWhats/version.js`, `lib/Defaults/index.js`, `lib/Utils/generics.js`) from `fetchLatestWaWebVersion()`.
4. `npm test && npm run check && npm run test:live`.
5. Commit, then tag and push: `git tag -a vX.Y.Z -m "WhatsBibz X.Y.Z" && git push origin main vX.Y.Z`.
6. The **Release** workflow (`.github/workflows/release.yml`) re-runs the tests, publishes to npm
   (skipped if that version already exists; needs the `NPM_TOKEN` repository secret) and creates the
   GitHub release from the matching `CHANGELOG.md` section. Publishing by hand with
   `npm publish --access public` is equivalent; the workflow then only creates the release.

---

## Panduan singkat (ID)

- Fork → branch → `npm install` → ubah → `npm test` → pull request.
- Test offline (`npm test`) wajib lulus. Test live (`npm run test:live`) wajib dijalankan bila kamu menyentuh kode koneksi, pairing, atau identitas; test live memakai nomor fiktif Ofcom, **jangan** memakai nomor orang sungguhan.
- Perubahan yang terlihat pengguna harus diperbarui di `README.md` **dan** `README.id.md`, ditambah entri di `CHANGELOG.md`.
- Ubah `.d.ts` bersamaan dengan perubahan API.
- Pesan commit memakai format Conventional Commits (`fix(client): …`).
- Jangan pernah meng-commit folder sesi, `creds.json`, `identity.json`, token, atau nomor telepon orang lain.
- Untuk melaporkan perubahan perilaku server WhatsApp, gunakan template issue *Protocol change* dan sertakan tanggal, versi WA Web, tuple `browser`, kode status, dan apakah terulang dengan `identity: 'auto'`.
- Rilis (maintainer): perbarui `CHANGELOG.md`, naikkan versi di `package.json`, `lib/BibzWhats/version.js`, dan `lib/Utils/browser-utils.js`, lalu `git tag -a vX.Y.Z` dan push. Workflow **Release** menjalankan test ulang, publish ke npm (dilewati bila versi sudah ada; butuh secret `NPM_TOKEN`), dan membuat GitHub release dari `CHANGELOG.md`.

// Identitas platform (Mac OS / Arch Linux) — OFFLINE.
// Memeriksa payload yang benar-benar dikirim ke server tanpa menyentuh jaringan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    Browsers, proto, initAuthCreds, generateRegistrationNode, generateLoginNode,
    derivePairingDisplay, resolvePairingOs, resolvePairingBrowser, isPairingDisplayAccepted,
    lintIdentity, hostOsLabel, linuxDistroName, PAIRING_ACCEPTED_OS, PAIRING_ACCEPTED_BROWSERS,
    getPlatformId,
} from '../lib/index.js';

const creds = initAuthCreds();
const cfg = (browser, extra = {}) => ({ version: [2, 3000, 1046672143], browser, syncFullHistory: false, countryCode: 'ID', ...extra });
const reg = (c) => {
    const node = generateRegistrationNode(creds, c);
    const dp = proto.DeviceProps.decode(node.devicePairingData.deviceProps);
    return { node, dp };
};

// ---------- preset Browsers ----------
test('Browsers.macOS / archLinux / linux menghasilkan tuple [os, browser, version] yang benar', () => {
    assert.deepEqual(Browsers.macOS('Chrome'), ['Mac OS', 'Chrome', '15.6.1']);
    assert.deepEqual(Browsers.archLinux('Chrome'), ['Arch Linux', 'Chrome', '6.12.44']);
    assert.deepEqual(Browsers.archLinux('Firefox'), ['Arch Linux', 'Firefox', '6.12.44']);
    assert.deepEqual(Browsers.linux('Chrome'), ['Linux', 'Chrome', '6.12.44']);
    assert.equal(typeof Browsers.appropriate('Chrome')[0], 'string');
    assert.equal(Browsers.appropriate('Chrome')[1], 'Chrome');
});

test('Browsers.appropriate memakai nama distro dari /etc/os-release (bukan selalu Ubuntu)', () => {
    const tmp = path.join(os.tmpdir(), `osrel-${process.pid}`);
    fs.writeFileSync(tmp, 'NAME="Arch Linux"\nPRETTY_NAME="Arch Linux"\nID=arch\n');
    assert.equal(linuxDistroName(tmp), 'Arch Linux');
    fs.writeFileSync(tmp, 'PRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nNAME="Debian GNU/Linux"\n');
    assert.equal(linuxDistroName(tmp), 'Debian');
    fs.unlinkSync(tmp);
    assert.equal(linuxDistroName('/nonexistent/os-release'), null);
    assert.equal(hostOsLabel('darwin'), 'Mac OS');
    assert.equal(hostOsLabel('win32'), 'Windows');
    assert.equal(hostOsLabel('android'), 'Android');
    // di host Linux hasilnya nama distro nyata atau 'Linux' — keduanya OS yang valid utk pairing
    assert.ok(resolvePairingOs(hostOsLabel('linux')));
});

// ---------- DeviceProps (nama di "Perangkat tertaut") ----------
test('DeviceProps.os membawa nama identitas apa adanya: "Mac OS" dan "Arch Linux"', () => {
    assert.equal(reg(cfg(Browsers.macOS('Chrome'))).dp.os, 'Mac OS');
    assert.equal(reg(cfg(Browsers.archLinux('Chrome'))).dp.os, 'Arch Linux');
    assert.equal(reg(cfg(Browsers.archLinux('Chrome'))).dp.platformType, proto.DeviceProps.PlatformType.CHROME);
    assert.equal(reg(cfg(Browsers.macOS('Safari'))).dp.platformType, proto.DeviceProps.PlatformType.SAFARI);
    assert.equal(reg(cfg(Browsers.macOS('Desktop'))).dp.platformType, proto.DeviceProps.PlatformType.DESKTOP);
});

// ---------- WebInfo.webSubPlatform ----------
test('Mac OS Desktop + syncFullHistory TIDAK lagi mengirim DARWIN (ditolak 428) → WEB_BROWSER + requireFullSync', () => {
    const { node, dp } = reg(cfg(Browsers.macOS('Desktop'), { syncFullHistory: true }));
    assert.equal(node.webInfo.webSubPlatform, proto.ClientPayload.WebInfo.WebSubPlatform.WEB_BROWSER);
    assert.equal(dp.requireFullSync, true);
});

test('Windows Desktop + syncFullHistory tetap WIN_HYBRID; Arch Linux Desktop → WEB_BROWSER', () => {
    assert.equal(reg(cfg(Browsers.windows('Desktop'), { syncFullHistory: true })).node.webInfo.webSubPlatform,
        proto.ClientPayload.WebInfo.WebSubPlatform.WIN_HYBRID);
    assert.equal(reg(cfg(Browsers.archLinux('Desktop'), { syncFullHistory: true })).node.webInfo.webSubPlatform,
        proto.ClientPayload.WebInfo.WebSubPlatform.WEB_BROWSER);
});

test('opsi webSubPlatform meng-override (nama enum atau angka) di registrasi & login', () => {
    const r = reg(cfg(Browsers.macOS('Desktop'), { syncFullHistory: true, webSubPlatform: 'win_hybrid' }));
    assert.equal(r.node.webInfo.webSubPlatform, 5);
    const l = generateLoginNode('628123456789:1@s.whatsapp.net', cfg(Browsers.windows('Desktop'), { syncFullHistory: true, webSubPlatform: 0 }));
    assert.equal(l.webInfo.webSubPlatform, 0);
    // nilai tak dikenal diabaikan (tetap default)
    assert.equal(reg(cfg(Browsers.macOS('Chrome'), { webSubPlatform: 'BOGUS' })).node.webInfo.webSubPlatform, 0);
});

// ---------- companion_platform_display (pairing kode) ----------
test('derivePairingDisplay: Mac OS tetap, Arch Linux → Linux, Desktop → Chrome, produk → OS host', () => {
    assert.equal(derivePairingDisplay(Browsers.macOS('Chrome')), 'Chrome (Mac OS)');
    assert.equal(derivePairingDisplay(Browsers.macOS('Safari')), 'Safari (Mac OS)');
    assert.equal(derivePairingDisplay(Browsers.macOS('Desktop')), 'Chrome (Mac OS)');
    assert.equal(derivePairingDisplay(Browsers.archLinux('Chrome')), 'Chrome (Linux)');
    assert.equal(derivePairingDisplay(Browsers.archLinux('Firefox')), 'Firefox (Linux)');
    assert.equal(derivePairingDisplay(Browsers.archLinux('Desktop')), 'Chrome (Linux)');
    assert.equal(derivePairingDisplay(Browsers.linux('Chrome')), 'Chrome (Linux)');
    assert.equal(derivePairingDisplay(Browsers.windows('Desktop')), 'Chrome (Windows)');
    assert.equal(derivePairingDisplay(Browsers.ubuntu('Chrome')), 'Chrome (Ubuntu)');
    // nama produk di os → pakai OS host (darwin) / Linux
    assert.equal(derivePairingDisplay(Browsers.bibzwhats('Chrome'), 'darwin'), 'Chrome (Mac OS)');
    assert.equal(derivePairingDisplay(Browsers.bibzwhats('Chrome'), 'win32'), 'Chrome (Windows)');
    assert.equal(derivePairingDisplay(['Foo', 'Bar', '1'], 'freebsd'), 'Chrome (Linux)');
});

test('setiap display turunan lolos isPairingDisplayAccepted (tabel hasil ukur server 2026-09-03)', () => {
    const presets = [Browsers.macOS('Chrome'), Browsers.macOS('Safari'), Browsers.macOS('Firefox'), Browsers.macOS('Edge'),
        Browsers.macOS('Desktop'), Browsers.archLinux('Chrome'), Browsers.archLinux('Firefox'), Browsers.archLinux('Desktop'),
        Browsers.linux('Chrome'), Browsers.ubuntu('Chrome'), Browsers.windows('Chrome'), Browsers.windows('Desktop'),
        Browsers.bibzwhats('Chrome'), Browsers.baileys('Chrome'), Browsers.appropriate('Chrome')];
    for (const b of presets) {
        const d = derivePairingDisplay(b);
        assert.ok(isPairingDisplayAccepted(d), `${JSON.stringify(b)} → ${d}`);
    }
    // nilai yang terbukti ditolak server
    for (const bad of ['Chrome (Arch Linux)', 'Chrome (Arch)', 'Chrome (GNU/Linux)', 'Chrome (Mac OS X)', 'Desktop (Mac OS)', 'Desktop (Windows)', 'Chrome (BibzWhats)', 'Foo (Mac OS)', 'Chrome (Kali)']) {
        assert.equal(isPairingDisplayAccepted(bad), false, bad);
    }
    // nilai yang terbukti diterima server
    for (const ok of ['Chrome (Mac OS)', 'Chrome (macOS)', 'Chrome (Linux)', 'Chrome (Ubuntu)', 'Chrome (Debian)', 'Chrome (Windows)', 'Safari (Mac OS)', 'Firefox (Linux)', 'Edge (Windows)', 'Brave (Mac OS)', 'chrome (mac os)']) {
        assert.ok(isPairingDisplayAccepted(ok), ok);
    }
});

test('resolvePairingOs / resolvePairingBrowser menangani alias & huruf', () => {
    assert.equal(resolvePairingOs('arch linux'), 'Linux');
    assert.equal(resolvePairingOs('ArchLinux'), 'Linux');
    assert.equal(resolvePairingOs('EndeavourOS'), 'Linux');
    assert.equal(resolvePairingOs('Mac OS X'), 'Mac OS');
    assert.equal(resolvePairingOs('macOS'), 'macOS');
    assert.equal(resolvePairingOs('Chrome OS'), 'Chromium OS');
    assert.equal(resolvePairingOs('Debian GNU/Linux'), 'Linux');
    assert.equal(resolvePairingOs('BibzWhats'), null);
    assert.equal(resolvePairingOs(''), null);
    assert.equal(resolvePairingBrowser('Desktop'), 'Chrome');
    assert.equal(resolvePairingBrowser('safari'), 'Safari');
    assert.equal(resolvePairingBrowser('Electron'), 'Chrome');
    assert.ok(PAIRING_ACCEPTED_OS.includes('Mac OS') && PAIRING_ACCEPTED_OS.includes('Linux'));
    assert.ok(PAIRING_ACCEPTED_BROWSERS.includes('Chrome') && !PAIRING_ACCEPTED_BROWSERS.includes('Desktop'));
});

test('getPlatformId: Desktop → 7 (Electron di enum WA Web), Chrome → 1, tak dikenal → 1', () => {
    assert.equal(getPlatformId('Desktop'), '7');
    assert.equal(getPlatformId('Chrome'), '1');
    assert.equal(getPlatformId('Safari'), '5');
    assert.equal(getPlatformId('Nonexistent'), '1');
});

// ---------- lint ----------
test('lintIdentity memperingatkan display yang pasti 400 dan menjelaskan fallback Arch Linux', () => {
    assert.deepEqual(lintIdentity({ browser: Browsers.macOS('Chrome') }), []);
    assert.deepEqual(lintIdentity({ browser: Browsers.archLinux('Chrome') }), []);
    const bad = lintIdentity({ browser: Browsers.macOS('Chrome'), companionPlatformDisplay: 'Chrome (Arch Linux)' });
    assert.equal(bad.length, 1); assert.equal(bad[0].level, 'warn'); assert.match(bad[0].message, /400/);
    const prod = lintIdentity({ browser: Browsers.whatsbibz('Chrome') });
    assert.equal(prod.length, 1); assert.equal(prod[0].level, 'info');
    assert.match(prod[0].message, new RegExp(`OS '${Browsers.whatsbibz('Chrome')[0]}' tidak dikenal server`));
    const mac = lintIdentity({ browser: Browsers.macOS('Desktop'), syncFullHistory: true });
    assert.ok(mac.some((n) => /DARWIN/.test(n.message)));
    assert.equal(lintIdentity({ browser: 'nope' })[0].level, 'warn');
});

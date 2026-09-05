import { platform, release } from 'os';
import { proto } from '../../WAProto/index.js';
import { hostOsLabel } from './platform-identity.js';
const PLATFORM_MAP = {
    aix: 'AIX',
    darwin: 'Mac OS',
    win32: 'Windows',
    android: 'Android',
    freebsd: 'FreeBSD',
    openbsd: 'OpenBSD',
    sunos: 'Solaris',
    linux: undefined,
    haiku: undefined,
    cygwin: undefined,
    netbsd: undefined
};
export const Browsers = {
    ubuntu: browser => ['Ubuntu', browser, '22.04.4'],
    /** Mac OS (Sequoia). Pairing kode: 'Chrome (Mac OS)' dst. — diterima server */
    macOS: browser => ['Mac OS', browser, '15.6.1'],
    /**
     * Arch Linux (rolling; versi = kernel LTS saat rilis). Tampil "Chrome (Arch Linux)"
     * di daftar perangkat. Untuk pairing kode, display otomatis diturunkan ke
     * 'Chrome (Linux)' karena server menolak 'Arch Linux' (400) — lihat platform-identity.js
     */
    archLinux: browser => ['Arch Linux', browser, '6.12.44'],
    /** Linux generik — 'Chrome (Linux)' diterima server apa adanya */
    linux: browser => ['Linux', browser, '6.12.44'],
    baileys: browser => ['Baileys', browser, '6.5.0'],
    /** identitas companion BibzWhats (tampil di daftar perangkat tertaut) */
    whatsbibz: browser => ['WhatsBibz', browser, '1.3.2'],
    /** alias lama */
    bibzwhats: browser => ['WhatsBibz', browser, '1.3.2'],
    windows: browser => ['Windows', browser, '10.0.22631'],
    /** eksperimental (upstream #2201): companion Android — bisa menerima view-once */
    android: browser => [browser, 'Android', ''],
    /**
     * Identitas sesuai host: macOS → 'Mac OS', Windows → 'Windows', Linux → nama distro
     * dari /etc/os-release ('Arch Linux', 'Ubuntu', 'Debian GNU/Linux'→'Debian', ...).
     * Upstream memetakan semua Linux ke 'Ubuntu'; BibzWhats memakai distro sebenarnya.
     */
    appropriate: browser => [hostOsLabel(platform()) || PLATFORM_MAP[platform()] || 'Linux', browser, release()]
};
export const getPlatformId = (browser) => {
    const platformType = proto.DeviceProps.PlatformType[browser.toUpperCase()];
    return platformType ? platformType.toString() : '1'; //chrome
};

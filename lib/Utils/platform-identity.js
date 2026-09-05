// BibzWhats — identitas platform companion (apa yang WhatsApp "lihat" dari library ini)
//
// Tiga tempat identitas dipakai, dan ketiganya berbeda aturannya:
//
//  1. DeviceProps.os  (= browser[0])  → teks di daftar "Perangkat tertaut" di HP.
//     Bebas; server menerima nama apa pun lewat QR.
//  2. companion_platform_display (pairing kode) → DIVALIDASI server dengan
//     allow-list. Nilai tidak dikenal = <error code='400' text='bad-request'/>
//     dan HP tidak pernah dapat notifikasi. Diukur langsung ke server produksi
//     (2026-09-03, WA Web 2.3000.1046672143):
//       OS diterima : Mac OS, macOS, Windows, Linux, Ubuntu, Debian, Fedora,
//                     CentOS, Gentoo, Manjaro, Chromium OS, Android, iOS
//       OS ditolak  : Arch Linux, Arch, ArchLinux, GNU/Linux, Mac OS X, Linux Mint,
//                     openSUSE, Kali, NixOS, Pop!_OS, FreeBSD, Chrome OS,
//                     nama produk (BibzWhats/Foo) — semuanya 400
//       Browser     : Chrome, Chromium, Firefox, Safari, Edge, Opera, Brave, Vivaldi,
//                     Arc diterima; "Desktop" DITOLAK (400)
//     Karena itu library menurunkan display dari OS terdekat yang valid:
//     Arch Linux → "Chrome (Linux)", Mac OS Desktop → "Chrome (Mac OS)".
//  3. WebInfo.webSubPlatform (ClientPayload) → hanya relevan untuk identitas
//     "Desktop" + syncFullHistory. DARWIN (Mac OS Desktop) dan APP_STORE
//     ditutup server: 428 sebelum QR. WIN_HYBRID (Windows) dan WEB_BROWSER
//     diterima. Mac OS Desktop otomatis diturunkan ke WEB_BROWSER.
//
// Hasil pengukuran lengkap ada di test/identity-live.test.js (opsional, live).

import { platform, release } from 'os';
import fs from 'fs';

/** OS yang diterima server pada companion_platform_display (huruf besar-kecil bebas) */
export const PAIRING_ACCEPTED_OS = Object.freeze([
    'Mac OS', 'macOS', 'Windows', 'Linux', 'Ubuntu', 'Debian', 'Fedora',
    'CentOS', 'Gentoo', 'Manjaro', 'Chromium OS', 'Android', 'iOS'
]);

/** OS yang terbukti DITOLAK (400) — dipetakan ke padanan yang valid */
export const PAIRING_OS_FALLBACK = Object.freeze({
    'arch linux': 'Linux', 'archlinux': 'Linux', 'arch': 'Linux', 'arch linux arm': 'Linux',
    'gnu/linux': 'Linux', 'linux mint': 'Linux', 'mint': 'Linux', 'opensuse': 'Linux',
    'kali': 'Linux', 'nixos': 'Linux', 'pop!_os': 'Linux', 'alpine': 'Linux', 'void': 'Linux',
    'endeavouros': 'Linux', 'garuda': 'Linux', 'raspbian': 'Linux', 'red hat': 'Linux',
    'rocky': 'Linux', 'almalinux': 'Linux', 'elementary os': 'Linux', 'zorin': 'Linux',
    'mac os x': 'Mac OS', 'osx': 'Mac OS', 'os x': 'Mac OS', 'darwin': 'Mac OS',
    'chrome os': 'Chromium OS', 'chromeos': 'Chromium OS',
    'freebsd': 'Linux', 'openbsd': 'Linux', 'netbsd': 'Linux', 'solaris': 'Linux', 'aix': 'Linux'
});

/** Nama browser yang diterima server pada companion_platform_display */
export const PAIRING_ACCEPTED_BROWSERS = Object.freeze([
    'Chrome', 'Chromium', 'Firefox', 'Safari', 'Edge', 'Opera', 'Brave', 'Vivaldi', 'Arc'
]);

const lower = (s) => String(s ?? '').trim().toLowerCase();

/** OS untuk companion_platform_display: kembalikan nama valid, atau null bila tidak dikenal */
export function resolvePairingOs(os) {
    const l = lower(os);
    if (!l) return null;
    const exact = PAIRING_ACCEPTED_OS.find((o) => o.toLowerCase() === l);
    if (exact) return exact;
    if (PAIRING_OS_FALLBACK[l]) return PAIRING_OS_FALLBACK[l];
    // heuristik: apa pun yang menyebut linux/ubuntu/debian → Linux; mac → Mac OS; win → Windows
    if (/\blinux\b|ubuntu|debian|fedora|arch/.test(l)) return 'Linux';
    if (/\bmac|darwin|osx/.test(l)) return 'Mac OS';
    if (/windows|win\d/.test(l)) return 'Windows';
    return null;
}

/** Browser untuk companion_platform_display: "Desktop"/nama tak dikenal → Chrome */
export function resolvePairingBrowser(browser) {
    const l = lower(browser);
    const exact = PAIRING_ACCEPTED_BROWSERS.find((b) => b.toLowerCase() === l);
    if (exact) return exact;
    return 'Chrome';
}

/**
 * Turunkan companion_platform_display yang PASTI lolos validasi dari deskripsi
 * browser [os, browser, version]. Contoh:
 *   ['Arch Linux','Chrome','6.16']     → 'Chrome (Linux)'
 *   ['Mac OS','Desktop','14.4.1']      → 'Chrome (Mac OS)'
 *   ['BibzWhats','Chrome','1.2.0']     → 'Chrome (Linux)' (di host Linux) — nama produk tidak valid
 *   ['Mac OS','Safari','14.4.1']       → 'Safari (Mac OS)'
 */
export function derivePairingDisplay(browser, hostOs = platform()) {
    const [os, name] = browser || [];
    const resolvedOs = resolvePairingOs(os) ?? resolvePairingOs(hostOsLabel(hostOs)) ?? 'Linux';
    return `${resolvePairingBrowser(name)} (${resolvedOs})`;
}

/** Apakah string display ini akan diterima server (berdasarkan tabel di atas)? */
export function isPairingDisplayAccepted(display) {
    const m = /^(.+?) \((.+)\)$/.exec(String(display ?? '').trim());
    if (!m) return false;
    const browserOk = PAIRING_ACCEPTED_BROWSERS.some((b) => b.toLowerCase() === lower(m[1]));
    const osOk = PAIRING_ACCEPTED_OS.some((o) => o.toLowerCase() === lower(m[2]));
    return browserOk && osOk;
}

/** Label OS host: 'Mac OS' | 'Windows' | 'Arch Linux' | 'Ubuntu' | ... (dibaca dari /etc/os-release) */
export function hostOsLabel(hostOs = platform()) {
    if (hostOs === 'darwin') return 'Mac OS';
    if (hostOs === 'win32') return 'Windows';
    if (hostOs === 'android') return 'Android';
    if (hostOs === 'linux') return linuxDistroName() || 'Linux';
    return 'Linux';
}

/** Nama distro dari /etc/os-release (NAME=), tanpa embel "GNU/Linux". null bila tak terbaca. */
export function linuxDistroName(file = '/etc/os-release') {
    try {
        const txt = fs.readFileSync(file, 'utf8');
        const m = /^NAME="?([^"\n]+)"?/m.exec(txt);
        if (!m) return null;
        return m[1].replace(/\s+GNU\/Linux/i, '').trim();
    } catch {
        return null;
    }
}

/** Versi OS host yang layak tampil di browser[2] (mis. '14.4.1' / '6.16.4-arch1-1') */
export function hostOsVersion() {
    return release();
}

/**
 * Verifikasi sebuah konfigurasi identitas SEBELUM konek. Mengembalikan daftar
 * catatan {level:'warn'|'info', message}. Dipakai createBibzWhats untuk memberi
 * peringatan dini, dan bisa dipanggil sendiri oleh pemakai.
 */
export function lintIdentity({ browser, companionPlatformDisplay, syncFullHistory } = {}) {
    const notes = [];
    if (!Array.isArray(browser) || browser.length < 2) {
        notes.push({ level: 'warn', message: 'browser harus [os, browser, version]' });
        return notes;
    }
    const [os, name] = browser;
    if (companionPlatformDisplay && !isPairingDisplayAccepted(companionPlatformDisplay)) {
        notes.push({ level: 'warn', message: `companionPlatformDisplay '${companionPlatformDisplay}' tidak ada di daftar yang diterima server (pairing kode akan 400). Disarankan: '${derivePairingDisplay(browser)}'.` });
    }
    if (!companionPlatformDisplay && !resolvePairingOs(os)) {
        notes.push({ level: 'info', message: `OS '${os}' tidak dikenal server untuk pairing kode → display otomatis '${derivePairingDisplay(browser)}' (nama di daftar perangkat tetap '${os}').` });
    }
    if (name === 'Desktop' && syncFullHistory && os === 'Mac OS') {
        notes.push({ level: 'info', message: 'Mac OS Desktop + syncFullHistory: webSubPlatform DARWIN ditolak server (428) → diturunkan ke WEB_BROWSER; riwayat penuh tetap diminta lewat requireFullSync.' });
    }
    return notes;
}

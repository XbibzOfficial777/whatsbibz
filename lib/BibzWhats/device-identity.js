// BibzWhats — identitas perangkat tertaut: KUSTOM atau OTOMATIS (paling stabil).
//
// Prinsip:
//  • Kalau pemakai MENENTUKAN identitas (opsi `browser`/`identity`, atau env
//    BIBZ_BROWSER / BIBZ_DEVICE_OS / BIBZ_DEVICE_BROWSER / BIBZ_DEVICE_VERSION),
//    itu yang dipakai — apa adanya, tanpa "dibetulkan" diam-diam. Library hanya
//    memberi peringatan bila kombinasi itu diketahui bermasalah.
//  • Kalau TIDAK ditentukan (`identity: 'auto'`), library memilih profil dengan
//    skor stabilitas tertinggi dari tabel di bawah (hasil pengukuran ke server
//    WA 2026-09-03), dan bila server menolaknya di tengah jalan (428 sebelum QR,
//    400 saat pairing kode, 405 versi/klien ditolak), otomatis berpindah ke
//    profil stabil berikutnya. Profil yang berhasil dipakai disimpan di
//    <authDir>/identity.json agar konsisten antar restart — identitas harus
//    tetap sama selama sesi hidup, kalau tidak WhatsApp menampilkan perangkat
//    dengan nama berbeda dan bisa memutus sesi.

import fs from 'fs';
import path from 'path';
import { Browsers } from '../Utils/browser-utils.js';
import { derivePairingDisplay, isPairingDisplayAccepted, resolvePairingOs, hostOsLabel, hostOsVersion } from '../Utils/platform-identity.js';

/**
 * Profil identitas, diurutkan dari yang PALING stabil.
 * skor = gabungan: QR/handshake OK, pairing kode diterima tanpa penyesuaian
 * display, tanpa webSubPlatform khusus, umum dipakai klien nyata (kecil
 * kemungkinan dianggap anomali).
 */
export const IDENTITY_PROFILES = Object.freeze([
    { id: 'macos-chrome',   browser: Browsers.macOS('Chrome'),      score: 100, note: 'default; display "Chrome (Mac OS)" diterima apa adanya' },
    { id: 'macos-safari',   browser: Browsers.macOS('Safari'),      score: 95,  note: 'display "Safari (Mac OS)" diterima' },
    { id: 'windows-chrome', browser: Browsers.windows('Chrome'),    score: 92,  note: 'display "Chrome (Windows)" diterima' },
    { id: 'linux-chrome',   browser: Browsers.linux('Chrome'),      score: 90,  note: 'display "Chrome (Linux)" diterima' },
    { id: 'ubuntu-chrome',  browser: Browsers.ubuntu('Chrome'),     score: 88,  note: 'display "Chrome (Ubuntu)" diterima' },
    { id: 'macos-firefox',  browser: Browsers.macOS('Firefox'),     score: 85,  note: 'display "Firefox (Mac OS)" diterima' },
    { id: 'windows-edge',   browser: Browsers.windows('Edge'),      score: 84,  note: 'display "Edge (Windows)" diterima' },
    { id: 'archlinux-chrome', browser: Browsers.archLinux('Chrome'), score: 80, note: 'nama "Arch Linux" di HP; display diturunkan ke "Chrome (Linux)"' },
    { id: 'macos-desktop',  browser: Browsers.macOS('Desktop'),     score: 60,  note: 'riwayat penuh; webSubPlatform WEB_BROWSER (DARWIN ditutup server)' },
    { id: 'windows-desktop', browser: Browsers.windows('Desktop'),  score: 58,  note: 'riwayat penuh; WIN_HYBRID' },
]);

export const IDENTITY_STATE_FILE = 'identity.json';

const isTuple = (b) => Array.isArray(b) && b.length >= 2 && b.slice(0, 2).every((x) => typeof x === 'string' && x.trim());

/** versi default yang wajar bila pemakai tidak mengisi browser[2] */
export function defaultVersionForOs(os) {
    const l = String(os || '').toLowerCase();
    const preset = Object.values(Browsers).map((fn) => { try { return fn('Chrome'); } catch { return null; } })
        .find((t) => t && t[0].toLowerCase() === l && t[2]);
    if (preset) return preset[2];
    if (/mac|darwin/.test(l)) return '15.6.1';
    if (/windows/.test(l)) return '10.0.22631';
    if (/linux|ubuntu|debian|arch|fedora/.test(l)) return '6.12.44';
    return '1.0.0';
}
const withVersion = (t) => [t[0], t[1], t[2] && String(t[2]).trim() ? String(t[2]).trim() : defaultVersionForOs(t[0])];

/** 'Mac OS/Chrome/15.6.1' | 'archLinux:Firefox' | 'Arch Linux, Chrome' | 'macos-safari' → tuple */
export function parseBrowserSpec(spec) {
    if (isTuple(spec)) return withVersion([spec[0], spec[1], spec[2]]);
    if (typeof spec !== 'string' || !spec.trim()) return null;
    const s = spec.trim();
    const profile = IDENTITY_PROFILES.find((p) => p.id === s.toLowerCase());
    if (profile) return [...profile.browser];
    // preset:Browser  (macOS:Chrome, archLinux:Firefox, windows:Edge, appropriate:Chrome)
    const m = /^([A-Za-z]+)\s*[:]\s*([A-Za-z][\w ]*)$/.exec(s);
    if (m) {
        const key = Object.keys(Browsers).find((k) => k.toLowerCase() === m[1].toLowerCase());
        if (key) return withVersion([...Browsers[key](m[2].trim())]);
    }
    const parts = s.split(/\s*[\/|,]\s*/);
    if (parts.length >= 2) return withVersion([parts[0], parts[1], parts[2]]);
    return null;
}

/** Baca identitas dari environment (semua opsional). BIBZ_BROWSER menang atas trio OS/BROWSER/VERSION. */
export function identityFromEnv(env = process.env) {
    const raw = env.BIBZ_BROWSER || env.BIBZ_IDENTITY;
    if (raw) {
        if (/^auto$/i.test(raw.trim())) return 'auto';
        const t = parseBrowserSpec(raw);
        if (t) return t;
    }
    if (env.BIBZ_DEVICE_OS || env.BIBZ_DEVICE_BROWSER) {
        const os = env.BIBZ_DEVICE_OS || hostOsLabel();
        const browser = env.BIBZ_DEVICE_BROWSER || 'Chrome';
        const version = env.BIBZ_DEVICE_VERSION || (env.BIBZ_DEVICE_OS ? '' : hostOsVersion());
        return withVersion([os, browser, version]);
    }
    return null;
}

/**
 * Tentukan identitas efektif.
 * Prioritas: opsi `identity`/`browser` eksplisit → env → 'auto'.
 * @returns {{ mode:'custom'|'auto', browser:[string,string,string], source:string, profileId?:string,
 *             candidates:Array<{id:string,browser:[string,string,string]}>, notes:Array<{level:string,message:string}> }}
 */
export function resolveDeviceIdentity({ identity, browser, authDir, env = process.env, prefer } = {}) {
    const notes = [];
    const explicit = identity ?? browser;
    // 1) eksplisit dari kode
    if (explicit && explicit !== 'auto') {
        const t = parseBrowserSpec(explicit);
        if (t) {
            notes.push(...customIdentityNotes(t));
            return { mode: 'custom', browser: t, source: 'options', candidates: [{ id: 'custom', browser: t }], notes };
        }
        notes.push({ level: 'warn', message: `identitas '${String(explicit)}' tidak bisa dibaca — pakai mode otomatis` });
    }
    // 2) env
    const fromEnv = identityFromEnv(env);
    if (fromEnv && fromEnv !== 'auto') {
        notes.push(...customIdentityNotes(fromEnv));
        return { mode: 'custom', browser: fromEnv, source: 'env', candidates: [{ id: 'custom', browser: fromEnv }], notes };
    }
    // 3) otomatis: kandidat terurut; profil yang pernah sukses di sesi ini didahulukan
    let candidates = [...IDENTITY_PROFILES]
        .filter((p) => !/desktop$/.test(p.id)) // Desktop hanya bila diminta eksplisit (butuh syncFullHistory)
        .sort((a, b) => b.score - a.score)
        .map((p) => ({ id: p.id, browser: [...p.browser] }));
    if (typeof prefer === 'string') {
        const i = candidates.findIndex((c) => c.id === prefer);
        if (i > 0) candidates = [candidates[i], ...candidates.slice(0, i), ...candidates.slice(i + 1)];
    }
    const saved = authDir ? loadIdentityState(authDir) : null;
    if (saved?.browser && isTuple(saved.browser)) {
        const i = candidates.findIndex((c) => c.id === saved.profileId);
        if (i > 0) candidates = [candidates[i], ...candidates.slice(0, i), ...candidates.slice(i + 1)];
        else if (i < 0) candidates = [{ id: saved.profileId || 'saved', browser: saved.browser }, ...candidates];
        notes.push({ level: 'info', message: `identitas otomatis dilanjutkan dari sesi: ${saved.browser[1]} (${saved.browser[0]})` });
    }
    const first = candidates[0];
    return { mode: 'auto', browser: first.browser, source: saved ? 'auto+saved' : 'auto', profileId: first.id, candidates, notes };
}

function customIdentityNotes(t) {
    const notes = [];
    if (!resolvePairingOs(t[0])) {
        notes.push({ level: 'info', message: `OS '${t[0]}' tidak ada di allow-list pairing kode WhatsApp → display pairing otomatis '${derivePairingDisplay(t)}' (nama di daftar perangkat tetap '${t[0]}')` });
    }
    if (t[1] === 'Desktop') {
        notes.push({ level: 'info', message: `identitas Desktop: riwayat penuh hanya diminta bila socketConfig.syncFullHistory=true; pairing kode memakai '${derivePairingDisplay(t)}'` });
    }
    return notes;
}

export function identityStatePath(authDir) {
    return path.join(authDir, IDENTITY_STATE_FILE);
}

export function loadIdentityState(authDir) {
    try {
        const raw = fs.readFileSync(identityStatePath(authDir), 'utf8');
        const j = JSON.parse(raw);
        return j && isTuple(j.browser) ? j : null;
    } catch {
        return null;
    }
}

export function saveIdentityState(authDir, { browser, profileId, mode, reason }) {
    try {
        fs.mkdirSync(authDir, { recursive: true });
        fs.writeFileSync(identityStatePath(authDir), JSON.stringify({ browser, profileId, mode, reason, at: new Date().toISOString() }, null, 2));
        return true;
    } catch {
        return false;
    }
}

export function clearIdentityState(authDir) {
    try { fs.rmSync(identityStatePath(authDir), { force: true }); } catch {}
}

/**
 * Apakah kegagalan ini menandakan server MENOLAK IDENTITAS (bukan jaringan/nomor)?
 * - 428 sebelum QR pernah muncul: handshake/ClientPayload ditolak (mis. webSubPlatform ditutup)
 * - 400 bad-request pada pairing kode: companion_platform_display tidak dikenal
 * - 405 (Method Not Allowed) pada connect: klien/versi ditolak
 * 401/408/429/515 BUKAN alasan ganti identitas.
 */
export function isIdentityRejection({ status, sawQr = false, phase = 'connect', errorData } = {}) {
    if (phase === 'pairing') return status === 400 || errorData === 400;
    if (status === 405) return true;
    if (status === 428 && !sawQr) return true;
    return false;
}

/**
 * Pengelola rotasi identitas untuk mode otomatis.
 * next(reason) → kandidat berikutnya (atau null bila habis); current → kandidat aktif.
 */
export function createIdentityRotator({ candidates, authDir, mode, logger, onChange = () => {} }) {
    let index = 0;
    const tried = [];
    const current = () => candidates[index];
    const commit = (reason) => {
        if (authDir) saveIdentityState(authDir, { browser: current().browser, profileId: current().id, mode, reason });
    };
    return {
        get current() { return current(); },
        get index() { return index; },
        get tried() { return [...tried]; },
        get exhausted() { return index >= candidates.length - 1; },
        /** panggil saat identitas terbukti bekerja (QR diterima / pairing diakui / open) */
        markStable(reason = 'ok') {
            commit(reason);
        },
        /** ganti ke kandidat berikutnya; false bila mode custom atau kandidat habis */
        next(reason) {
            if (mode !== 'auto') return false;
            if (index >= candidates.length - 1) return false;
            tried.push({ id: current().id, reason });
            index += 1;
            const c = current();
            logger?.warn?.(`BibzWhats: identitas '${tried[tried.length - 1].id}' ditolak server (${reason}) → mencoba '${c.id}' = ${c.browser[1]} (${c.browser[0]})`);
            if (authDir) saveIdentityState(authDir, { browser: c.browser, profileId: c.id, mode, reason: `rotated: ${reason}` });
            onChange(c, reason);
            return true;
        },
    };
}

/** Ringkasan identitas untuk log/`client.identity` */
export function describeIdentity(browser, { companionPlatformDisplay } = {}) {
    const display = companionPlatformDisplay || derivePairingDisplay(browser);
    return {
        browser: [...browser],
        linkedDeviceName: `${browser[1]} (${browser[0]})`,
        pairingDisplay: display,
        pairingDisplayAccepted: isPairingDisplayAccepted(display),
    };
}

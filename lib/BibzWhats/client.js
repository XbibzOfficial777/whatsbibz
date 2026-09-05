// BibzWhats — createBibzWhats()
// Pembungkus tingkat tinggi di atas makeWASocket:
//  • versi WA Web TERBARU diambil di setiap connect (server menolak versi lama)
//  • pairing code (custom/acak) + fallback QR headless
//  • auto-reconnect dengan backoff, 515 restartRequired → reconnect segera
//  • sesi korup / 401 loggedOut / 500 badSession / 411 → wipe otomatis + identitas baru
//  • cache metadata grup bawaan (cachedGroupMetadata)
//  • event 'ready' dipancarkan untuk SETIAP socket baru (pertama & tiap reconnect)
//    — pasang handler pesan di sini; 'first-ready' hanya sekali
//
// API Baileys asli (sock.ev, sock.sendMessage, ...) tetap tersedia lewat
// client.sock — tidak ada yang disembunyikan.

import fs from 'fs';
import https from 'https';
import { EventEmitter } from 'events';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import makeWASocket from '../Socket/index.js';
import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { DisconnectReason } from '../Types/index.js';
import { useMultiFileAuthState, fetchLatestWaWebVersion } from '../Utils/index.js';
import { Browsers } from '../Utils/browser-utils.js';
import { lintIdentity, derivePairingDisplay } from '../Utils/platform-identity.js';
import { resolveDeviceIdentity, createIdentityRotator, isIdentityRejection, describeIdentity, clearIdentityState, loadIdentityState, saveIdentityState } from './device-identity.js';
import { createPairingController } from './pairing.js';

export const BIBZWHATS_DEFAULTS = Object.freeze({
    authDir: 'bibzwhats-session',
    /**
     * identitas perangkat tertaut. Tidak diisi / 'auto' = pilih profil PALING STABIL
     * (Browsers.macOS('Chrome')) dan berpindah otomatis bila server menolak.
     * Kustom: tuple ['Arch Linux','Chrome','6.12.44'], string 'archLinux:Firefox' /
     * 'Mac OS/Safari/15.6.1' / id profil 'linux-chrome', atau env BIBZ_BROWSER.
     */
    identity: 'auto',
    /** alias lama untuk `identity` (kompatibel): tuple browser eksplisit */
    browser: null,
    /** mode auto: maksimum pergantian identitas sebelum menyerah */
    maxIdentityRotations: 4,
    maxReconnectAttempts: 10,
    maxSessionWipes: 3,
    qrFallbackAfterMs: 90000,
    pairingRequestDelayMs: 20000,
    restartDelayMs: 2000,
    wipeReconnectDelayMs: 10000,
    reconnectStepMs: 10000,
    reconnectMaxMs: 60000,
    forceIPv4: true,
    fetchLatestVersion: true,
    groupMetadataTtlMs: 5 * 60 * 1000,
    /**
     * string yang divalidasi WA saat pairing kode; null = diturunkan otomatis ke nilai
     * yang PASTI valid: Mac OS → "Chrome (Mac OS)", Arch Linux → "Chrome (Linux)"
     */
    companionPlatformDisplay: null,
    /** 'ready' tiap socket baru (true) atau hanya sekali (false, perilaku lama) */
    readyOnEveryConnect: true,
});

/** Hapus folder sesi & buat ulang. Aman dipanggil saat folder tak ada. */
export function wipeAuthDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
    fs.mkdirSync(dir, { recursive: true });
    return true;
}

export function makeSocketNetworkOptions({ forceIPv4 = true } = {}) {
    return forceIPv4 ? { fetchAgent: new https.Agent({ keepAlive: true, family: 4 }) } : {};
}

/**
 * Peta statusCode → alasan wipe sesi (null = jangan wipe).
 * @param {number|undefined} status
 * @param {string} message
 */
export function sessionWipeReason(status, message = '') {
    if (status === DisconnectReason.loggedOut) return '401 loggedOut';
    if (status === 500) return '500 badSession';
    if (status === 411) return '411 multideviceMismatch';
    if (/corrupt|invalid creds|bad session|unauthorized/i.test(String(message))) return `error sesi: ${String(message).slice(0, 60)}`;
    return null;
}

const noopLogger = { info() {}, warn() {}, error() {}, debug() {}, trace() {}, ok() {} };

function mergeLogger(logger) {
    const base = logger || console;
    return {
        info: (...a) => (base.info || base.log || noopLogger.info).call(base, ...a),
        warn: (...a) => (base.warn || base.log || noopLogger.warn).call(base, ...a),
        error: (...a) => (base.error || base.log || noopLogger.error).call(base, ...a),
        debug: (...a) => (base.debug || noopLogger.debug).call(base, ...a),
        ok: (...a) => (base.ok || base.info || base.log || noopLogger.ok).call(base, ...a),
    };
}

/**
 * @typedef {object} BibzWhatsOptions
 * @property {string} phone               nomor bot (digit, dengan kode negara) — wajib untuk pairing code
 * @property {string} [pairingCode]       kode custom 8 karakter A-Z0-9; kosong = acak bawaan
 * @property {string} [authDir]           folder kredensial (default 'bibzwhats-session')
 * @property {'auto'|string|[string,string,string]} [identity]  identitas perangkat tertaut: 'auto' (default, paling stabil + rotasi otomatis) atau kustom
 * @property {[string,string,string]} [browser]  alias lama `identity` (tuple eksplisit)
 * @property {object} [logger]            {info,warn,error,ok,debug}
 * @property {boolean} [printQR]          cetak QR ASCII ke console saat fallback (butuh qrcode-terminal)
 * @property {object} [socketConfig]      opsi tambahan langsung ke makeWASocket (override)
 * @property {string} [companionPlatformDisplay]  override `companion_platform_display` (WA memvalidasi dgn allow-list; default diturunkan otomatis, mis. "Chrome (Mac OS)" / "Chrome (Linux)")
 * @property {boolean} [readyOnEveryConnect]      default true — 'ready' tiap socket baru; false = hanya sekali
 */

/**
 * Buat client BibzWhats. Mengembalikan EventEmitter dengan event:
 *  'pairing-code' (code, {custom, fallback})   'qr' (qr)
 *  'open' (sock)  'ready' (sock — tiap socket BARU pertama kali open; pasang handler di sini)
 *  'first-ready' (sock — hanya sekali seumur client)
 *  'close' ({status, error})  'reconnecting' ({delay, attempt})
 *  'session-wiped' (reason)   'user' (digits)  'give-up' (message)
 *  'identity-changed' ({browser, linkedDeviceName, pairingDisplay, profileId, reason}) — hanya mode auto
 * @param {BibzWhatsOptions} options
 */
export async function createBibzWhats(options = {}) {
    const opts = { ...BIBZWHATS_DEFAULTS, ...options };
    const log = mergeLogger(opts.logger);
    const emitter = new EventEmitter();
    const groupMetadataCache = new Map();

    // ── Identitas perangkat tertaut: kustom (opsi/env) atau otomatis (paling stabil) ──
    const resolved = resolveDeviceIdentity({ identity: opts.identity === 'auto' ? undefined : opts.identity, browser: opts.browser, authDir: opts.authDir });
    for (const note of resolved.notes) (note.level === 'warn' ? log.warn : log.info)(`BibzWhats: ${note.message}`);
    const rotator = createIdentityRotator({
        candidates: resolved.candidates.slice(0, Math.max(1, opts.maxIdentityRotations + 1)),
        authDir: opts.authDir, mode: resolved.mode, logger: log,
        onChange: (c, reason) => emitter.emit('identity-changed', { ...describeIdentity(c.browser, opts), profileId: c.id, reason }),
    });
    const currentBrowser = () => rotator.current.browser;
    log.info(`BibzWhats: identitas perangkat ${resolved.mode === 'auto' ? 'OTOMATIS' : 'KUSTOM'} (${resolved.source}) → ${currentBrowser()[1]} (${currentBrowser()[0]})`);
    // Peringatan dini identitas (sebelum menyentuh server): display tak valid → 400 saat pairing.
    for (const note of lintIdentity({ browser: currentBrowser(), companionPlatformDisplay: opts.companionPlatformDisplay, syncFullHistory: opts.socketConfig?.syncFullHistory })) {
        (note.level === 'warn' ? log.warn : log.info)(`BibzWhats: ${note.message}`);
    }
    const identityInfo = () => Object.freeze({
        ...describeIdentity(currentBrowser(), opts),
        mode: resolved.mode, source: resolved.source, profileId: rotator.current.id,
        tried: rotator.tried,
    });

    let closedByUser = false;
    let attempts = 0;
    let wipeCount = 0;
    let currentSock = null;
    let readyCalled = false;
    let stopPairingRef = () => {};
    // Pairing code sudah diterbitkan server untuk kredensial saat ini (belum terdaftar).
    // Kalau koneksi putus di fase ini, server menolak kredensial yang sama dengan 401
    // ('pairing pending') — bukan masalah nomor/IP: ganti kredensial & minta kode lagi.
    let pairingIssuedAt = 0;
    let pendingPairingWipes = 0;
    // Semua reconnect dijadwalkan lewat satu tempat supaya close() bisa membatalkannya
    // (tanpa ini timer tertinggal → proses tidak bisa keluar & socket "hantu" tersambung lagi).
    let reconnectTimer = null;
    const scheduleReconnect = (delay) => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (closedByUser) return;
            void connect().catch((e) => log.error(`BibzWhats: reconnect gagal: ${e?.message || e}`));
        }, delay);
    };

    const wipeSession = (reason, { counted = true } = {}) => {
        if (counted) wipeCount += 1;
        stopPairingRef();
        // Simpan identitas yang sudah terbukti stabil: wipe sesi (401/500/411) BUKAN
        // penolakan identitas. Kalau identitas ikut hilang, restart berikutnya mulai
        // lagi dari kandidat pertama dan perangkat bisa muncul dengan nama berbeda.
        const keepIdentity = loadIdentityState(opts.authDir);
        wipeAuthDir(opts.authDir);
        if (keepIdentity && /^(qr-received|pairing-accepted|open)$/.test(String(keepIdentity.reason))) {
            saveIdentityState(opts.authDir, { ...keepIdentity, reason: keepIdentity.reason });
        } else {
            clearIdentityState(opts.authDir);
        }
        groupMetadataCache.clear();
        emitter.emit('session-wiped', reason);
        log.warn(`BibzWhats: sesi dihapus otomatis (${reason}) — folder ${opts.authDir} dibersihkan`);
        if (counted && wipeCount > opts.maxSessionWipes) {
            const message =
                `BibzWhats: ${wipeCount}x hapus sesi tapi masih ditolak — ini BUKAN masalah sesi. ` +
                'Cek: (1) nomor terdaftar & aktif di WhatsApp, (2) digit benar, (3) IP server mungkin dibatasi WA.';
            log.error(message);
            emitter.emit('give-up', message);
            closedByUser = true;
        }
        attempts = 0;
    };

    async function connect() {
        if (closedByUser) return currentSock;
        let authState;
        let saveCreds;
        try {
            ({ state: authState, saveCreds } = await useMultiFileAuthState(opts.authDir));
            if (!authState?.creds) throw new Error('creds kosong');
        } catch (e) {
            log.error(`BibzWhats: sesi KORUP di ${opts.authDir} (${e?.message || e}) — membersihkan otomatis...`);
            wipeSession('sesi korup');
            if (closedByUser) throw new Error(`BibzWhats: pemulihan sesi gagal ${wipeCount}x — periksa nomor/IP lalu start ulang.`);
            ({ state: authState, saveCreds } = await useMultiFileAuthState(opts.authDir));
        }

        let version;
        if (opts.fetchLatestVersion) {
            try {
                const latest = await fetchLatestWaWebVersion();
                // hanya pakai hasil fetch bila benar-benar dari web.whatsapp.com; bila gagal
                // jangan menurunkan versi (upstream issue #2777: versi lama → 408 loop)
                if (latest.isLatest) version = latest.version;
                log.info(`BibzWhats: versi WA web ${(version || DEFAULT_CONNECTION_CONFIG.version).join('.')}${latest.isLatest ? '' : ' (bawaan library)'}`);
            } catch (e) {
                log.warn(`BibzWhats: gagal ambil versi WA terbaru (${e?.message || e}) — pakai versi bawaan`);
            }
        }

        const sock = makeWASocket({
            ...(version ? { version } : {}),
            auth: authState,
            logger: pino({ level: 'silent' }),
            browser: currentBrowser(),
            ...(opts.companionPlatformDisplay ? { companionPlatformDisplay: opts.companionPlatformDisplay } : {}),
            printQRInTerminal: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 350,
            ...makeSocketNetworkOptions({ forceIPv4: opts.forceIPv4 }),
            getMessage: async () => undefined,
            cachedGroupMetadata: async (jid) => {
                const cached = groupMetadataCache.get(jid);
                if (cached && Date.now() - cached.ts < opts.groupMetadataTtlMs) return cached.metadata;
                try {
                    const metadata = await sock.groupMetadata(jid);
                    groupMetadataCache.set(jid, { metadata, ts: Date.now() });
                    return metadata;
                } catch {
                    return undefined;
                }
            },
            ...(opts.socketConfig || {}),
        });
        currentSock = sock;
        emitter.emit('socket', sock);

        const cacheGroups = (groups) => {
            for (const group of groups || []) {
                const jid = group?.id || group?.jid;
                if (jid && group) groupMetadataCache.set(jid, { metadata: group, ts: Date.now() });
            }
        };
        sock.ev.on('groups.update', cacheGroups);
        sock.ev.on('groups.upsert', cacheGroups);

        let qrFallback = null;
        let pairingStartedAt = 0;
        let pairingStarted = false;
        let sockReady = false;
        let sawQr = false;
        let rotatedByPairing = false;
        const pairing = createPairingController({
            sock,
            phone: opts.phone,
            pairingCode: opts.pairingCode,
            logger: log,
            onCode: (code, meta) => {
                pairingIssuedAt = Date.now();
                rotator.markStable('pairing-accepted');
                emitter.emit('pairing-code', code, meta);
            },
            onRejected: (error, info) => {
                // 400 = companion_platform_display identitas ini tidak dikenal server.
                // Mode auto: ganti identitas & sambung ulang dengan creds yang sama
                // (belum terdaftar, jadi aman). Mode kustom: biarkan pemakai yang memutuskan.
                if (!isIdentityRejection({ phase: 'pairing', status: info?.code, errorData: info?.code })) return false;
                if (!rotator.next('400 bad-request saat pairing kode')) return false;
                rotatedByPairing = true;
                pairing.stop();
                try { sock.end(new Boom('identity rotation', { statusCode: DisconnectReason.connectionClosed })); } catch {}
                return true; // rotasi diambil alih; jangan jadwalkan ulang di controller
            },
        });
        const stopPairing = () => {
            pairing.stop();
            if (qrFallback) {
                clearTimeout(qrFallback);
                qrFallback = null;
            }
            pairingStartedAt = 0;
        };
        stopPairingRef = stopPairing;

        sock.ev.on('creds.update', (update) => {
            // Folder sesi bisa sudah hilang (dihapus pemakai / wipe / close di tengah tulis):
            // jangan biarkan jadi unhandled rejection yang mematikan proses.
            saveCreds(update).catch((e) => {
                if (closedByUser || e?.code === 'ENOENT') {
                    if (!closedByUser) log.warn(`BibzWhats: gagal menyimpan kredensial (${e.code}) — folder sesi ${opts.authDir} hilang; akan dibuat ulang saat sambung berikutnya.`);
                    return;
                }
                log.error(`BibzWhats: gagal menyimpan kredensial: ${e?.message || e}`);
            });
            if (sock.authState.creds.registered) stopPairing();
        });

        sock.ev.on('connection.update', (u) => {
            const { connection, qr, lastDisconnect } = u;
            emitter.emit('connection.update', u);

            if (qr && !sock.authState.creds.registered) {
                if (!sawQr) { sawQr = true; rotator.markStable('qr-received'); }
                if (!pairingStartedAt) pairingStartedAt = Date.now();
                if (opts.phone && !pairingStarted) {
                    pairingStarted = true;
                    log.info('BibzWhats: perangkat belum terdaftar — meminta pairing code...');
                    pairing.start().catch((e) => log.error(`BibzWhats: pairing gagal: ${e?.message || e}`));
                }
                const showQr = !opts.phone || Date.now() - pairingStartedAt > opts.qrFallbackAfterMs;
                if (showQr) {
                    emitter.emit('qr', qr);
                    if (opts.printQR) Promise.resolve(printQrToTerminal(qr, log)).catch(() => {});
                }
            }
            if (sock.authState.creds.registered) stopPairing();

            if (connection === 'open' && !sock.authState.creds.registered && opts.phone) {
                qrFallback = setTimeout(() => {
                    if (!sock.authState.creds.registered && !pairingStarted) {
                        pairingStarted = true;
                        log.info('BibzWhats: QR tidak diterima — minta pairing code langsung...');
                        pairing.start().catch((e) => log.error(`BibzWhats: pairing gagal: ${e?.message || e}`));
                    }
                }, opts.pairingRequestDelayMs);
            }

            if (connection === 'open') {
                if (qrFallback) {
                    clearTimeout(qrFallback);
                    qrFallback = null;
                }
                attempts = 0;
                wipeCount = 0;
                pairingIssuedAt = 0;
                pendingPairingWipes = 0;
                rotator.markStable('open');
                const digits = String(sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
                log.ok(`BibzWhats: TERHUBUNG sebagai +${digits}`);
                if (digits) emitter.emit('user', digits);
                emitter.emit('open', sock);
                // 'ready' = socket ini siap dipakai & belum pernah dilaporkan. Setelah
                // reconnect, socket lama sudah mati (listener ikut hilang) → pemakai
                // HARUS memasang ulang handler pesan di socket baru.
                if (!sockReady && (opts.readyOnEveryConnect || !readyCalled)) {
                    sockReady = true;
                    emitter.emit('ready', sock);
                }
                if (!readyCalled) {
                    readyCalled = true;
                    emitter.emit('first-ready', sock);
                }
                return;
            }

            if (connection === 'close') {
                stopPairing();
                const err = lastDisconnect?.error;
                const status = err?.output?.statusCode;
                emitter.emit('close', { status, error: err });

                // Socket ditutup oleh kita sendiri setelah rotasi identitas (400 saat pairing):
                // sambung ulang segera dengan identitas baru, jangan lewat backoff biasa.
                if (rotatedByPairing) {
                    emitter.emit('reconnecting', { delay: opts.restartDelayMs, attempt: attempts, fresh: false, identity: rotator.current.id });
                    scheduleReconnect(opts.restartDelayMs);
                    return;
                }

                // Server menolak IDENTITAS (bukan sesi/nomor): 428 sebelum QR muncul, atau 405.
                // Mode auto → ganti profil & sambung ulang segera; mode kustom → hanya diberi tahu.
                if (!sock.authState.creds.registered && isIdentityRejection({ status, sawQr, phase: 'connect' })) {
                    if (rotator.next(`${status} sebelum QR`)) {
                        emitter.emit('reconnecting', { delay: opts.restartDelayMs, attempt: attempts, fresh: false, identity: rotator.current.id });
                        scheduleReconnect(opts.restartDelayMs);
                        return;
                    }
                    if (resolved.mode === 'custom') {
                        log.error(`BibzWhats: server menolak identitas kustom ${currentBrowser()[1]} (${currentBrowser()[0]}) (statusCode ${status} sebelum QR). ` +
                            `Coba identitas lain atau biarkan kosong (mode otomatis).`);
                    }
                }

                if (status === DisconnectReason.restartRequired) {
                    log.ok(`BibzWhats: pairing SUKSES — server minta restart (515) — reconnect dalam ${opts.restartDelayMs / 1000}s...`);
                    attempts = 0;
                    scheduleReconnect(opts.restartDelayMs);
                    return;
                }

                const pairingPending = !sock.authState.creds.registered && pairingIssuedAt > 0 && Date.now() - pairingIssuedAt < 15 * 60_000;
                if (status === DisconnectReason.loggedOut && pairingPending && pendingPairingWipes < opts.maxReconnectAttempts) {
                    pendingPairingWipes += 1;
                    const delay = pendingPairingWipes <= 3 ? Math.max(opts.restartDelayMs, 2000) : opts.wipeReconnectDelayMs;
                    log.warn(`BibzWhats: pairing sebelumnya masih tertunda di server (401 setelah sambung ulang) — kredensial diganti, pairing code diminta ulang dalam ${delay / 1000}s...`);
                    wipeSession('401 pairing tertunda', { counted: false });
                    if (closedByUser) return;
                    emitter.emit('reconnecting', { delay, attempt: 0, fresh: true, pairingPending: true });
                    scheduleReconnect(delay);
                    return;
                }

                if (status === DisconnectReason.loggedOut && sock.authState.creds.registered) {
                    log.error('BibzWhats: perangkat DILEPASKAN dari WhatsApp (401) — sesi dihapus & pairing ulang.');
                } else if (status === DisconnectReason.loggedOut) {
                    log.error('BibzWhats: koneksi DITOLAK sebelum pairing (401) — nomor belum aktif / digit salah / pairing pending / IP dibatasi.');
                } else if (status) {
                    log.warn(`BibzWhats: koneksi tutup (statusCode ${status}) — ${err?.message || ''}`);
                }

                const wipeReason = sessionWipeReason(status, err?.message);
                if (wipeReason) {
                    wipeSession(wipeReason);
                    if (closedByUser) return;
                    log.info(`BibzWhats: reconnect dengan sesi BARU dalam ${opts.wipeReconnectDelayMs / 1000}s...`);
                    emitter.emit('reconnecting', { delay: opts.wipeReconnectDelayMs, attempt: 0, fresh: true });
                    scheduleReconnect(opts.wipeReconnectDelayMs);
                    return;
                }

                if (closedByUser) return;
                attempts += 1;
                if (attempts >= opts.maxReconnectAttempts) {
                    const message = `BibzWhats: reconnect dihentikan setelah ${attempts}x gagal berturut — periksa nomor & jaringan.`;
                    log.error(message);
                    emitter.emit('give-up', message);
                    return;
                }
                // Koneksi yang sudah 'sehat' (server menerbitkan pairing code) lalu putus karena
                // jaringan → percobaan pertama cepat; backoff bertahap baru berlaku bila gagal lagi.
                const healthyDrop = attempts === 1 && pairingIssuedAt > 0 && status === DisconnectReason.connectionClosed;
                const delay = healthyDrop ? Math.max(opts.restartDelayMs, 1000) : Math.min(opts.reconnectStepMs * attempts, opts.reconnectMaxMs);
                log.info(`BibzWhats: reconnect otomatis dalam ${Math.round(delay / 1000)}s (percobaan ${attempts}/${opts.maxReconnectAttempts})...`);
                emitter.emit('reconnecting', { delay, attempt: attempts, fresh: false });
                scheduleReconnect(delay);
            }
        });

        return sock;
    }

    const sock = await connect();

    // CATATAN: getter TIDAK boleh lewat Object.assign — Object.assign mengevaluasi
    // getter sekali dan menyalin nilainya, sehingga client.sock akan "membeku" di
    // socket pertama setelah reconnect. Pakai defineProperty.
    Object.defineProperty(emitter, 'identity', { get: () => identityInfo(), enumerable: true });
    Object.defineProperty(emitter, 'sock', {
        /** socket aktif saat ini (berubah setelah reconnect) */
        get: () => currentSock,
        enumerable: true,
        configurable: false,
    });
    const client = Object.assign(emitter, {
        /** socket pertama (untuk kompatibilitas) */
        initialSock: sock,
        options: opts,
        isConnected: () => !!currentSock?.user && !!currentSock?.ws?.isOpen,
        close() {
            closedByUser = true;
            stopPairingRef();
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            try {
                currentSock?.ev?.removeAllListeners?.('connection.update');
                currentSock?.end?.();
            } catch {}
        },
        async logout() {
            closedByUser = true;
            stopPairingRef();
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            try {
                await currentSock?.logout?.();
            } catch {}
            wipeAuthDir(opts.authDir);
        },
    });
    return client;
}

async function printQrToTerminal(qr, log) {
    try {
        const mod = await import('qrcode-terminal');
        const QR = mod.default || mod;
        QR.generate(qr, (q) => console.log(q), { small: true });
    } catch {
        log.warn('BibzWhats: qrcode-terminal tidak terpasang — QR mentah: ' + qr.slice(0, 40) + '…');
    }
}


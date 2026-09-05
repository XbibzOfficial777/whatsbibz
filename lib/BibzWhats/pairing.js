// BibzWhats — PairingController
// Meminta pairing code (custom 8 karakter atau acak bawaan) dengan disiplin:
//  • satu request in-flight pada satu waktu
//  • refresh berjeda panjang (default 150 dtk) agar kode yang sedang diketik
//    di HP tidak hangus di tengah percobaan
//  • custom code ditolak server → fallback SEKALI ke kode acak
//  • rate-limit (428/429) → backoff eksponensial sampai PAIRING_BACKOFF_MAX_MS
//  • berhenti otomatis begitu creds.registered = true

export const PAIRING_REFRESH_MS = 150000;
export const PAIRING_BACKOFF_MAX_MS = 600000;

export function normalizePairingCode(value) {
    const normalized = String(value ?? '').trim().toUpperCase();
    return /^[A-Z0-9]{8}$/.test(normalized) ? normalized : '';
}

/**
 * Kode error dari server. Boom hasil assertNodeErrorFree menyimpan kode stanza
 * WA di `error.data` (mis. 400 bad-request, 429 rate-overlimit), sedangkan
 * statusCode Boom-nya 500 generik — jadi keduanya harus dicek.
 */
export function pairingErrorCode(error) {
    const fromData = typeof error?.data === 'number' ? error.data : undefined;
    const status = error?.output?.statusCode ?? error?.statusCode ?? error?.status;
    return fromData ?? (status && status !== 500 ? status : undefined);
}

export function isRateLimitError(error) {
    const code = pairingErrorCode(error);
    return code === 428 || code === 429 || /rate[- ]?overlimit|rate.?limit|too many|428|429/i.test(String(error?.message || error));
}

export function isCustomPairingError(error) {
    const code = pairingErrorCode(error);
    return code === 422 || /custom pairing code|pairing code.*(invalid|reject|unsupported)|invalid.*pairing/i.test(String(error?.message || error));
}

/** 400 bad-request pada companion_hello = server tidak mengenali companion_platform_display (bukan soal kode custom) */
export function isRegistrationRejected(error) {
    return pairingErrorCode(error) === 400 || /bad-request/i.test(String(error?.message || error));
}

export function isTimeoutError(error) {
    return pairingErrorCode(error) === 408 || /timed out|timeout/i.test(String(error?.message || error));
}

function emitLog(logger, level, message) {
    if (typeof logger?.[level] === 'function') logger[level](message);
    else if (typeof logger?.warn === 'function') logger.warn(message);
}

/**
 * @param {object} opts
 * @param {import('../Socket/index.js').WASocket} opts.sock
 * @param {string} opts.phone            nomor bot, digit saja (E.164 tanpa +)
 * @param {string} [opts.pairingCode]    kode custom 8 karakter A-Z0-9 (opsional)
 * @param {(code: string, meta: {custom: boolean, fallback: boolean}) => void} [opts.onCode]
 * @param {object} [opts.logger]
 * @param {number} [opts.refreshMs]
 * @param {number} [opts.backoffMaxMs]
 */
export function createPairingController({
    sock,
    phone,
    pairingCode = '',
    onCode = () => {},
    logger = console,
    refreshMs = PAIRING_REFRESH_MS,
    backoffMaxMs = PAIRING_BACKOFF_MAX_MS,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    /**
     * dipanggil saat server MENOLAK registrasi (400 bad-request / kode lain yang
     * bukan rate-limit & bukan timeout). Kembalikan true bila pemanggil mengambil
     * alih (mis. mengganti identitas & menyambung ulang) → controller berhenti,
     * tidak menjadwalkan ulang. Argumen: (error, { code, phone }).
     */
    onRejected = () => false,
} = {}) {
    let timer = null;
    let inFlight = false;
    let stopped = false;
    let fallbackUsed = false;
    let rateLimitDelay = refreshMs;

    const registered = () => !!sock?.authState?.creds?.registered;
    const stop = () => {
        stopped = true;
        if (timer) clearTimeoutFn(timer);
        timer = null;
    };
    const schedule = (delay) => {
        if (stopped || registered()) return;
        if (timer) clearTimeoutFn(timer);
        timer = setTimeoutFn(() => {
            timer = null;
            void request();
        }, delay);
    };
    const handleFailure = (error) => {
        if (isRateLimitError(error)) {
            const delay = rateLimitDelay;
            rateLimitDelay = Math.min(rateLimitDelay * 2, backoffMaxMs);
            emitLog(logger, 'warn', `pairing terkena rate-limit/428 — menunggu ${Math.round(delay / 1000)}s sebelum mencoba lagi`);
            schedule(delay);
            return;
        }
        if (isRegistrationRejected(error)) {
            let handled = false;
            try { handled = !!onRejected(error, { code: pairingErrorCode(error) ?? 400, phone }); } catch {}
            if (handled) {
                stop();
                return;
            }
            emitLog(logger, 'error',
                `registrasi pairing DITOLAK server (400 bad-request): companion_platform_display tidak ada di allow-list WhatsApp. ` +
                `Biarkan companionPlatformDisplay kosong (library menurunkannya otomatis, mis. 'Chrome (Mac OS)' / 'Chrome (Linux)') ` +
                `atau pakai nilai yang diterima: browser Chrome/Firefox/Safari/Edge + OS Mac OS/Windows/Linux/Ubuntu/Debian/Fedora. ` +
                `Coba lagi dalam ${refreshMs / 1000}s.`);
        } else if (isTimeoutError(error)) {
            emitLog(logger, 'error',
                `server tidak menjawab registrasi pairing (timeout) — cek nomor (${phone || '-'}) terdaftar di WhatsApp & jaringan ` +
                `server tidak diblokir. Coba lagi dalam ${refreshMs / 1000}s.`);
        } else {
            emitLog(logger, 'error', `pairing gagal (${error?.message || error}) — percobaan berikutnya paling cepat ${refreshMs / 1000}s lagi`);
        }
        schedule(refreshMs);
    };

    async function request() {
        if (stopped || inFlight) return null;
        if (registered()) {
            stop();
            return null;
        }
        inFlight = true;
        const custom = normalizePairingCode(pairingCode);
        const useCustom = !!custom && !fallbackUsed;
        try {
            const code = useCustom
                ? await sock.requestPairingCode(phone, custom)
                : await sock.requestPairingCode(phone);
            if (registered()) {
                stop();
                return code;
            }
            rateLimitDelay = refreshMs;
            onCode(code, { custom: useCustom, fallback: fallbackUsed });
            schedule(refreshMs);
            return code;
        } catch (error) {
            if (useCustom && !isRateLimitError(error) && isCustomPairingError(error) && !fallbackUsed) {
                fallbackUsed = true;
                emitLog(logger, 'warn', `custom pairing code ditolak (${error?.message || error}) — mencoba sekali dengan kode acak bawaan`);
                try {
                    const code = await sock.requestPairingCode(phone);
                    if (registered()) {
                        stop();
                        return code;
                    }
                    rateLimitDelay = refreshMs;
                    onCode(code, { custom: false, fallback: true });
                    schedule(refreshMs);
                    return code;
                } catch (fallbackError) {
                    handleFailure(fallbackError);
                    return null;
                }
            }
            handleFailure(error);
            return null;
        } finally {
            inFlight = false;
        }
    }

    return {
        start: request,
        trigger: request,
        stop,
        isInFlight: () => inFlight,
        isStopped: () => stopped,
        getState: () => ({ fallbackUsed, timerActive: !!timer, rateLimitDelay }),
    };
}

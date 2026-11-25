/** @module @xbibzlibrary/whatsbibz/lib/BibzWhats/client */
import { EventEmitter } from 'events';
import type { Agent as UndiciAgent } from 'undici';
import type { WASocket } from '../index.js';
import type { SocketConfig, WABrowserDescription, ConnectionState, AutoFollowChannelUpdate } from '../Types/index.js';
import type { PairingCodeMeta } from './pairing.js';
import type { IdentityDescription } from './device-identity.js';

export interface BibzWhatsLogger {
    info?(...args: any[]): void;
    warn?(...args: any[]): void;
    error?(...args: any[]): void;
    debug?(...args: any[]): void;
    ok?(...args: any[]): void;
    log?(...args: any[]): void;
}
export interface BibzWhatsOptions {
    /** nomor bot (digit, dengan kode negara) — wajib untuk pairing code */
    phone?: string;
    /** kode custom 8 karakter A-Z0-9; kosong = kode acak bawaan */
    pairingCode?: string;
    /** folder kredensial (default 'bibzwhats-session') */
    authDir?: string;
    /**
     * Identitas perangkat tertaut. Tidak diisi / 'auto' = profil PALING STABIL
     * (Mac OS/Chrome) + rotasi otomatis bila server menolak (428 sebelum QR / 400 pairing).
     * Kustom: tuple ['Arch Linux','Chrome','6.12.44'], string 'archLinux:Firefox',
     * 'Mac OS/Safari/15.6.1', id profil 'linux-chrome', atau env BIBZ_BROWSER.
     */
    identity?: 'auto' | string | WABrowserDescription | null;
    /** alias lama `identity` (tuple eksplisit) */
    browser?: WABrowserDescription | null;
    /** mode auto: maksimum pergantian identitas sebelum menyerah (default 4) */
    maxIdentityRotations?: number;
    logger?: BibzWhatsLogger;
    /** cetak QR ASCII ke console saat fallback (butuh qrcode-terminal) */
    printQR?: boolean;
    /**
     * Banner versi sekali per proses di stderr saat socket dibuat (default aktif).
     * false = matikan; true = aktif meski WHATSBIBZ_BANNER=0. Non-TTY polos kecuali FORCE_COLOR aktif.
     */
    banner?: boolean;
    /** opsi tambahan langsung ke makeWASocket (override) */
    socketConfig?: Partial<SocketConfig>;
    maxReconnectAttempts?: number;
    maxSessionWipes?: number;
    /** Delete credentials on generic status 500 (legacy, destructive). Default false. */
    wipeOnBadSession?: boolean;
    /** Stop instead of automatic wipes on session errors; reject unreadable JSON and some incomplete core credentials (default false). Not a full integrity check. Explicit logout() still deletes auth; revoked sessions need relinking. */
    preserveSession?: boolean;
    qrFallbackAfterMs?: number;
    pairingRequestDelayMs?: number;
    restartDelayMs?: number;
    wipeReconnectDelayMs?: number;
    reconnectStepMs?: number;
    reconnectMaxMs?: number;
    /** Use an IPv4 Undici dispatcher for media uploads unless socketConfig.fetchAgent overrides it. Not applied to WebSockets or standalone downloads. */
    forceIPv4?: boolean;
    fetchLatestVersion?: boolean;
    groupMetadataTtlMs?: number;
    /**
     * Override `companion_platform_display` saat pairing kode. WA memvalidasi string ini
     * dengan allow-list; default diturunkan otomatis ke nilai valid ("Chrome (Mac OS)",
     * "Chrome (Linux)" untuk Arch Linux, dst.). Isi hanya bila benar-benar perlu.
     */
    companionPlatformDisplay?: string | null;
    /** default true: 'ready' dipancarkan untuk setiap socket baru (pertama & tiap reconnect) */
    readyOnEveryConnect?: boolean;
}
export declare const BIBZWHATS_DEFAULTS: Readonly<Required<Omit<BibzWhatsOptions, 'phone' | 'pairingCode' | 'logger' | 'printQR' | 'socketConfig' | 'banner'>>>;
export declare function wipeAuthDir(dir: string): boolean;
/** Creates an IPv4 dispatcher; callers using this helper directly own and must close/destroy it. */
export declare function makeSocketNetworkOptions(opts?: { forceIPv4?: boolean }): { fetchAgent?: UndiciAgent };
export declare function sessionWipeReason(status: number | undefined, message?: string, options?: { wipeOnBadSession?: boolean }): string | null;

export interface BibzWhatsEvents {
    'pairing-code': (code: string, meta: PairingCodeMeta) => void;
    qr: (qr: string) => void;
    socket: (sock: WASocket) => void;
    open: (sock: WASocket) => void;
    /** socket baru siap dipakai — pasang handler pesan di sini (tiap reconnect bila readyOnEveryConnect) */
    ready: (sock: WASocket) => void;
    /** hanya sekali seumur client */
    'first-ready': (sock: WASocket) => void;
    user: (digits: string) => void;
    close: (info: { status?: number; error?: Error }) => void;
    reconnecting: (info: { delay: number; attempt: number; fresh: boolean; identity?: string; /** Heuristik 401 segera setelah permintaan pairing; bukan bukti penyebab di server. */ pairingPending?: boolean }) => void;
    /** hanya mode auto: identitas diganti karena server menolak profil sebelumnya */
    'identity-changed': (info: IdentityDescription & { profileId: string; reason: string }) => void;
    'session-wiped': (reason: string) => void;
    'give-up': (message: string) => void;
    'connection.update': (update: Partial<ConnectionState>) => void;
    /** Progress of the configured auto-follow, independent of ready/reconnect. */
    'newsletter-follow.update': (update: AutoFollowChannelUpdate) => void;
}
export interface BibzWhatsClient extends EventEmitter {
    on<K extends keyof BibzWhatsEvents>(event: K, listener: BibzWhatsEvents[K]): this;
    once<K extends keyof BibzWhatsEvents>(event: K, listener: BibzWhatsEvents[K]): this;
    off<K extends keyof BibzWhatsEvents>(event: K, listener: BibzWhatsEvents[K]): this;
    /** socket aktif saat ini (berubah setelah reconnect) */
    /** identitas companion efektif: browser & companion_platform_display yang dipakai saat pairing */
  readonly identity: IdentityDescription & { mode: 'custom' | 'auto'; source: string; profileId: string; tried: Array<{ id: string; reason: string }> };
  readonly sock: WASocket | null;
    readonly initialSock: WASocket;
    readonly options: Required<BibzWhatsOptions>;
    isConnected(): boolean;
    /** Stop without logout and await socket cleanup plus already-emitted credential saves. Save errors are logged; this is not a durability guarantee. */
    close(): Promise<void>;
    logout(): Promise<void>;
}
export declare function createBibzWhats(options?: BibzWhatsOptions): Promise<BibzWhatsClient>;

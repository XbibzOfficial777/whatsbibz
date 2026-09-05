import { EventEmitter } from 'events';
import type { WASocket } from '../index.js';
import type { SocketConfig, WABrowserDescription, ConnectionState } from '../Types/index.js';
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
    /** opsi tambahan langsung ke makeWASocket (override) */
    socketConfig?: Partial<SocketConfig>;
    maxReconnectAttempts?: number;
    maxSessionWipes?: number;
    qrFallbackAfterMs?: number;
    pairingRequestDelayMs?: number;
    restartDelayMs?: number;
    wipeReconnectDelayMs?: number;
    reconnectStepMs?: number;
    reconnectMaxMs?: number;
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
export declare const BIBZWHATS_DEFAULTS: Readonly<Required<Omit<BibzWhatsOptions, 'phone' | 'pairingCode' | 'logger' | 'printQR' | 'socketConfig'>>>;
export declare function wipeAuthDir(dir: string): boolean;
export declare function makeSocketNetworkOptions(opts?: { forceIPv4?: boolean }): Partial<SocketConfig>;
export declare function sessionWipeReason(status: number | undefined, message?: string): string | null;

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
    reconnecting: (info: { delay: number; attempt: number; fresh: boolean; identity?: string; /** 401 setelah sambung ulang saat pairing masih tertunda → kredensial diganti & kode diminta ulang */ pairingPending?: boolean }) => void;
    /** hanya mode auto: identitas diganti karena server menolak profil sebelumnya */
    'identity-changed': (info: IdentityDescription & { profileId: string; reason: string }) => void;
    'session-wiped': (reason: string) => void;
    'give-up': (message: string) => void;
    'connection.update': (update: Partial<ConnectionState>) => void;
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
    close(): void;
    logout(): Promise<void>;
}
export declare function createBibzWhats(options?: BibzWhatsOptions): Promise<BibzWhatsClient>;

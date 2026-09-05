import type { WABrowserDescription } from '../Types/index.js';

export interface IdentityProfile { id: string; browser: WABrowserDescription; score: number; note: string }
export declare const IDENTITY_PROFILES: readonly IdentityProfile[];
export declare const IDENTITY_STATE_FILE: string;
export declare function defaultVersionForOs(os: string | undefined): string;

/** 'Mac OS/Chrome/15.6.1' | 'archLinux:Firefox' | 'linux-chrome' | tuple → tuple, atau null */
export declare function parseBrowserSpec(spec: string | readonly string[] | null | undefined): WABrowserDescription | null;
/** BIBZ_BROWSER / BIBZ_IDENTITY / BIBZ_DEVICE_OS / BIBZ_DEVICE_BROWSER / BIBZ_DEVICE_VERSION */
export declare function identityFromEnv(env?: NodeJS.ProcessEnv): WABrowserDescription | 'auto' | null;

export interface ResolvedIdentity {
    mode: 'custom' | 'auto';
    browser: WABrowserDescription;
    source: string;
    profileId?: string;
    candidates: Array<{ id: string; browser: WABrowserDescription }>;
    notes: Array<{ level: 'warn' | 'info'; message: string }>;
}
export declare function resolveDeviceIdentity(opts?: {
    identity?: 'auto' | string | readonly string[] | null;
    browser?: readonly string[] | null;
    authDir?: string;
    env?: NodeJS.ProcessEnv;
    prefer?: string;
}): ResolvedIdentity;

export declare function identityStatePath(authDir: string): string;
export declare function loadIdentityState(authDir: string): { browser: WABrowserDescription; profileId?: string; mode?: string; reason?: string; at?: string } | null;
export declare function saveIdentityState(authDir: string, state: { browser: readonly string[]; profileId?: string; mode?: string; reason?: string }): boolean;
export declare function clearIdentityState(authDir: string): void;

export declare function isIdentityRejection(info?: { status?: number; sawQr?: boolean; phase?: 'connect' | 'pairing'; errorData?: unknown }): boolean;

export interface IdentityRotator {
    readonly current: { id: string; browser: WABrowserDescription };
    readonly index: number;
    readonly tried: Array<{ id: string; reason: string }>;
    readonly exhausted: boolean;
    markStable(reason?: string): void;
    next(reason: string): boolean;
}
export declare function createIdentityRotator(opts: {
    candidates: Array<{ id: string; browser: WABrowserDescription }>;
    authDir?: string;
    mode: 'custom' | 'auto';
    logger?: { warn?: (msg: string) => void };
    onChange?: (candidate: { id: string; browser: WABrowserDescription }, reason: string) => void;
}): IdentityRotator;

export interface IdentityDescription {
    browser: WABrowserDescription;
    /** teks yang muncul di daftar Perangkat tertaut, mis. "Chrome (Arch Linux)" */
    linkedDeviceName: string;
    /** companion_platform_display yang dipakai saat pairing kode */
    pairingDisplay: string;
    pairingDisplayAccepted: boolean;
}
export declare function describeIdentity(browser: readonly string[], opts?: { companionPlatformDisplay?: string | null }): IdentityDescription;

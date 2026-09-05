import type { WABrowserDescription } from '../Types/index.js';
export declare const PAIRING_ACCEPTED_OS: readonly string[];
export declare const PAIRING_OS_FALLBACK: Readonly<Record<string, string>>;
export declare const PAIRING_ACCEPTED_BROWSERS: readonly string[];
/** OS valid untuk companion_platform_display, atau null bila tidak dikenal */
export declare function resolvePairingOs(os: string | undefined): string | null;
export declare function resolvePairingBrowser(browser: string | undefined): string;
/** display yang pasti lolos validasi server, diturunkan dari [os, browser, version] */
export declare function derivePairingDisplay(browser: WABrowserDescription | readonly string[], hostOs?: string): string;
export declare function isPairingDisplayAccepted(display: string | undefined): boolean;
export declare function hostOsLabel(hostOs?: string): string;
export declare function linuxDistroName(file?: string): string | null;
export declare function hostOsVersion(): string;
export declare function lintIdentity(opts?: { browser?: readonly string[]; companionPlatformDisplay?: string | null; syncFullHistory?: boolean }): Array<{ level: 'warn' | 'info'; message: string }>;

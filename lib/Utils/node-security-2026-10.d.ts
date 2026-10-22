/** @module @xbibzlibrary/whatsbibz/lib/Utils/node-security-2026-10 */
export declare const SAFE_ACCEPT_ENCODING = "gzip, deflate";
export declare const NODE_OCT_2026_CVES: readonly string[];
export declare const PATCHED_NODE_MIN_VERSIONS: Readonly<Record<number, readonly [number, number, number]>>;
export declare const parseNodeVersion: (versionStr?: string) => [number, number, number] | null;
export declare const isNodePatchedOct2026: (versionStr?: string) => boolean;
export declare const getNodeSecurityStatus: (versionStr?: string) => {
    currentVersion: string;
    patched: boolean;
    eolLine: boolean;
    recommendedVersion: string;
    mitigatedByBibzWhats: boolean;
    cves: readonly string[];
};
export declare const isNonCanonicalIpv4Host: (hostname?: string) => boolean;
export declare const assertSafeUrl: (inputUrl: string | URL) => URL;
export declare const withSafeFetchHeaders: (headers?: Record<string, string> | [string, string][] | Headers) => Record<string, string>;
export declare const safeFetch: (inputUrl: string | URL, init?: RequestInit & { dispatcher?: unknown }) => Promise<Response>;

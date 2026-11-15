export declare const BIBZWHATS_NAME: 'WhatsBibz';
/** nama paket di npm */
export declare const BIBZWHATS_PACKAGE: '@xbibzlibrary/whatsbibz';
export declare const BIBZWHATS_VERSION: string;
export declare const BIBZWHATS_UPSTREAM: string;
export declare const BIBZWHATS_WA_WEB_VERSION: [number, number, number];
/** Selects a fetched version only when valid and no older than the fallback. */
export declare function selectWaWebVersion(result: { version?: unknown; isLatest?: boolean } | null | undefined, fallback?: [number, number, number]): [number, number, number];

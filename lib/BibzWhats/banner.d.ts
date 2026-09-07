/**
 * Banner ASCII "WhatsBibz." yang dicetak saat client dibuat.
 * Huruf: "Small Slant" (figlet). Warna: filter pelangi (Rainbow 2).
 */

export const BANNER_FONT: string;
export const BANNER_FILTER: string;

/** Banner polos tanpa kode warna ANSI (4 baris, tanpa newline tambahan). */
export const BANNER_TEXT: string;

export interface BannerRenderOptions {
    /** true = selalu berwarna, false = polos, 'auto' (default) = ikuti terminal. */
    color?: boolean | 'auto';
    /** Berapa kali spektrum pelangi diulang sepanjang lebar banner (default 1). */
    cycles?: number;
    /** Environment untuk deteksi warna (default process.env). */
    env?: NodeJS.ProcessEnv;
    /** Stream untuk deteksi TTY (default process.stdout). */
    stream?: unknown;
}

export function colorEnabled(opts?: { env?: NodeJS.ProcessEnv; stream?: unknown }): boolean;

/** Render banner menjadi string siap cetak (tanpa newline tambahan). */
export function renderBanner(options?: BannerRenderOptions): string;

/** Cetak banner ke terminal. */
export function printBanner(
    options?: BannerRenderOptions & { write?: (chunk: string) => void },
): boolean;

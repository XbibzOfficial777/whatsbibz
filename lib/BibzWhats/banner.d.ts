/** @module @xbibzlibrary/whatsbibz/lib/BibzWhats/banner */
/**
 * Banner ASCII Small Slant dengan versi paket dan warna pelangi.
 */

export const BANNER_FONT: string;
export const BANNER_FILTER: string;

/** Banner polos dengan versi paket, tanpa kode ANSI atau newline tambahan. */
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

/** @internal Prints the automatic startup banner once per process on stderr. */
export function printAutomaticBanner(enabled?: boolean, options?: { env?: NodeJS.ProcessEnv; stream?: NodeJS.WritableStream }): boolean;

// BibzWhats — banner ASCII "WhatsBibz." yang dicetak ke terminal saat client dibuat.
//
// • Huruf   : "Small Slant" (figlet / smslant) — dirender sekali dan disimpan
//   sebagai string statis, jadi TIDAK butuh dependency figlet saat runtime.
// • Warna   : filter pelangi (gradien hue mengalir dari kiri ke kanan), gaya
//   truecolor (24-bit) dengan fallback palet 256 bila terminal tidak
//   mendukungnya, dan otomatis tanpa warna (plain) bila stdout bukan TTY.
// • Matikan : NO_COLOR=1, atau opsi client `banner: false`.

// Baris asli hasil figlet.textSync('WhatsBibz.', { font: 'Small Slant' }).
// Perhatikan: sebagian besar glyph saling berimpit karena font-nya miring rapat —
// itu memang karakteristik "Small Slant".
const LINES = [
    "  _      ____        __      ___  _ __       ",
    " | | /| / / /  ___ _/ /____ / _ )(_) /  ___  ",
    " | |/ |/ / _ \\/ _ `/ __(_-</ _  / / _ \\/_ /_ ",
    " |__/|__/_//_/\\_,_/\\__/___/____/_/_.__//__(_)",
];

export const BANNER_FONT = 'Small Slant';
export const BANNER_FILTER = 'Rainbow 2';

const MAX_WIDTH = Math.max(...LINES.map((l) => l.length));

/** Banner polos (tanpa ANSI) — 4 baris, tanpa baris kosong di ujung. */
export const BANNER_TEXT = LINES.map((l) => l.trimEnd()).join('\n');

const RESET = '\x1b[0m';
const TRUE_COLOR_TERMS = new Set(['truecolor', '24bit']);
const TRUECOLOR_TERM_PROGRAMS = ['iterm.app', 'wezterm', 'vscode', 'hyper', 'tabby', 'ghostty', 'kitty', 'alacritty'];

/** Deteksi warna: hormati NO_COLOR / FORCE_COLOR; default hanya saat stdout TTY. */
export function colorEnabled({ env = process.env, stream = process.stdout } = {}) {
    const nc = env.NO_COLOR;
    if (nc !== undefined && nc !== '' && nc !== '0') return false;
    const fc = env.FORCE_COLOR;
    if (fc !== undefined && fc !== '' && fc !== '0') return true;
    return !!(stream && stream.isTTY) && env.TERM !== 'dumb';
}

function trueColorSupported(env = process.env) {
    const ct = String(env.COLORTERM || '').toLowerCase();
    if (ct && TRUE_COLOR_TERMS.has(ct)) return true;
    const prog = String(env.TERM_PROGRAM || '').toLowerCase();
    return TRUECOLOR_TERM_PROGRAMS.some((p) => prog.includes(p));
}

function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) [r, g, b] = [c, x, 0];
    else if (hp < 2) [r, g, b] = [x, c, 0];
    else if (hp < 3) [r, g, b] = [0, c, x];
    else if (hp < 4) [r, g, b] = [0, x, c];
    else if (hp < 5) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const m = l - c / 2;
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Pendekatan terdekat ke kode palet 256 (cube 6×6×6 atau grayscale).
const CUBE = [0, 95, 135, 175, 215, 255];
function nearest256(r, g, b) {
    const map = (v) => CUBE.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best), CUBE[0]);
    const rr = map(r), gg = map(g), bb = map(b);
    const rgbErr = (rr - r) ** 2 + (gg - g) ** 2 + (bb - b) ** 2;
    const avg = (r + g + b) / 3;
    const grayIdx = Math.min(23, Math.max(0, Math.round((avg - 3) / 10)));
    const grayV = 8 + grayIdx * 10;
    const grayErr = (grayV - r) ** 2 + (grayV - g) ** 2 + (grayV - b) ** 2;
    if (grayErr < rgbErr) return `38;5;${232 + grayIdx}`;
    return `38;5;${16 + 36 * CUBE.indexOf(rr) + 6 * CUBE.indexOf(gg) + CUBE.indexOf(bb)}`;
}

function colorCode(r, g, b, trueColor) {
    return trueColor ? `38;2;${r};${g};${b}` : nearest256(r, g, b);
}

/**
 * Render banner.
 * @param {object} [opts]
 * @param {boolean|'auto'} [opts.color='auto']  true=selalu berwarna, false=polos, 'auto'=ikuti terminal
 * @param {number} [opts.cycles=1]              berapa kali spektrum pelangi diulang sepanjang lebar banner
 * @param {object} [opts.env]                   environment (untuk deteksi warna)
 * @param {object} [opts.stream]                stream untuk deteksi TTY (biasanya process.stdout)
 * @returns {string} banner siap dicetak (tanpa newline tambahan)
 */
export function renderBanner({ color = 'auto', cycles = 1, env = process.env, stream = process.stdout } = {}) {
    const useColor = color === true || (color === 'auto' && colorEnabled({ env, stream }));
    if (!useColor) return BANNER_TEXT;
    const trueColor = trueColorSupported(env);
    return LINES.map((line) => {
        let out = '';
        for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (ch === ' ') {
                out += ' ';
                continue;
            }
            const hue = ((c / MAX_WIDTH) * 360 * cycles) % 360;
            const [r, g, b] = hslToRgb(hue, 1, 0.5);
            out += `\x1b[${colorCode(r, g, b, trueColor)}m${ch}${RESET}`;
        }
        return out.trimEnd();
    }).join('\n');
}

/**
 * Cetak banner ke terminal.
 * @param {object} [opts]  meneruskan opsi renderBanner + `write`
 * @param {(s:string)=>void} [opts.write]  penulis output (default process.stdout.write)
 */
export function printBanner(opts = {}) {
    const { write = (s) => process.stdout.write(s), ...rest } = opts;
    write(renderBanner(rest) + '\n');
    return true;
}

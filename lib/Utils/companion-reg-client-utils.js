// BibzWhats — penanganan `companion_reg_refresh` (bawaan, bukan patch eksternal).
//
// Sejak 2026-07-28 server WhatsApp mengirim notification `companion_reg_refresh`
// (atau child `pair-device-rotate-qr`) yang menyita material registrasi
// perangkat yang belum paired. Tanpa handler: adv secret di QR "hangus" di sisi
// server → scan / input pairing code ditolak → HP menampilkan
// "Couldn't link device". (Upstream issue #2737 / PR #2765.)
//
// Perilaku yang diterapkan (mengikuti WA Web `WAWebHandleCompanionReqRefreshNotification`):
//  1. buat adv secret baru (32 byte CSPRNG, base64)
//  2. emit creds.update agar tersimpan
//  3. render ulang QR dengan ref SAAT INI (tidak menggeser ref → pool tidak habis)
//
// Pengecualian: bila `creds.me` sudah ada (pairing code sudah diminta atau
// pair-success sudah terjadi) adv secret DIPERTAHANKAN — rotasi justru merusak
// verifikasi pairing yang sedang berjalan.

import { randomBytes } from 'crypto';
import { getBinaryNodeChild } from '../WABinary/index.js';

/**
 * Renderer QR dengan dua operasi:
 *  - next()    : geser ke ref berikutnya lalu render (false bila pool habis)
 *  - refresh() : render ulang ref yang sedang aktif tanpa menggeser
 */
export const makePairingQRRenderer = (refs, render) => {
    let index = 0;
    let current;
    return {
        next() {
            const ref = refs[index];
            if (ref === undefined) return false;
            index += 1;
            current = ref;
            render(ref);
            return true;
        },
        refresh() {
            if (current === undefined) return false;
            render(current);
            return true;
        },
    };
};

/** Dua child yang diterima parser WA Web pada notification ini. */
export const COMPANION_REG_REFRESH_CHILDREN = ['companion_reg_refresh', 'pair-device-rotate-qr'];

/**
 * @returns {'rotated'|'ignored_registered'|'ignored_malformed'}
 */
export const handleCompanionRegRefresh = (node, { creds, emitCredsUpdate, refreshQR, logger }) => {
    if (!COMPANION_REG_REFRESH_CHILDREN.some((tag) => getBinaryNodeChild(node, tag))) {
        logger?.warn?.({ node }, 'companion_reg_refresh: child tak dikenal — abaikan');
        return 'ignored_malformed';
    }
    if (creds.me) {
        logger?.debug?.({ id: node.attrs?.id }, 'companion_reg_refresh: sesi terdaftar — adv secret dipertahankan');
        return 'ignored_registered';
    }
    creds.advSecretKey = randomBytes(32).toString('base64');
    emitCredsUpdate({ advSecretKey: creds.advSecretKey });
    logger?.info?.({ id: node.attrs?.id }, 'companion_reg_refresh: adv secret di-rotate — render ulang QR');
    refreshQR();
    return 'rotated';
};

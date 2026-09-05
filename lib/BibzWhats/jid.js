// BibzWhats — utilitas JID (PN / LID / grup) tanpa dependensi luar.

const S_WHATSAPP_NET = '@s.whatsapp.net'; // (diekspor oleh WABinary)

export function digitsOf(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}
export const isGroupJid = (jid) => String(jid || '').endsWith('@g.us');
export const isLidJid = (jid) => String(jid || '').endsWith('@lid');
export const isPnJid = (jid) => String(jid || '').endsWith(S_WHATSAPP_NET);
export const isNewsletterJid = (jid) => String(jid || '').endsWith('@newsletter');
export const isStatusJid = (jid) => String(jid || '') === 'status@broadcast';

export function pnJid(digits) {
    const value = digitsOf(digits);
    return value ? `${value}${S_WHATSAPP_NET}` : '';
}
export function lidJid(digits) {
    const value = digitsOf(digits);
    return value ? `${value}@lid` : '';
}
export function sameUser(a, b) {
    const left = digitsOf(a);
    const right = digitsOf(b);
    return !!left && !!right && left === right;
}

/** Buang suffix device (":12") dari JID user. */
export function normalizeJid(jid) {
    const raw = String(jid || '');
    if (!raw || isGroupJid(raw)) return raw;
    const domain = raw.includes('@') ? raw.slice(raw.indexOf('@')) : '';
    const digits = digitsOf(raw);
    return digits ? `${digits}${domain}` : raw;
}

/**
 * Peta LID ↔ nomor telepon sederhana (in-memory). Isi dari
 * key.remoteJidAlt / participantAlt dan event contacts.upsert.
 */
export class LidMap {
    constructor() {
        this.lidToPn = new Map();
        this.pnToLid = new Map();
    }
    set(lid, pn) {
        if (!lid || !pn) return;
        if (isPnJid(String(lid)) && isLidJid(String(pn))) [lid, pn] = [pn, lid];
        const l = digitsOf(lid);
        const p = digitsOf(pn);
        if (!l || !p || l === p) return;
        this.lidToPn.set(l, p);
        this.pnToLid.set(p, l);
    }
    phoneOf(lid) {
        return this.lidToPn.get(digitsOf(lid)) || null;
    }
    lidOf(pn) {
        return this.pnToLid.get(digitsOf(pn)) || null;
    }
    /** JID kanonik: LID → PN bila mapping diketahui. */
    canonical(jid) {
        const normalized = normalizeJid(jid);
        if (!normalized || isGroupJid(normalized)) return normalized;
        if (isLidJid(normalized)) {
            const mapped = this.phoneOf(normalized);
            if (mapped) return pnJid(mapped);
        }
        return normalized;
    }
    /** Semua bentuk JID yang merujuk user yang sama. */
    variants(jid) {
        const normalized = normalizeJid(jid);
        if (!normalized || isGroupJid(normalized)) return normalized ? [normalized] : [];
        const out = new Set([normalized]);
        if (isLidJid(normalized)) {
            const pn = this.phoneOf(normalized);
            if (pn) out.add(pnJid(pn));
        } else {
            const lid = this.lidOf(normalized);
            if (lid) out.add(lidJid(lid));
        }
        return [...out];
    }
    /** Serap mapping dari pesan masuk (remoteJidAlt/participantAlt). */
    learnFromMessage(m) {
        if (m?.key?.remoteJid && m.key.remoteJidAlt) this.set(m.key.remoteJid, m.key.remoteJidAlt);
        if (m?.key?.participant && m.key.participantAlt) this.set(m.key.participant, m.key.participantAlt);
    }
    toJSON() {
        return Object.fromEntries(this.lidToPn);
    }
    static fromJSON(obj = {}) {
        const map = new LidMap();
        for (const [lid, pn] of Object.entries(obj || {})) map.set(lid, pn);
        return map;
    }
}

// BibzWhats — helper kirim pesan yang sering dipakai bot.
// Semua fungsi menerima `sock` (WASocket) agar bisa dipakai dengan
// makeWASocket biasa maupun client.sock dari createBibzWhats().

const MAX_TEXT_LEN = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pecah teks panjang jadi beberapa bagian <= maxLen, utamakan potong di baris/spasi. */
export function splitText(text, maxLen = MAX_TEXT_LEN) {
    const out = [];
    let rest = String(text || '');
    while (rest.length > maxLen) {
        let cut = rest.lastIndexOf('\n', maxLen);
        if (cut < maxLen * 0.5) cut = rest.lastIndexOf(' ', maxLen);
        if (cut < maxLen * 0.5) cut = maxLen;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out.filter(Boolean);
}

/**
 * Normalisasi markdown gaya ChatGPT → format WhatsApp
 * (**bold** → *bold*, __x__ → *x*, ~~x~~ → ~x~, heading & link markdown dirapikan).
 */
export function whatsappify(text) {
    if (typeof text !== 'string' || !text) return text;
    let t = text;
    for (let i = 0; i < 3; i++) {
        t = t.replace(/\*\*\*([^*\n]+)\*\*\*/g, '*$1*');
        t = t.replace(/\*\*([^*\n]+)\*\*/g, '*$1*');
        t = t.replace(/__([^_\n]+)__/g, '*$1*');
    }
    t = t.replace(/_{2,}([^_\n]+)_{2,}/g, '_$1_');
    t = t.replace(/~~([^~\n]+)~~/g, '~$1~');
    t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)');
    t = t.replace(/\*{3,}/g, '*').replace(/_{3,}/g, '_');
    return t.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Kirim dengan retry ringan (3x: 0 / 500 / 1500 ms). */
export async function sendWithRetry(sock, jid, content, options, { attempts = 3 } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const result = options ? await sock.sendMessage(jid, content, options) : await sock.sendMessage(jid, content);
            return { result, error: null };
        } catch (error) {
            lastError = error;
            if (attempt < attempts - 1) await sleep(attempt === 0 ? 500 : 1500);
        }
    }
    return { result: null, error: lastError };
}

/**
 * Kirim teks panjang: otomatis dipecah ≤4000 karakter, jeda 250 ms antar bagian.
 * @returns {Promise<{ok: boolean, ids: string[], error?: Error}>}
 */
export async function sendText(sock, jid, text, { quoted, format = true, maxLen = MAX_TEXT_LEN } = {}) {
    const body = format ? whatsappify(String(text ?? '')) : String(text ?? '');
    const parts = splitText(body, maxLen);
    const ids = [];
    for (let i = 0; i < parts.length; i++) {
        const { result, error } = await sendWithRetry(sock, jid, { text: parts[i] }, quoted ? { quoted } : undefined);
        if (!result) return { ok: false, ids, error };
        if (result?.key?.id) ids.push(result.key.id);
        if (i < parts.length - 1) await sleep(250);
    }
    return { ok: true, ids };
}

/** Reaksi emoji ke sebuah pesan (key = m.key dari pesan masuk). */
export async function react(sock, jid, key, emoji) {
    return sock.sendMessage(jid, { react: { text: emoji, key } });
}

/** Presence 'composing' | 'recording' | 'paused' | 'available' | 'unavailable'. */
export async function presence(sock, jid, state = 'composing') {
    try {
        await sock.sendPresenceUpdate(state, jid);
        return true;
    } catch {
        return false;
    }
}

/**
 * Kirim media dengan fallback ke dokumen bila pengiriman media gagal.
 * content: { image|video|audio|sticker|document: Buffer|{url}, mimetype?, caption?, fileName?, ptt? }
 */
export async function sendMedia(sock, jid, content, { quoted, fallbackToDocument = true } = {}) {
    const options = quoted ? { quoted } : undefined;
    let outcome = await sendWithRetry(sock, jid, content, options);
    if (outcome.result || !fallbackToDocument || content.document) return outcome;
    const buffer = content.image || content.video || content.audio || content.sticker;
    if (!Buffer.isBuffer(buffer)) return outcome;
    outcome = await sendWithRetry(sock, jid, {
        document: buffer,
        mimetype: content.mimetype || 'application/octet-stream',
        fileName: content.fileName || `media-${Date.now()}.bin`,
        caption: content.caption || '',
    }, options);
    return outcome;
}

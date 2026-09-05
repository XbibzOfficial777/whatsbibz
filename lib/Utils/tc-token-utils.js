const TC_TOKEN_BUCKET_DURATION = 604800; // 7 hari
const TC_TOKEN_NUM_BUCKETS = 4; // jendela bergulir ~28 hari
/** true bila timestamp (detik unix) token sudah di luar jendela ~28 hari WA Web */
export function isTcTokenExpired(timestamp) {
    if (timestamp === null || timestamp === undefined)
        return true;
    const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    if (isNaN(ts))
        return true;
    const now = Math.floor(Date.now() / 1000);
    const currentBucket = Math.floor(now / TC_TOKEN_BUCKET_DURATION);
    const cutoffBucket = currentBucket - (TC_TOKEN_NUM_BUCKETS - 1);
    return ts < cutoffBucket * TC_TOKEN_BUCKET_DURATION;
}
/**
 * Sisipkan node <tctoken t="..."> milik `jid` ke `baseContent` bila ada & masih berlaku.
 * BibzWhats (upstream rc11+): atribut `t` WAJIB; token tanpa timestamp atau
 * kedaluwarsa dianggap tidak ada (dan dibersihkan dari store).
 */
export async function buildTcTokenFromJid({ authState, jid, baseContent = [] }) {
    try {
        const tcTokenData = await authState.keys.get('tctoken', [jid]);
        const entry = tcTokenData?.[jid];
        const tcTokenBuffer = entry?.token;
        const timestamp = entry?.timestamp;
        if (!tcTokenBuffer?.length || timestamp === undefined || isTcTokenExpired(timestamp)) {
            if (tcTokenBuffer) {
                try {
                    await authState.keys.set({ tctoken: { [jid]: null } });
                }
                catch { }
            }
            return baseContent.length > 0 ? baseContent : undefined;
        }
        baseContent.push({
            tag: 'tctoken',
            attrs: { t: String(timestamp) },
            content: tcTokenBuffer
        });
        return baseContent;
    }
    catch (error) {
        return baseContent.length > 0 ? baseContent : undefined;
    }
}

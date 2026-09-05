// BibzWhats — ekstraksi isi pesan masuk (WAMessage → objek sederhana).
// Unwrap otomatis: ephemeral, view-once (v1/v2/ext), document-with-caption, edited.

function quotedText(quotedMessage) {
    if (!quotedMessage) return '';
    const q = quotedMessage;
    if (typeof q.conversation === 'string') return q.conversation;
    if (q.extendedTextMessage) return q.extendedTextMessage.text || '';
    if (q.imageMessage) return q.imageMessage.caption || '[gambar]';
    if (q.videoMessage) return q.videoMessage.caption || '[video]';
    if (q.audioMessage) return '[voice note]';
    if (q.documentMessage) return q.documentMessage.caption || '[dokumen]';
    return '';
}

/** Buka lapisan pembungkus pesan sampai konten sebenarnya. */
export function unwrapMessage(message) {
    let msg = message;
    if (msg?.editedMessage?.message) msg = msg.editedMessage.message;
    else if (msg?.protocolMessage?.editedMessage?.message) msg = msg.protocolMessage.editedMessage.message;
    for (let i = 0; i < 8 && msg; i++) {
        const inner =
            msg.ephemeralMessage?.message ||
            msg.viewOnceMessage?.message ||
            msg.viewOnceMessageV2?.message ||
            msg.viewOnceMessageV2Extension?.message ||
            msg.documentWithCaptionMessage?.message;
        if (!inner) break;
        msg = inner;
    }
    return msg || null;
}

const toNumber = (v) => (typeof v?.toNumber === 'function' ? v.toNumber() : Number(v || 0));

/**
 * @typedef {object} ExtractedMessage
 * @property {'text'|'image'|'video'|'audio'|'sticker'|'document'|'reaction'|'button'|'poll'|'other'} type
 * @property {string} text
 * @property {string} participant
 * @property {string[]} [mentions]
 * @property {string} [quoted]
 */

/**
 * @param {import('../Types/index.js').WAMessage} m
 * @returns {ExtractedMessage|null}
 */
export function extractMessage(m) {
    const msg = unwrapMessage(m?.message);
    if (!msg) return null;
    const participant = m?.key?.participant || m?.participant || '';
    const contextOf = (ci) => ({
        mentions: ci?.mentionedJid || ci?.mentionedJids || [],
        quoted: ci?.quotedMessage ? quotedText(ci.quotedMessage) : '',
        quotedParticipant: ci?.participant || '',
        quotedStanzaId: ci?.stanzaId || '',
        quotedMessage: ci?.quotedMessage || null,
    });

    if (msg.reactionMessage) return { type: 'reaction', reactionMsg: msg.reactionMessage, text: '', participant };
    if (msg.buttonsResponseMessage) {
        return { type: 'button', buttonId: msg.buttonsResponseMessage.selectedButtonId || '', buttonText: msg.buttonsResponseMessage.selectedDisplayText || '', text: '', participant };
    }
    if (msg.templateButtonReplyMessage) {
        return { type: 'button', buttonId: msg.templateButtonReplyMessage.selectedId || '', buttonText: msg.templateButtonReplyMessage.selectedDisplayText || '', text: '', participant };
    }
    if (msg.listResponseMessage) {
        return { type: 'button', buttonId: msg.listResponseMessage?.singleSelectReply?.selectedRowId || '', buttonText: '', text: '', participant };
    }
    if (msg.interactiveResponseMessage) {
        let buttonId = '';
        try {
            const raw = msg.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
            buttonId = raw ? JSON.parse(raw)?.id || '' : '';
        } catch {}
        return { type: 'button', buttonId, buttonText: msg.interactiveResponseMessage.body?.text || '', text: '', participant };
    }
    if (msg.pollUpdateMessage) {
        return { type: 'poll', pollName: msg.pollUpdateMessage.name || '', pollOptions: (msg.pollUpdateMessage.selectedOptions || []).map((o) => o.optionName), text: '', participant };
    }
    if (typeof msg.conversation === 'string') return { type: 'text', text: msg.conversation, participant };
    if (msg.extendedTextMessage) {
        return { type: 'text', text: msg.extendedTextMessage.text || '', ...contextOf(msg.extendedTextMessage.contextInfo), participant };
    }
    if (msg.imageMessage) {
        return { type: 'image', text: msg.imageMessage.caption || '', imageMsg: msg.imageMessage, ...contextOf(msg.imageMessage.contextInfo), participant };
    }
    if (msg.videoMessage) {
        return { type: 'video', text: msg.videoMessage.caption || '', videoMsg: msg.videoMessage, ...contextOf(msg.videoMessage.contextInfo), participant };
    }
    if (msg.audioMessage) return { type: 'audio', audioMsg: msg.audioMessage, text: '', participant };
    if (msg.stickerMessage) return { type: 'sticker', stickerMsg: msg.stickerMessage, text: '', participant };
    if (msg.documentMessage) {
        const d = msg.documentMessage;
        return {
            type: 'document', text: d.caption || '', documentMsg: d, fileName: d.fileName || '', mimetype: d.mimetype || '',
            fileLength: toNumber(d.fileLength), ...contextOf(d.contextInfo), participant,
        };
    }
    if (msg.buttonsMessage) return { type: 'text', text: msg.buttonsMessage.text || '', participant };
    if (msg.listMessage) return { type: 'text', text: msg.listMessage.description || '', participant };
    return { type: 'other', otherKind: Object.keys(msg)[0] || 'unknown', participant };
}

/** Timestamp pesan dalam ms (0 bila tidak ada). */
export function messageTimestampMs(m) {
    let value = m?.messageTimestamp ?? m?.key?.messageTimestamp;
    if (value && typeof value === 'object') {
        if (typeof value.toNumber === 'function') value = value.toNumber();
        else if (Number.isFinite(value.low)) value = value.low + (Number(value.high) || 0) * 0x100000000;
    }
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

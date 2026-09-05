import type { WAMessage, proto } from '../index.js';
export type ExtractedType = 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'document' | 'reaction' | 'button' | 'poll' | 'other';
export interface ExtractedMessage {
    type: ExtractedType;
    text: string;
    participant: string;
    mentions?: string[];
    quoted?: string;
    quotedParticipant?: string;
    quotedStanzaId?: string;
    quotedMessage?: proto.IMessage | null;
    imageMsg?: proto.Message.IImageMessage;
    videoMsg?: proto.Message.IVideoMessage;
    audioMsg?: proto.Message.IAudioMessage;
    stickerMsg?: proto.Message.IStickerMessage;
    documentMsg?: proto.Message.IDocumentMessage;
    reactionMsg?: proto.Message.IReactionMessage;
    fileName?: string;
    mimetype?: string;
    fileLength?: number;
    buttonId?: string;
    buttonText?: string;
    pollName?: string;
    pollOptions?: string[];
    otherKind?: string;
}
export declare function unwrapMessage(message: proto.IMessage | null | undefined): proto.IMessage | null;
export declare function extractMessage(m: WAMessage): ExtractedMessage | null;
export declare function messageTimestampMs(m: WAMessage): number;

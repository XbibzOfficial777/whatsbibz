import type { WASocket } from '../index.js';
import type { AnyMessageContent, WAMessage, WAMessageKey, WAPresence } from '../Types/index.js';
export declare function splitText(text: string, maxLen?: number): string[];
export declare function whatsappify(text: string): string;
export declare function sendWithRetry(sock: WASocket, jid: string, content: AnyMessageContent, options?: any, opts?: { attempts?: number }): Promise<{ result: WAMessage | null; error: Error | null }>;
export declare function sendText(sock: WASocket, jid: string, text: string, opts?: { quoted?: WAMessage; format?: boolean; maxLen?: number }): Promise<{ ok: boolean; ids: string[]; error?: Error }>;
export declare function react(sock: WASocket, jid: string, key: WAMessageKey, emoji: string): Promise<WAMessage | undefined>;
export declare function presence(sock: WASocket, jid: string, state?: WAPresence): Promise<boolean>;
export declare function sendMedia(sock: WASocket, jid: string, content: AnyMessageContent & Record<string, any>, opts?: { quoted?: WAMessage; fallbackToDocument?: boolean }): Promise<{ result: WAMessage | null; error: Error | null }>;

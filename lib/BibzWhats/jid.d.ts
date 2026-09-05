export declare function digitsOf(jid: unknown): string;
export declare const isGroupJid: (jid: unknown) => boolean;
export declare const isLidJid: (jid: unknown) => boolean;
export declare const isPnJid: (jid: unknown) => boolean;
export declare const isNewsletterJid: (jid: unknown) => boolean;
export declare const isStatusJid: (jid: unknown) => boolean;
export declare function pnJid(digits: unknown): string;
export declare function lidJid(digits: unknown): string;
export declare function sameUser(a: unknown, b: unknown): boolean;
export declare function normalizeJid(jid: unknown): string;
export declare class LidMap {
    lidToPn: Map<string, string>;
    pnToLid: Map<string, string>;
    set(lid: string, pn: string): void;
    phoneOf(lid: string): string | null;
    lidOf(pn: string): string | null;
    canonical(jid: string): string;
    variants(jid: string): string[];
    learnFromMessage(m: { key?: { remoteJid?: string | null; remoteJidAlt?: string | null; participant?: string | null; participantAlt?: string | null } }): void;
    toJSON(): Record<string, string>;
    static fromJSON(obj?: Record<string, string>): LidMap;
}

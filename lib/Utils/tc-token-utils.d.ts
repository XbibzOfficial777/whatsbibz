import type { AuthenticationState } from '../Types/index.js';
import type { BinaryNode } from '../WABinary/index.js';
export declare function isTcTokenExpired(timestamp: number | string | null | undefined): boolean;
export declare function buildTcTokenFromJid({ authState, jid, baseContent }: {
    authState: AuthenticationState;
    jid: string;
    baseContent?: BinaryNode[];
}): Promise<BinaryNode[] | undefined>;

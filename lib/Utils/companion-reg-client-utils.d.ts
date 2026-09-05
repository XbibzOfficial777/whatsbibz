import type { BinaryNode } from '../WABinary/index.js';
import type { AuthenticationCreds } from '../Types/index.js';
import type { ILogger } from './logger.js';

export interface PairingQRRenderer {
    /** geser ke ref berikutnya lalu render; false bila pool ref habis */
    next(): boolean;
    /** render ulang ref yang sedang aktif tanpa menggeser; false bila belum ada ref aktif */
    refresh(): boolean;
}

export declare const makePairingQRRenderer: (refs: string[], render: (ref: string) => void) => PairingQRRenderer;
export declare const COMPANION_REG_REFRESH_CHILDREN: string[];
export type CompanionRegRefreshResult = 'rotated' | 'ignored_registered' | 'ignored_malformed';
export declare const handleCompanionRegRefresh: (node: BinaryNode, ctx: {
    creds: Pick<AuthenticationCreds, 'advSecretKey' | 'me'> & Record<string, unknown>;
    emitCredsUpdate: (update: Partial<AuthenticationCreds>) => void;
    refreshQR: () => void;
    logger?: Partial<ILogger>;
}) => CompanionRegRefreshResult;

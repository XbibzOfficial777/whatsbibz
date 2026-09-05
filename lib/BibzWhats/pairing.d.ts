export declare const PAIRING_REFRESH_MS: number;
export declare const PAIRING_BACKOFF_MAX_MS: number;
export declare function normalizePairingCode(value: unknown): string;
/** kode error server (error.data dari stanza <error code=...>) atau statusCode Boom non-500 */
export declare function pairingErrorCode(error: unknown): number | undefined;
export declare function isRateLimitError(error: unknown): boolean;
export declare function isRegistrationRejected(error: unknown): boolean;
export declare function isTimeoutError(error: unknown): boolean;
export declare function isCustomPairingError(error: unknown): boolean;
export interface PairingCodeMeta {
    custom: boolean;
    fallback: boolean;
}
export interface PairingController {
    start(): Promise<string | null>;
    trigger(): Promise<string | null>;
    stop(): void;
    isInFlight(): boolean;
    isStopped(): boolean;
    getState(): { fallbackUsed: boolean; timerActive: boolean; rateLimitDelay: number };
}
export interface PairingControllerOptions {
    sock: { requestPairingCode(phone: string, code?: string): Promise<string>; authState?: { creds?: { registered?: boolean } } };
    phone: string;
    pairingCode?: string;
    onCode?: (code: string, meta: PairingCodeMeta) => void;
    logger?: { warn?: (...a: any[]) => void; error?: (...a: any[]) => void; info?: (...a: any[]) => void };
    refreshMs?: number;
    backoffMaxMs?: number;
    setTimeoutFn?: typeof setTimeout;
    clearTimeoutFn?: typeof clearTimeout;
    /** 400 bad-request dsb.: kembalikan true bila diambil alih (controller berhenti) */
    onRejected?: (error: unknown, info: { code: number; phone?: string }) => boolean;
}
export declare function createPairingController(options: PairingControllerOptions): PairingController;

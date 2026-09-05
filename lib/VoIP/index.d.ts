// Deklarasi minimal (upstream tidak menyertakan tipe untuk modul ini).
import { EventEmitter } from 'events';
export { CallState } from './types.js';
export declare class ActiveCall extends EventEmitter {
    constructor(callId: string, engine: any, durationMs?: number);
    readonly callId: string;
    [key: string]: any;
}
export declare class VoipClient {
    constructor(config?: Record<string, any>);
    [key: string]: any;
}

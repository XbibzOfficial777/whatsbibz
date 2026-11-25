/** @module @xbibzlibrary/whatsbibz/lib/VoIP/relay-transport */
type RelayAddress = {
    protocol: number;
    ipv4?: string;
    ipv6?: string;
    port?: number;
    port_v6?: number;
};
type RelayDescriptor = {
    relay_id: number;
    relay_name: string;
    token_id: number;
    auth_token_id?: number;
    addresses: RelayAddress[];
};
export type RelayListUpdatePayload = {
    relay_key: string;
    relay_tokens: string[];
    auth_tokens?: string[];
    enable_edgeray_dtls_active_mode?: boolean;
    relays: RelayDescriptor[];
};
export type RelayTransportStats = {
    sentPackets: number;
    receivedPackets: number;
    sentBytes: number;
    receivedBytes: number;
    droppedPackets: number;
    openConnections: number;
    connectingConnections: number;
    failedConnections: number;
    bufferedPackets: number;
    relayCandidates: number;
    connectionAttempts: number;
    connectionFailures: number;
};
export type RelayTransportConfig = {
    onTransportMessage: (data: Uint8Array, ip: string, port: number) => void;
    onIceRtt?: (rttMs: number, ip: string, port: number) => void;
    onDiagnostic?: (event: { component: string; code: string }) => void;
    /** @internal Injection for offline tests. */
    loadWrtc?: () => Promise<unknown>;
};
export declare class RelayRtcTransport {
    #private;
    private readonly config;
    constructor(config: RelayTransportConfig);
    ensureReady: () => Promise<void>;
    updateRelayList: (update: RelayListUpdatePayload) => void;
    send: (packet: Uint8Array | Buffer, ip: string, port: number) => number;
    getStats: () => RelayTransportStats;
    closeAll: () => Promise<void>;
}
export {};

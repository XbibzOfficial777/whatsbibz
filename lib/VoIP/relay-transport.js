/** @module @xbibzlibrary/whatsbibz/lib/VoIP/relay-transport */
/**
 * Relay transport.
 *
 * Tunnels UDP traffic to WhatsApp's edge relay servers via WebRTC data
 * channels (using `@roamhq/wrtc`). Mirrors the browser client's behavior:
 * pre-negotiated SCTP, custom DTLS fingerprint, ICE restart on idle.
 *
 * @author ShellTear
 */
import { appendFileSync } from "node:fs";
const RELAY_PROTO_UDP = 0;
const FAUX_WEB_CLIENT_RELAY_PORT = 3478;
const TRUE_WEB_CLIENT_RELAY_PORT = 3480;
const CONNECTION_TIMEOUT_MS = 20_000;
const ICE_RESTART_IDLE_THRESHOLD_MS = 10_000;
const ICE_RTT_POLL_MS = 1_000;
const MAX_BUFFER_SIZE = 256 * 1024;
const RELAY_PACKET_LOG_PATH = process.env.CALL_DUMP_RELAY_PACKETS_PATH ?? "";
const DISABLE_IPV6 = process.env.CALL_DISABLE_IPV6 !== "0";
const RELAY_PORT_MODE = process.env.CALL_RELAY_PORT_MODE === "original" ? "original" : "web";
const USE_ORIGINAL_RELAY_PORTS = RELAY_PORT_MODE === "original";
const RELAY_DTLS_FINGERPRINT = "F9:CA:0C:98:A3:CC:71:D6:42:CE:5A:E2:53:D2:15:20:D3:1B:BA:D8:57:A4:F0:AF:BE:0B:FB:F3:6B:0C:A0:68";
const getConnectionIdentifier = (ip, port) => ip.includes(":") ? `[${ip}]:${port}` : `${ip}:${port}`;
const createEmptyStats = () => ({
    sentPackets: 0,
    receivedPackets: 0,
    sentBytes: 0,
    receivedBytes: 0,
    droppedPackets: 0,
    openConnections: 0,
    connectionAttempts: 0,
    connectionFailures: 0,
});
const getRelayLookupId = (ip, port) => getConnectionIdentifier(ip, port === TRUE_WEB_CLIENT_RELAY_PORT ? TRUE_WEB_CLIENT_RELAY_PORT : port);
// Try the web-client endpoint first and, only after an ICE/transport failure,
// the port advertised for the SAME IP and credentials. Some relay hosts only
// answer one of those ports. Never redirect packets across different relays.
const getRtcConnectPorts = (info) => {
    const ports = USE_ORIGINAL_RELAY_PORTS ? [info.originalPort || info.port] : [info.port, info.originalPort];
    return [...new Set(ports.filter((port) => Number.isInteger(port) && port > 0 && port <= 65535))];
};
const getVoipStackPort = (info) => {
    if (USE_ORIGINAL_RELAY_PORTS)
        return info.originalPort || info.port;
    const sourcePort = info.originalPort || info.port;
    return sourcePort === TRUE_WEB_CLIENT_RELAY_PORT
        ? TRUE_WEB_CLIENT_RELAY_PORT
        : FAUX_WEB_CLIENT_RELAY_PORT;
};
const bufferPacket = (connection, packet, totals) => {
    if (packet.byteLength > MAX_BUFFER_SIZE) {
        connection.stats.droppedPackets += 1;
        totals.droppedPackets += 1;
        return false;
    }
    while (connection.packetBuffer.length > 0 &&
        connection.bufferedBytes + packet.byteLength > MAX_BUFFER_SIZE) {
        const dropped = connection.packetBuffer.shift();
        if (dropped) {
            connection.bufferedBytes -= dropped.byteLength;
            connection.stats.droppedPackets += 1;
            totals.droppedPackets += 1;
        }
    }
    connection.packetBuffer.push(packet);
    connection.bufferedBytes += packet.byteLength;
    return true;
};
const shiftPacket = (connection) => {
    const packet = connection.packetBuffer.shift() ?? null;
    if (packet)
        connection.bufferedBytes -= packet.byteLength;
    return packet;
};
const replaceIceCredentials = (sdp, ufrag, pwd) => sdp
    .replace(/a=ice-ufrag:[^\r\n]+/g, `a=ice-ufrag:${ufrag}`)
    .replace(/a=ice-pwd:[^\r\n]+/g, `a=ice-pwd:${pwd}`);
const replaceDtlsFingerprint = (sdp, algorithm, fingerprint) => sdp.replace(/a=fingerprint:[^\r\n]+/g, `a=fingerprint:${algorithm} ${fingerprint}`);
const removeIceCandidates = (sdp) => sdp
    .replace(/a=candidate:[^\r\n]+\r?\n/g, "")
    .replace(/a=end-of-candidates\r?\n?/g, "");
const appendRelayCandidate = (sdp, ip, port) => {
    const candidate = `a=candidate:2 1 udp 2122262783 ${ip} ${port} typ host generation 0 network-cost 5`;
    return `${removeIceCandidates(sdp)}${candidate}\r\na=end-of-candidates\r\n`;
};
const buildRemoteRelayAnswer = (offerSdp, info) => {
    const setupLine = info.enableEdgerayDtlsActiveMode ? "a=setup:active" : "a=setup:passive";
    let answerSdp = offerSdp.replace(/a=setup:actpass/g, setupLine);
    answerSdp = replaceIceCredentials(answerSdp, info.authToken ?? info.token, info.key);
    answerSdp = replaceDtlsFingerprint(answerSdp, "sha-256", RELAY_DTLS_FINGERPRINT);
    answerSdp = answerSdp.replace(/a=ice-options:[^\r\n]+\r\n/g, "");
    answerSdp = answerSdp.replace(/a=max-message-size:[^\r\n]+/g, "a=max-message-size:1200");
    return appendRelayCandidate(answerSdp, info.ip, info.port);
};
const toArrayBuffer = (data) => {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return copy.buffer;
};
const toUint8Array = (data) => {
    if (data instanceof Uint8Array)
        return new Uint8Array(data);
    if (Buffer.isBuffer(data))
        return new Uint8Array(data);
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);
    if (data && typeof data === "object" && "byteLength" in data && "buffer" in data) {
        const view = data;
        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    return null;
};
const classifyRelayPacket = (packet) => {
    if (packet.byteLength < 2)
        return "non_stun";
    const bytes = new Uint8Array(packet);
    const first = bytes[0];
    const second = bytes[1];
    if ((first & 0xc0) !== 0)
        return "non_stun";
    const stunType = ((first & 0x3f) << 8) | second;
    if (stunType === 0x0001)
        return "stun_bind";
    if (stunType === 0x0003)
        return "stun_alloc";
    return "stun_unknown";
};
const appendRelayPacketLog = (direction, connection, packet) => {
    if (!RELAY_PACKET_LOG_PATH)
        return;
    const buffer = packet instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(packet))
        : Buffer.from(packet.buffer, packet.byteOffset, packet.byteLength);
    try { appendFileSync(RELAY_PACKET_LOG_PATH, JSON.stringify({
        ts: new Date().toISOString(),
        direction,
        id: connection.info.id,
        relayId: connection.info.relayId,
        relayName: connection.info.name,
        ip: connection.info.ip,
        rtcPort: connection.info.port,
        voipPort: getVoipStackPort(connection.info),
        size: buffer.byteLength,
        hex: buffer.toString("hex"),
    }) + "\n"); } catch { /* diagnostic dumps must not break a call */ }
};
export class RelayRtcTransport {
    config;
    #relayInfoById = new Map();
    #connections = new Map();
    #totals = createEmptyStats();
    #wrtcPromise = null;
    constructor(config) {
        this.config = config;
    }
    #diagnose = (code) => {
        // Never include relay tokens, IPs, packet contents or SDP in diagnostics.
        try { this.config.onDiagnostic?.({ component: 'relay', code }); } catch {}
    };
    ensureReady = async () => {
        try {
            const wrtc = await this.#loadWrtc();
            if (typeof wrtc?.RTCPeerConnection !== 'function') throw new Error('missing RTCPeerConnection');
        } catch (cause) {
            throw new Error('VoIP requires a working @roamhq/wrtc installation for this platform', { cause });
        }
    };
    updateRelayList = (update) => {
        const nextInfoById = new Map();
        for (const relay of update.relays ?? []) {
            if (relay.token_id == null || relay.token_id < 0 ||
                relay.token_id >= (update.relay_tokens ?? []).length) {
                continue;
            }
            const authToken = update.auth_tokens && relay.auth_token_id != null && relay.auth_token_id >= 0
                ? update.auth_tokens[relay.auth_token_id]
                : undefined;
            for (const address of relay.addresses ?? []) {
                if (address.protocol !== RELAY_PROTO_UDP)
                    continue;
                if (address.ipv4 && address.port != null) {
                    const clientPort = USE_ORIGINAL_RELAY_PORTS ? address.port : TRUE_WEB_CLIENT_RELAY_PORT;
                    const id = getConnectionIdentifier(address.ipv4, clientPort);
                    nextInfoById.set(id, {
                        id,
                        relayId: relay.relay_id,
                        ip: address.ipv4,
                        port: clientPort,
                        originalPort: address.port,
                        isIPv6: false,
                        token: update.relay_tokens[relay.token_id],
                        authToken,
                        key: update.relay_key,
                        name: relay.relay_name,
                        enableEdgerayDtlsActiveMode: update.enable_edgeray_dtls_active_mode === true,
                    });
                }
                if (!DISABLE_IPV6 && address.ipv6 && address.port_v6 != null) {
                    const clientPort = USE_ORIGINAL_RELAY_PORTS ? address.port_v6 : TRUE_WEB_CLIENT_RELAY_PORT;
                    const id = getConnectionIdentifier(address.ipv6, clientPort);
                    nextInfoById.set(id, {
                        id,
                        relayId: relay.relay_id,
                        ip: address.ipv6,
                        port: clientPort,
                        originalPort: address.port_v6,
                        isIPv6: true,
                        token: update.relay_tokens[relay.token_id],
                        authToken,
                        key: update.relay_key,
                        name: relay.relay_name,
                        enableEdgerayDtlsActiveMode: update.enable_edgeray_dtls_active_mode === true,
                    });
                }
            }
        }
        for (const [id, old] of this.#relayInfoById) {
            const next = nextInfoById.get(id);
            if (!next || next.token !== old.token || next.authToken !== old.authToken || next.key !== old.key ||
                next.originalPort !== old.originalPort || next.enableEdgerayDtlsActiveMode !== old.enableEdgerayDtlsActiveMode) this.#closeConnection(id);
        }
        this.#relayInfoById.clear();
        for (const [id, info] of nextInfoById) this.#relayInfoById.set(id, info);
        for (const info of nextInfoById.values()) {
            // Early WASM packets may use the stack's 3478 port while the
            // matching WebRTC endpoint uses 3480. Move them only to the same
            // authenticated IP, never to a different relay or token.
            if (!USE_ORIGINAL_RELAY_PORTS) {
                for (const [earlyId, early] of [...this.#connections]) {
                    if (early.info.name !== 'early-packet' || earlyId === info.id || early.info.ip !== info.ip ||
                        ![info.originalPort, FAUX_WEB_CLIENT_RELAY_PORT, TRUE_WEB_CLIENT_RELAY_PORT].includes(early.info.port)) continue;
                    const target = this.#getOrCreateConnection(info);
                    let packet;
                    while ((packet = shiftPacket(early))) bufferPacket(target, packet, this.#totals);
                    this.#closeConnection(earlyId);
                }
            }
            void this.#ensureConnection(info);
        }
    };
    send = (packet, ip, port) => {
        const requestedId = getConnectionIdentifier(ip, port);
        const preferredPort = USE_ORIGINAL_RELAY_PORTS ? port : TRUE_WEB_CLIENT_RELAY_PORT;
        const candidateIds = [
            requestedId,
            getConnectionIdentifier(ip, preferredPort),
            getRelayLookupId(ip, TRUE_WEB_CLIENT_RELAY_PORT),
            getRelayLookupId(ip, FAUX_WEB_CLIENT_RELAY_PORT),
        ];
        let info;
        for (const candidateId of candidateIds) {
            info = this.#relayInfoById.get(candidateId);
            if (info)
                break;
        }
        if (!info) {
            if (DISABLE_IPV6 && ip.includes(":"))
                return 0;
            const earlyConnection = this.#getOrCreateEarlyConnection(ip, port);
            return bufferPacket(earlyConnection, toArrayBuffer(packet), this.#totals) ? packet.byteLength : 0;
        }
        const connection = this.#getOrCreateConnection(info);
        const arrayBuffer = toArrayBuffer(packet);
        if (classifyRelayPacket(arrayBuffer) === "stun_alloc" &&
            connection.state === "open" &&
            connection.sentMedia &&
            Date.now() - (connection.lastRxPacketTime || connection.openedAt) > ICE_RESTART_IDLE_THRESHOLD_MS) {
            const dropped = connection.packetBuffer.length;
            connection.stats.droppedPackets += dropped;
            this.#totals.droppedPackets += dropped;
            connection.packetBuffer = [];
            connection.bufferedBytes = 0;
            const buffered = bufferPacket(connection, arrayBuffer, this.#totals);
            void this.#restartIce(connection);
            return buffered ? packet.byteLength : 0;
        }
        if (connection.state === "open" && connection.dataChannel?.readyState === "open") {
            if (!this.#sendBufferedPacket(connection, arrayBuffer)) {
                connection.stats.droppedPackets += 1;
                this.#totals.droppedPackets += 1;
                return 0;
            }
            return packet.byteLength;
        }
        const buffered = bufferPacket(connection, arrayBuffer, this.#totals);
        void this.#ensureConnection(info);
        return buffered ? packet.byteLength : 0;
    };
    getStats = () => {
        let openConnections = 0, connectingConnections = 0, failedConnections = 0, bufferedPackets = 0;
        for (const connection of this.#connections.values()) {
            if (connection.state === 'open') openConnections++;
            else if (connection.state === 'connecting') connectingConnections++;
            else if (connection.state === 'failed') failedConnections++;
            bufferedPackets += connection.packetBuffer.length;
        }
        return { ...this.#totals, openConnections, connectingConnections, failedConnections,
            bufferedPackets, relayCandidates: this.#relayInfoById.size };
    };
    closeAll = async () => {
        this.#relayInfoById.clear();
        for (const id of [...this.#connections.keys()]) this.#closeConnection(id);
    };
    // ─── private ──────────────────────────────────────────────────────────────
    #getOrCreateConnection = (info) => {
        const existing = this.#connections.get(info.id);
        if (existing) {
            existing.info = info;
            return existing;
        }
        const created = {
            info, state: "none", peerConnection: null, dataChannel: null,
            iceCandidate: null, packetBuffer: [], bufferedBytes: 0,
            connectPromise: null, connectionTimeout: null, iceStatsInterval: null,
            lastIceRttMs: null, hasReceivedFirstPacket: false,
            hasNonStunPacketSent: false, sentMedia: false, lastRxPacketTime: 0,
            isReconnecting: false, stats: createEmptyStats(), failures: 0, retryTimer: null, generation: 0, openedAt: 0, rtcPortIndex: 0,
        };
        this.#connections.set(info.id, created);
        return created;
    };
    #getOrCreateEarlyConnection = (ip, port) => {
        const id = getConnectionIdentifier(ip, port);
        const existing = this.#connections.get(id);
        if (existing)
            return existing;
        const placeholderInfo = {
            id, relayId: 0, ip, port, originalPort: port,
            isIPv6: ip.includes(":"), token: "", key: "",
            name: "early-packet", enableEdgerayDtlsActiveMode: false,
        };
        const created = {
            info: placeholderInfo, state: "none", peerConnection: null,
            dataChannel: null, iceCandidate: null, packetBuffer: [],
            bufferedBytes: 0, connectPromise: null, connectionTimeout: null,
            iceStatsInterval: null, lastIceRttMs: null,
            hasReceivedFirstPacket: false, hasNonStunPacketSent: false,
            sentMedia: false, lastRxPacketTime: 0, isReconnecting: false,
            stats: createEmptyStats(), failures: 0, retryTimer: null, generation: 0, openedAt: 0, rtcPortIndex: 0,
        };
        this.#connections.set(id, created);
        return created;
    };
    #ensureConnection = (info) => {
        const connection = this.#getOrCreateConnection(info);
        if (connection.state === 'open' || connection.state === 'connecting' || connection.retryTimer || connection.failures > 4) {
            return connection.connectPromise ?? Promise.resolve();
        }
        connection.state = 'connecting';
        const generation = ++connection.generation;
        this.#totals.connectionAttempts++;
        const promise = this.#connect(connection, generation).catch(() => {
            if (this.#isCurrent(connection, generation)) this.#markFailed(connection, 'CONNECT_FAILED');
        }).finally(() => {
            if (connection.connectPromise === promise) connection.connectPromise = null;
        });
        connection.connectPromise = promise;
        return promise;
    };
    #isCurrent = (connection, generation) =>
        this.#connections.get(connection.info.id) === connection && connection.generation === generation;
    #markFailed = (connection, code) => {
        if (this.#connections.get(connection.info.id) !== connection || connection.state === 'failed') return;
        connection.state = 'failed';
        connection.generation++;
        connection.connectPromise = null;
        if (connection.connectionTimeout) clearTimeout(connection.connectionTimeout);
        connection.connectionTimeout = null;
        this.#closePeerObjects(connection);
        connection.failures++;
        this.#totals.connectionFailures++;
        this.#diagnose(code);
        const ports = getRtcConnectPorts(connection.info);
        if (ports.length > 1 && ['ICE_FAILED', 'CONNECT_TIMEOUT', 'CHANNEL_CLOSED', 'CHANNEL_ERROR'].includes(code)) {
            connection.rtcPortIndex = (connection.rtcPortIndex + 1) % ports.length;
            this.#diagnose('TRY_ALTERNATE_SAME_RELAY_PORT');
        }
        // Bounded retry of the same server-provided IP and credentials.
        // Never forward encrypted packets to another relay chosen by JS.
        if (connection.failures <= 4 && this.#relayInfoById.has(connection.info.id)) {
            const delayMs = Math.min(250 * (2 ** (connection.failures - 1)), 2000);
            connection.retryTimer = setTimeout(() => {
                connection.retryTimer = null;
                if (this.#connections.get(connection.info.id) === connection && this.#relayInfoById.has(connection.info.id)) {
                    void this.#ensureConnection(connection.info);
                }
            }, delayMs);
            connection.retryTimer.unref?.();
        }
    };
    #connect = async (connection, generation) => {
        const wrtcModule = await this.#loadWrtc();
        if (!this.#isCurrent(connection, generation)) return;
        const { RTCPeerConnection } = wrtcModule;
        if (typeof RTCPeerConnection !== 'function') throw new Error('RTCPeerConnection unavailable');
        this.#closePeerObjects(connection);
        const pc = new RTCPeerConnection();
        connection.peerConnection = pc;
        const dc = pc.createDataChannel('pre-negotiated', {
            negotiated: true, id: 0, ordered: false, maxRetransmits: 0, priority: 'high',
        });
        connection.dataChannel = dc;
        dc.binaryType = 'arraybuffer';
        const current = () => this.#isCurrent(connection, generation) && connection.peerConnection === pc;
        dc.onopen = () => {
            if (!current()) return;
            connection.state = 'open';
            connection.openedAt = Date.now();
            connection.isReconnecting = false;
            connection.failures = 0;
            if (connection.connectionTimeout) clearTimeout(connection.connectionTimeout);
            connection.connectionTimeout = null;
            this.#diagnose('CHANNEL_OPEN');
            this.#flushBufferedPackets(connection);
            this.#startIceRttPolling(connection);
        };
        dc.onclose = () => { if (current()) this.#markFailed(connection, 'CHANNEL_CLOSED'); };
        dc.onerror = () => { if (current()) this.#markFailed(connection, 'CHANNEL_ERROR'); };
        dc.onmessage = (event) => { if (current()) this.#handleIncomingPacket(connection, event.data); };
        pc.onicecandidate = (event) => {
            if (current() && event.candidate?.candidate && !connection.iceCandidate) connection.iceCandidate = event.candidate.candidate;
        };
        pc.oniceconnectionstatechange = () => {
            if (current() && (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed')) {
                this.#markFailed(connection, 'ICE_FAILED');
            }
        };
        connection.connectionTimeout = setTimeout(() => {
            if (current() && connection.state === 'connecting') this.#markFailed(connection, 'CONNECT_TIMEOUT');
        }, CONNECTION_TIMEOUT_MS);
        connection.connectionTimeout.unref?.();
        const offer = await pc.createOffer();
        if (!current()) return;
        await pc.setLocalDescription(offer);
        if (!current()) return;
        const ports = getRtcConnectPorts(connection.info);
        if (!ports.length) throw new Error('Relay has no valid RTC port');
        const remoteSdp = buildRemoteRelayAnswer(offer.sdp ?? '', {
            ...connection.info, port: ports[connection.rtcPortIndex % ports.length],
        });
        await pc.setRemoteDescription({ type: 'answer', sdp: remoteSdp });
    };
    #restartIce = (connection) => {
        if (connection.isReconnecting || !connection.hasNonStunPacketSent ||
            this.#connections.get(connection.info.id) !== connection) return;
        this.#diagnose('ICE_RESTART');
        connection.isReconnecting = true;
        connection.generation++;
        connection.connectPromise = null;
        if (connection.connectionTimeout) clearTimeout(connection.connectionTimeout);
        connection.connectionTimeout = null;
        this.#closePeerObjects(connection);
        connection.state = 'none';
        void this.#ensureConnection(connection.info);
    };
    #handleIncomingPacket = (connection, raw) => {
        const packet = toUint8Array(raw);
        if (!packet)
            return;
        connection.stats.receivedPackets += 1;
        connection.stats.receivedBytes += packet.byteLength;
        connection.hasReceivedFirstPacket = true;
        connection.lastRxPacketTime = Date.now();
        this.#totals.receivedPackets += 1;
        this.#totals.receivedBytes += packet.byteLength;
        appendRelayPacketLog("recv", connection, packet);
        this.config.onTransportMessage(packet, connection.info.ip, getVoipStackPort(connection.info));
    };
    #flushBufferedPackets = (connection) => {
        while (connection.state === "open" &&
            connection.dataChannel?.readyState === "open" &&
            connection.packetBuffer.length > 0) {
            const packet = shiftPacket(connection);
            if (!packet)
                break;
            if (!this.#sendBufferedPacket(connection, packet)) {
                connection.stats.droppedPackets += 1;
                this.#totals.droppedPackets += 1;
                break;
            }
        }
    };
    #sendBufferedPacket = (connection, packet) => {
        try {
            connection.dataChannel?.send(packet);
            if (classifyRelayPacket(packet) === "non_stun") {
                connection.hasNonStunPacketSent = true;
                connection.sentMedia = true;
            }
            connection.stats.sentPackets += 1;
            connection.stats.sentBytes += packet.byteLength;
            this.#totals.sentPackets += 1;
            this.#totals.sentBytes += packet.byteLength;
            appendRelayPacketLog("send", connection, packet);
            return true;
        }
        catch {
            return false;
        }
    };
    #startIceRttPolling = (connection) => {
        this.#stopIceRttPolling(connection);
        const pc = connection.peerConnection;
        if (!pc || typeof pc.getStats !== "function" || !this.config.onIceRtt)
            return;
        const poll = async () => {
            const rttMs = await this.#readCurrentRoundTripTimeMs(pc);
            if (connection.peerConnection !== pc || connection.state !== 'open' || rttMs == null || connection.lastIceRttMs === rttMs)
                return;
            connection.lastIceRttMs = rttMs;
            // Report the port as seen by the WASM stack, not the translated
            // WebRTC port, so its own path selection sees the correct relay.
            this.config.onIceRtt?.(rttMs, connection.info.ip, getVoipStackPort(connection.info));
        };
        void poll();
        connection.iceStatsInterval = setInterval(() => { void poll(); }, ICE_RTT_POLL_MS);
        connection.iceStatsInterval.unref?.();
    };
    #stopIceRttPolling = (connection) => {
        if (connection.iceStatsInterval) {
            clearInterval(connection.iceStatsInterval);
            connection.iceStatsInterval = null;
        }
        connection.lastIceRttMs = null;
    };
    #readCurrentRoundTripTimeMs = async (pc) => {
        try {
            const stats = await pc.getStats();
            const reports = stats && typeof stats.values === "function"
                ? Array.from(stats.values())
                : Array.isArray(stats) ? stats : Object.values(stats ?? {});
            if (!reports.length)
                return null;
            let selectedCandidatePairId = "";
            for (const report of reports) {
                if (report?.type === "transport" && typeof report.selectedCandidatePairId === "string") {
                    selectedCandidatePairId = report.selectedCandidatePairId;
                    break;
                }
            }
            const candidatePairs = reports.filter((r) => r?.type === "candidate-pair");
            const selectedPair = (selectedCandidatePairId && candidatePairs.find((r) => r?.id === selectedCandidatePairId)) ||
                candidatePairs.find((r) => r?.selected || r?.nominated) ||
                candidatePairs[0];
            const rttSeconds = typeof selectedPair?.currentRoundTripTime === "number"
                ? selectedPair.currentRoundTripTime
                : typeof selectedPair?.totalRoundTripTime === "number" &&
                    typeof selectedPair?.responsesReceived === "number" &&
                    selectedPair.responsesReceived > 0
                    ? selectedPair.totalRoundTripTime / selectedPair.responsesReceived
                    : null;
            if (rttSeconds == null || !Number.isFinite(rttSeconds) || rttSeconds <= 0)
                return null;
            return Math.max(1, Math.round(rttSeconds * 1000));
        }
        catch {
            return null;
        }
    };
    #closeConnection = (id) => {
        const connection = this.#connections.get(id);
        if (!connection)
            return;
        connection.generation++;
        if (connection.connectionTimeout) clearTimeout(connection.connectionTimeout);
        if (connection.retryTimer) clearTimeout(connection.retryTimer);
        connection.connectionTimeout = null;
        connection.retryTimer = null;
        connection.connectPromise = null;
        this.#closePeerObjects(connection);
        connection.state = "closed";
        this.#totals.droppedPackets += connection.packetBuffer.length;
        connection.packetBuffer = [];
        connection.bufferedBytes = 0;
        this.#connections.delete(id);
    };
    #closePeerObjects = (connection) => {
        this.#stopIceRttPolling(connection);
        if (connection.dataChannel) {
            connection.dataChannel.onopen = null;
            connection.dataChannel.onclose = null;
            connection.dataChannel.onerror = null;
            connection.dataChannel.onmessage = null;
        }
        if (connection.peerConnection) {
            connection.peerConnection.onicecandidate = null;
            connection.peerConnection.oniceconnectionstatechange = null;
        }
        try {
            connection.dataChannel?.close?.();
        }
        catch { }
        try {
            connection.peerConnection?.close?.();
        }
        catch { }
        connection.dataChannel = null;
        connection.peerConnection = null;
    };
    #loadWrtc = () => {
        this.#wrtcPromise ??= Promise.resolve()
            .then(() => this.config.loadWrtc ? this.config.loadWrtc() : import('@roamhq/wrtc'))
            .then((module) => module.default ?? module)
            .catch((error) => { this.#wrtcPromise = null; throw error; });
        return this.#wrtcPromise;
    };
}

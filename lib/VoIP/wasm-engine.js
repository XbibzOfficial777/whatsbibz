/** @module @xbibzlibrary/whatsbibz/lib/VoIP/wasm-engine */
var _a;
/**
 * WhatsApp VoIP WASM engine.
 *
 * Loads the WhatsApp Web VoIP WASM stack inside a Node.js `vm.Context`,
 * spawns bounded `worker_threads` pools to mirror the browser's pthread
 * model, and exposes a callback-based JS bridge. Audio-only (no video).
 *
 * @author ShellTear
 */
import * as vm from "node:vm";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomFillSync } from "node:crypto";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CALL_WASM_AB_PROPS_JSON = process.env.CALL_WASM_AB_PROPS_JSON ?? "";
// Preserve the bundled loader's original pool size. Smaller pools can reduce
// memory use but have not been validated for live media and may deadlock.
const DEFAULT_PTHREAD_POOL_SIZE = 20;
const VOIP_READY_TIMEOUT_MS = 15_000;
// --input-type is only valid for stdin/eval, not the file-backed workers.
const workerExecArgv = () => process.execArgv.filter((arg) => !arg.startsWith('--input-type'));
const parseJsonObjectEnv = (raw) => {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            return parsed;
    }
    catch { }
    return {};
};
const toByteArray = (input) => {
    if (!input)
        return new Uint8Array(0);
    if (input instanceof Uint8Array)
        return input;
    if (typeof input === "string")
        return new TextEncoder().encode(input);
    if (ArrayBuffer.isView(input))
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    if (input instanceof ArrayBuffer)
        return new Uint8Array(input);
    if (typeof input === "object" && typeof input.length === "number") {
        const arr = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i += 1)
            arr[i] = input[i] ?? 0;
        return arr;
    }
    return new Uint8Array(0);
};
const filterWorkerStderr = (chunk) => {
    const line = chunk.toString().trim();
    if (line && !line.startsWith("voip:") && !line.startsWith("still waiting")) {
        process.stderr.write(chunk);
    }
};
const resolveWorkerScriptPath = () => {
    const compiled = path.join(__dirname, "worker-bootstrap.js");
    return fs.existsSync(compiled) ? compiled : path.join(__dirname, "worker-bootstrap.mts");
};
/** @internal Bridges a worker to its owning engine, not to other clients. */
export class NodeWorkerMessagePort {
    #listeners = new Map();
    #worker;
    #onCallback;
    fullyConnected;
    name;
    workerID = 0;
    pthread_ptr = 0;
    constructor(worker, name = "WAWebVoipWebWasmWorker", onCallback = () => {}) {
        this.#worker = worker;
        this.#onCallback = onCallback;
        this.name = name;
        this.fullyConnected = new Promise((resolve) => {
            const loadedHandler = (msg) => {
                if (msg && msg.cmd === "loaded") {
                    this.workerID = msg.workerID ?? 0;
                    resolve(this);
                }
            };
            this.addMessageListener("cmd", loadedHandler);
        });
        if (typeof worker.on === "function") {
            worker.on("message", (data) => this.#handleMessage(data));
            worker.on("error", () => { });
        }
        else if (typeof worker.addEventListener === "function") {
            worker.addEventListener("message", (ev) => this.#handleMessage(ev?.data ?? ev));
        }
    }
    postMessage = (msg, transferList) => {
        const out = msg && typeof msg === "object" && msg.cmd && !msg.type ? { ...msg, type: "cmd" } : msg;
        this.#worker.postMessage(out, transferList);
    };
    addMessageListener = (type, handler) => {
        let set = this.#listeners.get(type);
        if (!set) {
            set = new Set();
            this.#listeners.set(type, set);
        }
        set.add(handler);
        return handler;
    };
    removeMessageListener = (type, handler) => this.#listeners.get(type)?.delete(handler) ?? false;
    removeAllMessageListeners = (type) => {
        if (type)
            this.#listeners.get(type)?.clear();
        else
            this.#listeners.clear();
    };
    terminate = () => this.#worker.terminate();
    close = () => { };
    isWrappingVirtualMessagePort = () => false;
    getWorker = () => this.#worker;
    #handleMessage = (data) => {
        if (!data || typeof data !== "object")
            return;
        if (data.type === "callback" || data.type === "waWasmWorkerCompatibleCallback") {
            let callbackName;
            let callbackArgs;
            if (data.__name) {
                callbackName = data.__name;
                callbackArgs = {};
                for (const key in data) {
                    if (key !== "type" && key !== "__name" && key !== "prototype" && key !== "args" && !key.startsWith("__")) {
                        callbackArgs[key] = data[key];
                    }
                }
            }
            else if (data.name) {
                callbackName = data.name;
                callbackArgs = data.args ?? {};
            }
            else if (data.payload?.name) {
                callbackName = data.payload.name;
                callbackArgs = data.payload.args ?? {};
            }
            else {
                return;
            }
            if (callbackName === "onSignalingXmpp" &&
                (!callbackArgs || Object.keys(callbackArgs).length === 0)) {
                callbackArgs = {
                    peerJid: data.peerJid, callId: data.callId, xmlPayload: data.xmlPayload,
                };
            }
            let listenerData = callbackArgs;
            if (!callbackArgs || Object.keys(callbackArgs).length === 0 ||
                (Object.keys(callbackArgs).length === 1 && callbackArgs.prototype)) {
                listenerData = {};
                for (const key in data) {
                    if (key !== "type" && key !== "__name" && key !== "prototype" && key !== "args" && !key.startsWith("__")) {
                        listenerData[key] = data[key];
                    }
                }
            }
            else if (callbackName === "sendDataToRelay") {
                listenerData = { ...callbackArgs };
                if (data.data !== undefined)
                    listenerData.data = data.data;
                if (data.len !== undefined)
                    listenerData.len = data.len;
                if (data.ip !== undefined)
                    listenerData.ip = data.ip;
                if (data.port !== undefined)
                    listenerData.port = data.port;
            }
            else if (callbackName === "onCallEvent") {
                listenerData = { ...callbackArgs };
                if (data.eventType !== undefined)
                    listenerData.eventType = data.eventType;
                if (data.userData !== undefined)
                    listenerData.userData = data.userData;
                if (data.eventDataJson !== undefined)
                    listenerData.eventDataJson = data.eventDataJson;
            }
            // Engine callbacks are scoped to the worker's owner. The legacy
            // global observers are still notified separately for compatibility.
            try { this.#onCallback(callbackName, listenerData); } catch {}
            WasmEngine.notifyGlobalCallbackListeners(callbackName, listenerData);
            return;
        }
        const dispatch = (key) => {
            if (!key)
                return;
            for (const handler of this.#listeners.get(key) ?? []) {
                try {
                    handler(data);
                }
                catch { }
            }
        };
        dispatch(data.type);
        if (data.cmd !== data.type)
            dispatch(data.cmd);
    };
}
export class WasmEngine {
    static #globalCallbackListeners = new Map();
    #callbackListeners = new Map();
    static registerGlobalCallbackListener = (callbackName, handler) => {
        const key = `callback:${callbackName}`;
        let set = _a.#globalCallbackListeners.get(key);
        if (!set) {
            set = new Set();
            _a.#globalCallbackListeners.set(key, set);
        }
        set.add(handler);
    };
    static notifyGlobalCallbackListeners = (callbackName, data) => {
        const set = _a.#globalCallbackListeners.get(`callback:${callbackName}`);
        if (!set)
            return;
        for (const handler of set) {
            try {
                handler(data);
            }
            catch { }
        }
    };
    #config;
    #pthreadPoolSize;
    #instance = null;
    #initialized = false;
    #initializing = false;
    #cancelInitialization = null;
    #generation = 0;
    #moduleRegistry = new Map();
    #vmContext = null;
    #vmTimeouts = new Set();
    #vmIntervals = new Set();
    #unusedWorkers = [];
    #runningWorkers = [];
    #auxiliaryWorkers = new Set();
    #pthreads = {};
    #nextWorkerID = 1;
    #wasmModule = null;
    #wasmMemory = null;
    #removeRunDependencyCallback = null;
    #workersLoadedCount = 0;
    #audioPlaybackLoopInterval = null;
    #audioPlaybackBuffer = null;
    #isPlaybackActive = false;
    #voipStackInitialized = false;
    #voipStackInitPromise = null;
    #voipReadyResolver = null;
    #voipReadyTimer = null;
    #voipInitCancel = null;
    #voipInitError = null;
    #workerModulesCode = "";
    #loaderCode = "";
    constructor(config = {}) {
        const size = config.workerPoolSize ?? DEFAULT_PTHREAD_POOL_SIZE;
        if (!Number.isInteger(size) || size < 4 || size > 20) throw new TypeError('workerPoolSize must be an integer from 4 to 20');
        this.#pthreadPoolSize = size;
        const basePath = config.resourcesPath
            ? (path.isAbsolute(config.resourcesPath) ? config.resourcesPath : path.resolve(process.cwd(), config.resourcesPath))
            : path.resolve(__dirname, "..");
        const wasmPath = config.wasmPath
            ? (path.isAbsolute(config.wasmPath) ? config.wasmPath : path.resolve(process.cwd(), config.wasmPath))
            : path.join(basePath, "assets", "wasm", "whatsapp.wasm");
        this.#config = {
            ...config,
            wasmPath,
            resourcesPath: basePath,
            enableLogs: config.enableLogs ?? true,
            options: {
                heartbeatInterval: 30,
                lobbyTimeout: 1,
                maxParticipantsScreenShare: 32,
                maxGroupSizeLongRingtone: 32,
                ...config.options,
            },
        };
    }
    initialize = async () => {
        if (this.#initialized || this.#initializing)
            throw new Error('WasmEngine already initialized or initializing');
        this.#initializing = true;
        const generation = ++this.#generation;
        const cancelled = Symbol('cancelled');
        let cancel;
        const cancelledPromise = new Promise((resolve) => { cancel = () => resolve(cancelled); });
        this.#cancelInitialization = cancel;
        const checkCurrent = () => {
            if (generation !== this.#generation) throw new Error('VoIP WASM initialization cancelled');
        };
        const cancellable = async (promise) => {
            const result = await Promise.race([promise, cancelledPromise]);
            if (result === cancelled) throw new Error('VoIP WASM initialization cancelled');
            checkCurrent();
            return result;
        };
        try {
        const voipStorageDir = "/tmp/voip";
        try {
            if (!fs.existsSync(voipStorageDir))
                fs.mkdirSync(voipStorageDir, { recursive: true });
        }
        catch { }
        const loaderFile = path.join(this.#config.resourcesPath, "assets", "wasm", "loader.js");
        const workerFile = path.join(this.#config.resourcesPath, "assets", "wasm", "worker-modules.js");
        if (!this.#config.wasmBinary && !fs.existsSync(this.#config.wasmPath)) {
            throw new Error(`WASM file not found: ${this.#config.wasmPath}`);
        }
        const wasmBuffer = this.#config.wasmBinary
            ? Buffer.from(this.#config.wasmBinary)
            : fs.readFileSync(this.#config.wasmPath);
        const diskWorkerCode = fs.existsSync(workerFile) ? fs.readFileSync(workerFile, "utf8") : "";
        this.#workerModulesCode = this.#config.workerModulesCode ?? diskWorkerCode;
        const workerBundleHasLoader = typeof this.#workerModulesCode === "string" && /WAWebVoipWebWasmLoader/.test(this.#workerModulesCode);
        // Skip the on-disk loader.js if the worker bundle already has a loader —
        // the standalone loader.js is older and would clobber the freshly fetched
        // bindings inside worker-modules.js.
        this.#loaderCode = this.#config.loaderCode ??
            (workerBundleHasLoader ? "" : fs.existsSync(loaderFile) ? fs.readFileSync(loaderFile, "utf8") : "");
        if (!this.#loaderCode && !this.#workerModulesCode) {
            throw new Error("No loader/worker code available to initialize VoIP");
        }
        const memory = new WebAssembly.Memory({ initial: 256, maximum: 32768, shared: true });
        this.#wasmMemory = memory;
        const wasmModule = await cancellable(WebAssembly.compile(wasmBuffer));
        checkCurrent();
        this.#wasmModule = wasmModule;
        this.#vmContext = this.#createVMContext(memory);
        const runModuleCode = (code) => { if (code)
            vm.runInContext(code, this.#vmContext); };
        runModuleCode(this.#workerModulesCode);
        runModuleCode(this.#loaderCode);
        this.#vmContext.WAWebVoipWebWasmWorkerResource = this.#requireModule("WAWebVoipWebWasmWorkerResource");
        const loaderModuleNames = [
            this.#config.loaderModuleName,
            "WAWebVoipWebWasmLoader",
            "WAWebVoipWebWasmLoader.worker",
            "WAWebVoipWebWasmLoader_ProdLab_internal.worker",
            "WAWebVoipWebWasmLoader_ProdLabvideo_internal.worker",
        ].filter((v, i, a) => !!v && a.indexOf(v) === i);
        let wasmLoader = null;
        for (const moduleName of loaderModuleNames) {
            const candidate = this.#requireModule(moduleName);
            if (typeof candidate === "function") {
                wasmLoader = candidate;
                break;
            }
            if (typeof candidate?.default === "function") {
                wasmLoader = candidate.default;
                break;
            }
        }
        if (typeof wasmLoader !== "function") {
            throw new Error(`No compatible WASM loader found. Tried: ${loaderModuleNames.join(", ")}`);
        }
        this.#registerInstanceCallbacks();
        await cancellable(this.#initPThreadPool());
        checkCurrent();
        if (this.#unusedWorkers.length !== this.#pthreadPoolSize) {
            throw new Error('Could not create the required VoIP WASM workers');
        }
        const workersLoadingPromise = this.#loadWasmModuleToAllWorkers();
        const readyPromise = Promise.resolve().then(() => {
            checkCurrent();
            return wasmLoader({
                wasmBinary: wasmBuffer,
                wasmMemory: memory,
                pthreadPoolSizeOverride: this.#pthreadPoolSize,
                locateFile: () => this.#config.wasmPath,
                onRuntimeInitialized: () => { },
            });
        });
        let initTimer;
        let instance;
        try {
            [instance] = await cancellable(Promise.race([
                Promise.all([readyPromise, workersLoadingPromise]),
                new Promise((_, reject) => { initTimer = setTimeout(() => reject(new Error('VoIP WASM initialization timed out')), 30_000); }),
            ]));
        } finally { clearTimeout(initTimer); }
        checkCurrent();
        this.#instance = instance;
        this.#initialized = true;
        } catch (error) {
            // Direct WasmEngine callers also need cleanup after a failed init.
            // A concurrent destroy has already cleaned its own generation.
            if (generation === this.#generation) this.destroy();
            throw error;
        } finally {
            if (this.#cancelInitialization === cancel) this.#cancelInitialization = null;
            this.#initializing = false;
        }
    };
    isInitialized = () => this.#initialized;
    destroy = () => {
        this.#generation++;
        this.#cancelInitialization?.();
        this.#voipInitCancel?.();
        for (const timer of this.#vmTimeouts) clearTimeout(timer);
        for (const timer of this.#vmIntervals) clearInterval(timer);
        this.#vmTimeouts.clear();
        this.#vmIntervals.clear();
        this.#stopAudioPlaybackLoop();
        if (this.#instance && typeof this.#instance.endCall === "function") {
            try {
                this.#instance.endCall(0, false);
            }
            catch { }
        }
        for (const worker of [...this.#runningWorkers, ...this.#unusedWorkers, ...this.#auxiliaryWorkers]) {
            try {
                // terminate() is asynchronous; observe rejections even though
                // destroy remains synchronous for backwards compatibility.
                worker.terminate()?.catch?.(() => {});
            }
            catch { }
        }
        this.#auxiliaryWorkers.clear();
        this.#runningWorkers = [];
        this.#unusedWorkers = [];
        this.#pthreads = {};
        this.#workersLoadedCount = 0;
        this.#removeRunDependencyCallback = null;
        this.#instance = null;
        this.#vmContext = null;
        this.#moduleRegistry.clear();
        this.#wasmModule = null;
        this.#wasmMemory = null;
        this.#initialized = false;
        this.#voipStackInitialized = false;
        this.#callbackListeners.clear();
    };
    initVoipStack = (selfJid, meUserJid, selfLid) => {
        this.#ensureInitialized();
        if (this.#voipStackInitialized || this.#voipStackInitPromise) return;
        this.#voipInitError = null;
        let settled = false;
        const promise = new Promise((resolve) => {
            const finish = (ready, error = null) => {
                if (settled) return;
                settled = true;
                if (this.#voipReadyTimer) clearTimeout(this.#voipReadyTimer);
                this.#voipReadyTimer = null;
                this.#voipReadyResolver = null;
                this.#voipInitCancel = null;
                this.#voipInitError = error;
                this.#voipStackInitialized = ready;
                resolve();
            };
            this.#voipReadyResolver = () => finish(true);
            this.#voipInitCancel = () => finish(false, new Error('VoIP engine disconnected during initialization'));
            this.#voipReadyTimer = setTimeout(() => {
                // Some upstream bundles do not emit onVoipReady. Preserve the
                // upstream fallback, but label it as an assumption, not proof.
                try { this.#config.callbacks?.onDiagnostic?.({ component: 'wasm', code: 'READY_TIMEOUT_ASSUMED' }); } catch {}
                finish(true);
            }, VOIP_READY_TIMEOUT_MS);
            try {
                this.#applyDefaultAbProps();
                try {
                    this.#instance.initVoipStack(selfJid, meUserJid, selfLid);
                }
                catch (modernErr) {
                    if (modernErr?.name === 'BindingError' &&
                        (String(modernErr?.message ?? '').includes('expected 8 args') ||
                            String(modernErr?.message ?? '').includes('takes 8'))) {
                        this.#instance.initVoipStack(selfJid, meUserJid, selfLid, true, 5, 0, 8, 16);
                    }
                    else throw modernErr;
                }
            }
            catch (error) {
                finish(false, new Error('VoIP stack initialization failed', { cause: error }));
            }
        });
        this.#voipStackInitPromise = promise;
        void promise.then(() => {
            if (this.#voipStackInitPromise === promise) this.#voipStackInitPromise = null;
        });
    };
    waitForVoipStackReady = async () => {
        if (this.#voipStackInitPromise) await this.#voipStackInitPromise;
        if (!this.#voipStackInitialized) throw this.#voipInitError ?? new Error('VoIP stack is not initialized');
    };
    isVoipStackReady = () => this.#voipStackInitialized;
    startCall = (options) => {
        this.#ensureInitialized();
        const peers = this.#makeStringList(options.peerList ?? [options.peerJid]);
        const tcToken = this.#createUint8List(options.extraData);
        const isLidCall = options.isLidCall ?? options.peerJid.includes("@lid");
        const isFromDialer = options.isFromDialer ?? false;
        const peerJid = String(options.peerJid);
        try {
            try {
                return this.#instance.startVoipCall(peerJid, peers, options.callId, options.isVideo, options.peerPn, isLidCall, isFromDialer, tcToken);
            }
            catch (error) {
                if (error?.name !== "BindingError")
                    throw error;
                return this.#instance.startVoipCall(peerJid, peers, options.callId, options.isVideo, options.peerPn, isFromDialer, tcToken);
            }
        }
        finally {
            peers?.delete?.();
            tcToken?.delete?.();
        }
    };
    endCall = (reason = 0, sendTerminate = true) => {
        this.#ensureInitialized();
        this.#instance.endCall(reason, sendTerminate);
    };
    setMute = (muted) => {
        this.#ensureInitialized();
        return this.#instance.setCallMute(muted);
    };
    updateNetworkMedium = (networkMedium, networkMtu = 0) => {
        this.#ensureInitialized();
        this.#instance.updateNetworkMedium?.(networkMedium, networkMtu);
    };
    handleSignalingOffer = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            this.#instance.handleIncomingSignalingOffer(msg.payload, String(msg.peerPlatform ?? 0), String(msg.peerAppVersion ?? "0"), String(msg.epochId ?? "0"), String(msg.timestamp ?? "0"), msg.isOffline ?? false, msg.isOfferNotContact ?? false, String(msg.peerJid), tcTokenList);
        }
        finally {
            tcTokenList?.delete?.();
        }
    };
    handleSignalingMessage = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            this.#instance.handleIncomingSignalingMessage(msg.payload, String(msg.peerPlatform ?? "0"), String(msg.peerAppVersion ?? "0"), String(msg.epochId ?? "0"), String(msg.timestamp ?? "0"), msg.isOffline ?? false, String(msg.peerJid), tcTokenList);
        }
        finally {
            tcTokenList?.delete?.();
        }
    };
    handleSignalingAck = (msg) => {
        this.#ensureInitialized();
        const options = this.#createUint8List(msg.extraData);
        try {
            this.#instance.handleIncomingSignalingAck(msg.payload, String(msg.ackError ?? "0"), String(msg.msgType ?? ""), msg.peerJid ?? "", options);
        }
        finally {
            options?.delete?.();
        }
    };
    handleSignalingReceipt = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            this.#instance.handleIncomingSignalingReceipt?.(msg.payload, msg.peerJid, tcTokenList);
        }
        finally {
            tcTokenList?.delete?.();
        }
    };
    handleOnTransportMessage = (data, ip, port) => {
        this.#ensureInitialized();
        if (typeof this.#instance.handleOnMessageFromHeap === "function") {
            const ptr = this.malloc(data.byteLength);
            if (!ptr)
                return;
            try {
                const heapU8 = this.#instance.GROWABLE_HEAP_U8?.() ?? this.#instance.HEAPU8;
                if (!heapU8)
                    return;
                heapU8.set(data, ptr);
                this.#instance.handleOnMessageFromHeap(ptr, data.byteLength, ip, port);
            }
            finally {
                this.free(ptr);
            }
            return;
        }
        if (typeof this.#instance.handleOnMessage !== "function")
            return;
        const dataList = this.#createUint8List(data);
        try {
            this.#instance.handleOnMessage(dataList, ip, port);
        }
        finally {
            dataList?.delete?.();
        }
    };
    updateIceRtt = (rttMs, relayIp, relayPort) => {
        this.#ensureInitialized();
        this.#instance.updateIceRtt?.(rttMs, relayIp, relayPort);
    };
    sendAudioData = (data, ptr) => {
        this.#ensureInitialized();
        if (!data || data.length === 0 || !ptr)
            return;
        if (typeof this.#instance.onAudioDataFromJs !== "function")
            return;
        try {
            const heapF32 = this.#instance.GROWABLE_HEAP_F32?.() ?? this.#instance.HEAPF32;
            if (!heapF32)
                return;
            const index = Math.floor(ptr / 4);
            if (index < 0 || index + data.length > heapF32.length)
                return;
            heapF32.set(data, index);
            this.#instance.onAudioDataFromJs(ptr, data.length);
        }
        catch { }
    };
    malloc = (size) => {
        this.#ensureInitialized();
        return this.#instance._malloc(size);
    };
    free = (ptr) => {
        this.#ensureInitialized();
        this.#instance._free(ptr);
    };
    // ─── private ──────────────────────────────────────────────────────────────
    #ensureInitialized = () => {
        if (!this.#initialized || !this.#instance) {
            throw new Error("WasmEngine not initialized. Call initialize() first.");
        }
    };
    #makeStringList = (arr) => {
        const list = new this.#instance.StringList();
        for (const v of arr)
            list.push_back(v);
        return list;
    };
    #createUint8List = (data) => {
        if (!this.#instance?.Uint8List)
            return null;
        const list = new this.#instance.Uint8List();
        if (data)
            data.forEach((byte) => list.push_back(byte));
        return list;
    };
    #startAudioPlaybackLoop = () => {
        if (this.#audioPlaybackLoopInterval)
            return;
        this.#ensureInitialized();
        this.#isPlaybackActive = true;
        if (typeof this.#instance.requestAudioDataFromWasmVoip !== "function")
            return;
        const framesPerChunk = 320;
        const bufferSize = framesPerChunk * 4;
        try {
            const _malloc = this.#instance._malloc ?? this.#instance.malloc;
            if (!_malloc)
                return;
            this.#audioPlaybackBuffer = _malloc(bufferSize);
        }
        catch {
            return;
        }
        if (!this.#audioPlaybackBuffer || this.#audioPlaybackBuffer <= 0)
            return;
        this.#audioPlaybackLoopInterval = setInterval(() => {
            if (!this.#isPlaybackActive || !this.#instance || !this.#initialized) {
                this.#stopAudioPlaybackLoop();
                return;
            }
            try {
                this.#instance.requestAudioDataFromWasmVoip(this.#audioPlaybackBuffer, bufferSize);
                const heapF32 = this.#instance.GROWABLE_HEAP_F32?.();
                if (!heapF32)
                    return;
                const index = Math.floor(this.#audioPlaybackBuffer / 4);
                const numFloats = Math.floor(bufferSize / 4);
                if (index < 0 || index + numFloats > heapF32.length)
                    return;
                const audioData = new Float32Array(heapF32.buffer, heapF32.byteOffset + index * 4, numFloats);
                const hasNonZero = audioData.some((s) => Math.abs(s) > 0.0001);
                if (hasNonZero)
                    this.#config.callbacks?.onAudioPlaybackData?.(audioData);
            }
            catch { }
        }, 16);
    };
    #stopAudioPlaybackLoop = () => {
        this.#isPlaybackActive = false;
        if (this.#audioPlaybackLoopInterval) {
            clearInterval(this.#audioPlaybackLoopInterval);
            this.#audioPlaybackLoopInterval = null;
        }
        if (this.#audioPlaybackBuffer && this.#audioPlaybackBuffer > 0) {
            try {
                this.#instance?._free?.(this.#audioPlaybackBuffer);
            }
            catch { }
            this.#audioPlaybackBuffer = null;
        }
    };
    #applyDefaultAbProps = () => {
        if (!this.#instance)
            return;
        const setInt = typeof this.#instance.setABPropInt === "function"
            ? (k, v) => { this.#instance.setABPropInt(k, v); }
            : null;
        const setBool = typeof this.#instance.setABPropBool === "function"
            ? (k, v) => { this.#instance.setABPropBool(k, v); }
            : null;
        const setString = typeof this.#instance.setABPropString === "function"
            ? (k, v) => { this.#instance.setABPropString(k, v); }
            : null;
        if (!setInt && !setBool && !setString)
            return;
        const opts = this.#config.options ?? {};
        const intProps = {
            heartbeat_interval_s: opts.heartbeatInterval ?? 30,
            lobby_timeout_min: opts.lobbyTimeout ?? 1,
            max_num_participants_for_ss: opts.maxParticipantsScreenShare ?? 32,
            max_group_size_for_long_ringtone: opts.maxGroupSizeLongRingtone ?? 32,
            app_exit_reason_version: 1,
            log_level: opts.logLevel ?? 3,
            calling_rust_migration_bitmap: 0,
            calling_rust_migration_incoming_stanza_bitmap: 0,
            default_endpoint_thread_poll_timeout: 0,
            aigc_version: 0,
            call_admin_version: 0,
            vid_stream_pause_resume_jb_reset_threshold_ms: 0,
            // Opus: max bandwidth WB (16 kHz). FB (48 kHz) needs native audio device
            // hooks not available in this JS-only WASM context.
            opus_max_bandwidth: 1103, // OPUS_BANDWIDTH_WIDEBAND
        };
        const boolProps = {
            enable_av_downgrade: false,
            enable_new_user_action_stanza_for_raise_hand_sender: false,
            enable_webcodec_video_encode: false,
            enable_init_bwe_for_group_call: false,
            enable_ring_for_gc_on_offer_expire: false,
            allow_reporting_call_replayer_id: false,
            enable_offer_v2_upgrade: false,
            enable_silent_offer: false,
            voice_ai_conversation_starter_latency_tracking: false,
            enable_waiting_room_logging: false,
            attach_transport_rtx: false,
            ignore_joinable_terminate_on_expired_offer: false,
            enable_passthrough_video_decoder: false,
        };
        for (const [key, value] of Object.entries(intProps)) {
            if (setInt && Number.isFinite(value))
                try {
                    setInt(key, value);
                }
                catch { }
        }
        for (const [key, value] of Object.entries(boolProps)) {
            if (setBool)
                try {
                    setBool(key, value);
                }
                catch { }
        }
        const overrideProps = parseJsonObjectEnv(CALL_WASM_AB_PROPS_JSON);
        for (const [key, value] of Object.entries(overrideProps)) {
            try {
                if (typeof value === "boolean" && setBool)
                    setBool(key, value);
                else if (typeof value === "number" && setInt)
                    setInt(key, value);
                else if (typeof value === "string" && setString)
                    setString(key, value);
            }
            catch { }
        }
    };
    #allocateUnusedWorker = () => {
        const workerScriptPath = resolveWorkerScriptPath();
        if (!fs.existsSync(workerScriptPath))
            return;
        try {
            const worker = new Worker(workerScriptPath, {
                stdout: true, stderr: true,
                execArgv: workerExecArgv(),
                workerData: {
                    wasmPath: this.#config.wasmPath,
                    wasmBinary: this.#config.wasmBinary,
                    workerModulesCode: this.#workerModulesCode,
                    loaderCode: this.#loaderCode,
                    loaderModuleName: this.#config.loaderModuleName,
                    resourcesPath: this.#config.resourcesPath,
                    enableLogs: this.#config.enableLogs,
                },
            });
            const port = new NodeWorkerMessagePort(worker, "WAWebVoipWebWasmWorker", this.#notifyInstanceCallback);
            worker.stdout?.on("data", () => { }); // suppress noisy worker stdout
            worker.stderr?.on("data", filterWorkerStderr);
            this.#unusedWorkers.push(port);
        }
        catch { }
    };
    #initPThreadPool = async () => {
        for (let i = 0; i < this.#pthreadPoolSize; i += 1)
            this.#allocateUnusedWorker();
    };
    #loadWasmModuleToWorker = (worker) => new Promise((resolve, reject) => {
        const rawWorker = worker.getWorker();
        const cleanup = () => {
            clearTimeout(timer);
            worker.removeMessageListener('cmd', loadedHandler);
            rawWorker.off?.('error', onError);
            rawWorker.off?.('exit', onExit);
        };
        const loadedHandler = (msg) => {
            if (msg && msg.cmd === 'loaded') {
                cleanup();
                this.#workersLoadedCount += 1;
                if (this.#workersLoadedCount >= this.#pthreadPoolSize && this.#removeRunDependencyCallback) {
                    this.#removeRunDependencyCallback('loading-workers');
                }
                resolve();
            }
        };
        const onError = () => { cleanup(); reject(new Error('VoIP WASM worker failed to start')); };
        const onExit = () => { cleanup(); reject(new Error('VoIP WASM worker exited before loading')); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('VoIP WASM worker load timed out')); }, 20_000);
        worker.addMessageListener('cmd', loadedHandler);
        rawWorker.once?.('error', onError);
        rawWorker.once?.('exit', onExit);
        worker.workerID = this.#nextWorkerID++;
        try {
            worker.postMessage({
                cmd: 'load', type: 'cmd', wasmMemory: this.#wasmMemory,
                wasmModule: this.#wasmModule, workerID: worker.workerID, handlers: [],
            });
        } catch { onError(); }
    });
    #loadWasmModuleToAllWorkers = async () => {
        this.#workersLoadedCount = 0;
        await Promise.all(this.#unusedWorkers.map((w) => this.#loadWasmModuleToWorker(w)));
    };
    #notifyInstanceCallback = (callbackName, data) => {
        for (const handler of this.#callbackListeners.get(callbackName) ?? []) {
            try { handler(data); } catch {}
        }
    };
    #registerInstanceCallback = (callbackName, handler) => {
        const set = this.#callbackListeners.get(callbackName) ?? new Set();
        set.add(handler);
        this.#callbackListeners.set(callbackName, set);
    };
    #registerInstanceCallbacks = () => {
        this.#callbackListeners.clear();
        const callbacks = this.#config.callbacks ?? {};
        this.#registerInstanceCallback("loggingCallback", (data) => {
            if (!this.#config.enableLogs)
                return;
            const level = data?.level;
            const msg = data?.message ?? "";
            const mapped = level === 1 ? "error" : level === 2 ? "warn" : level === 3 ? "log" : "debug";
            callbacks.onLog?.(mapped, msg);
        });
        if (callbacks.onAudioCaptureInit) {
            this.#registerInstanceCallback("initCaptureDriverJS", (data) => {
                callbacks.onAudioCaptureInit({
                    sampleRate: data?.sample_rate ?? data?.sampleRate,
                    channels: data?.channels,
                    bitsPerSample: data?.bits_per_sample ?? data?.bitsPerSample,
                    framesPerChunk: data?.frames_per_chunk ?? data?.framesPerChunk,
                });
            });
        }
        this.#registerInstanceCallback("startCaptureJS", () => callbacks.onAudioCaptureStart?.());
        this.#registerInstanceCallback("stopCaptureJS", () => callbacks.onAudioCaptureStop?.());
        if (callbacks.onAudioPlaybackInit) {
            this.#registerInstanceCallback("initPlaybackDriverJS", (data) => {
                callbacks.onAudioPlaybackInit({
                    sampleRate: data?.sample_rate ?? data?.sampleRate,
                    channels: data?.channels,
                    bitsPerSample: data?.bits_per_sample ?? data?.bitsPerSample,
                    framesPerChunk: data?.frames_per_chunk ?? data?.framesPerChunk,
                });
            });
        }
        this.#registerInstanceCallback("startPlaybackJS", () => {
            callbacks.onAudioPlaybackStart?.();
            this.#startAudioPlaybackLoop();
        });
        this.#registerInstanceCallback("stopPlaybackJS", () => {
            this.#stopAudioPlaybackLoop();
            callbacks.onAudioPlaybackStop?.();
        });
        if (callbacks.onSignalingXmpp) {
            this.#registerInstanceCallback("onSignalingXmpp", (data) => {
                const peerJid = data.peerJid ?? data.args?.peerJid;
                const callId = data.callId ?? data.args?.callId;
                let xmlPayload = data.xmlPayload ?? data.args?.xmlPayload;
                if (Array.isArray(xmlPayload))
                    xmlPayload = new Uint8Array(xmlPayload);
                else if (xmlPayload && typeof xmlPayload === "object" &&
                    !(xmlPayload instanceof Uint8Array) && !Buffer.isBuffer(xmlPayload)) {
                    xmlPayload = new Uint8Array(xmlPayload);
                }
                callbacks.onSignalingXmpp(peerJid, callId, xmlPayload);
            });
        }
        if (callbacks.onCallEvent) {
            this.#registerInstanceCallback("onCallEvent", (data) => {
                callbacks.onCallEvent(data.eventType, data.eventDataJson);
            });
        }
        if (callbacks.sendDataToRelay) {
            this.#registerInstanceCallback("sendDataToRelay", (data) => {
                let relayData = data.data ?? data.args?.data;
                const ip = data.ip ?? data.args?.ip;
                const portNum = data.port ?? data.args?.port;
                if (relayData instanceof Uint8Array) { /* ok */ }
                else if (Array.isArray(relayData))
                    relayData = new Uint8Array(relayData);
                else if (Buffer.isBuffer(relayData))
                    relayData = new Uint8Array(relayData);
                else if (relayData && typeof relayData === "object" && relayData.buffer) {
                    relayData = new Uint8Array(relayData.buffer, relayData.byteOffset ?? 0, relayData.byteLength ?? relayData.length);
                }
                else if (relayData instanceof ArrayBuffer)
                    relayData = new Uint8Array(relayData);
                else
                    return 0;
                if (!ip || !portNum)
                    return 0;
                return callbacks.sendDataToRelay(relayData, ip, portNum) ?? 0;
            });
        }
        this.#registerInstanceCallback("onVoipReady", () => {
            this.#voipReadyResolver?.();
            callbacks.onVoipReady?.();
        });
    };
    #requireModule = (name) => {
        const notifyOwner = this.#notifyInstanceCallback;
        class ScopedWorkerMessagePort extends NodeWorkerMessagePort {
            constructor(worker, name) { super(worker, name, notifyOwner); }
        }
        const preDefinedModules = {
            Promise,
            WAWebVoipWebWasmWorkerResource: {
                resourcePath: resolveWorkerScriptPath(),
                name: "WAWebVoipWebWasmWorker",
            },
            WorkerBundleResource: {
                createDedicatedWebWorker: (resource) => {
                    const scriptPath = resource?.resourcePath && fs.existsSync(resource.resourcePath)
                        ? resource.resourcePath
                        : resolveWorkerScriptPath();
                    const worker = new Worker(scriptPath, {
                        stdout: true, stderr: true,
                        execArgv: workerExecArgv(),
                        workerData: {
                            wasmPath: this.#config.wasmPath,
                            wasmBinary: this.#config.wasmBinary,
                            workerModulesCode: this.#workerModulesCode,
                            loaderCode: this.#loaderCode,
                            loaderModuleName: this.#config.loaderModuleName,
                            resourcesPath: this.#config.resourcesPath,
                            enableLogs: this.#config.enableLogs,
                        },
                    });
                    worker.stdout?.on("data", () => { });
                    worker.stderr?.on("data", filterWorkerStderr);
                    // The loader creates another worker pool outside the
                    // explicit pthread pool; it must be owned and terminated.
                    this.#auxiliaryWorkers.add(worker);
                    worker.once('exit', () => this.#auxiliaryWorkers.delete(worker));
                    worker.on('error', () => {});
                    return worker;
                },
            },
            WorkerClient: { init: () => { } },
            WorkerMessagePort: {
                WorkerMessagePort: ScopedWorkerMessagePort,
                CastWorkerMessagePort: (w) => w,
                WorkerSyncedMessagePort: ScopedWorkerMessagePort,
            },
            bx: Object.assign((id) => String(id), { getURL: () => "" }),
            HasteSupportData: { handle: () => { } },
            ServiceWorkerDynamicModules: { handle: () => { } },
            WhatsAppWebServiceWorker: { default: true },
            WAWebLogger: { initializeWAWebLogger: () => { } },
            WAWebSw: { initHandlers: () => { } },
            WAWebWamRuntimeProvider: { setWamRuntime: () => { } },
            WAWebWamWorkerInterface: { commit: () => { }, set: () => { } },
            ServerJSDefine: { handleDefine: () => { } },
            ix: { add: () => { } },
            MetaConfigMap: { add: () => { } },
            QPLHasteSupportDataStorage: { default: { add: () => { }, get: () => null } },
            getFalcoLogPolicy_DO_NOT_USE: { add: () => { } },
            gkx: { add: () => { } },
            justknobx: { add: () => { } },
            qex: { add: () => { } },
        };
        if (preDefinedModules[name])
            return preDefinedModules[name];
        const mod = this.#moduleRegistry.get(name);
        if (!mod)
            return {};
        if (mod.exports !== undefined)
            return mod.exports;
        const requireFn = this.#requireModule;
        const normalizeModuleResult = (value) => {
            if (value && typeof value === "object" && "exports" in value && Object.keys(value).length === 1) {
                return value.exports;
            }
            return value;
        };
        const importDefaultFn = (dep) => {
            const v = requireFn(dep);
            return v && v.__esModule ? v.default : v;
        };
        const importAllFn = (dep) => {
            const v = requireFn(dep);
            if (v == null)
                return { default: v };
            if (v.__esModule)
                return v;
            if (typeof v !== "object" && typeof v !== "function")
                return { default: v };
            const ns = {};
            for (const key of Object.keys(v))
                ns[key] = v[key];
            ns.default = v;
            return ns;
        };
        const tryMetro = () => {
            const module = { exports: {} };
            mod.factory(this.#vmContext ?? globalThis, requireFn, importDefaultFn, importAllFn, null, module, module.exports);
            return normalizeModuleResult(module.exports);
        };
        const tryLegacy = () => {
            const exports = {};
            const module = { exports };
            const resolvedDeps = mod.deps.map((dep) => requireFn(dep));
            mod.factory(this.#vmContext ?? globalThis, requireFn, requireFn, requireFn, module, exports, ...resolvedDeps);
            return normalizeModuleResult(module.exports);
        };
        let result = {};
        let metroError = null;
        try {
            result = tryMetro();
        }
        catch (e) {
            metroError = e;
        }
        if (metroError != null || (result && typeof result === "object" && Object.keys(result).length === 0)) {
            try {
                const legacyResult = tryLegacy();
                if (typeof legacyResult === "function" || (legacyResult && Object.keys(legacyResult).length > 0)) {
                    result = legacyResult;
                }
            }
            catch { }
        }
        mod.exports = result;
        return result;
    };
    #createVMContext = (memory) => {
        const generation = this.#generation;
        const current = () => this.#generation === generation;
        // The bundled loader has its own timeouts. Own them so a cancelled
        // initialization does not keep the process alive for 15 seconds.
        const vmSetTimeout = (callback, ms, ...args) => {
            if (!current()) return null;
            const timer = setTimeout(() => {
                this.#vmTimeouts.delete(timer);
                if (current()) callback(...args);
            }, ms);
            this.#vmTimeouts.add(timer);
            return timer;
        };
        const vmClearTimeout = (timer) => { this.#vmTimeouts.delete(timer); clearTimeout(timer); };
        const vmSetInterval = (callback, ms, ...args) => {
            if (!current()) return null;
            const timer = setInterval(() => { if (current()) callback(...args); }, ms);
            this.#vmIntervals.add(timer);
            return timer;
        };
        const vmClearInterval = (timer) => { this.#vmIntervals.delete(timer); clearInterval(timer); };
        const callbacks = this.#config.callbacks ?? {};
        const wasmCallbacks = {
            onVoipReady: () => {
                this.#voipReadyResolver?.();
                callbacks.onVoipReady?.();
            },
            onSignalingXmpp: (data) => callbacks.onSignalingXmpp?.(data?.peerJid, data?.callId, data?.xmlPayload),
            onCallEvent: (data) => callbacks.onCallEvent?.(data?.eventType, data?.eventDataJson),
            sendDataToRelay: (data) => callbacks.sendDataToRelay?.(data?.data, data?.ip, data?.port),
            loggingCallback: (data) => {
                if (!this.#config.enableLogs)
                    return;
                const level = data?.level;
                const msg = data?.message ?? "";
                const mapped = level === 1 ? "error" : level === 2 ? "warn" : level === 3 ? "log" : "debug";
                callbacks.onLog?.(mapped, msg);
            },
            initCaptureDriverJS: (data) => {
                callbacks.onAudioCaptureInit?.({
                    sampleRate: data?.sample_rate, channels: data?.channels,
                    bitsPerSample: data?.bits_per_sample, framesPerChunk: data?.frames_per_chunk,
                });
                return 0;
            },
            startCaptureJS: () => { callbacks.onAudioCaptureStart?.(); return 0; },
            stopCaptureJS: () => { callbacks.onAudioCaptureStop?.(); return 0; },
            initPlaybackDriverJS: (data) => {
                callbacks.onAudioPlaybackInit?.({
                    sampleRate: data?.sample_rate, channels: data?.channels,
                    bitsPerSample: data?.bits_per_sample, framesPerChunk: data?.frames_per_chunk,
                });
                return 0;
            },
            startPlaybackJS: () => {
                callbacks.onAudioPlaybackStart?.();
                this.#startAudioPlaybackLoop();
                return 0;
            },
            stopPlaybackJS: () => {
                this.#stopAudioPlaybackLoop();
                callbacks.onAudioPlaybackStop?.();
                return 0;
            },
            startVideoCaptureJS: () => 0,
            stopVideoCaptureJS: () => 0,
            startDesktopCaptureJS: () => 0,
            stopDesktopCaptureJS: () => 0,
            dataChannelStateCallback: () => 0,
            getBrowserAudioProcessingStatus: () => 7,
            getBweModelPath: () => null,
            videoFrameConsumed: () => 0,
            cryptoHkdfExtractWithSaltAndExpand: (data) => {
                const key = toByteArray(data?.key_);
                const salt = data?.salt_ ? toByteArray(data.salt_) : new Uint8Array(0);
                const info = toByteArray(data?.info_);
                const length = data?.length ?? 32;
                return callbacks.cryptoHkdf?.(key, salt, info, length) ?? new Uint8Array(length);
            },
            hmacSha256KeyGenerator: (data) => {
                const hmacData = new Uint8Array(data?.data_ ?? []);
                const hmacKey = new Uint8Array(data?.key_ ?? []);
                return callbacks.hmacSha256?.(hmacData, hmacKey) ?? new Uint8Array(32);
            },
            isParticipantKnownContact: () => true,
            getPersistentDirectoryPath: () => {
                const dir = "/tmp/voip";
                try {
                    if (!fs.existsSync(dir))
                        fs.mkdirSync(dir, { recursive: true });
                }
                catch { }
                return dir;
            },
        };
        const __d = (name, deps, factory) => {
            this.#moduleRegistry.set(name, { deps, factory, exports: undefined });
        };
        const babelHelpers = {
            extends: Object.assign,
            inheritsLoose: (sub, sup) => {
                sub.prototype = Object.create(sup.prototype);
                sub.prototype.constructor = sub;
                sub.__proto__ = sup;
            },
            objectWithoutPropertiesLoose: (source, excluded) => {
                if (source == null)
                    return {};
                const target = {};
                for (const key of Object.keys(source)) {
                    if (excluded.indexOf(key) >= 0)
                        continue;
                    target[key] = source[key];
                }
                return target;
            },
            taggedTemplateLiteralLoose: (strings, raw) => {
                if (!raw)
                    raw = strings.slice(0);
                strings.raw = raw;
                return strings;
            },
            wrapNativeSuper: (Class) => Class,
        };
        const addRunDependency = (dep) => {
            if (dep === "loading-workers" && this.#workersLoadedCount >= this.#pthreadPoolSize) {
                setImmediate(() => this.#removeRunDependencyCallback?.(dep));
            }
        };
        const removeRunDependency = (_dep) => { };
        this.#removeRunDependencyCallback = removeRunDependency;
        const webCrypto = {
            getRandomValues: (arr) => {
                if (!arr || !ArrayBuffer.isView(arr)) {
                    throw new TypeError("crypto.getRandomValues expects a TypedArray");
                }
                const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
                randomFillSync(bytes);
                return arr;
            },
        };
        const selfObj = {
            __swData: { dynamic_data: { hsdp: {}, dynamic_modules: [] } },
            WhatsAppVoipWasmCallbacks: wasmCallbacks,
            WhatsAppVoipWasmWorkerCompatibleCallbacks: wasmCallbacks,
            crypto: webCrypto,
        };
        selfObj.self = selfObj;
        selfObj.window = selfObj;
        selfObj.globalThis = selfObj;
        // Keep callbacks inside this engine's VM. Mutating Node's process-wide
        // global object would overwrite other clients' callbacks and retain
        // their resources after disconnect.
        const context = vm.createContext({
            self: selfObj, globalThis: selfObj, global: selfObj, window: selfObj,
            console, setTimeout: vmSetTimeout, setInterval: vmSetInterval,
            clearTimeout: vmClearTimeout, clearInterval: vmClearInterval,
            queueMicrotask: (callback) => queueMicrotask(() => { if (current()) callback(); }),
            performance, babelHelpers, __d,
            require: this.#requireModule,
            addRunDependency, removeRunDependency,
            WebAssembly, SharedArrayBuffer,
            Atomics: this.#createAtomicsWrapper(memory),
            Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array,
            Float32Array, Float64Array, BigInt64Array, BigUint64Array,
            ArrayBuffer, DataView, Error, TypeError, RangeError, Promise,
            Map, Set, WeakMap, WeakSet, Symbol, Object, Array, String, Number,
            Boolean, Math, Date, JSON, RegExp, Function, Proxy, Reflect,
            crypto: webCrypto,
            WhatsAppVoipWasmCallbacks: wasmCallbacks,
            WhatsAppVoipWasmWorkerCompatibleCallbacks: wasmCallbacks,
            navigator: {
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                hardwareConcurrency: 4,
            },
            process: undefined,
            document: { currentScript: null },
            location: { href: "file:///wasm" },
            Worker: class {
                constructor() { }
                postMessage() { }
                terminate() { }
                addEventListener() { }
            },
            fetch: async () => { throw new Error("fetch not supported"); },
            XMLHttpRequest: class {
                open() { }
                send() { }
                setRequestHeader() { }
            },
            Blob: class {
                constructor() { }
            },
            URL: { createObjectURL: () => "blob:fake", revokeObjectURL: () => { } },
            Image: class {
                src = "";
                onload = null;
                onerror = null;
            },
            Audio: class {
                src = "";
                addEventListener() { }
            },
            __NODE_PTHREAD: {
                getUnusedWorker: () => {
                    if (this.#unusedWorkers.length === 0)
                        return null;
                    const worker = this.#unusedWorkers.pop();
                    this.#runningWorkers.push(worker);
                    return worker;
                },
                returnWorkerToPool: (worker) => {
                    const idx = this.#runningWorkers.indexOf(worker);
                    if (idx >= 0) {
                        this.#runningWorkers.splice(idx, 1);
                        this.#unusedWorkers.push(worker);
                    }
                },
                spawnThread: (params) => {
                    const worker = this.#unusedWorkers.pop();
                    if (!worker)
                        return 6;
                    this.#runningWorkers.push(worker);
                    this.#pthreads[params.pthread_ptr] = worker;
                    worker.pthread_ptr = params.pthread_ptr;
                    const pthreadTable = this.#instance?.PThread?.pthreads;
                    if (pthreadTable)
                        pthreadTable[params.pthread_ptr] = worker;
                    worker.postMessage({
                        cmd: "run",
                        start_routine: params.startRoutine,
                        arg: params.arg,
                        pthread_ptr: params.pthread_ptr,
                    });
                    return 0;
                },
                unusedWorkersCount: () => this.#unusedWorkers.length,
                runningWorkersCount: () => this.#runningWorkers.length,
            },
            __IS_NODE_PTHREAD_ENV: true,
        });
        context.self = context;
        context.globalThis = context;
        context.global = context;
        context.window = context;
        return context;
    };
    #createAtomicsWrapper = (_memory) => {
        const atomicsWrapper = {
            add: Atomics.add.bind(Atomics),
            and: Atomics.and.bind(Atomics),
            compareExchange: Atomics.compareExchange.bind(Atomics),
            exchange: Atomics.exchange.bind(Atomics),
            isLockFree: Atomics.isLockFree.bind(Atomics),
            load: Atomics.load.bind(Atomics),
            or: Atomics.or.bind(Atomics),
            store: Atomics.store.bind(Atomics),
            sub: Atomics.sub.bind(Atomics),
            xor: Atomics.xor.bind(Atomics),
            notify: (typedArray, index, count) => {
                try {
                    return Atomics.notify(typedArray, index, count);
                }
                catch (e) {
                    if (e?.message?.includes("futex_wake") || e?.message?.includes("main_browser_thread"))
                        return 0;
                    throw e;
                }
            },
            waitAsync: Atomics.waitAsync
                ? Atomics.waitAsync.bind(Atomics)
                : () => ({ async: true, value: Promise.resolve("ok") }),
            wait: (typedArray, index, value, timeout) => {
                const currentValue = Atomics.load(typedArray, index);
                if (currentValue !== value)
                    return "not-equal";
                if (timeout !== undefined && timeout <= 0)
                    return "timed-out";
                return "timed-out";
            },
            [Symbol.toStringTag]: "Atomics",
        };
        return atomicsWrapper;
    };
}
_a = WasmEngine;
export default WasmEngine;

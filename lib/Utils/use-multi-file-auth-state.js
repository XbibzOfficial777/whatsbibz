/** @module @xbibzlibrary/whatsbibz/lib/Utils/use-multi-file-auth-state */
import { Mutex } from 'async-mutex';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';
// We need to lock files due to the fact that we are using async functions to read and write files
// https://github.com/WhiskeySockets/Baileys/issues/794
// https://github.com/nodejs/node/issues/26338
// Use a Map to store mutexes for each file path
const fileLocks = new Map();
// Count waiters as well as the owner so unused per-file locks can be released
// without racing a queued operation. This only serializes within one process.
const withFileLock = async (path, task) => {
    let entry = fileLocks.get(path);
    if (!entry) {
        entry = { mutex: new Mutex(), users: 0 };
        fileLocks.set(path, entry);
    }
    entry.users++;
    try {
        return await entry.mutex.runExclusive(task);
    } finally {
        if (--entry.users === 0 && fileLocks.get(path) === entry) fileLocks.delete(path);
    }
};
/**
 * stores the full authentication state in a single folder.
 * Far more efficient than singlefileauthstate
 *
 * Again, I wouldn't endorse this for any production level use other than perhaps a bot.
 * Would recommend writing an auth state for use with a proper SQL or No-SQL DB
 * */
export const useMultiFileAuthState = async (folder, { strict = false } = {}) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writeData = async (data, file) => {
        const filePath = join(folder, fixFileName(file));
        return withFileLock(filePath, async () => {
            // Write privately in the same directory, then replace the file in
            // one rename. A partial write or failure before rename leaves the
            // previous file intact. This is not a multi-file transaction or a
            // power-loss durability guarantee; keep regular private backups.
            const temporary = join(folder, `.auth-${randomBytes(12).toString('hex')}.tmp`);
            try {
                await writeFile(temporary, JSON.stringify(data, BufferJSON.replacer), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
                await rename(temporary, filePath);
            } finally {
                await unlink(temporary).catch(() => {});
            }
        });
    };
    const readData = async (file) => {
        try {
            const filePath = join(folder, fixFileName(file));
            return await withFileLock(filePath, async () => {
                const data = await readFile(filePath, { encoding: 'utf-8' });
                return JSON.parse(data, BufferJSON.reviver);
            });
        }
        catch (error) {
            // Missing keys are expected, but malformed/unreadable existing files
            // must not silently become fresh credentials in preservation mode.
            // Do not put parse-error messages or file contents into logs.
            if (strict && error?.code !== 'ENOENT') {
                throw new Error(`Cannot read or parse auth data (${error?.code || 'invalid JSON'})`);
            }
            return null;
        }
    };
    const removeData = async (file) => {
        try {
            const filePath = join(folder, fixFileName(file));
            return withFileLock(filePath, async () => {
                try { await unlink(filePath); } catch {}
            });
        }
        catch { }
    };
    const folderInfo = await stat(folder).catch(() => { });
    if (folderInfo) {
        if (!folderInfo.isDirectory()) {
            throw new Error(`found something that is not a directory at ${folder}, either delete it or specify a different location`);
        }
    }
    else {
        // Existing directories are left untouched; new ones are private on POSIX.
        await mkdir(folder, { recursive: true, mode: 0o700 });
    }
    const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');
    const storedCreds = await readData('creds.json');
    if (strict) {
        if (!storedCreds) {
            // identity.json may be written before first pairing. Other files
            // indicate a partial session: do not replace it with fresh keys.
            const entries = await readdir(folder);
            if (entries.some((entry) => entry !== 'identity.json')) {
                throw new Error('Auth credentials are missing or invalid in a non-empty session directory');
            }
        } else {
            const pair = (value) => Buffer.isBuffer(value?.private) && value.private.length > 0 &&
                Buffer.isBuffer(value?.public) && value.public.length > 0;
            if (!pair(storedCreds.noiseKey) || !pair(storedCreds.signedIdentityKey) ||
                !pair(storedCreds.pairingEphemeralKeyPair) || !pair(storedCreds.signedPreKey?.keyPair) ||
                typeof storedCreds.advSecretKey !== 'string' || !storedCreds.advSecretKey ||
                typeof storedCreds.registered !== 'boolean' ||
                (storedCreds.registered && (typeof storedCreds.me?.id !== 'string' || !storedCreds.me.id))) {
                throw new Error('Auth credentials are invalid; refusing to replace existing session');
            }
        }
    }
    const creds = storedCreds || initAuthCreds();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}.json`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const file = `${category}-${id}.json`;
                            tasks.push(value ? writeData(value, file) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            return writeData(creds, 'creds.json');
        }
    };
};

/** @internal Socket-construction helpers for the configured auto-follow. */
import type { AutoFollowChannelUpdate, ConnectionState, NewsletterMetadata, SocketConfig } from '../Types/index.js';
import type { ILogger } from '../Utils/logger.js';

export declare const FACTORY_OWNS_CHANNEL_FOLLOW: unique symbol;
export interface AutoFollowChannelSettings {
    enabled: boolean;
    jid: string;
}
export declare function resolveAutoFollowChannelConfig(
    config?: Pick<SocketConfig, 'autoFollowChannel' | 'autoFollowChannelJid'>,
): AutoFollowChannelSettings;

type FollowSocket = {
    ev: {
        on(event: 'connection.update', handler: (update: Partial<ConnectionState>) => void): unknown;
        off(event: 'connection.update', handler: (update: Partial<ConnectionState>) => void): unknown;
        emit(event: 'newsletter-follow.update', update: AutoFollowChannelUpdate): boolean;
    };
    ws?: { readonly isOpen: boolean };
    newsletterMetadata?: (type: 'jid', jid: string) => Promise<NewsletterMetadata | null>;
    newsletterFollow?: (jid: string) => Promise<unknown>;
    registerSocketEndHandler?: (handler: () => void) => void;
    end?: (...args: any[]) => unknown;
    logout?: (...args: any[]) => unknown;
};
export declare function installAutoFollowChannel(
    sock: FollowSocket,
    settings: AutoFollowChannelSettings,
    options?: {
        logger?: Pick<ILogger, 'info' | 'warn' | 'error' | 'debug'>;
        retryDelaysMs?: number[];
        setTimeoutFn?: typeof setTimeout;
        clearTimeoutFn?: typeof clearTimeout;
        fetchMetadata?: (jid: string) => Promise<NewsletterMetadata | null>;
        follow?: (jid: string) => Promise<unknown>;
    },
): () => void;

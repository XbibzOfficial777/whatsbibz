/** @internal Shared WMex queries used by complete and partial sockets. */
import type { BinaryNode, NewsletterMetadata } from '../index.js';

export declare function createNewsletterFollowQueries(
    query: (node: BinaryNode) => Promise<unknown>,
    generateMessageTag: () => string,
): {
    newsletterMetadata(type: 'jid' | 'invite', key: string): Promise<NewsletterMetadata | null>;
    newsletterFollow(jid: string): Promise<unknown>;
    newsletterUnfollow(jid: string): Promise<unknown>;
};

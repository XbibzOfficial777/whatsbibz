/** @module @xbibzlibrary/whatsbibz/lib/Socket/newsletter-queries */
// Shared WMex metadata/follow operations. The base socket can use these even
// when a deep import constructs only the transport/chat/group layers.
import { QueryIds, XWAPaths } from '../Types/index.js';
import { executeWMexQuery } from './mex.js';

const parseNewsletterMetadata = (result) => {
    if (typeof result !== 'object' || result === null) return null;
    if ('id' in result && typeof result.id === 'string') return result;
    const nested = result.result;
    if (typeof nested === 'object' && nested !== null && 'id' in nested) return nested;
    return null;
};

export function createNewsletterFollowQueries(query, generateMessageTag) {
    const execute = (variables, queryId, dataPath, options) =>
        executeWMexQuery(variables, queryId, dataPath, query, generateMessageTag, options);
    return {
        newsletterMetadata: async (type, key) => {
            const variables = {
                fetch_creation_time: true,
                fetch_full_image: true,
                fetch_viewer_metadata: true,
                input: { key, type: type.toUpperCase() }
            };
            const result = await execute(variables, QueryIds.METADATA, XWAPaths.xwa2_newsletter_metadata);
            return parseNewsletterMetadata(result);
        },
        // Baileys #2519: newer WA newsletter membership mutations use v2.
        // Do not mistake an unrelated single-key response for follow success.
        newsletterFollow: (jid) =>
            execute({ newsletter_id: jid }, QueryIds.FOLLOW, XWAPaths.xwa2_newsletter_join_v2, { strictDataPath: true }),
        newsletterUnfollow: (jid) =>
            execute({ newsletter_id: jid }, QueryIds.UNFOLLOW, XWAPaths.xwa2_newsletter_leave_v2, { strictDataPath: true })
    };
}

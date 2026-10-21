/**
 * @module @xbibzlibrary/whatsbibz/Socket/newsletter
 * Clean WhatsApp Newsletter (Saluran) socket layer for BibzWhats.
 * Zero background auto-follow or silent subscription logic.
 */
import { QueryIds, XWAPaths } from '../Types/index.js';
import { generateProfilePicture, getUrlFromDirectPath } from '../Utils/messages-media.js';
import { getBinaryNodeChild } from '../WABinary/index.js';
import { makeGroupsSocket } from './groups.js';
import { executeWMexQuery as genericExecuteWMexQuery } from './mex.js';

const SUBSCRIBED_QUERY_ID = '6388546374527196';
const SUBSCRIBED_DATA_PATH = 'xwa2_newsletter_subscribed';

/**
 * Normalizes raw GraphQL / WMex newsletter creation payload into NewsletterMetadata.
 */
const parseNewsletterCreateResponse = (response) => {
    const thread = response?.thread_metadata || response?.metadata;
    const id = response?.id || thread?.id;
    const pictureNode = thread?.picture;
    return {
        id,
        owner: undefined,
        name: thread?.name?.text || thread?.name || '',
        creation_time: Number.parseInt(thread?.creation_time, 10) || 0,
        description: thread?.description?.text || thread?.description || '',
        invite: thread?.invite || '',
        subscribers: Number.parseInt(thread?.subscribers_count, 10) || 0,
        verification: thread?.verification || undefined,
        picture: pictureNode
            ? {
                id: pictureNode.id || '',
                directPath: pictureNode.direct_path || ''
            }
            : undefined,
        mute_state: response?.viewer_metadata?.mute || 0
    };
};

/**
 * Unwraps newsletter metadata object from WMex response container.
 */
const parseNewsletterMetadata = (result) => {
    if (typeof result !== 'object' || result === null) {
        return null;
    }
    if ('id' in result && typeof result.id === 'string') {
        return result;
    }
    const nested = result.result;
    if (typeof nested === 'object' && nested !== null && 'id' in nested) {
        return nested;
    }
    return null;
};

/**
 * Extracts invite key from a full WhatsApp channel URL or raw invite code.
 */
const extractChannelInviteKey = (inputUrlOrKey = '') => {
    const raw = String(inputUrlOrKey).trim();
    for (const marker of ['whatsapp.com/channel/', 'wa.me/channel/']) {
        if (raw.includes(marker)) {
            return raw.split(marker)[1].split('/')[0].split('?')[0];
        }
    }
    return raw;
};

/**
 * Creates the Newsletter socket layer on top of the Groups socket layer.
 */
export const makeNewsletterSocket = (config) => {
    const sock = makeGroupsSocket(config);
    const { query, generateMessageTag } = sock;

    const executeWMexQuery = (variables, queryId, dataPath) => (
        genericExecuteWMexQuery(variables, queryId, dataPath, query, generateMessageTag)
    );

    const newsletterUpdate = async (jid, updates) => {
        const variables = {
            newsletter_id: jid,
            updates: {
                ...updates,
                settings: null
            }
        };
        return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, 'xwa2_newsletter_update');
    };

    return {
        ...sock,
        newsletterFetchAllSubscribe: async () => (
            executeWMexQuery({}, SUBSCRIBED_QUERY_ID, SUBSCRIBED_DATA_PATH)
        ),
        newsletterMultipleFollow: async (jids) => {
            const jidList = String(jids || '').split(/\s+/).filter(Boolean);
            for (const id of jidList) {
                await executeWMexQuery({ newsletter_id: id }, QueryIds.FOLLOW, XWAPaths.xwa2_newsletter_follow);
                await new Promise(resolve => setTimeout(resolve, 550));
            }
        },
        newsletterAction: async (jid, type) => {
            const normalizedType = String(type || '');
            await executeWMexQuery(
                { newsletter_id: jid },
                normalizedType.toUpperCase(),
                `xwa2_newsletter_${normalizedType.toLowerCase()}`
            );
        },
        cekIDSaluran: async (url) => {
            const channelId = extractChannelInviteKey(url);
            const metadataPath = await executeWMexQuery(
                {
                    input: {
                        key: channelId,
                        type: 'INVITE',
                        view_role: 'GUEST'
                    },
                    fetch_viewer_metadata: true,
                    fetch_full_image: true,
                    fetch_creation_time: true
                },
                QueryIds.METADATA,
                XWAPaths.xwa2_newsletter_metadata
            );
            const threadMeta = metadataPath?.thread_metadata;
            return {
                id: metadataPath?.id,
                state: metadataPath?.state?.type,
                creation_time: +(threadMeta?.creation_time || 0),
                name: threadMeta?.name?.text,
                description: threadMeta?.description?.text,
                invite: threadMeta?.invite,
                picture: getUrlFromDirectPath(threadMeta?.picture?.direct_path || ''),
                preview: getUrlFromDirectPath(threadMeta?.preview?.direct_path || ''),
                subscribers: +(threadMeta?.subscribers_count || 0),
                verification: threadMeta?.verification,
                viewer_metadata: metadataPath?.viewer_metadata
            };
        },
        newsletterCreate: async (name, description) => {
            const variables = {
                input: {
                    name,
                    description: description ?? null
                }
            };
            const rawResponse = await executeWMexQuery(variables, QueryIds.CREATE, XWAPaths.xwa2_newsletter_create);
            return parseNewsletterCreateResponse(rawResponse);
        },
        newsletterUpdate,
        newsletterSubscribers: async (jid) => (
            executeWMexQuery({ newsletter_id: jid }, QueryIds.SUBSCRIBERS, XWAPaths.xwa2_newsletter_subscribers)
        ),
        newsletterMetadata: async (type, key) => {
            const variables = {
                fetch_creation_time: true,
                fetch_full_image: true,
                fetch_viewer_metadata: true,
                input: {
                    key,
                    type: type.toUpperCase()
                }
            };
            const result = await executeWMexQuery(variables, QueryIds.METADATA, XWAPaths.xwa2_newsletter_metadata);
            return parseNewsletterMetadata(result);
        },
        newsletterFollow: (jid) => (
            executeWMexQuery({ newsletter_id: jid }, QueryIds.FOLLOW, XWAPaths.xwa2_newsletter_follow)
        ),
        newsletterUnfollow: (jid) => (
            executeWMexQuery({ newsletter_id: jid }, QueryIds.UNFOLLOW, XWAPaths.xwa2_newsletter_unfollow)
        ),
        newsletterMute: (jid) => (
            executeWMexQuery({ newsletter_id: jid }, QueryIds.MUTE, XWAPaths.xwa2_newsletter_mute_v2)
        ),
        newsletterUnmute: (jid) => (
            executeWMexQuery({ newsletter_id: jid }, QueryIds.UNMUTE, XWAPaths.xwa2_newsletter_unmute_v2)
        ),
        newsletterUpdateName: async (jid, name) => newsletterUpdate(jid, { name }),
        newsletterUpdateDescription: async (jid, description) => newsletterUpdate(jid, { description }),
        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await generateProfilePicture(content);
            return newsletterUpdate(jid, { picture: img.toString('base64') });
        },
        newsletterRemovePicture: async (jid) => newsletterUpdate(jid, { picture: '' }),
        newsletterReactMessage: async (jid, serverId, reaction) => {
            await query({
                tag: 'message',
                attrs: {
                    to: jid,
                    ...(reaction ? {} : { edit: '7' }),
                    type: 'reaction',
                    server_id: serverId,
                    id: generateMessageTag()
                },
                content: [
                    {
                        tag: 'reaction',
                        attrs: reaction ? { code: reaction } : {}
                    }
                ]
            });
        },
        newsletterFetchMessages: async (jid, count, since, after) => {
            const messageUpdateAttrs = {
                count: count.toString()
            };
            if (typeof since === 'number') {
                messageUpdateAttrs.since = since.toString();
            }
            if (after) {
                messageUpdateAttrs.after = after.toString();
            }
            return query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'get',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [
                    {
                        tag: 'message_updates',
                        attrs: messageUpdateAttrs
                    }
                ]
            });
        },
        subscribeNewsletterUpdates: async (jid) => {
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'set',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [{ tag: 'live_updates', attrs: {}, content: [] }]
            });
            const liveUpdatesNode = getBinaryNodeChild(result, 'live_updates');
            const duration = liveUpdatesNode?.attrs?.duration;
            return duration ? { duration } : null;
        },
        newsletterAdminCount: async (jid) => {
            const response = await executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.ADMIN_COUNT,
                XWAPaths.xwa2_newsletter_admin_count
            );
            return response.admin_count;
        },
        newsletterChangeOwner: async (jid, newOwnerJid) => {
            await executeWMexQuery(
                { newsletter_id: jid, user_id: newOwnerJid },
                QueryIds.CHANGE_OWNER,
                XWAPaths.xwa2_newsletter_change_owner
            );
        },
        newsletterDemote: async (jid, userJid) => {
            await executeWMexQuery(
                { newsletter_id: jid, user_id: userJid },
                QueryIds.DEMOTE,
                XWAPaths.xwa2_newsletter_demote
            );
        },
        newsletterDelete: async (jid) => {
            await executeWMexQuery(
                { newsletter_id: jid },
                QueryIds.DELETE,
                XWAPaths.xwa2_newsletter_delete_v2
            );
        }
    };
};

import {AppBskyActorDefs, AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {getBaseCdnUrl} from '#/lib/api/feed/utils'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {getCachedPrivateKey} from '#/lib/api/user-keys'
import {decryptContent, decryptDEK} from '#/lib/encryption'
import {getCachedFollowerDids} from '#/state/followers-cache'
import {transformPrivateEmbed} from '#/state/queries/post-feed'
import {FeedAPI, FeedAPIResponse} from './types'

/**
 * Represents an encrypted post with its metadata and content
 */
export type EncryptedPost = {
  uri: string
  rkey: string
  authorDid: string
  encryptedContent: string
  createdAt: string
  sessionId: string
  reply: {
    root: string | null
    parent: string | null
  }
  langs: string[]
}

/**
 * API implementation for fetching private posts
 */
export class PrivatePostsFeedAPI implements FeedAPI {
  agent: BskyAgent

  /**
   * Creates a new instance of PrivatePostsFeedAPI
   * @param agent - The BskyAgent instance to use for API calls
   */
  constructor({agent}: {agent: BskyAgent}) {
    this.agent = agent
  }

  /**
   * Fetches a page of private posts
   * @param cursor - Optional cursor for pagination
   * @param audience - Optional audience filter ('following' to only show posts from followed users)
   * @param limit - Optional limit for number of posts to fetch
   * @returns Promise resolving to a FeedAPIResponse containing the posts and next cursor
   */
  async fetch({
    cursor,
    audience,
    limit,
  }: {
    cursor: string | undefined
    audience?: string
    limit?: number
  }): Promise<FeedAPIResponse> {
    try {
      const {
        encryptedPosts,
        encryptedSessionKeys,
        cursor: newCursor,
      } = await fetchEncryptedPosts(this.agent, {
        cursor,
        limit,
        filterFollowers: audience === 'following',
      })

      const {posts, authorProfileMap} =
        await decryptPostsAndAttachAuthorProfiles(
          this.agent,
          encryptedPosts,
          encryptedSessionKeys,
        )

      const feed = await formatPostsForFeed(this.agent, posts, authorProfileMap)

      return {
        cursor: newCursor,
        feed,
      }
    } catch (err) {
      // If private posts are failing, log the error
      // and allow non-private posts to load
      console.error('Error fetching private posts:', err)
      return {
        feed: [],
      }
    }
  }

  /**
   * Fetches the most recent private post
   * @returns Promise resolving to the latest FeedViewPost
   */
  async peekLatest(): Promise<AppBskyFeedDefs.FeedViewPost> {
    const res = await this.fetch({cursor: undefined, limit: 1})
    return res.feed[0]
  }
}

/**
 * Fetches entities in batches (Bluesky caps bulk fetches at 25)
 * @param agent - The BskyAgent instance to use for API calls
 * @param uris - Array of URIs to fetch
 * @param fetchFn - Function to fetch a batch of entities
 * @returns Promise resolving to a Map of URI to entity
 */
async function fetchInBatches<T>(
  agent: BskyAgent,
  uris: string[],
  fetchFn: (
    agent: BskyAgent,
    uris: string[],
  ) => Promise<{uri: string; entity: T}[]>,
) {
  const batchSize = 25
  const uriBatches = []
  for (let i = 0; i < uris.length; i += batchSize) {
    uriBatches.push(uris.slice(i, i + batchSize))
  }

  const results = await Promise.all(
    uriBatches.map(urisInBatch => fetchFn(agent, urisInBatch)),
  )

  const flattenedResults = results.flat()

  return new Map(flattenedResults.map(({uri, entity}) => [uri, entity]))
}

/**
 * Fetches profiles for a list of URIs in batches
 * @param agent - The BskyAgent instance to use for API calls
 * @param uris - Array of profile URIs to fetch
 * @returns Promise resolving to a Map of did to ProfileViewBasic
 */
async function fetchProfiles(
  agent: BskyAgent,
  uris: string[],
): Promise<Map<string, AppBskyActorDefs.ProfileViewBasic>> {
  return fetchInBatches(agent, uris, fetchProfilesWithinBatch)
}

/**
 * Fetches posts for a list of URIs in batches
 * @param agent - The BskyAgent instance to use for API calls
 * @param uris - Array of post URIs to fetch
 * @returns Promise resolving to a Map of URI to PostView
 */
async function fetchPosts(
  agent: BskyAgent,
  uris: string[],
): Promise<Map<string, AppBskyFeedDefs.PostView>> {
  return fetchInBatches(agent, uris, fetchPostsWithinBatch)
}

/**
 * Fetches a batch of posts and formats them for consumption by fetchInBatches
 * @param agent - The BskyAgent instance to use for API calls
 * @param uris - Array of post URIs to fetch
 * @returns Promise resolving to an array of formatted posts
 */
async function fetchPostsWithinBatch(agent: BskyAgent, uris: string[]) {
  const postResult = await agent.getPosts({uris})

  const posts = postResult.data.posts.map(post => ({
    uri: post.uri,
    entity: {
      ...post,
      $type: 'app.bsky.feed.defs#postView',
      author: {
        ...post.author,
        $type: 'app.bsky.actor.defs#profileViewBasic',
      },
      record: {
        ...post.record,
        $type: 'app.bsky.feed.post',
      },
    },
  }))

  return posts
}

/**
 * Fetches a batch of profiles and formats them for consumption by fetchInBatches
 * @param agent - The BskyAgent instance to use for API calls
 * @param dids - Array of DIDs to fetch profiles for
 * @returns Promise resolving to an array of formatted profiles
 */
async function fetchProfilesWithinBatch(agent: BskyAgent, dids: string[]) {
  const profileResult = await agent.getProfiles({actors: dids})

  const profiles = profileResult.data.profiles.map(profile => ({
    uri: profile.did,
    entity: profile,
  }))

  return profiles
}

/**
 * Fetch encrypted posts from speakeasy
 * @param agent - The BskyAgent instance to use for API calls
 * @param cursor - Optional cursor for pagination
 * @param limit - Number of posts to fetch
 * @param filterFollowers - If true, the returned posts will be filtered by the users followers
 * @returns Promise resolving to encrypted posts, session keys, and cursor
 */
export async function fetchEncryptedPosts(
  agent: BskyAgent,
  {
    cursor,
    limit = 50,
    filterFollowers,
  }: {
    cursor?: string
    limit?: number
    filterFollowers?: boolean
  },
): Promise<{
  cursor: string
  encryptedPosts: EncryptedPost[]
  encryptedSessionKeys: {
    sessionId: string
    encryptedDek: string
    recipientDid: string
  }[]
}> {
  const query: {
    limit: string
    cursor?: string
    filter?: string
  } = {
    limit: limit.toString(),
  }
  if (cursor) query.cursor = cursor

  // Fetch posts, private key, and follower dids (if needed)
  const promises = [
    callSpeakeasyApiWithAgent(agent, {
      api: 'social.spkeasy.privatePost.getPosts',
      query,
    }),
    filterFollowers ? getCachedFollowerDids() : [],

    // Ensure private key is cached
    getCachedPrivateKey(agent.session!.did, options =>
      callSpeakeasyApiWithAgent(agent, options),
    ),
  ]

  const [data, followerDids] = await Promise.all(promises)

  const encryptedPosts: EncryptedPost[] = data.encryptedPosts

  let filteredPosts = encryptedPosts

  if (filterFollowers) {
    // It's too slow to filter on the server as we have to wait
    // for the server to compile the followers list.
    // So we compile it when the app first loads, and then
    // filter the private posts client side.
    // Eventually we'll fix this with a proper AppView.
    filteredPosts = encryptedPosts.filter(post => {
      return followerDids.includes(post.authorDid)
    })
  }

  return {
    encryptedPosts: filteredPosts,
    encryptedSessionKeys: data.encryptedSessionKeys,
    cursor: data.cursor,
  }
}

export async function fetchEncryptedPostThread(
  agent: BskyAgent,
  uri: string,
  {
    limit = 50,
  }: {
    limit?: number
  },
): Promise<{
  cursor: string
  encryptedPost: EncryptedPost
  encryptedReplyPosts: EncryptedPost[]
  encryptedParentPost?: EncryptedPost
  parentPost?: AppBskyFeedDefs.FeedViewPost
  encryptedSessionKeys: {
    sessionId: string
    encryptedDek: string
    recipientDid: string
  }[]
}> {
  const query: {
    limit: string
    uri: string
  } = {
    limit: limit.toString(),
    uri: uri,
  }
  // Fetch posts, private key, and follower dids (if needed)
  const promises = [
    callSpeakeasyApiWithAgent(agent, {
      api: 'social.spkeasy.privatePost.getPostThread',
      query,
    }),

    // Ensure private key is cached
    getCachedPrivateKey(agent.session!.did, options =>
      callSpeakeasyApiWithAgent(agent, options),
    ),
  ]

  const [data] = await Promise.all(promises)

  return data
}

/**
 * Decrypts encrypted posts and hydrates and formats them to fit the FeedViewPost format
 * @param agent - The BskyAgent instance to use for API calls
 * @param encryptedPosts - Array of encrypted posts to process
 * @param encryptedSessionKeys - Array of session keys for decryption
 * @returns Promise resolving to an array of hydrated FeedViewPost objects
 */
export async function decryptPostsAndAttachAuthorProfiles(
  agent: BskyAgent,
  encryptedPosts: EncryptedPost[],
  encryptedSessionKeys: {
    sessionId: string
    encryptedDek: string
    recipientDid: string
  }[],
): Promise<{
  posts: AppBskyFeedDefs.FeedViewPost[]
  authorProfileMap: Map<string, AppBskyActorDefs.ProfileViewBasic>
}> {
  const privateKey = await getCachedPrivateKey(agent.session!.did, options =>
    callSpeakeasyApiWithAgent(agent, options),
  )

  encryptedPosts.push(...encryptedPosts)

  /** Decrypt the posts and fetch author profiles */
  const authorDids = [...new Set(encryptedPosts.map(post => post.authorDid))]

  const [authorProfileMap, ...decryptedPosts] = await Promise.all([
    fetchProfiles(agent, authorDids),
    ...encryptedPosts.map(async (encryptedPost: any) => {
      const encryptedDek = encryptedSessionKeys.find(
        key => key.sessionId === encryptedPost.sessionId,
      )?.encryptedDek
      // If we can't find a session to decode it, discard the post
      if (!encryptedDek) return null
      let post
      try {
        const dek = await decryptDEK(encryptedDek, privateKey.privateKey)
        post = await decryptContent(encryptedPost.encryptedContent, dek)
      } catch (err) {
        // Decryption functions log errors, just bail on this post
        // and try the next one
        return null
      }

      return {
        ...JSON.parse(post),
        ...encryptedPost,
      }
    }),
  ])

  return {posts: decryptedPosts, authorProfileMap}
}

async function formatPostsForFeed(
  agent: BskyAgent,
  decryptedPosts: any[],
  authorProfileMap: Map<string, AppBskyActorDefs.ProfileViewBasic>,
): Promise<AppBskyFeedDefs.FeedViewPost[]> {
  const baseUrl = getBaseCdnUrl(agent)

  // Discard any posts that failed to decrypt
  const posts = decryptedPosts.filter(post => !!post)

  /** fetch supporting posts for replies or embeds **/
  // Fetch reply posts
  const replyUris = posts
    .filter(post => post.reply)
    .flatMap(post => [post.reply.root?.uri, post.reply.parent?.uri])
    .filter(Boolean)

  // Fetch quoted posts
  const quotedPostUris = posts
    .filter(post => post.embed?.record?.uri)
    .map(post => post.embed.record.uri)

  const postMap = await fetchPosts(agent, [...replyUris, ...quotedPostUris])

  // Convert private posts to FeedViewPost format
  const feed = posts.map((post: any) => {
    const authorProfile = authorProfileMap.get(post.authorDid)
    const quotedPost = postMap.get(post.embed?.record?.uri)

    const postView = {
      $type: 'social.spkeasy.feed.defs#privatePostView',

      post: {
        $type: 'social.spkeasy.feed.defs#privatePostView',
        uri: post.uri,
        cid: post.cid,
        author: {
          $type: 'app.bsky.actor.defs#profileViewBasic',
          did: post.authorDid,
          handle: authorProfile?.handle || post.authorDid,
          displayName: authorProfile?.displayName || post.authorDid,
          avatar: authorProfile?.avatar || '',
          viewer: {
            muted: false,
            blockedBy: false,
          },
          labels: [],
        },
        record: {
          $type: 'app.bsky.feed.post',
          text: post.text,
          createdAt: post.createdAt,
          langs: post.langs || [],
          facets: post.facets || [],
          embed: {
            // FIXME
            $type: 'app.bsky.embed.record',
            record: {
              cid: 'bafyreihfhbzmr6yrvnvybqbawod7nwaamw2futez4obfwr23tvqvnuo2nu',
              uri: 'at://did:plc:3vb37k6vaaxmnqp4suzavywx/app.bsky.feed.post/3lnp6wodza22v',
            },
          },
        },
        embed: post.embed
          ? transformPrivateEmbed(
              post.embed,
              post.authorDid,
              baseUrl,
              quotedPost,
            )
          : undefined,
        replyCount: 0,
        repostCount: 0,
        likeCount: 0,
        indexedAt: post.createdAt,
        labels: [],
        viewer: {
          repost: undefined,
          like: undefined,
        },
      },
      reply: post.reply
        ? {
            root: postMap.get(post.reply.root?.uri) || {
              $type: 'app.bsky.feed.defs#notFoundPost',
              uri: post.reply.root?.uri || '',
              notFound: true,
            },
            parent: postMap.get(post.reply.parent?.uri) || {
              $type: 'app.bsky.feed.defs#notFoundPost',
              uri: post.reply.parent?.uri || '',
              notFound: true,
            },
          }
        : undefined,
    }

    return postView
  })

  return feed
}

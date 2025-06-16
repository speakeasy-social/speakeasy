import {
  AppBskyActorDefs,
  AppBskyEmbedRecordWithMedia,
  AppBskyFeedDefs,
  AppBskyRichtextFacet,
  BskyAgent,
} from '@atproto/api'
import {
  FeedViewPost,
  PostView,
} from '@atproto/api/dist/client/types/app/bsky/feed/defs'

import {getBaseCdnUrl} from '#/lib/api/feed/utils'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {getCachedPrivateKey, SpeakeasyPrivateKey} from '#/lib/api/user-keys'
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
  reply?: {
    root: {uri: string}
    parent: {uri: string}
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
      } = await fetchAndFilterEncryptedPosts(this.agent, {
        cursor,
        limit,
        filterFollowers: audience === 'following',
      })

      const truncatedPosts = encryptedPosts

      const {posts, authorProfileMap} =
        await decryptPostsAndFetchAuthorProfiles(
          this.agent,
          truncatedPosts,
          encryptedSessionKeys,
        )

      /** fetch supporting posts for replies or embeds **/
      // Fetch reply posts
      const postMap = await createNestedPostMapFromPosts(
        this.agent,
        posts,
        authorProfileMap,
      )

      const feed = await formatPostsForFeed(
        this.agent,
        posts,
        postMap,
        authorProfileMap,
      )

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
export async function fetchProfiles(
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
 * Fetches both Speakeasy and Bluesky posts for a list of URIs
 * @param agent - The BskyAgent instance to use for API calls
 * @param uris - Array of post URIs to fetch
 * @param authorProfileMap - Map of author DIDs to their profile information
 * @returns Promise resolving to a Map of URI to PostView
 */
export async function fetchMixedPosts(
  agent: BskyAgent,
  uris: string[],
  authorProfileMap: Map<string, AppBskyActorDefs.ProfileViewBasic>,
): Promise<Map<string, AppBskyFeedDefs.PostView>> {
  const speakeasyUris = []
  const bskyUris = []

  // Split the uris into spkeasy and bsky uris
  for (const uri of uris) {
    if (uri.includes('/social.spkeasy')) {
      speakeasyUris.push(uri)
    } else {
      bskyUris.push(uri)
    }
  }

  const bskyPostsPromise = fetchPosts(agent, bskyUris)

  const {encryptedPosts, encryptedSessionKeys} = await fetchEncryptedPosts(
    agent,
    {
      uris: speakeasyUris,
    },
  )

  const {posts: decryptedPosts, authorProfileMap: newAuthorProfileMap} =
    await decryptPostsAndFetchAuthorProfiles(
      agent,
      encryptedPosts,
      encryptedSessionKeys,
      authorProfileMap,
    )

  const formattedPrivatePosts = await formatPostsForFeed(
    agent,
    decryptedPosts,
    new Map<string, AppBskyFeedDefs.PostView>(),
    newAuthorProfileMap,
  )

  const bskyPosts = await bskyPostsPromise

  const mappedSpeakeasyPosts = new Map(
    formattedPrivatePosts
      .filter(post => !!post.post)
      .map(post => [
        post.post.uri as string,
        post.post as AppBskyFeedDefs.PostView,
      ]),
  )

  const posts = new Map<string, AppBskyFeedDefs.PostView>([
    ...bskyPosts,
    ...mappedSpeakeasyPosts,
  ])

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

type FetchEncryptedPostsResponse = {
  encryptedPosts: EncryptedPost[]
  encryptedSessionKeys: EncryptedSessionKey[]
  cursor: string
}

/**
 * Fetches encrypted posts from the Speakeasy API
 * @param agent - The BskyAgent instance to use for API calls
 * @param query - Query parameters for fetching posts including optional uris, authors, replyTo, limit, cursor, and filter
 * @returns Promise resolving to encrypted posts, session keys, and cursor
 */
export async function fetchEncryptedPosts(
  agent: BskyAgent,
  query: {
    uris?: string[]
    authors?: string[]
    replyTo?: string
    limit?: number
    cursor?: string
    filter?: string
  },
): Promise<FetchEncryptedPostsResponse> {
  const res = await callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.privatePost.getPosts',
    query,
  })
  return res
}

/**
 * Fetch encrypted posts from speakeasy
 * @param agent - The BskyAgent instance to use for API calls
 * @param cursor - Optional cursor for pagination
 * @param limit - Number of posts to fetch
 * @param filterFollowers - If true, the returned posts will be filtered by the users followers
 * @returns Promise resolving to encrypted posts, session keys, and cursor
 */
export async function fetchAndFilterEncryptedPosts(
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
    cursor?: string
    filter?: string
    limit?: number
  } = {
    limit,
  }
  if (cursor) query.cursor = cursor

  // Fetch posts, private key, and follower dids (if needed)
  const promises = [
    fetchEncryptedPosts(agent, query),
    filterFollowers ? getCachedFollowerDids(agent, agent.session!.did) : [],
  ]

  // We don't need the result of this, subsequent calls will use the value
  // We call it here to ensure it's cached in advance
  getCachedPrivateKey(
    agent.session!.did,
    options => callSpeakeasyApiWithAgent(agent, options),
    true,
  )

  const [data, followerDids] = (await Promise.all(promises)) as [
    FetchEncryptedPostsResponse,
    string[],
    SpeakeasyPrivateKey,
  ]

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

/**
 * Fetches an encrypted post thread including replies and parent posts
 * @param agent - The BskyAgent instance to use for API calls
 * @param uri - The URI of the post to fetch the thread for
 * @param options - Optional parameters including limit for number of posts to fetch
 * @returns Promise resolving to the encrypted post thread data including replies, parent posts, and session keys
 */
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
  encryptedParentPosts: EncryptedPost[]
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
    getCachedPrivateKey(
      agent.session!.did,
      options => callSpeakeasyApiWithAgent(agent, options),
      true,
    ),
  ]

  const [data] = await Promise.all(promises)

  return data
}

export type DecryptedPost = {
  $type: 'social.spkeasy.feed.privatePost'
  createdAt: string
  text: string
  langs: string[]
  uri: string
  cid: string
  rkey: string
  authorDid: string
  encryptedContent: string
  sessionId: string
  reply?: {
    root: {uri: string; cid: string}
    parent: {uri: string; cid: string}
  }
  facets: AppBskyRichtextFacet.Main[]
  embed: {$type: string} & (
    | AppBskyEmbedRecordWithMedia.View
    | SocialSpkeasyEmbedExternal
    | SocialSpkeasyEmbedImage
    | SocialSpkeasyEmbedRecord
  )
  viewer: {
    like: boolean
  }
}

export type SocialSpkeasyEmbedImage = {
  // $type: 'social.spkeasy.embed.images'
  images: {
    image: {
      ref: string
      mimeType: string
      size: number
      key: string
    }
    alt: string
    aspectRatio: {
      width: number
      height: number
    }
  }[]
}

export type SocialSpkeasyEmbedExternal = {
  // $type: 'social.spkeasy.embed.external'
  external: {
    uri: string
    title: string
    description: string
    thumb: {
      $type: 'blob'
      key: string
      mimeType: string
      size: number
    }
  }
}

export type SocialSpkeasyEmbedRecord = {
  // $type: 'social.spkeasy.embed.record'
  record: {
    uri: string
    cid: string
  }
}

export type EncryptedSessionKey = {
  sessionId: string
  encryptedDek: string
  recipientDid: string
}

/**
 * Decrypts encrypted posts and hydrates and formats them to fit the FeedViewPost format
 * @param agent - The BskyAgent instance to use for API calls
 * @param encryptedPosts - Array of encrypted posts to process
 * @param encryptedSessionKeys - Array of session keys for decryption
 * @returns Promise resolving to an array of hydrated FeedViewPost objects
 */
export async function decryptPostsAndFetchAuthorProfiles(
  agent: BskyAgent,
  encryptedPosts: EncryptedPost[],
  encryptedSessionKeys: EncryptedSessionKey[],
  authorProfileMap?: Map<string, AppBskyActorDefs.ProfileViewBasic>,
): Promise<{
  posts: DecryptedPost[]
  authorProfileMap: Map<string, AppBskyActorDefs.ProfileViewBasic>
}> {
  const privateKey = await getCachedPrivateKey(
    agent.session!.did,
    options => callSpeakeasyApiWithAgent(agent, options),
    false,
  )

  /** Decrypt the posts and fetch author profiles */
  let authorDids = [...new Set(encryptedPosts.map(post => post.authorDid))]

  // Subtract already known post authors from the list of authors to fetch
  if (authorProfileMap) {
    authorDids = authorDids.filter(did => !authorProfileMap.has(did))
  }

  const [newAuthorProfileMap, decryptedPosts] = await Promise.all([
    fetchProfiles(agent, authorDids),
    decryptPosts(agent, encryptedPosts, encryptedSessionKeys, privateKey!),
  ])

  const mergedAuthorProfileMap = authorProfileMap
    ? new Map([...newAuthorProfileMap, ...authorProfileMap])
    : newAuthorProfileMap

  return {posts: decryptedPosts, authorProfileMap: mergedAuthorProfileMap}
}

/**
 * Decrypts a list of encrypted posts using the provided session keys and private key
 * @param agent - The BskyAgent instance to use for API calls
 * @param encryptedPosts - Array of encrypted posts to decrypt
 * @param encryptedSessionKeys - Array of session keys for decryption
 * @param privateKey - The private key to use for decryption
 * @returns Promise resolving to an array of decrypted posts
 */
export async function decryptPosts(
  agent: BskyAgent,
  encryptedPosts: EncryptedPost[],
  encryptedSessionKeys: EncryptedSessionKey[],
  privateKey: SpeakeasyPrivateKey,
): Promise<DecryptedPost[]> {
  return Promise.all(
    encryptedPosts.map(async (encryptedPost: any) => {
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
  )
}

/**
 * Formats decrypted posts into the FeedViewPost format for display
 * @param agent - The BskyAgent instance to use for API calls
 * @param decryptedPosts - Array of decrypted posts to format
 * @param postMap - Map of post URIs to their PostView objects
 * @param authorProfileMap - Map of author DIDs to their profile information
 * @returns Promise resolving to an array of formatted FeedViewPost objects
 */
async function formatPostsForFeed(
  agent: BskyAgent,
  decryptedPosts: any[],
  postMap: Map<string, AppBskyFeedDefs.PostView>,
  authorProfileMap: Map<string, AppBskyActorDefs.ProfileViewBasic>,
): Promise<AppBskyFeedDefs.FeedViewPost[]> {
  const baseUrl = getBaseCdnUrl(agent)

  // Discard any posts that failed to decrypt
  const posts = decryptedPosts.filter(post => !!post)

  // Convert private posts to FeedViewPost format
  const feed = posts.map((post: any) => {
    if (post.$type === 'social.spkeasy.feed.repost') {
      const postView: FeedViewPost = {
        post: postMap.get(post.embed?.record?.uri)!,
        reason: {
          $type: 'social.spkeasy.feed.defs#reasonPrivateRepost',
          by: authorProfileMap.get(post.authorDid)!,
          indexedAt: post.createdAt,
        },
      }
      return postView
    }

    const authorProfile = authorProfileMap.get(post.authorDid)
    const quotedPost = postMap.get(post.embed?.record?.uri)

    const postView: FeedViewPost = {
      $type: 'social.spkeasy.feed.defs#privatePostView',

      post: formatPostView(post, authorProfile, baseUrl, quotedPost),
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

export function formatPostView(
  post: DecryptedPost,
  authorProfile: AppBskyActorDefs.ProfileViewBasic | undefined,
  baseUrl: string,
  quotedPost: PostView | undefined,
): PostView {
  return {
    $type: 'social.spkeasy.feed.defs#privatePostView',
    uri: post.uri,
    cid: post.cid,
    author: profileToAuthorView(post.authorDid, authorProfile),
    record: {
      $type: 'app.bsky.feed.post',
      text: post.text,
      createdAt: post.createdAt,
      indexedAt: post.createdAt,
      langs: post.langs || [],
      facets: post.facets || [],

      // Weird hack, but it works.
      // Lots of things break when embed
      // is representative of what the record
      // actually contains
      // but putting something innocuous like this here
      // causes everything to display fine
      embed: {
        $type: 'app.bsky.embed.record',
        record: {
          cid: 'bafyreihfhbzmr6yrvnvybqbawod7nwaamw2futez4obfwr23tvqvnuo2nu',
          uri: 'at://did:plc:3vb37k6vaaxmnqp4suzavywx/app.bsky.feed.post/3lnp6wodza22v',
        },
      },
      reply: post.reply
        ? {
            root: {
              uri: post.reply.root.uri,
              // FIXME, should be the post's cid, but any valid cid will do
              cid:
                post.reply.root.uri &&
                'bafyreichsn5zvtlqksg6ojq3ih2yx646mzwhvopejmefat7m5f5fdlvgdi',
            },
            parent: {
              uri: post.reply.parent.uri,
              // FIXME, should be the post's cid, but any valid cid will do
              cid:
                post.reply.parent.uri &&
                'bafyreichsn5zvtlqksg6ojq3ih2yx646mzwhvopejmefat7m5f5fdlvgdi',
            },
          }
        : undefined,
    },
    embed:
      baseUrl && post.embed
        ? transformPrivateEmbed(post.embed, post.authorDid, baseUrl, quotedPost)
        : undefined,
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
    indexedAt: post.createdAt,
    labels: [],
    viewer: {
      repost: undefined,
      like: post.viewer.like ? post.uri : undefined,
    },
  }
}

/**
 * Converts a profile to the author view format used in feed posts
 * @param authorDid - The DID of the author
 * @param profile - Optional profile information for the author
 * @returns Author view object for use in feed posts
 */
export function profileToAuthorView(
  authorDid: string,
  profile?: AppBskyActorDefs.ProfileViewBasic,
): AppBskyActorDefs.ProfileViewBasic {
  return {
    $type: 'app.bsky.actor.defs#profileViewBasic',
    did: profile?.did || authorDid,
    handle: profile?.handle || authorDid,
    avatar: profile?.avatar || '',
    displayName: profile?.displayName || profile?.handle || authorDid,
    viewer: profile?.viewer,
    labels: [],
  }
}

/**
 * Creates a map of nested posts (replies and quoted posts) from a list of posts
 * @param agent - The BskyAgent instance to use for API calls
 * @param posts - Array of decrypted posts to process
 * @param authorProfileMap - Map of author DIDs to their profile information
 * @returns Promise resolving to a Map of post URIs to their PostView objects
 */
async function createNestedPostMapFromPosts(
  agent: BskyAgent,
  posts: DecryptedPost[],
  authorProfileMap: Map<string, AppBskyActorDefs.ProfileViewBasic>,
): Promise<Map<string, AppBskyFeedDefs.PostView>> {
  const replyUris = posts
    .filter(post => post.reply)
    .flatMap(post => [post.reply?.root.uri, post.reply?.parent.uri])
    .filter(Boolean)

  // Fetch quoted posts
  const quotedPostUris = posts
    .map(post => (post.embed as any)?.record?.uri)
    .filter(Boolean)

  const postMap = await fetchMixedPosts(
    agent,
    [...replyUris, ...quotedPostUris],
    authorProfileMap,
  )

  return postMap
}

export async function deleteEncryptedPost(agent: BskyAgent, uri: string) {
  const res = await callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.privatePost.deletePost',
    method: 'POST',
    body: {
      uri,
    },
  })
  return res
}

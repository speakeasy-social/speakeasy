import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {getBaseCdnUrl} from '#/lib/api/feed/utils'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {getPrivateKey} from '#/lib/api/user-keys'
import {decryptContent, decryptDEK} from '#/lib/encryption'
import {transformPrivateEmbed} from '#/state/queries/post-feed'
import {FeedAPI, FeedAPIResponse} from './types'

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

export class PrivatePostsFeedAPI implements FeedAPI {
  agent: BskyAgent

  constructor({agent}: {agent: BskyAgent}) {
    this.agent = agent
  }

  async fetch({
    cursor,
    audience,
    limit = 50,
  }: {
    cursor: string | undefined
    audience?: string
    limit: number
  }): Promise<FeedAPIResponse> {
    try {
      const baseUrl = getBaseCdnUrl(this.agent)

      const query: {
        limit: string
        audience: string
        cursor?: string
        filter?: string
      } = {
        limit: limit.toString(),
        audience: audience || 'trusted',
      }
      if (cursor) query.cursor = cursor
      if (audience === 'following') query.filter = 'follows'

      const data = await callSpeakeasyApiWithAgent(this.agent, {
        api: 'social.spkeasy.privatePost.getPosts',
        query,
      })

      const {
        encryptedPosts,
        encryptedSessionKeys,
      }: {
        cursor: string
        encryptedPosts: EncryptedPost[]
        encryptedSessionKeys: {
          sessionId: string
          encryptedDek: string
          recipientDid: string
        }[]
      } = data

      const privateKey = await getPrivateKey(options =>
        callSpeakeasyApiWithAgent(this.agent, options),
      )

      const posts = (
        await Promise.all(
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
      ).filter(post => !!post)

      // Fetch author profiles for all posts
      const authorDids = [...new Set(posts.map(post => post.authorDid))]
      const authorProfiles = await Promise.all(
        authorDids.map(did =>
          this.agent.getProfile({actor: did}).then(res => ({
            did,
            profile: res.data,
          })),
        ),
      )
      const authorProfileMap = Object.fromEntries(
        authorProfiles.map(({did, profile}) => [did, profile]),
      )

      // Fetch reply posts
      const replyUris = posts
        .filter(post => post.reply)
        .flatMap(post => [post.reply.root?.uri, post.reply.parent?.uri])
        .filter(Boolean)

      const replyPostMap = await fetchPostsInBatches(this.agent, replyUris)

      // Fetch quoted posts
      const quotedPostUris = posts
        .filter(post => post.embed?.record?.uri)
        .map(post => post.embed.record.uri)

      const quotedPostMap = await fetchPostsInBatches(
        this.agent,
        quotedPostUris,
      )

      // Convert private posts to FeedViewPost format
      const feed = posts.map((post: any) => {
        const authorProfile = authorProfileMap[post.authorDid]
        const quotedPost = quotedPostMap[post.embed?.record?.uri]

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
                root: replyPostMap[post.reply.root?.uri],
                parent: replyPostMap[post.reply.parent?.uri],
              }
            : undefined,
        }

        return postView
      })

      return {
        cursor: data.cursor,
        feed,
      }
    } catch (err) {
      console.error('Error fetching private posts:', err)
      return {
        feed: [],
      }
    }
  }

  async peekLatest(): Promise<AppBskyFeedDefs.FeedViewPost> {
    const res = await this.fetch({cursor: undefined, limit: 1})
    return res.feed[0]
  }
}

// Helper function to fetch posts in batches
async function fetchPostsInBatches(agent: BskyAgent, uris: string[]) {
  const batchSize = 25
  const uriBatches = []
  for (let i = 0; i < uris.length; i += batchSize) {
    uriBatches.push(uris.slice(i, i + batchSize))
  }

  const posts = (
    await Promise.all(
      uriBatches.map(urisInBatch =>
        agent.getPosts({uris: urisInBatch}).then(res =>
          res.data.posts.map(post => ({
            uri: post.uri,
            post: {
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
          })),
        ),
      ),
    )
  ).flat()

  return Object.fromEntries(posts.map(({uri, post}) => [uri, post]))
}

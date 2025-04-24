import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {getPrivateKey} from '#/lib/api/user-keys'
import {decryptContent, decryptDEK} from '#/lib/encryption'
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
    limit = 50,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    try {
      const data = await callSpeakeasyApiWithAgent(this.agent, {
        api: 'social.spkeasy.privatePosts.getPosts',
        query: {
          recipient: this.agent.session?.did || '',
          ...(cursor ? {cursor} : {}),
          limit: limit.toString(),
        },
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

      // const privateKey = await getPrivateKey(this.agent)

      const posts = (
        await Promise.all(
          encryptedPosts.map(async (encryptedPost: any) => {
            // const encryptedDek = encryptedSessionKeys.find(
            //   key => key.sessionId === encryptedPost.sessionId,
            // )?.encryptedDek
            // // If we can't find a session to decode it, discard the post
            // if (!encryptedDek) return null
            // const dek = await decryptDEK(encryptedDek, privateKey)

            // const post = await decryptContent(
            //   encryptedPost.encryptedContent,
            //   dek,
            // )
            // return {
            //   ...post,
            //   ...encryptedPost,
            // }
            return {
              ...JSON.parse(encryptedPost.encryptedContent),
              ...encryptedPost,
            }
          }),
        )
      ).filter(post => !!post)

      // Convert private posts to FeedViewPost format
      const feed = posts.map((post: any) => ({
        $type: 'app.bsky.feed.defs#feedViewPost',
        post: {
          $type: 'app.bsky.feed.defs#postView',
          uri: post.uri,
          cid: post.cid,
          author: {
            $type: 'app.bsky.actor.defs#profileViewBasic',
            did: post.authorDid,
            handle: '', // We'll need to fetch this separately if needed
            displayName: '',
            avatar: '',
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
            langs: [],
          },
          embed: undefined,
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
        reply: undefined,
        reason: {
          $type: 'app.bsky.feed.defs#reasonRepost',
          by: {
            $type: 'app.bsky.actor.defs#profileViewBasic',
            did: post.authorDid,
            handle: '', // We'll need to fetch this separately if needed
            displayName: '',
            avatar: '',
            viewer: {
              muted: false,
              blockedBy: false,
            },
            labels: [],
          },
          indexedAt: post.createdAt,
        },
      }))

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

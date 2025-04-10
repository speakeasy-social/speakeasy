import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {FeedAPI, FeedAPIResponse} from './types'

export class PrivatePostsFeedAPI implements FeedAPI {
  agent: BskyAgent
  privatePostsServerUrl: string

  constructor({agent}: {agent: BskyAgent}) {
    this.agent = agent
    this.privatePostsServerUrl = 'http://localhost:3002'
  }

  async fetch({
    cursor,
    limit = 50,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    try {
      const response = await fetch(
        `${this.privatePostsServerUrl}/xrpc/social.spkeasy.privatePosts.getPosts?` +
          new URLSearchParams({
            recipient: this.agent.session?.did || '',
            ...(cursor ? {cursor} : {}),
            limit: limit.toString(),
          }),
        {
          headers: {
            Authorization: `Bearer ${this.agent.session?.accessJwt}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch private posts: ${response.statusText}`)
      }

      const data = await response.json()

      // Convert private posts to FeedViewPost format
      const feed = data.posts.map((post: any) => ({
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

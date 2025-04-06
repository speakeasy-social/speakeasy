import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {PrivatePostsFeedAPI} from './private-posts'
import {FeedAPI, FeedAPIResponse} from './types'

export class FollowingFeedAPI implements FeedAPI {
  agent: BskyAgent
  privatePosts: PrivatePostsFeedAPI

  constructor({agent}: {agent: BskyAgent}) {
    this.agent = agent
    this.privatePosts = new PrivatePostsFeedAPI({agent})
  }

  async peekLatest(): Promise<AppBskyFeedDefs.FeedViewPost> {
    const res = await this.agent.getTimeline({
      limit: 1,
    })
    return res.data.feed[0]
  }

  async fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    const promises = []

    // Fetch private posts
    promises.push(
      this.privatePosts.fetch({
        cursor: undefined,
        limit,
      }),
    )
    // Then fetch regular timeline
    promises.push(
      this.agent.getTimeline({
        cursor,
        limit,
      }),
    )

    const [privatePostsRes, res] = (await Promise.all(promises)) as [
      FeedAPIResponse,
      {
        success: boolean
        data: {cursor?: string; feed: AppBskyFeedDefs.FeedViewPost[]}
      },
    ]

    // FIXME error handling for private posts

    if (res.success) {
      // Combine private posts with regular timeline
      return {
        cursor: res.data.cursor,
        feed: [...privatePostsRes.feed, ...res.data.feed],
      }
    }
    return {
      feed: privatePostsRes.feed,
    }
  }
}

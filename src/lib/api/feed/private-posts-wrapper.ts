import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {PrivatePostsFeedAPI} from './private-posts'
import {FeedAPI, FeedAPIResponse} from './types'

export class PrivatePostsWrapper implements FeedAPI {
  private wrappedFeed: FeedAPI
  private privatePosts: PrivatePostsFeedAPI
  private mergeMethod: string
  constructor({
    wrappedFeed,
    agent,
    mergeMethod,
  }: {
    wrappedFeed: FeedAPI
    agent: BskyAgent
    mergeMethod: string
  }) {
    this.wrappedFeed = wrappedFeed
    this.privatePosts = new PrivatePostsFeedAPI({agent})
    this.mergeMethod = mergeMethod
  }

  async peekLatest(): Promise<AppBskyFeedDefs.FeedViewPost> {
    // Try to get public posts first, fall back to wrapped feed
    try {
      const publicRes = await this.wrappedFeed.peekLatest()
      if (publicRes) {
        return publicRes
      }
    } catch (e) {
      // If public posts fail, continue to wrapped feed
    }
    return this.privatePosts.peekLatest()
  }

  async fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    let privateCursor: string | undefined
    let wrappedCursor: string | undefined

    if (cursor) {
      // Split only on the first occurrence of the pipe character
      const splitIndex = cursor.indexOf('|')
      if (splitIndex !== -1) {
        privateCursor = cursor.substring(0, splitIndex)
        wrappedCursor = cursor.substring(splitIndex + 1)
      }
    }

    const promises = []

    // Fetch private posts
    promises.push(
      privateCursor === 'undefined'
        ? {cursor: undefined, feed: []}
        : this.privatePosts.fetch({
            cursor: privateCursor,
            audience: this.mergeMethod === 'trusted' ? 'trusted' : 'following',
            limit,
          }),
    )
    // Then fetch wrapped feed
    promises.push(
      wrappedCursor === 'undefined'
        ? {cursor: undefined, feed: []}
        : this.wrappedFeed.fetch({
            cursor: wrappedCursor,
            limit,
          }),
    )

    const [privatePostsRes, wrappedRes] = await Promise.all(promises)

    // Combine both cursors into one string separated by |
    const mergedCursor = `${privatePostsRes.cursor}|${wrappedRes.cursor}`

    // Merge the results
    return {
      cursor: mergedCursor,
      feed: [...privatePostsRes.feed, ...wrappedRes.feed],
    }
  }
}

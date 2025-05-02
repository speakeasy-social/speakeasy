import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {PrivatePostsFeedAPI} from './private-posts'
import {FeedAPI, FeedAPIResponse} from './types'

export class PrivatePostsWrapper implements FeedAPI {
  private wrappedFeed: FeedAPI
  private privatePosts: PrivatePostsFeedAPI
  private mergeMethod: string

  private postSortIndex: (post: AppBskyFeedDefs.FeedViewPost) => number
  private postDistance: (
    a: AppBskyFeedDefs.FeedViewPost,
    b: AppBskyFeedDefs.FeedViewPost,
  ) => number

  private stashedPrivatePosts: AppBskyFeedDefs.FeedViewPost[] = []
  private stashedWrappedPosts: AppBskyFeedDefs.FeedViewPost[] = []

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

    this.postSortIndex = postDate

    this.postDistance = (
      a: AppBskyFeedDefs.FeedViewPost,
      b: AppBskyFeedDefs.FeedViewPost,
    ) => {
      return postDate(b) - postDate(a)
    }
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

  private parseCursor(cursor: string | undefined): {
    privateCursor: string | undefined
    wrappedCursor: string | undefined
  } {
    let privateCursor: string | undefined
    let wrappedCursor: string | undefined

    if (cursor) {
      const splitIndex = cursor.indexOf('|')
      if (splitIndex !== -1) {
        privateCursor = cursor.substring(0, splitIndex)
        wrappedCursor = cursor.substring(splitIndex + 1)
      }
    }

    return {privateCursor, wrappedCursor}
  }

  private async fetchBothFeeds(
    privateCursor: string | undefined,
    wrappedCursor: string | undefined,
    limit: number,
  ) {
    const promises = [
      // If the cursor is the string "undefined",
      // then we have paginated through all the private posts
      privateCursor === 'undefined'
        ? {cursor: undefined, feed: []}
        : this.privatePosts.fetch({
            cursor: privateCursor,
            audience: this.mergeMethod === 'trusted' ? 'trusted' : 'following',
            limit,
          }),
      // Fetch wrapped feed
      wrappedCursor === 'undefined'
        ? {cursor: undefined, feed: []}
        : this.wrappedFeed.fetch({
            cursor: wrappedCursor,
            limit,
          }),
    ]

    return Promise.all(promises)
  }

  private mergeFeeds(
    privatePosts: AppBskyFeedDefs.FeedViewPost[],
    wrappedPosts: AppBskyFeedDefs.FeedViewPost[],
    privateCursor: string | undefined,
    wrappedCursor: string | undefined,
  ): AppBskyFeedDefs.FeedViewPost[] {
    const mergedFeed: AppBskyFeedDefs.FeedViewPost[] = []

    // Merge posts according to the sorting method
    while (privatePosts.length && wrappedPosts.length) {
      if (
        this.postSortIndex(privatePosts[0]) >
        this.postSortIndex(wrappedPosts[0])
      ) {
        mergedFeed.push(privatePosts.shift()!)
      } else {
        mergedFeed.push(wrappedPosts.shift()!)
      }
    }

    // Calculate average distance between posts based on their sorting index
    const averageDistance =
      mergedFeed.length > 1
        ? mergedFeed.reduce((acc, post, index) => {
            const increment =
              index === 0 ? 0 : this.postDistance(post, mergedFeed[index - 1])
            return acc + increment
          }, 0) /
          (mergedFeed.length - 1)
        : 0

    const remainingPosts = privatePosts.length ? privatePosts : wrappedPosts
    const emptiedHasMore = privatePosts.length ? wrappedCursor : privateCursor
    // Add remaining posts if they're within the average sorting index
    while (
      remainingPosts.length &&
      (!emptiedHasMore ||
        this.postDistance(
          remainingPosts[0],
          mergedFeed[mergedFeed.length - 1],
        ) < averageDistance)
    ) {
      mergedFeed.push(remainingPosts.shift()!)
    }

    return mergedFeed
  }

  async fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    try {
      // Parse the cursor into private and wrapped components
      const {privateCursor, wrappedCursor} = this.parseCursor(cursor)

      // Fetch posts from both sources
      const [privatePostsRes, wrappedRes] = await this.fetchBothFeeds(
        privateCursor,
        wrappedCursor,
        limit,
      )

      // Combine cursors for next request
      const mergedCursor = `${privatePostsRes.cursor}|${wrappedRes.cursor}`

      // Prepare posts for merging
      const privatePosts = [
        ...this.stashedPrivatePosts,
        ...privatePostsRes.feed,
      ]
      const wrappedPosts = [...this.stashedWrappedPosts, ...wrappedRes.feed]

      // Merge the feeds
      const mergedFeed = this.mergeFeeds(
        privatePosts,
        wrappedPosts,
        privatePostsRes.cursor,
        wrappedRes.cursor,
      )

      // Store remaining posts for next fetch
      this.stashedPrivatePosts = privatePosts
      this.stashedWrappedPosts = wrappedPosts

      return {
        cursor: mergedCursor,
        feed: mergedFeed,
      }
    } catch (e) {
      console.error(e)
      throw e
    }
  }
}

function postDate(post: AppBskyFeedDefs.FeedViewPost) {
  return new Date(
    (post.post.indexedAt || post.post.createdAt) as string,
  ).getTime()
}

import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {PrivatePostsFeedAPI} from './private-posts'
import {FeedAPI, FeedAPIResponse} from './types'

/**
 * A wrapper class that merges private posts with another feed implementation.
 * Implements the FeedAPI interface to provide a unified feed experience.
 */
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

  /**
   * Creates a new instance of PrivatePostsWrapper.
   * @param {Object} params - The initialization parameters
   * @param {FeedAPI} params.wrappedFeed - The feed implementation to wrap
   * @param {BskyAgent} params.agent - The Bluesky agent instance
   * @param {string} params.mergeMethod - The method to use for merging feeds ('trusted' or other)
   */
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

  /**
   * Attempts to peek at the latest post from either the wrapped feed or private posts.
   * @returns {Promise<AppBskyFeedDefs.FeedViewPost>} The latest post from either feed
   */
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

  /**
   * Parses a combined cursor string into separate cursors for private and wrapped feeds.
   * @param {string | undefined} cursor - The combined cursor string in format "privateCursor|wrappedCursor"
   */
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

  /**
   * Fetches posts from both private and wrapped feeds concurrently.
   * @param {string | undefined} privateCursor - Cursor for private posts pagination
   * @param {string | undefined} wrappedCursor - Cursor for wrapped feed pagination
   * @param {number} limit - Maximum number of posts to fetch from each feed
   * @returns {Promise<Array<{cursor: string | undefined, feed: AppBskyFeedDefs.FeedViewPost[]}>>} Array containing results from both feeds
   */
  private async fetchBothFeeds(
    privateCursor: string | undefined,
    wrappedCursor: string | undefined,
    limit: number,
  ) {
    const promises = [
      // If the cursor is the string "undefined",
      // then we have paginated through all the private posts
      privateCursor === 'EOF'
        ? {cursor: undefined, feed: []}
        : awaitWithTimeout(
            this.privatePosts.fetch({
              cursor: privateCursor,
              audience:
                this.mergeMethod === 'trusted' ? 'trusted' : 'following',

              // Fetching private posts and then any quotes / replies
              // is slow. So fetch just enough to fill the page on
              // first fetch
              limit: privateCursor ? limit : 4,
            }),
            privateCursor,
            5,
          ),
      // Fetch wrapped feed
      wrappedCursor === 'EOF'
        ? {cursor: undefined, feed: []}
        : this.wrappedFeed.fetch({
            cursor: wrappedCursor,
            limit,
          }),
    ]

    return Promise.all(promises)
  }

  /**
   * Merges posts from private and wrapped feeds based on their sorting index.
   * @param {AppBskyFeedDefs.FeedViewPost[]} privatePosts - Posts from private feed
   * @param {AppBskyFeedDefs.FeedViewPost[]} wrappedPosts - Posts from wrapped feed
   * @param {string | undefined} privateCursor - Cursor for private posts
   * @param {string | undefined} wrappedCursor - Cursor for wrapped feed
   * @returns {AppBskyFeedDefs.FeedViewPost[]} Merged and sorted array of posts
   */
  private mergeFeeds(
    newPrivatePosts: AppBskyFeedDefs.FeedViewPost[],
    newWrappedPosts: AppBskyFeedDefs.FeedViewPost[],
    privateCursor: string | undefined,
    wrappedCursor: string | undefined,
    mustReturnData: boolean,
  ): AppBskyFeedDefs.FeedViewPost[] {
    const mergedFeed: AppBskyFeedDefs.FeedViewPost[] = []

    // Prepare posts for merging
    const privatePosts = [...this.stashedPrivatePosts, ...newPrivatePosts]
    const wrappedPosts = [...this.stashedWrappedPosts, ...newWrappedPosts]

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

    const remainingPosts = privatePosts.length ? privatePosts : wrappedPosts
    const emptiedHasMore = privatePosts.length ? wrappedCursor : privateCursor

    // If one of the feeds has run out, then we don't
    // need to merge anymore
    if (!emptiedHasMore) {
      mergedFeed.push(...remainingPosts)
      this.stashedPrivatePosts = []
      this.stashedWrappedPosts = []
    } else {
      // If we must return data, take the first 9 posts
      if (mustReturnData) {
        mergedFeed.push(...remainingPosts.splice(0, 9))
      }

      // Store remaining posts for next fetch
      this.stashedPrivatePosts = privatePosts
      this.stashedWrappedPosts = wrappedPosts
    }

    return mergedFeed
  }

  /**
   * Fetches and merges posts from both private and wrapped feeds.
   * @param {Object} params - The fetch parameters
   * @param {string | undefined} params.cursor - Combined cursor for pagination
   * @param {number} params.limit - Maximum number of posts to fetch
   * @returns {Promise<FeedAPIResponse>} Response containing merged feed and next cursor
   */
  async fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    let mergedCursor
    let mergedFeed

    let mustReturnData = false

    do {
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
        mergedCursor = `${privatePostsRes.cursor || 'EOF'}|${
          wrappedRes.cursor || 'EOF'
        }`

        if (mergedCursor === 'EOF|EOF') mergedCursor = undefined

        // Merge the feeds
        mergedFeed = this.mergeFeeds(
          privatePostsRes.feed,
          wrappedRes.feed,
          privatePostsRes.cursor,
          wrappedRes.cursor,
          mustReturnData,
        )
      } catch (e) {
        console.error('merge fetch failed', e)
        throw e
      }

      // Sometimes the merge will return 0 posts
      // because it needs to fetch more data to merge
      // in which case, loop again
      // But only do this at most once, then we need to send
      // some data
      mustReturnData = true
    } while (mergedFeed.length === 0 && mergedCursor)
    return {
      cursor: mergedCursor,
      feed: mergedFeed,
    }
  }
}

/**
 * Gets the timestamp of a post for sorting purposes.
 * @param {AppBskyFeedDefs.FeedViewPost} post - The post to get the timestamp for
 * @returns {number} The timestamp in milliseconds
 */
function postDate(post: AppBskyFeedDefs.FeedViewPost) {
  return new Date(
    (post.post.indexedAt || post.post.createdAt) as string,
  ).getTime()
}

let shouldContinue = true

/**
 * Private keys server is occasionally very slow to respond and hangs
 * the whole feed
 * Until we resolve it, set a timeout on fetching private feed
 * so as not to completely ruin the UX
 * @param promise
 * @param cursor
 * @param seconds
 * @returns
 */
function awaitWithTimeout(
  promise: Promise<any>,
  cursor: string | undefined,
  seconds: number,
) {
  return Promise.race([
    promise,
    new Promise(resolve =>
      setTimeout(() => {
        if (shouldContinue) {
          resolve({cursor, feed: []})
        } else {
          resolve({cursor: 'EOF', feed: []})
        }
        // Try again first time this happens
        // second time give up
        shouldContinue = !shouldContinue
      }, seconds * 1000),
    ),
  ])
}

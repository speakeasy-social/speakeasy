import {AppBskyFeedDefs} from '@atproto/api'
import {QueryKey} from '@tanstack/react-query'

import {
  mergePrivateProfileData,
  PrivateProfileData,
  shouldCheckPrivateProfile,
} from '#/lib/api/private-profiles'
import {FeedPageUnselected, RQKEY_ROOT} from './post-feed'
import {usePrivateProfileFetcher} from './use-private-profile-fetcher'

/**
 * Extracts unique author DIDs from feed pages.
 * Includes post authors, reply parent authors, and repost authors.
 */
export function extractDidsFromFeed(pages: FeedPageUnselected[]): Set<string> {
  const dids = new Set<string>()

  for (const page of pages) {
    for (const item of page.feed) {
      // Post author
      if (shouldCheckPrivateProfile(item.post.author)) {
        dids.add(item.post.author.did)
      }

      // Reply parent author
      if (item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent)) {
        if (shouldCheckPrivateProfile(item.reply.parent.author)) {
          dids.add(item.reply.parent.author.did)
        }
      }

      // Reply root author (if different from parent)
      if (item.reply?.root && AppBskyFeedDefs.isPostView(item.reply.root)) {
        if (shouldCheckPrivateProfile(item.reply.root.author)) {
          dids.add(item.reply.root.author.did)
        }
      }

      // Repost author
      if (AppBskyFeedDefs.isReasonRepost(item.reason)) {
        if (shouldCheckPrivateProfile(item.reason.by)) {
          dids.add(item.reason.by.did)
        }
      }
    }
  }

  return dids
}

/**
 * Pure function to merge private profile data into a single feed item.
 * Returns a new item with private profiles merged into:
 * post author, reply parent/root authors, repost author.
 */
export function mergeFeedItemWithPrivateProfiles(
  item: AppBskyFeedDefs.FeedViewPost,
  getProfile: (did: string) => PrivateProfileData | undefined,
): AppBskyFeedDefs.FeedViewPost {
  let modified = false
  let newPost = item.post
  let newReply = item.reply
  let newReason = item.reason

  // Enhance post author
  const authorPrivate = getProfile(item.post.author.did)
  if (authorPrivate) {
    newPost = {
      ...item.post,
      author: mergePrivateProfileData(item.post.author, authorPrivate),
    }
    modified = true
  }

  // Enhance reply parent author
  if (item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent)) {
    const parentPrivate = getProfile(item.reply.parent.author.did)
    if (parentPrivate) {
      newReply = {
        ...item.reply,
        parent: {
          ...item.reply.parent,
          author: mergePrivateProfileData(
            item.reply.parent.author,
            parentPrivate,
          ),
        },
      }
      modified = true
    }
  }

  // Enhance reply root author
  if (item.reply?.root && AppBskyFeedDefs.isPostView(item.reply.root)) {
    const rootPrivate = getProfile(item.reply.root.author.did)
    if (rootPrivate) {
      const baseReply = newReply ?? item.reply
      newReply = {
        ...baseReply,
        root: {
          ...item.reply.root,
          author: mergePrivateProfileData(item.reply.root.author, rootPrivate),
        },
      }
      modified = true
    }
  }

  // Enhance repost author
  if (AppBskyFeedDefs.isReasonRepost(item.reason)) {
    const repostPrivate = getProfile(item.reason.by.did)
    if (repostPrivate) {
      newReason = {
        ...item.reason,
        by: mergePrivateProfileData(item.reason.by, repostPrivate),
      }
      modified = true
    }
  }

  if (modified) {
    return {
      ...item,
      post: newPost,
      reply: newReply,
      reason: newReason,
    }
  }
  return item
}

/**
 * Hook to fetch private profiles for feed authors.
 *
 * Watches the feed cache for changes, extracts unique author DIDs,
 * and batch fetches their private profiles into the module-level cache.
 *
 * Does NOT mutate the feed query cache — merging happens
 * in the post-feed.ts select callback via mergeFeedItemWithPrivateProfiles.
 */
export function useFeedPrivateProfiles(
  feedQueryKey: QueryKey,
  options?: {enabled?: boolean},
) {
  usePrivateProfileFetcher<FeedPageUnselected>({
    queryKey: feedQueryKey,
    rqKeyRoot: RQKEY_ROOT,
    extractDids: extractDidsFromFeed,
    enabled: options?.enabled,
    logPrefix: 'useFeedPrivateProfiles',
  })
}

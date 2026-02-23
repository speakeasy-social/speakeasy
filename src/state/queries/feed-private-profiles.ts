import {AppBskyActorDefs, AppBskyFeedDefs} from '@atproto/api'
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
 * Uses the single resolver (mergePrivateProfileData) for every author: publicSource
 * from getPublicProfile when provided, else author from item; then resolve with getPrivateProfile.
 */
export function mergeFeedItemWithPrivateProfiles(
  item: AppBskyFeedDefs.FeedViewPost,
  getPrivateProfile: (did: string) => PrivateProfileData | undefined,
  getPublicProfile?: (
    did: string,
  ) => AppBskyActorDefs.ProfileViewBasic | undefined,
): AppBskyFeedDefs.FeedViewPost {
  const postAuthorDid = item.post.author.did
  const publicSourcePost = getPublicProfile?.(postAuthorDid) ?? item.post.author
  const displayPostAuthor = mergePrivateProfileData(
    publicSourcePost,
    getPrivateProfile(postAuthorDid),
  )
  let newPost = {...item.post, author: displayPostAuthor}
  let newReply = item.reply
  let newReason = item.reason

  if (item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent)) {
    const did = item.reply.parent.author.did
    const publicSource = getPublicProfile?.(did) ?? item.reply.parent.author
    newReply = {
      ...item.reply,
      parent: {
        ...item.reply.parent,
        author: mergePrivateProfileData(publicSource, getPrivateProfile(did)),
      },
    }
  }

  if (item.reply?.root && AppBskyFeedDefs.isPostView(item.reply.root)) {
    const did = item.reply.root.author.did
    const publicSource = getPublicProfile?.(did) ?? item.reply.root.author
    const baseReply = newReply ?? item.reply
    newReply = {
      ...baseReply,
      root: {
        ...item.reply.root,
        author: mergePrivateProfileData(publicSource, getPrivateProfile(did)),
      },
    }
  }

  if (AppBskyFeedDefs.isReasonRepost(item.reason)) {
    const did = item.reason.by.did
    const publicSource = getPublicProfile?.(did) ?? item.reason.by
    newReason = {
      ...item.reason,
      by: mergePrivateProfileData(publicSource, getPrivateProfile(did)),
    }
  }

  return {
    ...item,
    post: newPost,
    reply: newReply,
    reason: newReason,
  }
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

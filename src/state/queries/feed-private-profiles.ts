import {AppBskyFeedDefs} from '@atproto/api'
import {InfiniteData, QueryKey, useQueryClient} from '@tanstack/react-query'

import {
  mergePrivateProfileData,
  PrivateProfileData,
} from '#/lib/api/private-profiles'
import {FeedPageUnselected, RQKEY_ROOT} from './post-feed'
import {usePrivateProfileEnhancer} from './use-private-profile-enhancer'

/**
 * Extracts unique author DIDs from feed pages.
 * Includes post authors, reply parent authors, and repost authors.
 */
export function extractDidsFromFeed(pages: FeedPageUnselected[]): Set<string> {
  const dids = new Set<string>()

  for (const page of pages) {
    for (const item of page.feed) {
      // Post author
      dids.add(item.post.author.did)

      // Reply parent author
      if (item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent)) {
        dids.add(item.reply.parent.author.did)
      }

      // Reply root author (if different from parent)
      if (item.reply?.root && AppBskyFeedDefs.isPostView(item.reply.root)) {
        dids.add(item.reply.root.author.did)
      }

      // Repost author
      if (AppBskyFeedDefs.isReasonRepost(item.reason)) {
        dids.add(item.reason.by.did)
      }
    }
  }

  return dids
}

/**
 * Updates the feed cache with private profile data.
 * Mutates FeedPageUnselected to trigger select callback re-run.
 */
export function updateFeedCacheWithPrivateProfiles(
  queryClient: ReturnType<typeof useQueryClient>,
  feedQueryKey: QueryKey,
  privateProfiles: Map<string, PrivateProfileData>,
): boolean {
  const queryData =
    queryClient.getQueryData<InfiniteData<FeedPageUnselected>>(feedQueryKey)

  if (!queryData?.pages) return false

  let modified = false

  for (const page of queryData.pages) {
    for (const item of page.feed) {
      // Enhance post author
      const authorPrivate = privateProfiles.get(item.post.author.did)
      if (authorPrivate) {
        item.post.author = mergePrivateProfileData(
          item.post.author,
          authorPrivate,
        )
        modified = true
      }

      // Enhance reply parent author
      if (item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent)) {
        const parentPrivate = privateProfiles.get(item.reply.parent.author.did)
        if (parentPrivate) {
          item.reply.parent.author = mergePrivateProfileData(
            item.reply.parent.author,
            parentPrivate,
          )
          modified = true
        }
      }

      // Enhance reply root author
      if (item.reply?.root && AppBskyFeedDefs.isPostView(item.reply.root)) {
        const rootPrivate = privateProfiles.get(item.reply.root.author.did)
        if (rootPrivate) {
          item.reply.root.author = mergePrivateProfileData(
            item.reply.root.author,
            rootPrivate,
          )
          modified = true
        }
      }

      // Enhance repost author
      if (AppBskyFeedDefs.isReasonRepost(item.reason)) {
        const repostPrivate = privateProfiles.get(item.reason.by.did)
        if (repostPrivate) {
          item.reason.by = mergePrivateProfileData(
            item.reason.by,
            repostPrivate,
          )
          modified = true
        }
      }
    }
  }

  if (modified) {
    // Trigger re-render by setting data with new reference
    queryClient.setQueryData(feedQueryKey, {...queryData})
  }

  return modified
}

/**
 * Hook to enhance feed author profiles with private profile data.
 *
 * Watches the feed cache for changes, extracts unique author DIDs,
 * batch fetches their private profiles, and updates the cache.
 *
 * @param feedQueryKey - The React Query key for the feed (from RQKEY)
 * @param options - Optional configuration
 */
export function useFeedPrivateProfiles(
  feedQueryKey: QueryKey,
  options?: {enabled?: boolean},
) {
  usePrivateProfileEnhancer<FeedPageUnselected>({
    queryKey: feedQueryKey,
    rqKeyRoot: RQKEY_ROOT,
    extractDids: extractDidsFromFeed,
    updateCache: updateFeedCacheWithPrivateProfiles,
    enabled: options?.enabled,
    logPrefix: 'useFeedPrivateProfiles',
  })
}

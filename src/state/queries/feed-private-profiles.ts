import {useCallback, useEffect, useRef} from 'react'
import {AppBskyFeedDefs} from '@atproto/api'
import {InfiniteData, QueryKey, useQueryClient} from '@tanstack/react-query'

import {
  fetchPrivateProfiles,
  mergePrivateProfileData,
  PrivateProfileData,
} from '#/lib/api/private-profiles'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {isServiceError, showServiceErrorToast} from '#/lib/api/speakeasy-health'
import {logger} from '#/logger'
import {useAgent, useSession} from '#/state/session'
import {FeedPageUnselected, RQKEY_ROOT} from './post-feed'

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
  const queryClient = useQueryClient()
  const agent = useAgent()
  const {currentAccount} = useSession()

  // Track which DIDs we've already fetched to avoid refetching
  const fetchedDidsRef = useRef<Set<string>>(new Set())
  const isFetchingRef = useRef(false)

  // Reset fetched DIDs when feed descriptor changes
  const feedDesc = feedQueryKey[1]
  useEffect(() => {
    fetchedDidsRef.current.clear()
  }, [feedDesc])

  const enhanceProfiles = useCallback(async () => {
    if (options?.enabled === false) return
    if (!currentAccount?.did) return
    if (isFetchingRef.current) return

    // Get current feed data
    const queryData =
      queryClient.getQueryData<InfiniteData<FeedPageUnselected>>(feedQueryKey)

    if (!queryData?.pages?.length) return

    // Extract DIDs that haven't been fetched yet
    const allDids = extractDidsFromFeed(queryData.pages)
    const newDids = Array.from(allDids).filter(
      did => !fetchedDidsRef.current.has(did),
    )

    if (newDids.length === 0) return

    isFetchingRef.current = true

    try {
      const call = (opts: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
        callSpeakeasyApiWithAgent(agent, opts)

      const privateProfiles = await fetchPrivateProfiles(
        newDids,
        currentAccount.did,
        call,
      )

      // Mark all DIDs as fetched (even if no private profile found)
      for (const did of newDids) {
        fetchedDidsRef.current.add(did)
      }

      // Update cache if we got any private profiles
      if (privateProfiles.size > 0) {
        updateFeedCacheWithPrivateProfiles(
          queryClient,
          feedQueryKey,
          privateProfiles,
        )
      }
    } catch (error) {
      logger.error('useFeedPrivateProfiles: failed to fetch', {error})
      if (isServiceError(error)) {
        showServiceErrorToast()
      }
      // Mark as fetched to avoid retry loops
      for (const did of newDids) {
        fetchedDidsRef.current.add(did)
      }
    } finally {
      isFetchingRef.current = false
    }
  }, [agent, currentAccount?.did, feedQueryKey, options?.enabled, queryClient])

  // Watch for feed data changes
  useEffect(() => {
    // Initial enhancement
    enhanceProfiles()

    // Subscribe to cache updates for this query
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (
        event.type === 'updated' &&
        event.query.queryKey[0] === RQKEY_ROOT &&
        JSON.stringify(event.query.queryKey) === JSON.stringify(feedQueryKey)
      ) {
        enhanceProfiles()
      }
    })

    return unsubscribe
  }, [enhanceProfiles, feedQueryKey, queryClient])

  // Clear fetched DIDs on refetch (pull-to-refresh)
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (
        event.type === 'updated' &&
        event.action?.type === 'fetch' &&
        JSON.stringify(event.query.queryKey) === JSON.stringify(feedQueryKey)
      ) {
        // Query is refetching - clear tracked DIDs to allow re-enhancement
        fetchedDidsRef.current.clear()
      }
    })

    return unsubscribe
  }, [feedQueryKey, queryClient])
}

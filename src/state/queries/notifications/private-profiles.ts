import {AppBskyFeedDefs} from '@atproto/api'
import {InfiniteData, QueryKey, useQueryClient} from '@tanstack/react-query'

import {
  mergePrivateProfileData,
  PrivateProfileData,
} from '#/lib/api/private-profiles'
import {usePrivateProfileEnhancer} from '../use-private-profile-enhancer'
import {getEmbeddedPost} from '../util'
import {RQKEY_ROOT} from './feed'
import {FeedPage} from './types'

/**
 * Extracts unique author DIDs from notification pages.
 * Includes notification authors, subject authors (post authors), and quoted post authors.
 */
export function extractDidsFromNotifications(pages: FeedPage[]): Set<string> {
  const dids = new Set<string>()

  for (const page of pages) {
    for (const item of page.items) {
      // Notification author (who triggered the notification)
      dids.add(item.notification.author.did)

      // Additional notification authors (grouped notifications)
      if (item.additional) {
        for (const additional of item.additional) {
          dids.add(additional.author.did)
        }
      }

      // Subject author (for post-related notifications)
      if (item.type !== 'starterpack-joined' && item.subject) {
        const postView = item.subject as AppBskyFeedDefs.PostView
        if (postView.author) {
          dids.add(postView.author.did)
        }

        // Quoted post author
        const quotedPost = getEmbeddedPost(postView.embed)
        if (quotedPost?.author) {
          dids.add(quotedPost.author.did)
        }
      }
    }
  }

  return dids
}

/**
 * Updates the notification cache with private profile data.
 * Mutates FeedPage to trigger re-render.
 */
export function updateNotificationCacheWithPrivateProfiles(
  queryClient: ReturnType<typeof useQueryClient>,
  notificationQueryKey: QueryKey,
  privateProfiles: Map<string, PrivateProfileData>,
): boolean {
  const queryData =
    queryClient.getQueryData<InfiniteData<FeedPage>>(notificationQueryKey)

  if (!queryData?.pages) return false

  let modified = false

  for (const page of queryData.pages) {
    for (const item of page.items) {
      // Enhance notification author
      const authorPrivate = privateProfiles.get(item.notification.author.did)
      if (authorPrivate) {
        item.notification.author = mergePrivateProfileData(
          item.notification.author,
          authorPrivate,
        )
        modified = true
      }

      // Enhance additional notification authors
      if (item.additional) {
        for (const additional of item.additional) {
          const additionalPrivate = privateProfiles.get(additional.author.did)
          if (additionalPrivate) {
            additional.author = mergePrivateProfileData(
              additional.author,
              additionalPrivate,
            )
            modified = true
          }
        }
      }

      // Enhance subject author (for post-related notifications)
      if (item.type !== 'starterpack-joined' && item.subject) {
        const postView = item.subject as AppBskyFeedDefs.PostView
        if (postView.author) {
          const subjectPrivate = privateProfiles.get(postView.author.did)
          if (subjectPrivate) {
            postView.author = mergePrivateProfileData(
              postView.author,
              subjectPrivate,
            )
            modified = true
          }
        }

        // Enhance quoted post author
        const quotedPost = getEmbeddedPost(postView.embed)
        if (quotedPost?.author) {
          const quotedPrivate = privateProfiles.get(quotedPost.author.did)
          if (quotedPrivate) {
            quotedPost.author = mergePrivateProfileData(
              quotedPost.author,
              quotedPrivate,
            )
            modified = true
          }
        }
      }
    }
  }

  if (modified) {
    // Trigger re-render by setting data with new reference
    queryClient.setQueryData(notificationQueryKey, {...queryData})
  }

  return modified
}

/**
 * Hook to enhance notification author profiles with private profile data.
 *
 * Watches the notification cache for changes, extracts unique author DIDs,
 * batch fetches their private profiles, and updates the cache.
 *
 * @param notificationQueryKey - The React Query key for notifications (from RQKEY)
 * @param options - Optional configuration
 */
export function useNotificationPrivateProfiles(
  notificationQueryKey: QueryKey,
  options?: {enabled?: boolean},
) {
  usePrivateProfileEnhancer<FeedPage>({
    queryKey: notificationQueryKey,
    rqKeyRoot: RQKEY_ROOT,
    extractDids: extractDidsFromNotifications,
    updateCache: updateNotificationCacheWithPrivateProfiles,
    enabled: options?.enabled,
    logPrefix: 'useNotificationPrivateProfiles',
  })
}

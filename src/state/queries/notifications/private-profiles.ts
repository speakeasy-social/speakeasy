import {AppBskyFeedDefs} from '@atproto/api'
import {QueryKey} from '@tanstack/react-query'

import {
  mergePrivateProfileData,
  PrivateProfileData,
} from '#/lib/api/private-profiles'
import {usePrivateProfileFetcher} from '../use-private-profile-fetcher'
import {getEmbeddedPost} from '../util'
import {RQKEY_ROOT} from './feed'
import {FeedNotification, FeedPage} from './types'

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
 * Pure function to merge private profile data into a single notification item.
 * Returns a new item with private profiles merged into:
 * notification author, additional authors, subject author, quoted post author.
 */
export function mergeNotificationItemWithPrivateProfiles(
  item: FeedNotification,
  getProfile: (did: string) => PrivateProfileData | undefined,
): FeedNotification {
  let itemModified = false
  let newNotification = item.notification
  let newAdditional = item.additional
  let newSubject = item.subject

  // Enhance notification author
  const authorPrivate = getProfile(item.notification.author.did)
  if (authorPrivate) {
    newNotification = {
      ...item.notification,
      author: mergePrivateProfileData(item.notification.author, authorPrivate),
    }
    itemModified = true
  }

  // Enhance additional notification authors
  if (item.additional) {
    const mappedAdditional = item.additional.map(additional => {
      const additionalPrivate = getProfile(additional.author.did)
      if (additionalPrivate) {
        itemModified = true
        return {
          ...additional,
          author: mergePrivateProfileData(additional.author, additionalPrivate),
        }
      }
      return additional
    })
    if (itemModified) {
      newAdditional = mappedAdditional
    }
  }

  // Enhance subject author (for post-related notifications)
  if (item.type !== 'starterpack-joined' && item.subject) {
    const postView = item.subject as AppBskyFeedDefs.PostView
    if (postView.author) {
      const subjectPrivate = getProfile(postView.author.did)
      if (subjectPrivate) {
        newSubject = {
          ...postView,
          author: mergePrivateProfileData(postView.author, subjectPrivate),
        }
        itemModified = true
      }
    }

    // Enhance quoted post author
    const quotedPost = getEmbeddedPost(postView.embed)
    if (quotedPost?.author) {
      const quotedPrivate = getProfile(quotedPost.author.did)
      if (quotedPrivate) {
        // Create new subject with a new embed containing the merged quoted author
        // We need to clone since getEmbeddedPost returns a reference
        const mergedAuthor = mergePrivateProfileData(
          quotedPost.author,
          quotedPrivate,
        )
        // Only update subject if we haven't already
        if (!newSubject || newSubject === item.subject) {
          newSubject = {...postView}
        }
        // Mutate the quoted post author within the new subject's embed
        const newQuotedPost = getEmbeddedPost(
          (newSubject as AppBskyFeedDefs.PostView).embed,
        )
        if (newQuotedPost) {
          newQuotedPost.author = mergedAuthor
        }
        itemModified = true
      }
    }
  }

  if (itemModified) {
    return {
      ...item,
      notification: newNotification,
      additional: newAdditional,
      subject: newSubject,
    } as FeedNotification
  }
  return item
}

/**
 * Hook to fetch private profiles for notification authors.
 *
 * Watches the notification cache for changes, extracts unique author DIDs,
 * and batch fetches their private profiles into the module-level cache.
 *
 * Does NOT mutate the notification query cache — merging happens
 * in the feed.ts select callback via mergeNotificationItemWithPrivateProfiles.
 */
export function useNotificationPrivateProfiles(
  notificationQueryKey: QueryKey,
  options?: {enabled?: boolean},
) {
  usePrivateProfileFetcher<FeedPage>({
    queryKey: notificationQueryKey,
    rqKeyRoot: RQKEY_ROOT,
    extractDids: extractDidsFromNotifications,
    enabled: options?.enabled,
    logPrefix: 'useNotificationPrivateProfiles',
  })
}

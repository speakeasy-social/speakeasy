import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyFeedLike,
  AppBskyFeedPost,
  AppBskyFeedRepost,
  AppBskyGraphDefs,
  AppBskyGraphStarterpack,
  AppBskyNotificationListNotifications,
  BskyAgent,
  moderateNotification,
  ModerationOpts,
} from '@atproto/api'
import {QueryClient} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {mergeCursors, parseCursor} from '#/lib/api/cursor'
import {
  decryptPosts,
  fetchEncryptedPosts,
  formatPostView,
} from '#/lib/api/feed/private-posts'
import {
  listPrivateNotifications,
  PrivateNotification,
} from '#/lib/api/private-notifications'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {getPrivateKeyOrWarn} from '#/lib/api/user-keys'
import {awaitWithTimeout} from '#/lib/async/timeout'
import {labelIsHideableOffense} from '#/lib/moderation'
import {precacheProfile} from '../profile'
import {FeedNotification, FeedPage, NotificationType} from './types'

const GROUPABLE_REASONS = ['like', 'repost', 'follow']
const MS_1HR = 1e3 * 60 * 60
const MS_2DAY = MS_1HR * 48

// exported api
// =

export async function fetchPage({
  agent,
  cursor,
  limit,
  queryClient,
  moderationOpts,
  fetchAdditionalData,
  reasons,
}: {
  agent: BskyAgent
  cursor: string | undefined
  limit: number
  queryClient: QueryClient
  moderationOpts: ModerationOpts | undefined
  fetchAdditionalData: boolean
  reasons: string[]
}): Promise<{
  page: FeedPage
  indexedAt: string | undefined
}> {
  const [regularCursor, privateCursor] = parseCursor(cursor)

  // Fetch both regular and private notifications
  const [regularRes, privateRes] = await Promise.all([
    regularCursor === 'EOF'
      ? Promise.resolve({
          data: {
            notifications: [],
            cursor: 'EOF',
            priority: false,
            seenAt: null,
          },
        })
      : agent.listNotifications({
          limit,
          cursor: regularCursor,
          reasons,
        }),
    privateCursor === 'EOF'
      ? Promise.resolve({
          notifications: [],
          cursor: 'EOF',
        })
      : awaitWithTimeout(
          listPrivateNotifications(agent, privateCursor, limit),
          4000, // 4 second timeout - ignore private notifications if API is slow
          {
            notifications: [],
            cursor: 'EOF',
          },
        ),
  ])

  const mergedCursor = mergeCursors(regularRes.data.cursor, privateRes.cursor)

  const indexedAt = regularRes.data.notifications[0]?.indexedAt

  // Filter out notifs by mod rules
  const regularNotifs = regularRes.data.notifications.filter(
    notif => !shouldFilterNotif(notif, moderationOpts),
  )

  // Convert private notifications to the same format as regular notifications
  const privateNotifs = privateRes.notifications.map(formatPrivateNotification)

  // Combine and sort notifications by date
  const allNotifs = [...regularNotifs, ...privateNotifs].sort(
    (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
  )

  // Group notifications which are essentially similar (follows, likes on a post)
  let notifsGrouped = groupNotifications(allNotifs)

  // We fetch subjects of notifications (usually posts) now instead of lazily
  // in the UI to avoid relayouts
  if (fetchAdditionalData) {
    const subjects = await fetchSubjects(agent, notifsGrouped)
    for (const notif of notifsGrouped) {
      if (notif.subjectUri) {
        if (
          notif.type === 'starterpack-joined' &&
          notif.notification.reasonSubject
        ) {
          notif.subject = subjects.starterPacks.get(
            notif.notification.reasonSubject,
          )
        } else {
          notif.subject = subjects.posts.get(notif.subjectUri)
          if (notif.subject) {
            precacheProfile(queryClient, notif.subject.author)
          } else {
            console.log('no subject', notif.subjectUri, notif)
          }
        }
      }
    }
  }

  let seenAt = regularRes.data.seenAt
    ? new Date(regularRes.data.seenAt)
    : new Date()
  if (Number.isNaN(seenAt.getTime())) {
    seenAt = new Date()
  }

  return {
    page: {
      cursor: mergedCursor,
      seenAt,
      items: notifsGrouped,
      priority: regularRes.data.priority ?? false,
    },
    indexedAt,
  }
}

// internal methods
// =

export function shouldFilterNotif(
  notif: AppBskyNotificationListNotifications.Notification,
  moderationOpts: ModerationOpts | undefined,
): boolean {
  const containsImperative = !!notif.author.labels?.some(labelIsHideableOffense)
  if (containsImperative) {
    return true
  }
  if (!moderationOpts) {
    return false
  }
  if (notif.author.viewer?.following) {
    return false
  }
  return moderateNotification(notif, moderationOpts).ui('contentList').filter
}

export function groupNotifications(
  notifs: AppBskyNotificationListNotifications.Notification[],
): FeedNotification[] {
  const groupedNotifs: FeedNotification[] = []
  for (const notif of notifs) {
    const ts = +new Date(notif.indexedAt)
    let grouped = false
    if (GROUPABLE_REASONS.includes(notif.reason)) {
      for (const groupedNotif of groupedNotifs) {
        const ts2 = +new Date(groupedNotif.notification.indexedAt)
        if (
          Math.abs(ts2 - ts) < MS_2DAY &&
          notif.reason === groupedNotif.notification.reason &&
          notif.reasonSubject === groupedNotif.notification.reasonSubject &&
          notif.author.did !== groupedNotif.notification.author.did
        ) {
          const nextIsFollowBack =
            notif.reason === 'follow' && notif.author.viewer?.following
          const prevIsFollowBack =
            groupedNotif.notification.reason === 'follow' &&
            groupedNotif.notification.author.viewer?.following
          const shouldUngroup = nextIsFollowBack || prevIsFollowBack
          if (!shouldUngroup) {
            groupedNotif.additional = groupedNotif.additional || []
            groupedNotif.additional.push(notif)
            grouped = true
            break
          }
        }
      }
    }
    if (!grouped) {
      const type = toKnownType(notif)
      if (type !== 'starterpack-joined') {
        groupedNotifs.push({
          _reactKey: `notif-${notif.uri}`,
          type,
          notification: notif,
          subjectUri: getSubjectUri(type, notif),
        })
      } else {
        groupedNotifs.push({
          _reactKey: `notif-${notif.uri}`,
          type: 'starterpack-joined',
          notification: notif,
          subjectUri: notif.uri,
        })
      }
    }
  }
  return groupedNotifs
}

async function fetchSubjects(
  agent: BskyAgent,
  groupedNotifs: FeedNotification[],
): Promise<{
  posts: Map<string, AppBskyFeedDefs.PostView>
  starterPacks: Map<string, AppBskyGraphDefs.StarterPackViewBasic>
}> {
  const postUris = new Set<string>()
  const packUris = new Set<string>()
  const privatePostUris = new Set<string>()
  for (const notif of groupedNotifs) {
    if (notif.subjectUri?.includes('app.bsky.feed.post')) {
      postUris.add(notif.subjectUri)
    } else if (notif.subjectUri?.includes('social.spkeasy.feed.privatePost')) {
      privatePostUris.add(notif.subjectUri)
    } else if (
      notif.notification.reasonSubject?.includes('app.bsky.graph.starterpack')
    ) {
      packUris.add(notif.notification.reasonSubject)
    }
  }

  // Only fetch private posts if there are any to fetch, with timeout protection
  const privatePostsPromise =
    privatePostUris.size > 0
      ? awaitWithTimeout(
          fetchEncryptedPosts(agent, {
            uris: Array.from(privatePostUris),
          }).then(async res => {
            const privateKey = await getPrivateKeyOrWarn(
              agent.assertDid,
              options => callSpeakeasyApiWithAgent(agent, options),
            )
            if (!privateKey) {
              return []
            }
            const encryptedSessionKeys = res.encryptedSessionKeys
            return await decryptPosts(
              agent,
              res.encryptedPosts,
              encryptedSessionKeys,
              privateKey,
            )
          }),
          3000, // 3 second timeout
          [], // Return empty array on timeout
        )
      : Promise.resolve([])

  const postUriChunks = chunk(Array.from(postUris), 25)
  const packUriChunks = chunk(Array.from(packUris), 25)
  const postsChunks = await Promise.all(
    postUriChunks.map(uris =>
      agent.app.bsky.feed.getPosts({uris}).then(res => res.data.posts),
    ),
  )
  const packsChunks = await Promise.all(
    packUriChunks.map(uris =>
      agent.app.bsky.graph
        .getStarterPacks({uris})
        .then(res => res.data.starterPacks),
    ),
  )
  const postsMap = new Map<string, AppBskyFeedDefs.PostView>()
  const packsMap = new Map<string, AppBskyGraphDefs.StarterPackView>()
  for (const post of postsChunks.flat()) {
    if (
      AppBskyFeedPost.isRecord(post.record) &&
      AppBskyFeedPost.validateRecord(post.record).success
    ) {
      postsMap.set(post.uri, post)
    }
  }
  for (const pack of packsChunks.flat()) {
    if (AppBskyGraphStarterpack.isRecord(pack.record)) {
      packsMap.set(pack.uri, pack)
    }
  }

  const authorProfileMap = new Map<string, AppBskyActorDefs.ProfileViewBasic>(
    groupedNotifs.map(notif => [
      notif.notification.author.did,
      notif.notification.author,
    ]),
  )

  const privatePosts = await privatePostsPromise

  // Merge private posts into the posts map
  for (const post of privatePosts) {
    const postView = formatPostView(
      post,
      authorProfileMap.get(post.authorDid),
      '',
      undefined,
    )
    if (post.uri) {
      postsMap.set(post.uri, postView)
    }
  }

  return {
    posts: postsMap,
    starterPacks: packsMap,
  }
}

function toKnownType(
  notif: AppBskyNotificationListNotifications.Notification,
): NotificationType {
  if (notif.reason === 'like') {
    if (notif.reasonSubject?.includes('feed.generator')) {
      return 'feedgen-like'
    }
    return 'post-like'
  }
  if (
    notif.reason === 'repost' ||
    notif.reason === 'mention' ||
    notif.reason === 'reply' ||
    notif.reason === 'quote' ||
    notif.reason === 'follow' ||
    notif.reason === 'starterpack-joined'
  ) {
    return notif.reason as NotificationType
  }
  return 'unknown'
}

function getSubjectUri(
  type: NotificationType,
  notif: AppBskyNotificationListNotifications.Notification,
): string | undefined {
  if (type === 'reply' || type === 'quote' || type === 'mention') {
    return notif.uri
  } else if (type === 'post-like' || type === 'repost') {
    if (
      AppBskyFeedRepost.isRecord(notif.record) ||
      AppBskyFeedLike.isRecord(notif.record)
    ) {
      return typeof notif.record.subject?.uri === 'string'
        ? notif.record.subject?.uri
        : undefined
    }
  } else if (type === 'feedgen-like') {
    return notif.reasonSubject
  }
}

function formatPrivateNotification(
  notif: PrivateNotification,
): AppBskyNotificationListNotifications.Notification {
  let formattedNotification

  if (notif.reason === 'reply') {
    formattedNotification = {
      ...notif,
      uri: notif.reasonSubject,
      record: {
        $type: `app.bsky.feed.post`,
        author: notif.author,
      },
    }
  } else if (notif.reason === 'like') {
    formattedNotification = {
      ...notif,
      uri: `at://${notif.author.did}/social.spkeasy.feed.like/${notif.createdAt}`,
      record: {
        $type: `app.bsky.feed.like`,
        subject: {
          uri: notif.reasonSubject,
          validationStatus: 'valid',
        },
      },
    }
  }

  return {
    ...notif,
    isPrivate: true,
    ...formattedNotification,
  }
}

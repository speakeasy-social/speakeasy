import {AppBskyNotificationListNotifications, BskyAgent} from '@atproto/api'

import {
  EncryptedPost,
  fetchProfiles,
  profileToAuthorView,
} from '#/lib/api/feed/private-posts'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'

export type PrivateNotification = {
  authorDid: string
  createdAt: string
  indexedAt: string
  readAt: string
  isRead: boolean
  uri: string
  cid: string
  reason: string
  reasonSubject: string
  reasonSubjectUri: string
  record: any

  author: AppBskyNotificationListNotifications.Notification['author']
  post?: EncryptedPost
}

type PrivateNotificationResponse = {
  notifications: PrivateNotification[]
  cursor: string | undefined
}

export async function listPrivateNotifications(
  agent: BskyAgent,
  cursor: string | undefined,
  limit: number,
): Promise<PrivateNotificationResponse> {
  try {
    const res = (await Promise.race([
      callSpeakeasyApiWithAgent(agent, {
        api: 'social.spkeasy.notification.listNotifications',
        method: 'GET',
        query: {
          cursor,
          limit,
        },
      }),
      new Promise<PrivateNotificationResponse>((_resolve, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000)
      }),
    ])) as PrivateNotificationResponse

    // Fetch profiles for all notification authors
    const authorDids = [...new Set(res.notifications.map(n => n.authorDid))]
    const profileMap = await fetchProfiles(agent, authorDids)

    // Transform notifications with proper author details
    res.notifications.forEach((notif: PrivateNotification) => {
      const profile = profileMap.get(notif.authorDid)

      notif.isRead = !!notif.readAt
      notif.author = profileToAuthorView(notif.authorDid, profile)
      notif.indexedAt = notif.createdAt
    })
  } catch (error) {
    console.error('Error listing private notifications:', error)
    return {
      notifications: [],
      cursor: undefined,
    }
  }

  return res
}

export async function updatePrivateNotificationSeen(
  agent: BskyAgent,
  time: string,
) {
  return callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.notification.updateSeen',
    method: 'POST',
    body: {
      seenAt: time,
    },
  })
}

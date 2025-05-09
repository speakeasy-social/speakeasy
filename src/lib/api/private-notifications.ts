import {AppBskyNotificationListNotifications, BskyAgent} from '@atproto/api'

import {fetchProfiles, profileToAuthorView} from '#/lib/api/feed/private-posts'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'

export type PrivateNotification = {
  authorDid: string
  createdAt: string
  isRead: boolean
  author: AppBskyNotificationListNotifications.Notification['author']
  indexedAt: string
  uri: string
  cid: string
  reason: string
  record: any
}

type PrivateNotificationResponse = {
  notifications: PrivateNotification[]
}

export async function listPrivateNotifications(
  agent: BskyAgent,
): Promise<PrivateNotificationResponse> {
  const res = (await callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.notification.listNotifications',
    method: 'GET',
  })) as PrivateNotificationResponse

  // Fetch profiles for all notification authors
  const authorDids = [...new Set(res.notifications.map(n => n.authorDid))]
  const profileMap = await fetchProfiles(agent, authorDids)

  // Transform notifications with proper author details
  res.notifications.forEach((notif: PrivateNotification) => {
    const profile = profileMap.get(notif.authorDid)
    notif.author = profileToAuthorView(notif.authorDid, profile)
    notif.indexedAt = notif.createdAt
  })

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

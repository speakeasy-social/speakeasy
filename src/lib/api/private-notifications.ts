import {BskyAgent} from '@atproto/api'

import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'

export async function listPrivateNotifications(agent: BskyAgent) {
  return callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.notification.listNotifications',
    method: 'GET',
  })
}

export async function updatePrivateNotificationSeen(agent: BskyAgent) {
  return callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.notification.updateSeen',
    method: 'POST',
    body: {
      seenAt: new Date().toISOString(),
    },
  })
}

import {AtUri} from '@atproto/api'
import {BskyAgent} from '@atproto/api'

import {LOCAL_DEV_CDN, LOCAL_DEV_SERVICE, PROD_CDN} from '#/lib/constants'
import {BSKY_FEED_OWNER_DIDS} from '#/lib/constants'
import {isWeb} from '#/platform/detection'
import {UsePreferencesQueryResponse} from '#/state/queries/preferences'

let debugTopics = ''
if (isWeb && typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search)
  debugTopics = params.get('debug_topics') ?? ''
}

export function createBskyTopicsHeader(userInterests?: string) {
  return {
    'X-Bsky-Topics': debugTopics || userInterests || '',
  }
}

export function aggregateUserInterests(
  preferences?: UsePreferencesQueryResponse,
) {
  return preferences?.interests?.tags?.join(',') || ''
}

export function isBlueskyOwnedFeed(feedUri: string) {
  const uri = new AtUri(feedUri)
  return BSKY_FEED_OWNER_DIDS.includes(uri.host)
}

export function getBaseCdnUrl(agent: BskyAgent): string {
  return agent.service.toString() === `${LOCAL_DEV_SERVICE}/`
    ? `${LOCAL_DEV_CDN}/speakeasy-develop`
    : `${PROD_CDN}/user-content`
}

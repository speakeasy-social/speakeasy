import {AppBskyFeedDefs} from '@atproto/api'

export interface FeedAPIResponse {
  cursor?: string
  feed: AppBskyFeedDefs.FeedViewPost[]
}

export interface FeedAPI {
  peekLatest(): Promise<AppBskyFeedDefs.FeedViewPost>
  fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse>
}

export interface ReasonFeedSource {
  $type: 'reasonFeedSource'
  uri: string
  href: string
}

export function isReasonFeedSource(v: unknown): v is ReasonFeedSource {
  return (
    !!v &&
    typeof v === 'object' &&
    '$type' in v &&
    v.$type === 'reasonFeedSource'
  )
}

export function isReasonPrivateRepost(v: unknown): v is {
  $type: 'social.spkeasy.feed.defs#reasonPrivateRepost'
  by: any
  indexedAt: string
} {
  return (
    !!v &&
    typeof v === 'object' &&
    '$type' in v &&
    v.$type === 'social.spkeasy.feed.defs#reasonPrivateRepost'
  )
}

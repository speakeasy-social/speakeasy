/**
 * Post shadow state — lightweight module with no query-layer imports.
 *
 * Extracted from post-shadow.ts so that session/index.tsx can import
 * clearAllShadows without pulling in the heavy notifications/feed →
 * post-feed → themes import chain (which creates a circular dependency
 * back to session).
 */
import {
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyFeedDefs,
} from '@atproto/api'

export interface PostShadow {
  likeUri: string | undefined
  repostUri: string | undefined
  isDeleted: boolean
  embed: AppBskyEmbedRecord.View | AppBskyEmbedRecordWithMedia.View | undefined
  pinned: boolean
}

export const POST_TOMBSTONE = Symbol('PostTombstone')

export const shadows: WeakMap<
  AppBskyFeedDefs.PostView,
  Partial<PostShadow>
> = new WeakMap()

export const shadowsByUri = new Map<string, Partial<PostShadow>>()

export function getShadow(post: AppBskyFeedDefs.PostView) {
  return shadows.get(post) ?? shadowsByUri.get(post.uri)
}

export function clearAllShadows() {
  shadowsByUri.clear()
}

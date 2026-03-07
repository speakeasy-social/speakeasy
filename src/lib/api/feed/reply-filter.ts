const MIN_LIKES_TO_SHOW = 2

/**
 * Determines whether a reply should be shown based on trust, follow
 * relationships, and engagement.
 *
 * A reply is shown if ANY of the following are true:
 * - The reply has at least MIN_LIKES_TO_SHOW likes
 * - The reply author is the current user
 * - The reply author is followed by the current user
 * - The reply author is trusted by the current user
 */
export function shouldShowReply({
  likeCount,
  authorDid,
  authorIsFollowed,
  userDid,
  trustedDids,
}: {
  likeCount: number
  authorDid: string
  authorIsFollowed: boolean
  userDid: string
  trustedDids: Set<string>
}): boolean {
  if (authorDid === userDid) return true
  if (authorIsFollowed) return true
  if (trustedDids.has(authorDid)) return true
  if (likeCount >= MIN_LIKES_TO_SHOW) return true
  return false
}

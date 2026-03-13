import {useMemo} from 'react'

import {FeedTuner} from '#/lib/api/feed-manip'
import {FeedDescriptor} from '../queries/post-feed'
import {usePreferencesQuery} from '../queries/preferences'
import {useTrustedQuery} from '../queries/trusted'
import {useSession} from '../session'
import {useLanguagePrefs} from './languages'

export function useFeedTuners(feedDesc: FeedDescriptor) {
  const langPrefs = useLanguagePrefs()
  const {data: preferences} = usePreferencesQuery()
  const {currentAccount} = useSession()
  const {data: trustedUsers} = useTrustedQuery(currentAccount?.did)

  return useMemo(() => {
    const userDid = currentAccount?.did || ''
    const trustedDids = new Set(trustedUsers?.map(t => t.recipientDid) ?? [])

    if (feedDesc.startsWith('author')) {
      if (feedDesc.endsWith('|posts_with_replies')) {
        // TODO: Do this on the server instead.
        return [FeedTuner.removeReposts]
      }
    }
    if (feedDesc.startsWith('feedgen')) {
      return [
        FeedTuner.safeRepliesOnly({userDid, trustedDids}),
        FeedTuner.preferredLangOnly(langPrefs.contentLanguages),
      ]
    }
    if (
      feedDesc === 'following' ||
      feedDesc.startsWith('list') ||
      feedDesc === 'friends-pics'
    ) {
      const feedTuners = [FeedTuner.removeOrphans]

      if (preferences?.feedViewPrefs.hideReposts) {
        feedTuners.push(FeedTuner.removeReposts)
      }
      if (preferences?.feedViewPrefs.hideReplies) {
        feedTuners.push(FeedTuner.removeReplies)
      } else {
        feedTuners.push(
          FeedTuner.followedRepliesOnly({
            userDid,
          }),
        )
      }
      if (preferences?.feedViewPrefs.hideQuotePosts) {
        feedTuners.push(FeedTuner.removeQuotePosts)
      }
      feedTuners.push(FeedTuner.dedupThreads)

      if (feedDesc === 'friends-pics') {
        feedTuners.push(FeedTuner.mediaOnly)
      }

      return feedTuners
    }
    return []
  }, [feedDesc, currentAccount, preferences, langPrefs, trustedUsers])
}

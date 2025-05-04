import {useEffect} from 'react'
import {AppBskyGraphGetFollows} from '@atproto/api'

import {logger} from '#/logger'
import {useAgent, useSession} from '#/state/session'

// In-memory cache of follower DIDs
let cachedFollowerDids: string[] = []
let isFetching = false
let hasFetched = false
let lastAccountDid: string | undefined
let retryCount = 0
const MAX_RETRIES = 3
let cachedFollowerDidsPromise: Promise<string[]>

export async function getCachedFollowerDids() {
  return cachedFollowerDidsPromise
}

export function removeCachedFollowerDid(did: string) {
  // Update cache
  const index = cachedFollowerDids.indexOf(did)
  if (index !== -1) {
    cachedFollowerDids.splice(index, 1)
  }
}

export function addCachedFollowerDid(did: string) {
  if (!cachedFollowerDids.includes(did)) {
    cachedFollowerDids.push(did)
  }
}

export function usePrefetchFollowers() {
  const {currentAccount} = useSession()
  const agent = useAgent()

  useEffect(() => {
    // Reset if account changed
    if (currentAccount?.did !== lastAccountDid) {
      hasFetched = false
      retryCount = 0
      lastAccountDid = currentAccount?.did
    }

    console.log('usePrefetchFollowers', {
      currentAccount,
      hasFetched,
      isFetching,
    })

    if (!currentAccount?.did || hasFetched || isFetching) return

    hasFetched = true
    isFetching = true

    async function fetchAllFollowers() {
      let allFollowDids: string[] = [currentAccount!.did]
      let cursor: string | undefined

      console.log('prefetching followers')

      try {
        do {
          const res = await agent.api.app.bsky.graph.getFollows({
            actor: currentAccount!.did,
            limit: 100,
            ...(cursor ? {cursor} : {}),
          })

          const data = res.data as AppBskyGraphGetFollows.OutputSchema
          const followDids = data.follows.map(follow => follow.did)
          allFollowDids.push(...followDids)
          cursor = data.cursor
        } while (cursor)

        cachedFollowerDids = allFollowDids
        logger.debug('Successfully cached follower DIDs', {
          count: allFollowDids.length,
        })
      } catch (error) {
        // If we encounter any error, cache what we have so far
        cachedFollowerDids = allFollowDids
        logger.error('Error prefetching followers:', {error})

        // Retry with exponential backoff if we haven't exceeded max retries
        if (retryCount < MAX_RETRIES) {
          retryCount++
          const backoffTime = Math.pow(2, retryCount) * 2000 // 4s, 8s, 16s
          logger.debug('Retrying follower fetch', {
            attempt: retryCount,
            backoffTime,
          })

          setTimeout(() => {
            hasFetched = false
            isFetching = false
          }, backoffTime)
        }
      } finally {
        console.log('fetchAllFollowers done')
        isFetching = false
        return cachedFollowerDids
      }
    }

    cachedFollowerDidsPromise = fetchAllFollowers()
  }, [currentAccount, agent])
}

import {useEffect} from 'react'
import {AppBskyGraphGetFollows, BskyAgent} from '@atproto/api'

import {logger} from '#/logger'
import {useAgent, useSession} from '#/state/session'

// In-memory cache of follower DIDs
let cachedFollowerDids: string[] = []
let isFetching = false
let hasFetched = false
let lastAccountDid: string | undefined
let retryCount = 0
const MAX_RETRIES = 3
let cachedFollowerDidsPromise: Promise<string[]> | undefined

export async function getCachedFollowerDids(agent: BskyAgent, userDid: string) {
  // If we're out of sync with the usePrefetchFollowers
  // function, abort
  if (!userDid) return []
  if (userDid !== lastAccountDid) {
    logger.error('getCachedFollowerDids called out of sync', {
      userDid,
      lastAccountDid,
    })
    return []
  }

  if (cachedFollowerDidsPromise) {
    return cachedFollowerDidsPromise
  }

  if (!hasFetched) {
    cachedFollowerDidsPromise = fetchAllFollowers(agent, userDid)
    return cachedFollowerDidsPromise
  }

  return cachedFollowerDids
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

async function fetchAllFollowers(agent: BskyAgent, userDid: string) {
  let allFollowDids: string[] = [userDid]
  let cursor: string | undefined

  console.log('prefetching followers')

  hasFetched = true

  do {
    try {
      const res = await agent.api.app.bsky.graph.getFollows({
        actor: userDid,
        limit: 100,
        ...(cursor ? {cursor} : {}),
      })

      // If the session has changed while we
      // were fetching, abort to avoid polluting
      // the cache
      // (and a new loop will be started)
      if (userDid !== lastAccountDid) return []

      const data = res.data as AppBskyGraphGetFollows.OutputSchema
      const followDids = data.follows.map(follow => follow.did)
      allFollowDids.push(...followDids)
      cursor = data.cursor

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
        const backoffTime = Math.pow(2, retryCount) * 500 // .5s, 1s, 2s
        logger.debug('Retrying follower fetch', {
          attempt: retryCount,
          backoffTime,
        })
        retryCount++

        // Pause for backoff
        await new Promise(resolve => setTimeout(resolve, backoffTime))
      } else {
        // If 3 retries fail, abort with what we have
        logger.error('Failed to fetch all followers after 3 retries', {
          userDid,
          cachedFollowerDids,
        })
        hasFetched = false
        break
      }
    }
  } while (cursor)

  isFetching = false

  // Clear the promise so stale data is not
  // returned in future
  cachedFollowerDidsPromise = undefined
  return cachedFollowerDids
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

    // This is called at the top level of the app
    // so only fetch once for pre-caching
    if (!currentAccount?.did || isFetching) return

    hasFetched = true
    isFetching = true

    cachedFollowerDidsPromise = fetchAllFollowers(agent, currentAccount.did)
  }, [currentAccount, agent])
}

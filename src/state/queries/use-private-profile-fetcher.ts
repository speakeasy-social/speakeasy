import {useCallback, useEffect, useRef} from 'react'
import {InfiniteData, QueryKey, useQueryClient} from '@tanstack/react-query'

import {getBaseCdnUrl} from '#/lib/api/feed/utils'
import {fetchPrivateProfiles} from '#/lib/api/private-profiles'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {isServiceError, showServiceErrorToast} from '#/lib/api/speakeasy-health'
import {logger} from '#/logger'
import {
  claimDids,
  isDidChecked,
  markDidsChecked,
  releaseDids,
  upsertCachedPrivateProfiles,
} from '#/state/cache/private-profile-cache'
import {useAgent, useSession} from '#/state/session'

export type ExtractDidsFn<TPage> = (pages: TPage[]) => Set<string>

export interface UsePrivateProfileFetcherOptions<TPage> {
  queryKey: QueryKey
  rqKeyRoot: string
  extractDids: ExtractDidsFn<TPage>
  enabled?: boolean
  logPrefix?: string
}

/**
 * Pure fetcher hook — watches a query cache for new DIDs, batch fetches
 * their private profiles, and stores results in the module-level cache.
 *
 * Does NOT mutate query caches. Consumers use `select` callbacks with
 * `usePrivateProfileCacheVersion` to merge at read time.
 */
export function usePrivateProfileFetcher<TPage>({
  queryKey,
  rqKeyRoot,
  extractDids,
  enabled = true,
  logPrefix = 'usePrivateProfileFetcher',
}: UsePrivateProfileFetcherOptions<TPage>) {
  const queryClient = useQueryClient()
  const agent = useAgent()
  const {currentAccount} = useSession()

  const isFetchingRef = useRef(false)

  const fetchProfiles = useCallback(async () => {
    if (!enabled) return
    if (!currentAccount?.did) return
    if (isFetchingRef.current) return

    const queryData = queryClient.getQueryData<InfiniteData<TPage>>(queryKey)
    if (!queryData?.pages?.length) return

    // Extract DIDs that haven't been checked yet
    const allDids = extractDids(queryData.pages)
    const newDids = Array.from(allDids).filter(did => !isDidChecked(did))

    if (newDids.length === 0) return

    // Claim DIDs for inflight dedup — skip any already being fetched
    const claimedDids = claimDids(newDids)
    if (claimedDids.length === 0) return

    isFetchingRef.current = true

    try {
      const call = (opts: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
        callSpeakeasyApiWithAgent(agent, opts)

      const privateProfiles = await fetchPrivateProfiles(
        claimedDids,
        currentAccount.did,
        call,
        getBaseCdnUrl(agent),
      )

      // Store results in the module-level cache
      if (privateProfiles.size > 0) {
        upsertCachedPrivateProfiles(privateProfiles)
      }

      // Mark all claimed DIDs as checked (null sentinel for those without data)
      markDidsChecked(claimedDids)
    } catch (error) {
      logger.error(`${logPrefix}: failed to fetch`, {error})
      if (isServiceError(error)) {
        showServiceErrorToast()
      }
      // Mark as checked to avoid retry loops
      markDidsChecked(claimedDids)
    } finally {
      releaseDids(claimedDids)
      isFetchingRef.current = false
    }
  }, [
    agent,
    currentAccount?.did,
    enabled,
    extractDids,
    logPrefix,
    queryClient,
    queryKey,
  ])

  // Watch for data changes and handle refetch clearing
  useEffect(() => {
    // Initial fetch
    fetchProfiles()

    const queryKeyStr = JSON.stringify(queryKey)

    // Subscribe to cache updates for this query
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (event.type !== 'updated') return
      if (event.query.queryKey[0] !== rqKeyRoot) return
      if (JSON.stringify(event.query.queryKey) !== queryKeyStr) return

      // On success: check for new DIDs and fetch
      fetchProfiles()
    })

    return unsubscribe
  }, [fetchProfiles, queryClient, queryKey, rqKeyRoot])
}

import {useCallback, useEffect, useRef} from 'react'
import {InfiniteData, QueryKey, useQueryClient} from '@tanstack/react-query'

import {
  fetchPrivateProfiles,
  PrivateProfileData,
} from '#/lib/api/private-profiles'
import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {isServiceError, showServiceErrorToast} from '#/lib/api/speakeasy-health'
import {logger} from '#/logger'
import {useAgent, useSession} from '#/state/session'

export type ExtractDidsFn<TPage> = (pages: TPage[]) => Set<string>

export type UpdateCacheFn = (
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
  privateProfiles: Map<string, PrivateProfileData>,
) => boolean

export interface UsePrivateProfileEnhancerOptions<TPage> {
  queryKey: QueryKey
  rqKeyRoot: string
  extractDids: ExtractDidsFn<TPage>
  updateCache: UpdateCacheFn
  enabled?: boolean
  logPrefix?: string
}

/**
 * Generic hook to enhance cached data with private profile information.
 *
 * Watches a query cache for changes, extracts unique author DIDs using the
 * provided extractor, batch fetches their private profiles, and updates
 * the cache using the provided updater.
 *
 * @param options - Configuration for the enhancer
 */
export function usePrivateProfileEnhancer<TPage>({
  queryKey,
  rqKeyRoot,
  extractDids,
  updateCache,
  enabled = true,
  logPrefix = 'usePrivateProfileEnhancer',
}: UsePrivateProfileEnhancerOptions<TPage>) {
  const queryClient = useQueryClient()
  const agent = useAgent()
  const {currentAccount} = useSession()

  // Track which DIDs we've already fetched to avoid refetching
  const fetchedDidsRef = useRef<Set<string>>(new Set())
  const isFetchingRef = useRef(false)

  // Reset fetched DIDs when query key descriptor changes
  const keyDescriptor = queryKey[1]
  useEffect(() => {
    fetchedDidsRef.current.clear()
  }, [keyDescriptor])

  const enhanceProfiles = useCallback(async () => {
    if (!enabled) return
    if (!currentAccount?.did) return
    if (isFetchingRef.current) return

    // Get current data
    const queryData = queryClient.getQueryData<InfiniteData<TPage>>(queryKey)

    if (!queryData?.pages?.length) return

    // Extract DIDs that haven't been fetched yet
    const allDids = extractDids(queryData.pages)
    const newDids = Array.from(allDids).filter(
      did => !fetchedDidsRef.current.has(did),
    )

    if (newDids.length === 0) return

    isFetchingRef.current = true

    try {
      const call = (opts: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
        callSpeakeasyApiWithAgent(agent, opts)

      const privateProfiles = await fetchPrivateProfiles(
        newDids,
        currentAccount.did,
        call,
      )

      // Mark all DIDs as fetched (even if no private profile found)
      for (const did of newDids) {
        fetchedDidsRef.current.add(did)
      }

      // Update cache if we got any private profiles
      if (privateProfiles.size > 0) {
        updateCache(queryClient, queryKey, privateProfiles)
      }
    } catch (error) {
      logger.error(`${logPrefix}: failed to fetch`, {error})
      if (isServiceError(error)) {
        showServiceErrorToast()
      }
      // Mark as fetched to avoid retry loops
      for (const did of newDids) {
        fetchedDidsRef.current.add(did)
      }
    } finally {
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
    updateCache,
  ])

  // Watch for data changes and handle refetch clearing
  useEffect(() => {
    // Initial enhancement
    enhanceProfiles()

    const queryKeyStr = JSON.stringify(queryKey)

    // Subscribe to cache updates for this query
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (event.type !== 'updated') return
      if (event.query.queryKey[0] !== rqKeyRoot) return
      if (JSON.stringify(event.query.queryKey) !== queryKeyStr) return

      // Clear tracked DIDs on refetch (pull-to-refresh)
      if (event.action?.type === 'fetch') {
        fetchedDidsRef.current.clear()
      }

      enhanceProfiles()
    })

    return unsubscribe
  }, [enhanceProfiles, queryClient, queryKey, rqKeyRoot])
}

import {useCallback} from 'react'
import {AppBskyActorDefs, AppBskyGraphGetFollows} from '@atproto/api'
import {
  InfiniteData,
  QueryClient,
  QueryKey,
  useInfiniteQuery,
} from '@tanstack/react-query'

import {
  mergePrivateProfileData,
  shouldCheckPrivateProfile,
} from '#/lib/api/private-profiles'
import {
  getCachedPrivateProfile,
  usePrivateProfileCacheVersion,
} from '#/state/cache/private-profile-cache'
import {STALE} from '#/state/queries'
import {usePrivateProfileFetcher} from '#/state/queries/use-private-profile-fetcher'
import {useAgent} from '#/state/session'

const PAGE_SIZE = 30
type RQPageParam = string | undefined

// TODO refactor invalidate on mutate?
const RQKEY_ROOT = 'profile-follows'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

export function extractDidsFromFollowsPages(
  pages: AppBskyGraphGetFollows.OutputSchema[],
): Set<string> {
  const dids = new Set<string>()
  for (const page of pages) {
    for (const follow of page.follows) {
      if (shouldCheckPrivateProfile(follow)) {
        dids.add(follow.did)
      }
    }
  }
  return dids
}

export function useFollowsPrivateProfiles(did: string | undefined) {
  usePrivateProfileFetcher<AppBskyGraphGetFollows.OutputSchema>({
    queryKey: RQKEY(did || ''),
    rqKeyRoot: RQKEY_ROOT,
    extractDids: extractDidsFromFollowsPages,
    enabled: !!did,
    logPrefix: 'useFollowsPrivateProfiles',
  })
}

export function useProfileFollowsQuery(
  did: string | undefined,
  {
    limit,
  }: {
    limit?: number
  } = {
    limit: PAGE_SIZE,
  },
) {
  const agent = useAgent()
  usePrivateProfileCacheVersion()

  return useInfiniteQuery<
    AppBskyGraphGetFollows.OutputSchema,
    Error,
    InfiniteData<AppBskyGraphGetFollows.OutputSchema>,
    QueryKey,
    RQPageParam
  >({
    staleTime: STALE.MINUTES.ONE,
    queryKey: RQKEY(did || ''),
    async queryFn({pageParam}: {pageParam: RQPageParam}) {
      const res = await agent.app.bsky.graph.getFollows({
        actor: did || '',
        limit: limit || PAGE_SIZE,
        cursor: pageParam,
      })
      return res.data
    },
    initialPageParam: undefined,
    getNextPageParam: lastPage => lastPage.cursor,
    enabled: !!did,
    select: useCallback(
      (data: InfiniteData<AppBskyGraphGetFollows.OutputSchema>) => {
        return {
          ...data,
          pages: data.pages.map(page => ({
            ...page,
            follows: page.follows.map(follow =>
              mergePrivateProfileData(
                follow,
                getCachedPrivateProfile(follow.did),
              ),
            ),
          })),
        }
      },
      [],
    ),
  })
}

export function* findAllProfilesInQueryData(
  queryClient: QueryClient,
  did: string,
): Generator<AppBskyActorDefs.ProfileView, void> {
  const queryDatas = queryClient.getQueriesData<
    InfiniteData<AppBskyGraphGetFollows.OutputSchema>
  >({
    queryKey: [RQKEY_ROOT],
  })
  for (const [_queryKey, queryData] of queryDatas) {
    if (!queryData?.pages) {
      continue
    }
    for (const page of queryData?.pages) {
      for (const follow of page.follows) {
        if (follow.did === did) {
          yield follow
        }
      }
    }
  }
}

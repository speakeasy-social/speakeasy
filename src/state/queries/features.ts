import {useQuery} from '@tanstack/react-query'

import {getFeatures} from '#/lib/api/speakeasy'
import {useAgent} from '#/state/session'

/** Set to true to require an invite code before users can post to trusted audience */
export const PRIVATE_POSTS_INVITE_REQUIRED = false

const RQKEY = () => ['features']

export function useFeaturesQuery() {
  const agent = useAgent()

  return useQuery({
    queryKey: RQKEY(),
    queryFn: async () => {
      return getFeatures(agent)
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

export function useCanPostPrivate() {
  const agent = useAgent()
  const result = useQuery({
    queryKey: RQKEY(),
    queryFn: async () => getFeatures(agent),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    enabled: PRIVATE_POSTS_INVITE_REQUIRED,
  })

  if (!PRIVATE_POSTS_INVITE_REQUIRED) {
    return {canPostPrivate: true, isFeaturesPending: false}
  }

  const canPostPrivate = (result.data ?? []).some(
    f => f.key === 'private-posts' && f.value === 'true',
  )
  return {canPostPrivate, isFeaturesPending: result.isPending}
}

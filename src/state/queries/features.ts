import {useQuery} from '@tanstack/react-query'

import {getFeatures} from '#/lib/api/speakeasy'
import {useAgent} from '#/state/session'

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

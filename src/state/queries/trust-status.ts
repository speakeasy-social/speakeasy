import {useQuery} from '@tanstack/react-query'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {STALE} from '#/state/queries'
import {useAgent} from '#/state/session'

const RQKEY_ROOT = 'trust-status'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

type TrustedResponse = {
  trusted: Array<{recipientDid: string}>
}

export function useTrustStatusQuery(did: string) {
  const agent = useAgent()
  const {call} = useSpeakeasyApi()

  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.THIRTY,
    queryKey: RQKEY(did || ''),
    queryFn: async () => {
      if (!did) return false

      const data = (await call({
        api: 'social.spkeasy.graph.getTrusted',
        query: {
          authorDid: agent.did!,
          recipientDid: did,
        },
      })) as TrustedResponse
      return data.trusted.length > 0
    },
  })
}

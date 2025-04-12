import {useQuery} from '@tanstack/react-query'

import {getPrivatePostsServerUrl} from '#/lib/api/config'
import {STALE} from '#/state/queries'
import {useAgent} from '#/state/session'

const RQKEY_ROOT = 'trust-status'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

type TrustedResponse = {
  trusted: Array<{recipientDid: string}>
}

export function useTrustStatusQuery(did: string | undefined) {
  const agent = useAgent()

  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.THIRTY,
    queryKey: RQKEY(did || ''),
    queryFn: async () => {
      // Fetch from server
      const serverUrl = getPrivatePostsServerUrl(
        agent,
        'social.spkeasy.graph.getTrusted',
      )
      const response = await fetch(
        `${serverUrl}/xrpc/social.spkeasy.graph.getTrusted?authorDid=${agent.did}&recipientDid=${did}`,
        {
          headers: {
            Authorization: `Bearer ${agent.session?.accessJwt}`,
          },
        },
      )
      if (!response.ok) {
        throw new Error('Failed to fetch trust status')
      }
      const data = (await response.json()) as TrustedResponse
      return data.trusted.length > 0
    },
  })
}

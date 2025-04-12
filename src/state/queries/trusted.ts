import {useQuery, useQueryClient} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {useAgent} from '#/state/session'
import {RQKEY as TRUST_STATUS_RQKEY} from './trust-status'

const STALE = {
  MINUTES: {
    FIVE: 5 * 60 * 1000,
  },
}

const RQKEY_ROOT = 'trusted'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

type TrustedResponse = {
  trusted: Array<{recipientDid: string}>
}

export function useTrustedQuery(did: string | undefined) {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {call} = useSpeakeasyApi()

  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: RQKEY(did || ''),
    queryFn: async () => {
      const data = (await call({
        api: 'social.spkeasy.graph.getTrusted',
        query: {
          authorDid: did!,
        },
      })) as TrustedResponse

      // Update trust status cache for each trusted user
      data.trusted.forEach(({recipientDid}: {recipientDid: string}) => {
        queryClient.setQueryData(TRUST_STATUS_RQKEY(recipientDid), true)
      })

      // Fetch profile information for each trusted DID in batches of 25
      const dids = data.trusted.map(
        (t: {recipientDid: string}) => t.recipientDid,
      )
      const batches = chunk(dids, 25)
      const profilePromises = batches.map(batch =>
        agent.getProfiles({actors: batch}),
      )
      const profileResults = await Promise.all(profilePromises)
      const profiles = profileResults.flatMap(result => result.data.profiles)

      return profiles
    },
  })
}

import {QueryClient, useQuery, useQueryClient} from '@tanstack/react-query'
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

type TrustedUser = {
  recipientDid: string
  createdAt: string
}

/**
 * Fetches the list of users that a given DID trusts
 * @param {string} did - The DID of the user whose trusted users we want to fetch
 * @param {any} speakeasyApi - The Speakeasy API client instance
 * @param {QueryClient} queryClient - The React Query client instance
 * @returns {Promise<Array<{recipientDid: string}>>} A promise that resolves to an array of trusted users
 */
export async function getTrustedUsers(
  did: string,
  speakeasyApi: any,
  queryClient: QueryClient,
): Promise<TrustedUser[]> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.graph.getTrusted',
    query: {
      authorDid: did,
    },
  })

  // Update trust status cache for each trusted user
  data.trusted.forEach(({recipientDid}: {recipientDid: string}) => {
    queryClient.setQueryData(TRUST_STATUS_RQKEY(recipientDid), true)
  })

  return data.trusted
}

/**
 * React Query hook to fetch and manage trusted users for a given DID
 * @param {string | undefined} did - The DID of the user whose trusted users we want to fetch
 * @returns {UseQueryResult} A React Query result object containing the trusted users' profiles
 */
export function useTrustedQuery(did: string | undefined) {
  const queryClient = useQueryClient()
  const {call: speakeasyApi} = useSpeakeasyApi()

  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: RQKEY(did || ''),
    queryFn: async () => {
      return getTrustedUsers(did!, speakeasyApi, queryClient)
    },
  })
}

/**
 * Hook to fetch full profiles for trusted users
 */
export function useTrustedProfiles(did: string | undefined) {
  const agent = useAgent()
  const {data: trustedUsers} = useTrustedQuery(did)

  return useQuery({
    enabled: !!trustedUsers?.length,
    queryKey: [...RQKEY(did || ''), 'profiles'],
    queryFn: async () => {
      if (!trustedUsers) return []

      // Fetch profile information for each trusted DID in batches of 25
      const dids = trustedUsers.map(t => t.recipientDid)
      const batches = chunk(dids, 25)
      const profilePromises = batches.map(batch =>
        agent.getProfiles({actors: batch}),
      )
      const profileResults = await Promise.all(profilePromises)
      return profileResults.flatMap(result => result.data.profiles)
    },
  })
}

import {useCallback} from 'react'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {getPrivatePostsServerUrl} from '#/lib/api/config'
import {useToggleMutationQueue} from '#/lib/hooks/useToggleMutationQueue'
import {useAgent} from '#/state/session'
import {RQKEY as TRUST_STATUS_RQKEY} from './trust-status'

const RQKEY_ROOT = 'trust'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

export function useTrustMutationQueue(profile: {did: string}) {
  const queryClient = useQueryClient()
  const did = profile.did
  const trustMutation = useTrustMutation()
  const untrustMutation = useUntrustMutation()

  const queueToggle = useToggleMutationQueue<boolean>({
    initialState: false, // TODO: Get initial trust state from profile
    runMutation: async (_prevState: boolean, shouldTrust: boolean) => {
      if (shouldTrust) {
        await trustMutation.mutateAsync({
          did,
        })
        return true
      } else {
        await untrustMutation.mutateAsync({
          did,
        })
        return false
      }
    },
    onSuccess(finalTrusted: boolean) {
      // Update trust status cache
      queryClient.setQueryData(TRUST_STATUS_RQKEY(did), finalTrusted)
    },
  })

  const queueTrust = useCallback(() => {
    // Optimistically update trust status cache
    queryClient.setQueryData(TRUST_STATUS_RQKEY(did), true)
    return queueToggle(true)
  }, [queryClient, did, queueToggle])

  const queueUntrust = useCallback(() => {
    // Optimistically update trust status cache
    queryClient.setQueryData(TRUST_STATUS_RQKEY(did), false)
    return queueToggle(false)
  }, [queryClient, did, queueToggle])

  return [queueTrust, queueUntrust]
}

function useTrustMutation() {
  const agent = useAgent()
  return useMutation<void, Error, {did: string}>({
    mutationFn: async ({did}) => {
      const serverUrl = getPrivatePostsServerUrl(
        agent,
        'social.spkeasy.graph.addTrusted',
      )
      const response = await fetch(
        `${serverUrl}/xrpc/social.spkeasy.graph.addTrusted`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${agent.session?.accessJwt}`,
          },
          body: JSON.stringify({
            recipientDid: did,
          }),
        },
      )
      if (!response.ok) {
        const error = await response.json()
        if (error.code === 'AlreadyExists') {
          return
        }
        throw new Error('Failed to add trusted user')
      }
    },
  })
}

function useUntrustMutation() {
  const agent = useAgent()
  return useMutation<void, Error, {did: string}>({
    mutationFn: async ({did}) => {
      const serverUrl = getPrivatePostsServerUrl(
        agent,
        'social.spkeasy.graph.removeTrusted',
      )
      const response = await fetch(
        `${serverUrl}/xrpc/social.spkeasy.graph.removeTrusted`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${agent.session?.accessJwt}`,
          },
          body: JSON.stringify({
            recipientDid: did,
          }),
        },
      )
      if (!response.ok) {
        const error = await response.json()
        if (error.code === 'NotFoundError') {
          return
        }

        throw new Error('Failed to remove trusted user')
      }
    },
  })
}

import {useCallback} from 'react'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {useToggleMutationQueue} from '#/lib/hooks/useToggleMutationQueue'
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
  const {call} = useSpeakeasyApi()
  return useMutation<void, Error, {did: string}>({
    mutationFn: async ({did}) => {
      try {
        await call({
          api: 'social.spkeasy.graph.addTrusted',
          method: 'POST',
          body: {
            recipientDid: did,
          },
        })
      } catch (error: any) {
        if (error.code === 'AlreadyExists') {
          return
        }
        throw new Error('Failed to add trusted user')
      }
    },
  })
}

function useUntrustMutation() {
  const {call} = useSpeakeasyApi()
  return useMutation<void, Error, {did: string}>({
    mutationFn: async ({did}) => {
      try {
        await call({
          api: 'social.spkeasy.graph.removeTrusted',
          method: 'POST',
          body: {
            recipientDid: did,
          },
        })
      } catch (error: any) {
        if (error.code === 'NotFoundError') {
          return
        }
        throw new Error('Failed to remove trusted user')
      }
    },
  })
}

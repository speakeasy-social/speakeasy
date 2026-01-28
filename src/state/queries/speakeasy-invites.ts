import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {STALE} from '#/state/queries'

const RQKEY_ROOT = 'speakeasy-invites'
export const RQKEY = () => [RQKEY_ROOT]

export type SpeakeasyInviteCode = {
  code: string
  remainingUses: number
  totalUses: number
  createdAt: string
}

type ListInviteCodesResponse = {
  inviteCodes: SpeakeasyInviteCode[]
}

type GenerateInviteCodeResponse = {
  code: string
  remainingUses: number
}

export function canCreateInvite(invite: SpeakeasyInviteCode | null): boolean {
  if (!invite) return true

  const createdAt = new Date(invite.createdAt)
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  return createdAt < oneWeekAgo
}

export function daysUntilCanCreateInvite(invite: SpeakeasyInviteCode): number {
  const createdAt = new Date(invite.createdAt)
  const canCreateAt = new Date(createdAt)
  canCreateAt.setDate(canCreateAt.getDate() + 7)

  const now = new Date()
  const diffMs = canCreateAt.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}

export function useSpeakeasyInvitesQuery() {
  const {call} = useSpeakeasyApi()

  return useQuery({
    staleTime: STALE.MINUTES.FIVE,
    queryKey: RQKEY(),
    queryFn: async () => {
      const data = (await call({
        api: 'social.spkeasy.actor.listInviteCodes',
      })) as ListInviteCodesResponse

      // Sort by createdAt descending (newest first)
      return data.inviteCodes.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    },
  })
}

export function useCreateSpeakeasyInviteMutation() {
  const {call} = useSpeakeasyApi()
  const queryClient = useQueryClient()

  return useMutation<GenerateInviteCodeResponse, Error>({
    mutationFn: async () => {
      const data = (await call({
        api: 'social.spkeasy.actor.generateInviteCode',
        method: 'POST',
      })) as GenerateInviteCodeResponse

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: RQKEY()})
    },
  })
}

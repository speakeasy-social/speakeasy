import {useMutation, useQuery} from '@tanstack/react-query'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'

const RQKEY_ROOT = 'testimonial'
export const RQKEY_SUPPORTER = () => [RQKEY_ROOT, 'supporter']

interface CheckSupporterResponse {
  isSupporter: boolean
  contributions: string[]
}

export function useCheckSupporterQuery(options?: {enabled?: boolean}) {
  const {call} = useSpeakeasyApi()

  return useQuery<CheckSupporterResponse, Error>({
    queryKey: RQKEY_SUPPORTER(),
    queryFn: async () => {
      return call({
        api: 'social.spkeasy.actor.checkSupporter',
        method: 'GET',
      })
    },
    enabled: options?.enabled ?? true,
  })
}

interface CreateTestimonialInput {
  content: {
    text: string
    facets?: any[]
  }
}

interface CreateTestimonialOutput {
  id: string
  createdAt: string
}

export function useCreateTestimonialMutation() {
  const {call} = useSpeakeasyApi()

  return useMutation<CreateTestimonialOutput, Error, CreateTestimonialInput>({
    mutationFn: async ({content}) => {
      return call({
        api: 'social.spkeasy.actor.createTestimonial',
        method: 'POST',
        body: {content},
      })
    },
  })
}

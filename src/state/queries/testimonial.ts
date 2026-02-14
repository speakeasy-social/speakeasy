import {useMutation, useQuery} from '@tanstack/react-query'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'

const RQKEY_ROOT = 'testimonial'
export const RQKEY_CONTRIBUTION = () => [RQKEY_ROOT, 'contribution']

interface CheckContributionResponse {
  isContributor: boolean
  contributions: string[]
}

export function useCheckContributionQuery(options?: {enabled?: boolean}) {
  const {call} = useSpeakeasyApi()

  return useQuery<CheckContributionResponse, Error>({
    queryKey: RQKEY_CONTRIBUTION(),
    queryFn: async () => {
      return call({
        api: 'social.spkeasy.actor.checkContribution',
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

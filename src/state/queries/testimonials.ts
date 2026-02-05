import {AppBskyActorDefs} from '@atproto/api'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {useAgent} from '#/state/session'
import {
  RelationshipPriority,
  SupporterTier,
  Testimonial,
} from '#/view/com/supporters/types'
import {useTrustedQuery} from './trusted'

const STALE = {
  MINUTES: {
    FIVE: 5 * 60 * 1000,
  },
}

export const RQKEY_ROOT = 'testimonials'
export const RQKEY = () => [RQKEY_ROOT]
export const RQKEY_PROFILES = () => [RQKEY_ROOT, 'profiles']
// Internal cache key for individual trusts-me queries
const RQKEY_TRUSTS_ME = (did: string) => [RQKEY_ROOT, 'trusts-me', did]

// API response types
type ApiContributionPublicData = {
  recognition?: string
  isRegularGift?: boolean
  feature?: string
}

type ApiContribution = {
  createdAt: string
  contribution: string
  public: ApiContributionPublicData | null
}

type ApiTestimonial = {
  id: string
  did: string
  content: {text: string; facets?: unknown[]}
  createdAt: string
  contributions: ApiContribution[]
}

type ListTestimonialsResponse = {
  testimonials: ApiTestimonial[]
  cursor?: string
}

// Badge mapping from API contribution strings to UI tier
const CONTRIBUTION_TO_BADGE: Record<string, SupporterTier> = {
  donor: 'supporter',
  contributor: 'contributor',
  designer: 'design',
  engineer: 'engineering',
  testing: 'qa',
}

/**
 * Maps API contribution strings to SupporterTier badges
 */
export function mapContributionsToBadges(
  contributions: ApiContribution[],
): SupporterTier[] {
  const badges: SupporterTier[] = []
  const seen = new Set<SupporterTier>()

  for (const c of contributions) {
    let badge: SupporterTier | undefined

    if (c.contribution === 'donor' && c.public?.recognition === 'founding') {
      badge = 'founder'
    } else {
      badge = CONTRIBUTION_TO_BADGE[c.contribution]
    }

    if (badge && !seen.has(badge)) {
      seen.add(badge)
      badges.push(badge)
    }
  }

  return badges
}

/**
 * Computes the relationship priority for a testimonial author
 */
export function computeRelationship(
  authorDid: string,
  currentUserDid: string | undefined,
  profile: AppBskyActorDefs.ProfileViewDetailed | undefined,
  iTrustDids: Set<string>,
  trustsMe: boolean | undefined,
): RelationshipPriority {
  if (currentUserDid && authorDid === currentUserDid) {
    return 'self'
  }

  if (trustsMe) {
    return 'trusts-me'
  }

  if (iTrustDids.has(authorDid)) {
    return 'i-trust'
  }

  if (profile?.viewer?.following) {
    return 'i-follow'
  }

  if (profile?.viewer?.followedBy) {
    return 'follows-me'
  }

  return 'other'
}

const RELATIONSHIP_ORDER: Record<RelationshipPriority, number> = {
  self: 0,
  'trusts-me': 1,
  'i-trust': 2,
  'i-follow': 3,
  'follows-me': 4,
  other: 5,
}

/**
 * Sorts testimonials by relationship priority
 */
export function sortTestimonialsByRelationship(
  testimonials: Testimonial[],
): Testimonial[] {
  return [...testimonials].sort((a, b) => {
    return (
      RELATIONSHIP_ORDER[a.relationship] - RELATIONSHIP_ORDER[b.relationship]
    )
  })
}

/**
 * Fetches all testimonials from the API, paginating as needed
 */
async function fetchAllTestimonials(
  speakeasyApi: (options: {
    api: string
    query?: Record<string, unknown>
  }) => Promise<ListTestimonialsResponse>,
): Promise<ApiTestimonial[]> {
  const allTestimonials: ApiTestimonial[] = []
  let cursor: string | undefined

  do {
    const response = await speakeasyApi({
      api: 'social.spkeasy.actor.listTestimonials',
      query: {
        limit: 100,
        ...(cursor && {cursor}),
      },
    })

    allTestimonials.push(...response.testimonials)
    cursor = response.cursor
  } while (cursor)

  return allTestimonials
}

/**
 * Hook to fetch raw testimonials from the API
 */
export function useTestimonialsQuery() {
  const {call: speakeasyApi} = useSpeakeasyApi()

  return useQuery({
    staleTime: STALE.MINUTES.FIVE,
    queryKey: RQKEY(),
    queryFn: () => fetchAllTestimonials(speakeasyApi),
  })
}

/**
 * Hook to fetch profiles for testimonial authors
 */
export function useTestimonialProfiles(testimonials: ApiTestimonial[]) {
  const agent = useAgent()

  return useQuery({
    enabled: testimonials.length > 0,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: [...RQKEY_PROFILES(), testimonials.map(t => t.did).join(',')],
    queryFn: async () => {
      const dids = testimonials.map(t => t.did)
      const batches = chunk(dids, 25)
      const profilePromises = batches.map(batch =>
        agent.getProfiles({actors: batch}),
      )
      const profileResults = await Promise.all(profilePromises)
      const profiles = profileResults.flatMap(result => result.data.profiles)

      // Create a map keyed by DID for easy lookup
      const profileMap = new Map<string, AppBskyActorDefs.ProfileViewDetailed>()
      for (const profile of profiles) {
        profileMap.set(profile.did, profile)
      }
      return profileMap
    },
  })
}

/**
 * Hook to check if each author trusts the current user
 * This performs N API calls in the background and updates progressively
 */
export function useTrustsMeQueries(
  authorDids: string[],
  currentUserDid: string | undefined,
) {
  const queryClient = useQueryClient()
  const {call: speakeasyApi} = useSpeakeasyApi()

  return useQuery({
    enabled: authorDids.length > 0 && !!currentUserDid,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: [
      RQKEY_ROOT,
      'trusts-me-batch',
      currentUserDid,
      authorDids.length,
    ],
    queryFn: async () => {
      const trustsMeMap = new Map<string, boolean>()

      // Check each author in parallel with limited concurrency
      const checkPromises = authorDids.map(async authorDid => {
        // Skip self
        if (authorDid === currentUserDid) {
          trustsMeMap.set(authorDid, false)
          return
        }

        try {
          const response = await speakeasyApi({
            api: 'social.spkeasy.graph.getTrusted',
            query: {
              authorDid,
              recipientDid: currentUserDid,
              limit: 1,
            },
          })

          const trustsMe = response.trusted.length > 0
          trustsMeMap.set(authorDid, trustsMe)

          // Cache individual result
          queryClient.setQueryData(RQKEY_TRUSTS_ME(authorDid), trustsMe)
        } catch {
          // On error, assume false to avoid blocking UI
          trustsMeMap.set(authorDid, false)
        }
      })

      await Promise.all(checkPromises)
      return trustsMeMap
    },
  })
}

/**
 * Combined hook that fetches testimonials with profiles and relationship data
 * Returns UI-ready Testimonial[] sorted by relationship
 */
export function useTestimonialsWithProfiles(
  currentUserDid: string | undefined,
) {
  // Fetch raw testimonials
  const {
    data: apiTestimonials,
    isLoading: isLoadingTestimonials,
    isError: isErrorTestimonials,
    error: testimonialsError,
    refetch: refetchTestimonials,
    isFetching: isFetchingTestimonials,
  } = useTestimonialsQuery()

  // Fetch profiles for all authors
  const {
    data: profileMap,
    isLoading: isLoadingProfiles,
    isError: isErrorProfiles,
  } = useTestimonialProfiles(apiTestimonials ?? [])

  // Fetch current user's trust list (who they trust)
  const {data: iTrustUsers, isLoading: isLoadingITrust} =
    useTrustedQuery(currentUserDid)

  // Create Set of DIDs the current user trusts
  const iTrustDids = new Set(iTrustUsers?.map(u => u.recipientDid) ?? [])

  // Get author DIDs for trusts-me checks
  const authorDids = apiTestimonials?.map(t => t.did) ?? []

  // Check which authors trust the current user
  const {data: trustsMeMap, isLoading: isLoadingTrustsMe} = useTrustsMeQueries(
    authorDids,
    currentUserDid,
  )

  // Transform API data to UI Testimonial type
  const testimonials: Testimonial[] = (apiTestimonials ?? []).map(
    apiTestimonial => {
      const profile = profileMap?.get(apiTestimonial.did)
      const trustsMe = trustsMeMap?.get(apiTestimonial.did)

      return {
        id: apiTestimonial.id,
        author: {
          did: apiTestimonial.did,
          handle: profile?.handle ?? apiTestimonial.did,
          displayName: profile?.displayName,
          avatar: profile?.avatar,
        },
        message: apiTestimonial.content.text,
        badges: mapContributionsToBadges(apiTestimonial.contributions),
        relationship: computeRelationship(
          apiTestimonial.did,
          currentUserDid,
          profile,
          iTrustDids,
          trustsMe,
        ),
      }
    },
  )

  // Sort by relationship
  const sortedTestimonials = sortTestimonialsByRelationship(testimonials)

  return {
    data: sortedTestimonials,
    isLoading: isLoadingTestimonials,
    isLoadingProfiles:
      isLoadingProfiles || isLoadingITrust || isLoadingTrustsMe,
    isError: isErrorTestimonials || isErrorProfiles,
    error: testimonialsError,
    refetch: refetchTestimonials,
    isFetching: isFetchingTestimonials,
  }
}

import {useMemo} from 'react'
import {AppBskyActorDefs} from '@atproto/api'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {getBaseCdnUrl} from '#/lib/api/feed/utils'
import {
  fetchPrivateProfiles,
  mergePrivateProfileData,
  type PrivateProfileData,
  shouldCheckPrivateProfile,
} from '#/lib/api/private-profiles'
import {callSpeakeasyApiWithAgent, useSpeakeasyApi} from '#/lib/api/speakeasy'
import {
  getCachedDek,
  getCachedPrivateProfile,
  isDidChecked,
  markDidsChecked,
  upsertCachedPrivateProfiles,
  usePrivateProfileCacheVersion,
} from '#/state/cache/private-profile-cache'
import {useAgent, useSession} from '#/state/session'
import {
  deduplicateContributions,
  RelationshipPriority,
  Testimonial,
  TestimonialContribution,
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
  options?: {dids?: string},
): Promise<ApiTestimonial[]> {
  const allTestimonials: ApiTestimonial[] = []
  let cursor: string | undefined

  do {
    const response = await speakeasyApi({
      api: 'social.spkeasy.actor.listTestimonials',
      query: {
        limit: 100,
        ...(cursor && {cursor}),
        ...(options?.dids && {dids: options.dids}),
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
 * Hook to fetch contributions for a specific user by DID.
 * Calls listTestimonials with dids filter and deduplicates by (contribution, recognition).
 */
export function useUserContributionsQuery(did: string | undefined) {
  const {call: speakeasyApi} = useSpeakeasyApi()

  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: [RQKEY_ROOT, 'contributions', did],
    queryFn: async () => {
      const testimonials = await fetchAllTestimonials(speakeasyApi, {dids: did})

      const allContributions: TestimonialContribution[] = testimonials.flatMap(
        t =>
          t.contributions.map(c => ({
            contribution: c.contribution,
            public: c.public,
          })),
      )

      return deduplicateContributions(allContributions)
    },
  })
}

/**
 * Hook to fetch profiles for testimonial authors.
 * Detects sentinel (private) profiles, fetches/decrypts private data,
 * and merges via mergePrivateProfileData (single merge point).
 * Follows useProfilesQuery pattern (profile.ts:297-362).
 */
export function useTestimonialProfiles(testimonials: ApiTestimonial[]) {
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useQuery({
    enabled: testimonials.length > 0,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: [...RQKEY_PROFILES(), testimonials.map(t => t.did).join(',')],
    queryFn: async () => {
      const call = (options: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
        callSpeakeasyApiWithAgent(agent, options)

      const dids = testimonials.map(t => t.did)
      const batches = chunk(dids, 25)
      const profilePromises = batches.map(batch =>
        agent.getProfiles({actors: batch}),
      )
      const profileResults = await Promise.all(profilePromises)
      const profiles = profileResults.flatMap(result => result.data.profiles)

      // Build lookup for sentinel check
      const profileByDid = new Map(profiles.map(p => [p.did, p]))

      // Only fetch unchecked DIDs that have the sentinel displayName
      const uncheckedDids = dids.filter(d => {
        if (isDidChecked(d)) return false
        return shouldCheckPrivateProfile(profileByDid.get(d))
      })

      let freshDataMap = new Map<string, PrivateProfileData>()

      if (uncheckedDids.length > 0) {
        try {
          const {profiles: fresh, deks} = await fetchPrivateProfiles(
            uncheckedDids,
            currentAccount?.did ?? '',
            call,
            getBaseCdnUrl(agent),
          )
          freshDataMap = fresh
          if (freshDataMap.size > 0) {
            upsertCachedPrivateProfiles(freshDataMap, currentAccount?.did, deks)
          }
        } catch {
          // Silent fallback — show ATProto data only
        }
        // Always mark as checked to prevent retry loops
        markDidsChecked(uncheckedDids, currentAccount?.did)
      }

      // Merge private data into profiles using the single merge point
      const profileMap = new Map<string, AppBskyActorDefs.ProfileViewDetailed>()
      for (const profile of profiles) {
        if (!shouldCheckPrivateProfile(profile)) {
          profileMap.set(profile.did, profile)
          continue
        }
        const privateData =
          freshDataMap.get(profile.did) ?? getCachedPrivateProfile(profile.did)
        profileMap.set(
          profile.did,
          mergePrivateProfileData(profile, privateData),
        )
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
  const privateProfileCacheVersion = usePrivateProfileCacheVersion()

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

  // Transform API data to UI Testimonial type, re-merging from cache when
  // privateProfileCacheVersion changes (e.g. another screen fetched private data).
  // No sentinel re-check needed here — cache is only populated for verified DIDs.
  // Follows useProfileQuery useMemo pattern (profile.ts:280-292).
  const testimonials = useMemo(() => {
    const items: Testimonial[] = (apiTestimonials ?? []).map(apiTestimonial => {
      let profile = profileMap?.get(apiTestimonial.did)
      const trustsMe = trustsMeMap?.get(apiTestimonial.did)

      // Re-merge from cache when cache version changes
      const cached = getCachedPrivateProfile(apiTestimonial.did)
      if (profile && cached) {
        profile = mergePrivateProfileData(profile, cached)
      }

      return {
        id: apiTestimonial.id,
        author: {
          did: apiTestimonial.did,
          handle: profile?.handle ?? apiTestimonial.did,
          displayName: profile?.displayName,
          avatar: profile?.avatar,
          dek: getCachedDek(apiTestimonial.did),
        },
        message: apiTestimonial.content.text,
        contributions: apiTestimonial.contributions.map(
          (c): TestimonialContribution => ({
            contribution: c.contribution,
            public: c.public,
          }),
        ),
        relationship: computeRelationship(
          apiTestimonial.did,
          currentUserDid,
          profile,
          iTrustDids,
          trustsMe,
        ),
      }
    })
    return sortTestimonialsByRelationship(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- privateProfileCacheVersion forces re-merge when cache updates
  }, [
    apiTestimonials,
    profileMap,
    trustsMeMap,
    currentUserDid,
    iTrustDids,
    privateProfileCacheVersion,
  ])

  return {
    data: testimonials,
    isLoading: isLoadingTestimonials,
    isLoadingProfiles:
      isLoadingProfiles || isLoadingITrust || isLoadingTrustsMe,
    isError: isErrorTestimonials || isErrorProfiles,
    error: testimonialsError,
    refetch: refetchTestimonials,
    isFetching: isFetchingTestimonials,
  }
}

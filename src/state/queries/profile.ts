import {useCallback, useMemo} from 'react'
import {Image as RNImage} from 'react-native-image-crop-picker'
import {
  AppBskyActorDefs,
  AppBskyActorGetProfile,
  AppBskyActorGetProfiles,
  AppBskyActorProfile,
  AtUri,
  BskyAgent,
  ComAtprotoRepoUploadBlob,
} from '@atproto/api'
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {uploadBlob} from '#/lib/api'
import {getBaseCdnUrl} from '#/lib/api/feed/utils'
import {
  anonymizeAtProtoProfile,
  decryptProfileIfAccessible,
  DEFAULT_PRIVATE_DESCRIPTION,
  deletePrivateProfile,
  fetchPrivateProfiles,
  getPrivateProfile,
  mergePrivateProfileData,
  migrateMediaToAtProto,
  PRIVATE_PROFILE_DISPLAY_NAME,
  type PrivateProfileData,
  resolvePrivateProfileMedia,
  resolvePrivateProfileUrls,
  shouldCheckPrivateProfile,
  writePrivateProfileRecord,
} from '#/lib/api/private-profiles'
import {callSpeakeasyApiWithAgent, getErrorCode} from '#/lib/api/speakeasy'
import {until} from '#/lib/async/until'
import {useToggleMutationQueue} from '#/lib/hooks/useToggleMutationQueue'
import {decryptAndCacheImage} from '#/lib/media/encrypted-image-cache'
import {logEvent, LogEvents, toClout} from '#/lib/statsig/statsig'
import {logger} from '#/logger'
import {
  claimDids,
  evictDid,
  getCachedDek,
  getCachedPrivateProfile,
  isDidChecked,
  markDidsChecked,
  releaseDids,
  setCachedDek,
  upsertCachedPrivateProfiles,
  usePrivateProfileCacheVersion,
} from '#/state/cache/private-profile-cache'
import {Shadow} from '#/state/cache/types'
import {
  addCachedFollowerDid,
  removeCachedFollowerDid,
} from '#/state/followers-cache'
import {STALE} from '#/state/queries'
import {
  resetProfilePostsQueries,
  RQKEY_ROOT as FEED_RQKEY_ROOT,
} from '#/state/queries/post-feed'
import {
  type PronounSet,
  RQKEY as PRONOUNS_RQKEY,
} from '#/state/queries/pronouns'
import * as userActionHistory from '#/state/userActionHistory'
import {updateProfileShadow} from '../cache/profile-shadow'
import {useAgent, useSession} from '../session'
import {
  ProgressGuideAction,
  useProgressGuideControls,
} from '../shell/progress-guide'
import {RQKEY as RQKEY_LIST_CONVOS} from './messages/list-conversations'
import {RQKEY as RQKEY_MY_BLOCKED} from './my-blocked-accounts'
import {RQKEY as RQKEY_MY_MUTED} from './my-muted-accounts'

const RQKEY_ROOT = 'profile'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

const profilesQueryKeyRoot = 'profiles'
export const profilesQueryKey = (handles: string[]) => [
  profilesQueryKeyRoot,
  handles,
]

const profileBasicQueryKeyRoot = 'profileBasic'
export const profileBasicQueryKey = (didOrHandle: string) => [
  profileBasicQueryKeyRoot,
  didOrHandle,
]

/**
 * Metadata about the private profile state.
 * Attached to profile query results as _privateProfile.
 */
export type PrivateProfileMetadata = {
  isPrivate: boolean
  avatarUri?: string // Speakeasy media key for migration
  bannerUri?: string // Speakeasy media key for migration
  publicDescription?: string // ATProto description before private merge
  loadError?: boolean // true if non-404 error occurred loading private profile
  dek?: string // DEK for decrypting encrypted media (avatar/banner)
}

/**
 * Extended profile type that includes private profile metadata.
 */
export type ProfileViewDetailedWithPrivate =
  AppBskyActorDefs.ProfileViewDetailed & {
    _privateProfile?: PrivateProfileMetadata
  }

/**
 * Returns a profile with _privateProfile set from cached private data or isPrivate: false.
 * Used when building the final profile object after mergePrivateProfileData().
 */
function withPrivateProfileMeta<T extends AppBskyActorDefs.ProfileViewDetailed>(
  profile: T,
  cached: PrivateProfileData | null | undefined,
  dek?: string,
  publicDescription?: string,
): T & {_privateProfile: PrivateProfileMetadata} {
  return {
    ...profile,
    _privateProfile: cached
      ? {
          isPrivate: true,
          avatarUri: cached.rawAvatarUri,
          bannerUri: cached.rawBannerUri,
          dek,
          publicDescription,
        }
      : {isPrivate: false},
  }
}

/**
 * Fetches and merges ATProto + Speakeasy private profile data for a given DID.
 * Extracted from useProfileQuery so it can be unit-tested without React rendering.
 */
export async function profileQueryFn(
  agent: BskyAgent,
  did: string,
  currentAccountDid: string,
): Promise<ProfileViewDetailedWithPrivate> {
  // Create call function for Speakeasy API
  const call = (options: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
    callSpeakeasyApiWithAgent(agent, options)

  // ATProto fetch is always unconditional
  const atprotoRes = await agent.getProfile({actor: did})
  let result: ProfileViewDetailedWithPrivate = atprotoRes.data

  // Check cache before calling Speakeasy API (avoid re-fetching when we already know the answer)
  if (isDidChecked(did)) {
    const cached = getCachedPrivateProfile(did)
    return withPrivateProfileMeta(
      cached ? mergePrivateProfileData(result, cached) : result,
      cached ?? null,
    )
  }

  // Skip Speakeasy lookup if displayName doesn't match the sentinel
  if (!shouldCheckPrivateProfile(result)) {
    result._privateProfile = {isPrivate: false}
    return result
  }

  const claimed = claimDids([did])
  if (claimed.length === 0) {
    // DID already being fetched by batch fetcher; return atproto result and
    // merge from cache if already present; useMemo will re-merge when cache updates
    const cached = getCachedPrivateProfile(did)
    return withPrivateProfileMeta(
      cached ? mergePrivateProfileData(result, cached) : result,
      cached ?? null,
    )
  }

  try {
    const privateResult = await getPrivateProfile(did, call)

    if (privateResult) {
      const decryptedResult = await decryptProfileIfAccessible(
        privateResult,
        currentAccountDid,
        call,
      )
      if (decryptedResult) {
        const baseUrl = getBaseCdnUrl(agent)
        const decrypted = resolvePrivateProfileUrls(
          decryptedResult.data,
          baseUrl,
        )
        setCachedDek(did, decryptedResult.dek)
        result = withPrivateProfileMeta(
          mergePrivateProfileData(result, decrypted),
          decrypted,
          decryptedResult.dek,
        )
        upsertCachedPrivateProfiles(new Map([[did, decrypted]]))
        markDidsChecked([did])
      } else {
        markDidsChecked([did])
        result = withPrivateProfileMeta(result, null)
      }
    } else {
      if (result.displayName !== PRIVATE_PROFILE_DISPLAY_NAME) {
        evictDid(did)
        markDidsChecked([did])
      }
      result = withPrivateProfileMeta(result, null)
    }
  } catch (err) {
    if (getErrorCode(err) !== 'NotFound') {
      logger.error('Failed to load private profile', {message: err})
    }
    result._privateProfile = {isPrivate: false, loadError: true}
  } finally {
    releaseDids([did])
  }

  return result
}

/**
 * Single place for "display profile" for a DID: fetches public (ATProto) and
 * private (Speakeasy) when needed, then applies mergePrivateProfileData(public,
 * getCachedPrivateProfile(did)) so displayProfile = isProfilePrivate(public)
 * ? (private ? merge(public, private) : public) : public. Re-merges when the
 * private-profile cache updates (useMemo + usePrivateProfileCacheVersion) so
 * optimistic cache updates from mutations show immediately without refetch.
 */
export function useProfileQuery({
  did,
  staleTime = STALE.SECONDS.FIFTEEN,
}: {
  did: string | undefined
  staleTime?: number
}) {
  const queryClient = useQueryClient()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const privateProfileCacheVersion = usePrivateProfileCacheVersion()

  const query = useQuery<ProfileViewDetailedWithPrivate>({
    // WARNING
    // this staleTime is load-bearing
    // if you remove it, the UI infinite-loops
    // -prf
    staleTime,
    queryKey: RQKEY(did ?? ''),
    queryFn: () => profileQueryFn(agent, did ?? '', currentAccount?.did ?? ''),
    placeholderData: () => {
      if (!did) return

      return queryClient.getQueryData<AppBskyActorDefs.ProfileViewBasic>(
        profileBasicQueryKey(did),
      )
    },
    enabled: !!did,
  })

  // Apply display rule: re-merge with private cache when it updates (e.g. after
  // optimistic upsert from save). No refetch — cache + this useMemo avoid flash.
  const data = useMemo(() => {
    const base = query.data
    if (!base || !did) return base
    const cached = getCachedPrivateProfile(did)
    if (!cached) return base
    const dek = getCachedDek(did)
    return withPrivateProfileMeta(
      mergePrivateProfileData(base, cached),
      cached,
      dek,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- privateProfileCacheVersion forces re-merge when cache updates
  }, [query.data, privateProfileCacheVersion, did])

  return {...query, data}
}

export function useProfilesQuery({handles}: {handles: string[]}) {
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useQuery({
    staleTime: STALE.MINUTES.FIVE,
    queryKey: profilesQueryKey(handles),
    queryFn: async () => {
      // Create call function for Speakeasy API
      const call = (options: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
        callSpeakeasyApiWithAgent(agent, options)

      const res = await agent.getProfiles({actors: handles})

      // Extract DIDs from the returned profiles
      const dids = res.data.profiles.map(p => p.did)

      // Only fetch unchecked DIDs that look like private profiles
      const profileByDid = new Map(res.data.profiles.map(p => [p.did, p]))
      const uncheckedDids = dids.filter(d => {
        if (isDidChecked(d)) return false
        return shouldCheckPrivateProfile(profileByDid.get(d))
      })

      let freshDataMap = new Map<string, PrivateProfileData>()

      if (uncheckedDids.length > 0) {
        try {
          freshDataMap = await fetchPrivateProfiles(
            uncheckedDids,
            currentAccount?.did ?? '',
            call,
            getBaseCdnUrl(agent),
          )
          if (freshDataMap.size > 0) {
            upsertCachedPrivateProfiles(freshDataMap)
          }
        } catch {
          // Silent fallback - show ATProto data only
        }
        markDidsChecked(uncheckedDids)
      }

      // Merge private data into profiles — use fresh data if available,
      // otherwise fall back to existing cache
      const mergedProfiles = res.data.profiles.map(profile => {
        const privateData =
          freshDataMap.get(profile.did) ?? getCachedPrivateProfile(profile.did)
        const dek = getCachedDek(profile.did)
        return withPrivateProfileMeta(
          mergePrivateProfileData(profile, privateData),
          privateData ?? null,
          dek,
        )
      })

      return {
        ...res.data,
        profiles: mergedProfiles,
      }
    },
  })
}

export function usePrefetchProfileQuery() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const prefetchProfileQuery = useCallback(
    async (did: string) => {
      await queryClient.prefetchQuery({
        staleTime: STALE.SECONDS.THIRTY,
        queryKey: RQKEY(did),
        queryFn: async () => {
          const res = await agent.getProfile({actor: did || ''})
          let result: ProfileViewDetailedWithPrivate = res.data

          // Merge cached private profile if available (no API call for prefetch)
          const cached = getCachedPrivateProfile(did)
          if (cached) {
            result = mergePrivateProfileData(result, cached)
            result._privateProfile = {
              isPrivate: true,
              avatarUri: cached.rawAvatarUri,
              bannerUri: cached.rawBannerUri,
            }
          }

          return result
        },
      })
    },
    [queryClient, agent],
  )
  return prefetchProfileQuery
}

/** Normalized result for avatar/banner upload or migration. */
type AvatarBannerUploadResult = {
  response: ComAtprotoRepoUploadBlob.Response
}

/**
 * Builds avatar and banner upload/migration promises for the public-profile path.
 * Caller awaits these so media is ready when updating the record.
 */
function buildAvatarBannerPromisesForPublicProfile(
  agent: BskyAgent,
  profile: AppBskyActorDefs.ProfileView,
  newUserAvatar: RNImage | undefined | null,
  newUserBanner: RNImage | undefined | null,
  existingPrivateAvatarUri: string | undefined,
  existingPrivateBannerUri: string | undefined,
  dek: string | undefined,
): {
  newUserAvatarPromise: Promise<AvatarBannerUploadResult> | undefined
  newUserBannerPromise: Promise<AvatarBannerUploadResult> | undefined
} {
  let newUserAvatarPromise: Promise<AvatarBannerUploadResult> | undefined
  let newUserBannerPromise: Promise<AvatarBannerUploadResult> | undefined

  if (newUserAvatar) {
    newUserAvatarPromise = uploadBlob(
      agent,
      newUserAvatar.path,
      newUserAvatar.mime,
    ).then(response => ({response}))
  } else if (newUserAvatar === undefined && existingPrivateAvatarUri) {
    if (!dek)
      throw new Error('dek required to migrate private avatar to ATProto')
    newUserAvatarPromise = migrateMediaToAtProto(
      existingPrivateAvatarUri,
      agent,
      dek,
    )
  } else {
    newUserAvatarPromise = undefined
  }

  if (newUserBanner) {
    newUserBannerPromise = uploadBlob(
      agent,
      newUserBanner.path,
      newUserBanner.mime,
    ).then(response => ({response}))
  } else if (newUserBanner === undefined && existingPrivateBannerUri) {
    if (!dek)
      throw new Error('dek required to migrate private banner to ATProto')
    newUserBannerPromise = migrateMediaToAtProto(
      existingPrivateBannerUri,
      agent,
      dek,
    )
  } else {
    newUserBannerPromise = undefined
  }

  return {newUserAvatarPromise, newUserBannerPromise}
}

/**
 * Default checkCommitted for public profile save: wait until avatar/banner and
 * display fields match what we sent.
 */
export function defaultCheckCommittedForPublicProfile(
  profile: AppBskyActorDefs.ProfileView,
  updates:
    | AppBskyActorProfile.Record
    | ((existing: AppBskyActorProfile.Record) => AppBskyActorProfile.Record),
  newUserAvatar: RNImage | undefined | null,
  newUserBanner: RNImage | undefined | null,
): (res: AppBskyActorGetProfile.Response) => boolean {
  return res => {
    if (typeof newUserAvatar !== 'undefined') {
      if (newUserAvatar === null && res.data.avatar) return false
      if ((res.data.avatar ?? null) === (profile.avatar ?? null)) return false
    }
    if (typeof newUserBanner !== 'undefined') {
      if (newUserBanner === null && res.data.banner) return false
      if ((res.data.banner ?? null) === (profile.banner ?? null)) return false
    }
    if (typeof updates === 'function') return true
    return (
      res.data.displayName === updates.displayName &&
      res.data.description === updates.description
    )
  }
}

/**
 * Resolves pronouns for private profile storage: 2+ sets → array, else native string.
 */
function resolvePrivatePronouns(pronouns: {
  native: string
  sets: PronounSet[]
}): string | PronounSet[] {
  return pronouns.sets.length >= 2 ? pronouns.sets : pronouns.native
}

export interface ProfileUpdateParams {
  profile: AppBskyActorDefs.ProfileView
  updates:
    | AppBskyActorProfile.Record
    | ((existing: AppBskyActorProfile.Record) => AppBskyActorProfile.Record)
  newUserAvatar?: RNImage | undefined | null
  newUserBanner?: RNImage | undefined | null
  checkCommitted?: (res: AppBskyActorGetProfile.Response) => boolean
  // Private profile fields
  isPrivate?: boolean
  publicDescription?: string // Custom ATProto description for private profiles
  existingPrivateAvatarUri?: string // Speakeasy media key for migration
  existingPrivateBannerUri?: string // Speakeasy media key for migration
  pronouns?: {
    native: string // first set as "she/her"
    sets: PronounSet[] // all parsed sets
  }
  // Explicit values for private profile storage (needed when updates is a function)
  privateDisplayName?: string
  privateDescription?: string
  // Progress callback for UI display during migration
  onStateChange?: (stage: string) => void
}
export type ProfileMutationResult =
  | {
      type: 'private'
      privateData: PrivateProfileData
      optimisticProfile: AppBskyActorDefs.ProfileViewDetailed
      dek: string
    }
  | {
      type: 'public'
      optimisticProfile: AppBskyActorDefs.ProfileViewDetailed
    }

/**
 * Extracted mutation function for profile updates. Handles both private and
 * public save flows and returns complete optimistic data so onSuccess doesn't
 * need to reconstruct anything.
 */
export async function profileMutationFn(
  agent: BskyAgent,
  queryClient: QueryClient,
  params: ProfileUpdateParams,
): Promise<ProfileMutationResult> {
  const {
    profile,
    updates,
    newUserAvatar,
    newUserBanner,
    checkCommitted,
    isPrivate,
    publicDescription,
    existingPrivateAvatarUri,
    existingPrivateBannerUri,
    pronouns,
    privateDisplayName,
    privateDescription,
    onStateChange,
  } = params

  const call = (options: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
    callSpeakeasyApiWithAgent(agent, options)

  if (isPrivate) {
    // Becoming private or staying private. Order: 1) save avatar/banner, 2) write private record, 3) clear public.
    // If step 3 fails, roll back by deleting the private record so profile is considered still public.
    const privatePronouns = pronouns
      ? resolvePrivatePronouns(pronouns)
      : undefined

    const displayName =
      privateDisplayName ??
      (typeof updates === 'function' ? '' : updates.displayName || '')
    const description =
      privateDescription ??
      (typeof updates === 'function' ? '' : updates.description || '')

    const mediaParams = {
      displayName,
      description,
      newAvatar: newUserAvatar
        ? {path: newUserAvatar.path, mime: newUserAvatar.mime}
        : newUserAvatar, // null or undefined
      newBanner: newUserBanner
        ? {path: newUserBanner.path, mime: newUserBanner.mime}
        : newUserBanner,
      existingAvatarUri:
        newUserAvatar === undefined
          ? existingPrivateAvatarUri ?? (profile.avatar as string | undefined)
          : undefined,
      existingBannerUri:
        newUserBanner === undefined
          ? existingPrivateBannerUri ?? (profile.banner as string | undefined)
          : undefined,
      pronouns: privatePronouns,
    }

    onStateChange?.('Uploading media...')
    const resolved = await resolvePrivateProfileMedia(
      agent,
      call,
      queryClient,
      mediaParams,
    )

    // Pre-warm decrypted image cache so UserAvatar doesn't flash a white circle
    // while decrypting. Runs in parallel with subsequent network calls so is
    // likely complete before re-render. Errors are non-critical (fallback is
    // the current flash behaviour).
    const prewarmBaseUrl = getBaseCdnUrl(agent)
    if (resolved.avatarUri) {
      decryptAndCacheImage(
        `${prewarmBaseUrl}/${resolved.avatarUri}`,
        resolved.sessionKey,
      ).catch(() => {})
    }
    if (resolved.bannerUri) {
      decryptAndCacheImage(
        `${prewarmBaseUrl}/${resolved.bannerUri}`,
        resolved.sessionKey,
      ).catch(() => {})
    }

    onStateChange?.('Saving private profile...')
    await writePrivateProfileRecord(call, {
      sessionId: resolved.sessionId,
      sessionKey: resolved.sessionKey,
      displayName,
      description,
      avatarUri: resolved.avatarUri,
      bannerUri: resolved.bannerUri,
      pronouns: privatePronouns,
    })

    // Step 3a: Anonymize ATProto — only roll back if this fails
    try {
      onStateChange?.('Anonymizing public profile...')
      await agent.upsertProfile(existing =>
        anonymizeAtProtoProfile(
          publicDescription,
          existing ? {pinnedPost: existing.pinnedPost} : undefined,
        ),
      )
      try {
        await agent.api.com.atproto.repo.deleteRecord({
          repo: profile.did,
          collection: 'app.nearhorizon.actor.pronouns',
          rkey: 'self',
        })
      } catch (e: any) {
        if (!e.message?.includes('Could not locate record')) {
          throw e
        }
      }
    } catch (clearError) {
      await deletePrivateProfile(call)
      throw clearError
    }

    // Step 3b: Wait for PDS sync — non-fatal timeout, profile is already saved
    try {
      const expectedAnonymized = anonymizeAtProtoProfile(publicDescription)
      await whenAppViewReady(agent, profile.did, res => {
        return (
          res.data.displayName === expectedAnonymized.displayName &&
          res.data.description === expectedAnonymized.description
        )
      })
    } catch {
      // Timeout is non-fatal — ATProto upsert already succeeded
    }

    // Build complete private profile data with raw keys
    const privateData: PrivateProfileData = {
      displayName,
      description,
      avatarUri: resolved.avatarUri,
      bannerUri: resolved.bannerUri,
      pronouns: privatePronouns,
    }

    // Build optimistic profile: sentinel merged with resolved private data
    const baseUrl = getBaseCdnUrl(agent)
    const resolvedData = resolvePrivateProfileUrls(privateData, baseUrl)
    const sentinelProfile = {
      ...profile,
      displayName: PRIVATE_PROFILE_DISPLAY_NAME,
      description: publicDescription ?? DEFAULT_PRIVATE_DESCRIPTION,
      avatar: undefined,
      banner: undefined,
    } as AppBskyActorDefs.ProfileViewDetailed
    const optimisticProfile = mergePrivateProfileData(
      sentinelProfile,
      resolvedData,
    )

    return {
      type: 'private',
      privateData,
      optimisticProfile,
      dek: resolved.sessionKey,
    }
  } else {
    // Becoming public or staying public. Order: 1) save avatar/banner, 2) write public record, 3) clear private.
    // If step 3 fails, profile is still considered public (don't rethrow).
    if (existingPrivateAvatarUri || existingPrivateBannerUri) {
      onStateChange?.('Migrating media...')
    }
    const {newUserAvatarPromise, newUserBannerPromise} =
      buildAvatarBannerPromisesForPublicProfile(
        agent,
        profile,
        newUserAvatar,
        newUserBanner,
        existingPrivateAvatarUri,
        existingPrivateBannerUri,
        getCachedDek(profile.did),
      )

    const [avatarRes, bannerRes] = await Promise.all([
      newUserAvatarPromise ?? Promise.resolve(undefined),
      newUserBannerPromise ?? Promise.resolve(undefined),
    ])

    onStateChange?.('Updating public profile...')
    await agent.upsertProfile(existing => {
      existing = existing || {}
      if (typeof updates === 'function') {
        existing = updates(existing)
      } else {
        existing.displayName = updates.displayName
        existing.description = updates.description
        if ('pinnedPost' in updates) {
          existing.pinnedPost = updates.pinnedPost
        }
      }
      if (avatarRes) {
        existing.avatar = avatarRes.response.data.blob
      } else if (newUserAvatar === null) {
        existing.avatar = undefined
      }
      if (bannerRes) {
        existing.banner = bannerRes.response.data.blob
      } else if (newUserBanner === null) {
        existing.banner = undefined
      }
      return existing
    })
    // When migrating media from Speakeasy→ATProto, the default check skips
    // avatar/banner (newUserAvatar/Banner are undefined). Build a check that
    // waits for the app view to index the migrated blobs.
    const migrationAwareCheck =
      (!newUserAvatar && avatarRes) || (!newUserBanner && bannerRes)
        ? (res: AppBskyActorGetProfile.Response) => {
            if (!newUserAvatar && avatarRes && !res.data.avatar) return false
            if (!newUserBanner && bannerRes && !res.data.banner) return false
            return defaultCheckCommittedForPublicProfile(
              profile,
              updates,
              newUserAvatar,
              newUserBanner,
            )(res)
          }
        : undefined

    onStateChange?.('Waiting for profile to update...')
    await whenAppViewReady(
      agent,
      profile.did,
      checkCommitted ??
        migrationAwareCheck ??
        defaultCheckCommittedForPublicProfile(
          profile,
          updates,
          newUserAvatar,
          newUserBanner,
        ),
    )

    // Fetch the real profile with canonical CDN URLs, retrying if media URLs
    // are not yet serving real images (eventual consistency on local AppView)
    const freshProfile = await fetchProfileWithValidatedMedia(
      agent,
      profile.did,
      onStateChange,
    )

    onStateChange?.('Removing private profile...')
    try {
      await deletePrivateProfile(call)
    } catch (error) {
      if (getErrorCode(error) !== 'NotFound') {
        logger.error('Failed to clear private profile after going public', {
          message: String(error),
        })
      }
    }

    return {type: 'public', optimisticProfile: freshProfile.data}
  }
}

/**
 * Extracted onSuccess handler for profile mutations. Simple setter — no data
 * reconstruction. The mutation returns complete optimistic data.
 */
export async function profileOnSuccess(
  queryClient: QueryClient,
  agent: BskyAgent,
  data: ProfileMutationResult,
  variables: ProfileUpdateParams,
): Promise<void> {
  const did = variables.profile.did
  // Cancel any in-flight queries so stale refetches don't overwrite optimistic data
  await queryClient.cancelQueries({queryKey: RQKEY(did)})

  if (data.type === 'private') {
    const baseUrl = getBaseCdnUrl(agent)
    const resolved = resolvePrivateProfileUrls(data.privateData, baseUrl)
    setCachedDek(did, data.dek)
    upsertCachedPrivateProfiles(new Map([[did, resolved]]))
    markDidsChecked([did])
    queryClient.setQueryData(
      RQKEY(did),
      withPrivateProfileMeta(
        data.optimisticProfile,
        resolved,
        data.dek,
        variables.publicDescription ?? DEFAULT_PRIVATE_DESCRIPTION,
      ),
    )
    queryClient.invalidateQueries({queryKey: PRONOUNS_RQKEY(did)})
  } else {
    evictDid(did)
    markDidsChecked([did])
    queryClient.setQueryData(
      RQKEY(did),
      withPrivateProfileMeta(data.optimisticProfile, null),
    )
    queryClient.invalidateQueries({queryKey: PRONOUNS_RQKEY(did)})
    // Feed caches embed stale ATProto profile data (sentinel displayName, no avatar).
    // Invalidate so the next render of any feed containing this user refetches fresh data.
    queryClient.invalidateQueries({queryKey: [FEED_RQKEY_ROOT]})
  }
}

export function useProfileUpdateMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  return useMutation<ProfileMutationResult, Error, ProfileUpdateParams>({
    mutationFn: params => profileMutationFn(agent, queryClient, params),
    async onSuccess(data, variables) {
      await profileOnSuccess(queryClient, agent, data, variables)
    },
    onError(_error, variables) {
      queryClient.invalidateQueries({queryKey: RQKEY(variables.profile.did)})
    },
  })
}

export function useProfileFollowMutationQueue(
  profile: Shadow<AppBskyActorDefs.ProfileViewDetailed>,
  logContext: LogEvents['profile:follow']['logContext'] &
    LogEvents['profile:follow']['logContext'],
) {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const did = profile.did
  const initialFollowingUri = profile.viewer?.following
  const followMutation = useProfileFollowMutation(logContext, profile)
  const unfollowMutation = useProfileUnfollowMutation(logContext)

  const queueToggle = useToggleMutationQueue({
    initialState: initialFollowingUri,
    runMutation: async (prevFollowingUri, shouldFollow) => {
      if (shouldFollow) {
        const {uri} = await followMutation.mutateAsync({
          did,
        })
        userActionHistory.follow([did])
        addCachedFollowerDid(did)
        return uri
      } else {
        if (prevFollowingUri) {
          await unfollowMutation.mutateAsync({
            did,
            followUri: prevFollowingUri,
          })
          userActionHistory.unfollow([did])
        }
        removeCachedFollowerDid(did)
        return undefined
      }
    },
    onSuccess(finalFollowingUri) {
      // finalize
      updateProfileShadow(queryClient, did, {
        followingUri: finalFollowingUri,
      })

      if (finalFollowingUri) {
        agent.app.bsky.graph
          .getSuggestedFollowsByActor({
            actor: did,
          })
          .then(res => {
            const dids = res.data.suggestions
              .filter(a => !a.viewer?.following)
              .map(a => a.did)
              .slice(0, 8)
            userActionHistory.followSuggestion(dids)
          })
      }
    },
  })

  const queueFollow = useCallback(() => {
    // optimistically update
    updateProfileShadow(queryClient, did, {
      followingUri: 'pending',
    })
    return queueToggle(true)
  }, [queryClient, did, queueToggle])

  const queueUnfollow = useCallback(() => {
    // optimistically update
    updateProfileShadow(queryClient, did, {
      followingUri: undefined,
    })
    return queueToggle(false)
  }, [queryClient, did, queueToggle])

  return [queueFollow, queueUnfollow]
}

function useProfileFollowMutation(
  logContext: LogEvents['profile:follow']['logContext'],
  profile: Shadow<AppBskyActorDefs.ProfileViewDetailed>,
) {
  const {currentAccount} = useSession()
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {captureAction} = useProgressGuideControls()

  return useMutation<{uri: string; cid: string}, Error, {did: string}>({
    mutationFn: async ({did}) => {
      let ownProfile: AppBskyActorDefs.ProfileViewDetailed | undefined
      if (currentAccount) {
        ownProfile = findProfileQueryData(queryClient, currentAccount.did)
      }
      captureAction(ProgressGuideAction.Follow)
      logEvent('profile:follow', {
        logContext,
        didBecomeMutual: profile.viewer
          ? Boolean(profile.viewer.followedBy)
          : undefined,
        followeeClout: toClout(profile.followersCount),
        followerClout: toClout(ownProfile?.followersCount),
      })
      const result = await agent.follow(did)
      addCachedFollowerDid(did)
      return result
    },
  })
}

function useProfileUnfollowMutation(
  logContext: LogEvents['profile:unfollow']['logContext'],
) {
  const agent = useAgent()
  return useMutation<void, Error, {did: string; followUri: string}>({
    mutationFn: async ({followUri}) => {
      logEvent('profile:unfollow', {logContext})
      return await agent.deleteFollow(followUri)
    },
  })
}

export function useProfileMuteMutationQueue(
  profile: Shadow<AppBskyActorDefs.ProfileViewDetailed>,
) {
  const queryClient = useQueryClient()
  const did = profile.did
  const initialMuted = profile.viewer?.muted
  const muteMutation = useProfileMuteMutation()
  const unmuteMutation = useProfileUnmuteMutation()

  const queueToggle = useToggleMutationQueue({
    initialState: initialMuted,
    runMutation: async (_prevMuted, shouldMute) => {
      if (shouldMute) {
        await muteMutation.mutateAsync({
          did,
        })
        return true
      } else {
        await unmuteMutation.mutateAsync({
          did,
        })
        return false
      }
    },
    onSuccess(finalMuted) {
      // finalize
      updateProfileShadow(queryClient, did, {muted: finalMuted})
    },
  })

  const queueMute = useCallback(() => {
    // optimistically update
    updateProfileShadow(queryClient, did, {
      muted: true,
    })
    return queueToggle(true)
  }, [queryClient, did, queueToggle])

  const queueUnmute = useCallback(() => {
    // optimistically update
    updateProfileShadow(queryClient, did, {
      muted: false,
    })
    return queueToggle(false)
  }, [queryClient, did, queueToggle])

  return [queueMute, queueUnmute]
}

function useProfileMuteMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  return useMutation<void, Error, {did: string}>({
    mutationFn: async ({did}) => {
      await agent.mute(did)
    },
    onSuccess() {
      queryClient.invalidateQueries({queryKey: RQKEY_MY_MUTED()})
    },
  })
}

function useProfileUnmuteMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  return useMutation<void, Error, {did: string}>({
    mutationFn: async ({did}) => {
      await agent.unmute(did)
    },
    onSuccess() {
      queryClient.invalidateQueries({queryKey: RQKEY_MY_MUTED()})
    },
  })
}

export function useProfileBlockMutationQueue(
  profile: Shadow<AppBskyActorDefs.ProfileViewBasic>,
) {
  const queryClient = useQueryClient()
  const did = profile.did
  const initialBlockingUri = profile.viewer?.blocking
  const blockMutation = useProfileBlockMutation()
  const unblockMutation = useProfileUnblockMutation()

  const queueToggle = useToggleMutationQueue({
    initialState: initialBlockingUri,
    runMutation: async (prevBlockUri, shouldFollow) => {
      if (shouldFollow) {
        const {uri} = await blockMutation.mutateAsync({
          did,
        })
        return uri
      } else {
        if (prevBlockUri) {
          await unblockMutation.mutateAsync({
            did,
            blockUri: prevBlockUri,
          })
        }
        return undefined
      }
    },
    onSuccess(finalBlockingUri) {
      // finalize
      updateProfileShadow(queryClient, did, {
        blockingUri: finalBlockingUri,
      })
      queryClient.invalidateQueries({queryKey: RQKEY_LIST_CONVOS})
    },
  })

  const queueBlock = useCallback(() => {
    // optimistically update
    updateProfileShadow(queryClient, did, {
      blockingUri: 'pending',
    })
    return queueToggle(true)
  }, [queryClient, did, queueToggle])

  const queueUnblock = useCallback(() => {
    // optimistically update
    updateProfileShadow(queryClient, did, {
      blockingUri: undefined,
    })
    return queueToggle(false)
  }, [queryClient, did, queueToggle])

  return [queueBlock, queueUnblock]
}

function useProfileBlockMutation() {
  const {currentAccount} = useSession()
  const agent = useAgent()
  const queryClient = useQueryClient()
  return useMutation<{uri: string; cid: string}, Error, {did: string}>({
    mutationFn: async ({did}) => {
      if (!currentAccount) {
        throw new Error('Not signed in')
      }
      return await agent.app.bsky.graph.block.create(
        {repo: currentAccount.did},
        {subject: did, createdAt: new Date().toISOString()},
      )
    },
    onSuccess(_, {did}) {
      queryClient.invalidateQueries({queryKey: RQKEY_MY_BLOCKED()})
      resetProfilePostsQueries(queryClient, did, 1000)
    },
  })
}

function useProfileUnblockMutation() {
  const {currentAccount} = useSession()
  const agent = useAgent()
  const queryClient = useQueryClient()
  return useMutation<void, Error, {did: string; blockUri: string}>({
    mutationFn: async ({blockUri}) => {
      if (!currentAccount) {
        throw new Error('Not signed in')
      }
      const {rkey} = new AtUri(blockUri)
      await agent.app.bsky.graph.block.delete({
        repo: currentAccount.did,
        rkey,
      })
    },
    onSuccess(_, {did}) {
      resetProfilePostsQueries(queryClient, did, 1000)
    },
  })
}

export function precacheProfile(
  queryClient: QueryClient,
  profile: AppBskyActorDefs.ProfileViewBasic,
) {
  queryClient.setQueryData(profileBasicQueryKey(profile.handle), profile)
  queryClient.setQueryData(profileBasicQueryKey(profile.did), profile)
}

async function whenAppViewReady(
  agent: BskyAgent,
  actor: string,
  fn: (res: AppBskyActorGetProfile.Response) => boolean,
) {
  await until(
    5, // 5 tries
    1e3, // 1s delay between tries
    fn,
    () => agent.app.bsky.actor.getProfile({actor}),
  )
}

/**
 * Validates that a media URL serves an actual image.
 * Returns true if the URL should be discarded (retry needed):
 *   - URL contains 'cdn.appview.com' → discard immediately
 *   - Fetch returns non-image content-type or error → discard
 *   - Fetch throws CORS error → accept (can't verify, hope for the best)
 */
async function isMediaUrlInvalid(url: string): Promise<boolean> {
  if (url.includes('cdn.appview.com')) {
    return true
  }
  try {
    const res = await fetch(url, {method: 'HEAD'})
    const contentType = res.headers.get('content-type') ?? ''
    return !res.ok || !contentType.startsWith('image/')
  } catch {
    // CORS or network error — can't verify, accept the URL
    return false
  }
}

/**
 * Fetches getProfile, retrying every 500ms (up to 4s total) if any
 * avatar/banner URL is invalid (cdn.appview.com or non-image response).
 * Returns the best available result when the timeout expires.
 */
async function fetchProfileWithValidatedMedia(
  agent: BskyAgent,
  did: string,
  onStateChange?: (stage: string) => void,
): Promise<AppBskyActorGetProfile.Response> {
  const maxElapsed = 4000
  const retryDelay = 500
  const start = Date.now()

  while (true) {
    const res = await agent.app.bsky.actor.getProfile({actor: did})

    const mediaUrls = [res.data.avatar, res.data.banner].filter(
      (u): u is string => !!u,
    )
    const invalid = await Promise.all(mediaUrls.map(isMediaUrlInvalid))

    if (!invalid.some(Boolean)) {
      return res
    }

    const elapsed = Date.now() - start
    if (elapsed + retryDelay > maxElapsed) {
      logger.warn(
        'fetchProfileWithValidatedMedia: timed out waiting for valid media URLs',
      )
      return res
    }

    onStateChange?.('Waiting for media to be ready...')
    await new Promise(resolve => setTimeout(resolve, retryDelay))
  }
}

export function* findAllProfilesInQueryData(
  queryClient: QueryClient,
  did: string,
): Generator<AppBskyActorDefs.ProfileViewDetailed, void> {
  const profileQueryDatas =
    queryClient.getQueriesData<AppBskyActorDefs.ProfileViewDetailed>({
      queryKey: [RQKEY_ROOT],
    })
  for (const [_queryKey, queryData] of profileQueryDatas) {
    if (!queryData) {
      continue
    }
    if (queryData.did === did) {
      yield queryData
    }
  }
  const profilesQueryDatas =
    queryClient.getQueriesData<AppBskyActorGetProfiles.OutputSchema>({
      queryKey: [profilesQueryKeyRoot],
    })
  for (const [_queryKey, queryData] of profilesQueryDatas) {
    if (!queryData) {
      continue
    }
    for (let profile of queryData.profiles) {
      if (profile.did === did) {
        yield profile
      }
    }
  }
}

export function findProfileQueryData(
  queryClient: QueryClient,
  did: string,
): AppBskyActorDefs.ProfileViewDetailed | undefined {
  return queryClient.getQueryData<AppBskyActorDefs.ProfileViewDetailed>(
    RQKEY(did),
  )
}

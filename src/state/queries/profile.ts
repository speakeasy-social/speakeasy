import {useCallback} from 'react'
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
import {
  anonymizeAtProtoProfile,
  decryptProfileIfAccessible,
  deletePrivateProfile,
  getPrivateProfile,
  getPrivateProfiles,
  mergePrivateProfileData,
  migrateMediaToAtProto,
  savePrivateProfile,
} from '#/lib/api/private-profiles'
import {callSpeakeasyApiWithAgent, getErrorCode} from '#/lib/api/speakeasy'
import {until} from '#/lib/async/until'
import {useToggleMutationQueue} from '#/lib/hooks/useToggleMutationQueue'
import {logEvent, LogEvents, toClout} from '#/lib/statsig/statsig'
import {Shadow} from '#/state/cache/types'
import {
  addCachedFollowerDid,
  removeCachedFollowerDid,
} from '#/state/followers-cache'
import {STALE} from '#/state/queries'
import {resetProfilePostsQueries} from '#/state/queries/post-feed'
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
  loadError?: boolean // true if non-404 error occurred loading private profile
}

/**
 * Extended profile type that includes private profile metadata.
 */
export type ProfileViewDetailedWithPrivate =
  AppBskyActorDefs.ProfileViewDetailed & {
    _privateProfile?: PrivateProfileMetadata
  }

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

  return useQuery<ProfileViewDetailedWithPrivate>({
    // WARNING
    // this staleTime is load-bearing
    // if you remove it, the UI infinite-loops
    // -prf
    staleTime,
    refetchOnWindowFocus: true,
    queryKey: RQKEY(did ?? ''),
    queryFn: async () => {
      // Create call function for Speakeasy API
      const call = (options: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
        callSpeakeasyApiWithAgent(agent, options)

      // Fetch ATProto and Speakeasy profiles in parallel
      const [atprotoRes, privateResult] = await Promise.all([
        agent.getProfile({actor: did ?? ''}),
        getPrivateProfile(did ?? '', call).catch(err => {
          if (getErrorCode(err) === 'NotFound') return null
          return {_error: err} // Non-404 error
        }),
      ])

      let result: ProfileViewDetailedWithPrivate = atprotoRes.data

      if (privateResult && '_error' in privateResult) {
        // Load error - flag it so Edit button can be disabled
        result._privateProfile = {isPrivate: false, loadError: true}
      } else if (privateResult) {
        // Private profile found - decrypt and merge
        const decrypted = await decryptProfileIfAccessible(
          privateResult,
          currentAccount?.did ?? '',
          call,
        )
        if (decrypted) {
          result = mergePrivateProfileData(result, decrypted)
          result._privateProfile = {
            isPrivate: true,
            avatarUri: decrypted.avatarUri,
            bannerUri: decrypted.bannerUri,
          }
        }
      }
      // If no private profile, _privateProfile remains undefined (public mode)

      return result
    },
    placeholderData: () => {
      if (!did) return

      return queryClient.getQueryData<AppBskyActorDefs.ProfileViewBasic>(
        profileBasicQueryKey(did),
      )
    },
    enabled: !!did,
  })
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

      // Fetch private profiles in batch (silent failure)
      let privateProfiles: Awaited<ReturnType<typeof getPrivateProfiles>> = []
      try {
        privateProfiles = await getPrivateProfiles(dids, call)
      } catch {
        // Silent fallback - show ATProto data only
      }

      // Create a map of DID -> decrypted private data
      const privateDataMap = new Map<
        string,
        Awaited<ReturnType<typeof decryptProfileIfAccessible>>
      >()
      for (const encrypted of privateProfiles) {
        const decrypted = await decryptProfileIfAccessible(
          encrypted,
          currentAccount?.did ?? '',
          call,
        )
        if (decrypted) {
          privateDataMap.set(encrypted.did, decrypted)
        }
      }

      // Merge private data into profiles
      const mergedProfiles = res.data.profiles.map(profile => {
        const privateData = privateDataMap.get(profile.did)
        return mergePrivateProfileData(profile, privateData)
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
          return res.data
        },
      })
    },
    [queryClient, agent],
  )
  return prefetchProfileQuery
}

interface ProfileUpdateParams {
  profile: AppBskyActorDefs.ProfileView
  updates:
    | AppBskyActorProfile.Record
    | ((existing: AppBskyActorProfile.Record) => AppBskyActorProfile.Record)
  newUserAvatar?: RNImage | undefined | null
  newUserBanner?: RNImage | undefined | null
  checkCommitted?: (res: AppBskyActorGetProfile.Response) => boolean
  // Private profile fields
  isPrivate?: boolean
  existingPrivateAvatarUri?: string // Speakeasy media key for migration
  existingPrivateBannerUri?: string // Speakeasy media key for migration
}
export function useProfileUpdateMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  return useMutation<void, Error, ProfileUpdateParams>({
    mutationFn: async ({
      profile,
      updates,
      newUserAvatar,
      newUserBanner,
      checkCommitted,
      isPrivate,
      existingPrivateAvatarUri,
      existingPrivateBannerUri,
    }) => {
      // Create call function for Speakeasy API
      const call = (options: Parameters<typeof callSpeakeasyApiWithAgent>[1]) =>
        callSpeakeasyApiWithAgent(agent, options)

      if (isPrivate) {
        // Becoming private or staying private:
        // 1. Save to Speakeasy first (handles media upload internally)
        // 2. Then anonymize ATProto profile

        await savePrivateProfile(agent, call, queryClient, {
          displayName:
            typeof updates === 'function' ? '' : updates.displayName || '',
          description:
            typeof updates === 'function' ? '' : updates.description || '',
          isPublic: false,
          newAvatar: newUserAvatar
            ? {path: newUserAvatar.path, mime: newUserAvatar.mime}
            : newUserAvatar, // null or undefined
          newBanner: newUserBanner
            ? {path: newUserBanner.path, mime: newUserBanner.mime}
            : newUserBanner,
          // If no new avatar, pass the existing ATProto avatar for migration
          existingAvatarUri:
            newUserAvatar === undefined
              ? (profile.avatar as string | undefined)
              : undefined,
          existingBannerUri:
            newUserBanner === undefined
              ? (profile.banner as string | undefined)
              : undefined,
        })

        // Anonymize ATProto profile
        const anonymized = anonymizeAtProtoProfile()
        await agent.upsertProfile(() => ({
          displayName: anonymized.displayName,
          description: anonymized.description,
          avatar: undefined,
          banner: undefined,
        }))

        await whenAppViewReady(agent, profile.did, res => {
          return (
            res.data.displayName === anonymized.displayName &&
            res.data.description === anonymized.description
          )
        })
      } else {
        // Becoming public or staying public:
        // 1. Migrate media from Speakeasy if needed
        // 2. Delete private profile from Speakeasy (ignore NotFound)
        // 3. Save to ATProto normally

        let newUserAvatarPromise:
          | Promise<ComAtprotoRepoUploadBlob.Response>
          | undefined
        let newUserBannerPromise:
          | Promise<ComAtprotoRepoUploadBlob.Response>
          | undefined

        if (newUserAvatar) {
          // User selected a new avatar
          newUserAvatarPromise = uploadBlob(
            agent,
            newUserAvatar.path,
            newUserAvatar.mime,
          )
        } else if (
          newUserAvatar === undefined &&
          existingPrivateAvatarUri &&
          !profile.avatar
        ) {
          // No new avatar, but we have a private avatar to migrate
          // (profile.avatar is empty because user was private)
          newUserAvatarPromise = migrateMediaToAtProto(
            existingPrivateAvatarUri,
            agent,
          )
        }

        if (newUserBanner) {
          // User selected a new banner
          newUserBannerPromise = uploadBlob(
            agent,
            newUserBanner.path,
            newUserBanner.mime,
          )
        } else if (
          newUserBanner === undefined &&
          existingPrivateBannerUri &&
          !profile.banner
        ) {
          // No new banner, but we have a private banner to migrate
          newUserBannerPromise = migrateMediaToAtProto(
            existingPrivateBannerUri,
            agent,
          )
        }

        // Delete private profile from Speakeasy (ignore NotFound)
        try {
          await deletePrivateProfile(call)
        } catch (error) {
          if (getErrorCode(error) !== 'NotFound') {
            throw error
          }
        }

        await agent.upsertProfile(async existing => {
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
          if (newUserAvatarPromise) {
            const res = await newUserAvatarPromise
            existing.avatar = res.data.blob
          } else if (newUserAvatar === null) {
            existing.avatar = undefined
          }
          if (newUserBannerPromise) {
            const res = await newUserBannerPromise
            existing.banner = res.data.blob
          } else if (newUserBanner === null) {
            existing.banner = undefined
          }
          return existing
        })
        await whenAppViewReady(
          agent,
          profile.did,
          checkCommitted ||
            (res => {
              if (typeof newUserAvatar !== 'undefined') {
                if (newUserAvatar === null && res.data.avatar) {
                  // url hasnt cleared yet
                  return false
                } else if (res.data.avatar === profile.avatar) {
                  // url hasnt changed yet
                  return false
                }
              }
              if (typeof newUserBanner !== 'undefined') {
                if (newUserBanner === null && res.data.banner) {
                  // url hasnt cleared yet
                  return false
                } else if (res.data.banner === profile.banner) {
                  // url hasnt changed yet
                  return false
                }
              }
              if (typeof updates === 'function') {
                return true
              }
              return (
                res.data.displayName === updates.displayName &&
                res.data.description === updates.description
              )
            }),
        )
      }
    },
    onSuccess(data, variables) {
      // invalidate cache
      queryClient.invalidateQueries({
        queryKey: RQKEY(variables.profile.did),
      })
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

import {AppBskyActorDefs, BskyAgent} from '@atproto/api'
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'

import {
  clearAll,
  getCachedPrivateProfile,
  isDidChecked,
  setCachedDek,
  upsertCachedPrivateProfiles,
} from '#/state/cache/private-profile-cache'
import {
  defaultCheckCommittedForPublicProfile,
  profileMutationFn,
  profileOnSuccess,
  type ProfileUpdateParams,
  RQKEY,
} from '../profile'

// Note: public-profile pronouns are handled by `savePronounsMutation` in
// `EditProfile.tsx` and are intentionally out of scope for this test file.
// Only private-profile pronouns (stored in the Speakeasy record) are tested here.

// --- Module mocks ---

// Partial mock: keep pure functions real, mock network operations
jest.mock('#/lib/api/private-profiles', () => {
  const actual = jest.requireActual<
    typeof import('#/lib/api/private-profiles')
  >('#/lib/api/private-profiles')
  return {
    ...actual,
    resolvePrivateProfileMedia: jest.fn(),
    writePrivateProfileRecord: jest.fn(),
    deletePrivateProfile: jest.fn(),
    migrateMediaToAtProto: jest.fn(),
  }
})

jest.mock('#/lib/api/speakeasy', () => {
  const actual = jest.requireActual<typeof import('#/lib/api/speakeasy')>(
    '#/lib/api/speakeasy',
  )
  return {
    ...actual,
    callSpeakeasyApiWithAgent: jest.fn(),
  }
})

jest.mock('#/lib/api', () => ({
  uploadBlob: jest.fn(),
}))

// Separate mock for the upload-blob module imported directly by private-profiles.ts
// (private-profiles.ts uses './upload-blob', not '#/lib/api')
jest.mock('#/lib/api/upload-blob', () => ({
  uploadBlob: jest.fn(),
}))

jest.mock('#/lib/api/feed/utils', () => ({
  getBaseCdnUrl: jest.fn(() => 'https://cdn.test'),
}))

jest.mock('#/lib/async/until', () => ({
  until: jest.fn<any>().mockResolvedValue(true),
}))

jest.mock('#/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}))

// Import mocked modules for setup
import {uploadBlob} from '#/lib/api'
import {
  deletePrivateProfile,
  migrateMediaToAtProto,
  resolvePrivateProfileMedia,
  writePrivateProfileRecord,
} from '#/lib/api/private-profiles'
import {uploadBlob as uploadBlobInternal} from '#/lib/api/upload-blob'
import {logger} from '#/logger'
const mockedUploadBlob = uploadBlob as jest.MockedFunction<typeof uploadBlob>
const mockedUploadBlobInternal = uploadBlobInternal as jest.MockedFunction<
  typeof uploadBlobInternal
>
const mockedResolveMedia = resolvePrivateProfileMedia as jest.MockedFunction<
  typeof resolvePrivateProfileMedia
>
const mockedWriteRecord = writePrivateProfileRecord as jest.MockedFunction<
  typeof writePrivateProfileRecord
>
const mockedDeletePrivate = deletePrivateProfile as jest.MockedFunction<
  typeof deletePrivateProfile
>
const mockedMigrateMedia = migrateMediaToAtProto as jest.MockedFunction<
  typeof migrateMediaToAtProto
>
const mockedLoggerWarn = logger.warn as jest.MockedFunction<typeof logger.warn>

// --- Test fixtures ---

const mockDid = 'did:plc:testuser123'
const mockDek = 'mock-dek-xyz'
const mockAvatarKey = 'media/avatar-abc123'
const mockBannerKey = 'media/banner-def456'
const mockCdnAvatar = 'https://cdn.bsky.app/img/avatar/migrated.jpg'
const mockCdnBanner = 'https://cdn.bsky.app/img/banner/migrated.jpg'

function makeProfile(
  overrides: Partial<AppBskyActorDefs.ProfileViewDetailed> = {},
): AppBskyActorDefs.ProfileViewDetailed {
  return {
    did: mockDid,
    handle: 'test.bsky.social',
    displayName: 'Test User',
    description: 'A test user',
    avatar: 'https://cdn.bsky.app/avatar/old.jpg',
    banner: 'https://cdn.bsky.app/banner/old.jpg',
    followersCount: 10,
    followsCount: 5,
    postsCount: 42,
    indexedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeAgent(): BskyAgent {
  return {
    did: mockDid,
    upsertProfile: jest.fn<any>().mockResolvedValue(undefined),
    app: {
      bsky: {
        actor: {
          getProfile: jest.fn<any>().mockResolvedValue({
            data: {
              did: mockDid,
              handle: 'test.bsky.social',
              displayName: 'Alice Public',
              description: 'My public bio',
              avatar: mockCdnAvatar,
              banner: mockCdnBanner,
              followersCount: 10,
              followsCount: 5,
              postsCount: 42,
              indexedAt: '2024-01-01T00:00:00Z',
            },
          }),
        },
      },
    },
    api: {
      com: {
        atproto: {
          repo: {
            deleteRecord: jest.fn<any>().mockResolvedValue(undefined),
          },
        },
      },
    },
    session: {accessJwt: 'mock-jwt'},
  } as unknown as BskyAgent
}

function makePrivateParams(
  overrides: Partial<ProfileUpdateParams> = {},
): ProfileUpdateParams {
  return {
    profile: makeProfile(),
    updates: (existing: any) => {
      existing = existing || {}
      existing.displayName = 'Alice Private'
      existing.description = 'My private bio'
      return existing
    },
    isPrivate: true,
    privateDisplayName: 'Alice Private',
    privateDescription: 'My private bio',
    pronouns: {native: 'she/her', sets: [{forms: ['she', 'her']}]},
    ...overrides,
  }
}

function makePublicParams(
  overrides: Partial<ProfileUpdateParams> = {},
): ProfileUpdateParams {
  return {
    profile: makeProfile(),
    updates: (existing: any) => {
      existing = existing || {}
      existing.displayName = 'Alice Public'
      existing.description = 'My public bio'
      return existing
    },
    privateDisplayName: 'Alice Public',
    privateDescription: 'My public bio',
    ...overrides,
  }
}

// --- Test helpers ---

let queryClient: QueryClient
let mockAgent: BskyAgent

async function runMutationAndOnSuccess(params: ProfileUpdateParams) {
  const result = await profileMutationFn(mockAgent, queryClient, params)
  await profileOnSuccess(queryClient, mockAgent, result, params)
  return {
    result,
    queryData: queryClient.getQueryData(RQKEY(mockDid)) as any,
    cachedPrivate: getCachedPrivateProfile(mockDid),
    isChecked: isDidChecked(mockDid),
  }
}

// --- Tests ---

describe('profileMutationFn + profileOnSuccess', () => {
  let savedFetch: typeof global.fetch

  afterEach(() => {
    queryClient.clear()
    global.fetch = savedFetch
  })

  beforeEach(() => {
    jest.clearAllMocks()
    savedFetch = global.fetch
    global.fetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      headers: {get: () => 'image/jpeg'},
    }) as any
    queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    })
    clearAll()
    setCachedDek(mockDid, mockDek)
    queryClient.setQueryData(RQKEY(mockDid), makeProfile())

    // Default mock: resolvePrivateProfileMedia returns session + keys
    mockedResolveMedia.mockResolvedValue({
      sessionId: 'session-123',
      sessionKey: 'key-abc',
      avatarUri: mockAvatarKey,
      bannerUri: mockBannerKey,
    })
    mockedWriteRecord.mockResolvedValue(undefined)
    mockedDeletePrivate.mockResolvedValue(undefined)
    mockedUploadBlob.mockResolvedValue({
      data: {
        blob: {
          $type: 'blob',
          ref: {$link: 'bafymock123'},
          mimeType: 'image/jpeg',
          size: 1000,
        },
      },
    } as any)

    mockAgent = makeAgent()
  })

  describe('save as private', () => {
    it('returns complete PrivateProfileData with resolved media keys', async () => {
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePrivateParams(),
      )

      expect(result.type).toBe('private')
      if (result.type !== 'private') return

      expect(result.privateData).toEqual({
        displayName: 'Alice Private',
        description: 'My private bio',
        avatarUri: mockAvatarKey,
        bannerUri: mockBannerKey,
        pronouns: 'she/her',
      })
    })

    it('returns undefined avatarUri when avatar deleted (newAvatar=null)', async () => {
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-123',
        sessionKey: 'key-abc',
        avatarUri: undefined,
        bannerUri: mockBannerKey,
      })

      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePrivateParams({newUserAvatar: null}),
      )

      if (result.type !== 'private') throw new Error('expected private')
      expect(result.privateData.avatarUri).toBeUndefined()
    })

    it('returns existing key when avatar unchanged (newAvatar=undefined)', async () => {
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-123',
        sessionKey: 'key-abc',
        avatarUri: 'media/existing-avatar',
        bannerUri: mockBannerKey,
      })

      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePrivateParams({
          existingPrivateAvatarUri: 'media/existing-avatar',
        }),
      )

      if (result.type !== 'private') throw new Error('expected private')
      expect(result.privateData.avatarUri).toBe('media/existing-avatar')
    })

    it('returns new key when avatar changed (newAvatar={path,mime})', async () => {
      const newKey = 'media/new-avatar-xyz'
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-123',
        sessionKey: 'key-abc',
        avatarUri: newKey,
        bannerUri: mockBannerKey,
      })

      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePrivateParams({
          newUserAvatar: {
            path: 'data:image/jpeg;base64,/9j/4AAQ',
            mime: 'image/jpeg',
          } as any,
        }),
      )

      if (result.type !== 'private') throw new Error('expected private')
      expect(result.privateData.avatarUri).toBe(newKey)
    })

    it('anonymizes ATProto only after Speakeasy steps succeed', async () => {
      await profileMutationFn(mockAgent, queryClient, makePrivateParams())

      // Verify order: resolveMedia → writeRecord → upsertProfile (anonymize)
      const resolveOrder = mockedResolveMedia.mock.invocationCallOrder[0]
      const writeOrder = mockedWriteRecord.mock.invocationCallOrder[0]
      const upsertOrder = (mockAgent.upsertProfile as jest.Mock).mock
        .invocationCallOrder[0]

      expect(resolveOrder).toBeLessThan(writeOrder)
      expect(writeOrder).toBeLessThan(upsertOrder)
    })

    it('rolls back private profile if ATProto anonymize fails', async () => {
      ;(mockAgent.upsertProfile as jest.Mock<any>).mockRejectedValue(
        new Error('ATProto write failed'),
      )

      await expect(
        profileMutationFn(mockAgent, queryClient, makePrivateParams()),
      ).rejects.toThrow('ATProto write failed')

      expect(mockedDeletePrivate).toHaveBeenCalled()
    })
  })

  describe('save as public', () => {
    it('returns optimistic profile with canonical CDN URLs from getProfile', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
      })

      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
        }),
      )

      expect(result.type).toBe('public')
      expect(result.optimisticProfile.avatar).toBe(mockCdnAvatar)
    })

    it('returns fresh profile from getProfile when no migration needed', async () => {
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams(),
      )

      expect(result.type).toBe('public')
      // Uses the canonical CDN URL from the fresh getProfile fetch
      expect(result.optimisticProfile.avatar).toBe(mockCdnAvatar)
      expect(result.optimisticProfile.banner).toBe(mockCdnBanner)
    })

    it('waits for app view to index migrated media (migrationAwareCheck)', async () => {
      const {until} =
        jest.requireMock<typeof import('#/lib/async/until')>(
          '#/lib/async/until',
        )
      const mockedUntil = until as jest.MockedFunction<typeof until>

      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
      })

      await profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      // until is called by whenAppViewReady
      expect(mockedUntil).toHaveBeenCalled()
    })

    it('fetches fresh profile from getProfile after whenAppViewReady', async () => {
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams(),
      )

      // getProfile is called twice: once by whenAppViewReady (via until), once for fresh profile
      const getProfileMock = mockAgent.app.bsky.actor
        .getProfile as jest.MockedFunction<any>
      // The fresh fetch after whenAppViewReady
      expect(getProfileMock).toHaveBeenCalled()
      expect(result.optimisticProfile.avatar).toBe(mockCdnAvatar)
      expect(result.optimisticProfile.displayName).toBe('Alice Public')
    })
  })

  describe('onSuccess: private', () => {
    it('upserts private cache with resolved URLs', async () => {
      const {cachedPrivate} = await runMutationAndOnSuccess(makePrivateParams())

      expect(cachedPrivate).toBeDefined()
      expect(cachedPrivate!.displayName).toBe('Alice Private')
      expect(cachedPrivate!.avatarUri).toBe(`https://cdn.test/${mockAvatarKey}`)
      expect(cachedPrivate!.rawAvatarUri).toBe(mockAvatarKey)
    })

    it('sets query data with merged sentinel + private profile', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePrivateParams())

      expect(queryData.displayName).toBe('Alice Private')
      expect(queryData.description).toBe('My private bio')
      expect(queryData.avatar).toBe(`https://cdn.test/${mockAvatarKey}`)
    })

    it('markDidsChecked so batch fetcher skips this DID', async () => {
      const {isChecked} = await runMutationAndOnSuccess(makePrivateParams())
      expect(isChecked).toBe(true)
    })

    it('invalidates feed queries so stale pre-sentinel author profiles are not shown', async () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')

      await runMutationAndOnSuccess(makePrivateParams())

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({queryKey: ['post-feed']}),
      )
      spy.mockRestore()
    })
  })

  describe('onSuccess: public', () => {
    it('evicts DID from private cache', async () => {
      // Pre-populate cache with private data
      upsertCachedPrivateProfiles(
        new Map([
          [
            mockDid,
            {
              displayName: 'Old Private',
              description: 'old',
              avatarUri: 'https://cdn.test/old',
            },
          ],
        ]),
      )

      const {cachedPrivate} = await runMutationAndOnSuccess(makePublicParams())
      expect(cachedPrivate).toBeUndefined()
    })

    it('marks DID as checked (no private profile)', async () => {
      const {isChecked} = await runMutationAndOnSuccess(makePublicParams())
      expect(isChecked).toBe(true)
    })

    it('sets query data with canonical CDN URLs from getProfile', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
      })

      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      expect(queryData.avatar).toBe(mockCdnAvatar)
    })

    it('invalidates feed queries so stale sentinel profile data is not shown', async () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')

      await runMutationAndOnSuccess(makePublicParams())

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({queryKey: ['post-feed']}),
      )
      spy.mockRestore()
    })

    it('_privateProfile metadata is {isPrivate: false}', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePublicParams())
      expect(queryData._privateProfile).toEqual({isPrivate: false})
    })
  })

  describe('full flows', () => {
    it('private→public: query data has canonical CDN URLs', async () => {
      // Save as private first
      await runMutationAndOnSuccess(makePrivateParams())

      // Now go public with migration
      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
      })

      const {queryData, cachedPrivate} = await runMutationAndOnSuccess(
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
          existingPrivateBannerUri: mockBannerKey,
        }),
      )

      // Private cache evicted
      expect(cachedPrivate).toBeUndefined()
      // Query data has canonical CDN URLs from getProfile
      expect(queryData.avatar).toBe(mockCdnAvatar)
      expect(queryData.banner).toBe(mockCdnBanner)
      expect(queryData._privateProfile.isPrivate).toBe(false)
    })

    it('private→public→private: new Speakeasy keys, not stale', async () => {
      // Save as private
      await runMutationAndOnSuccess(makePrivateParams())

      // Go public
      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
      })
      await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      // Go back to private with NEW media keys
      const newAvatarKey = 'media/fresh-avatar-999'
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-456',
        sessionKey: 'key-def',
        avatarUri: newAvatarKey,
        bannerUri: mockBannerKey,
      })

      const {cachedPrivate, queryData} = await runMutationAndOnSuccess(
        makePrivateParams(),
      )

      // Cache has fresh keys, not stale ones
      expect(cachedPrivate!.rawAvatarUri).toBe(newAvatarKey)
      expect(queryData.avatar).toBe(`https://cdn.test/${newAvatarKey}`)
    })

    it('private→public→private: CDN URLs from getProfile migrated correctly', async () => {
      // After going public, optimistic profile has canonical CDN URLs from getProfile.
      // When going back to private, resolvePrivateProfileMedia handles HTTP URL migration.

      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-789',
        sessionKey: 'key-ghi',
        avatarUri: 'media/migrated-from-cdn',
        bannerUri: undefined,
      })

      const {cachedPrivate} = await runMutationAndOnSuccess(
        makePrivateParams({
          profile: makeProfile({avatar: mockCdnAvatar}),
        }),
      )

      // Key should be a Speakeasy key, not a CDN URL
      expect(cachedPrivate!.rawAvatarUri).toBe('media/migrated-from-cdn')
      expect(cachedPrivate!.rawAvatarUri).not.toMatch(/^https?:/)
    })

    it('delete avatar while private→reopen: no avatar in cache or query', async () => {
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-123',
        sessionKey: 'key-abc',
        avatarUri: undefined, // deleted
        bannerUri: mockBannerKey,
      })

      const {cachedPrivate, queryData} = await runMutationAndOnSuccess(
        makePrivateParams({newUserAvatar: null}),
      )

      expect(cachedPrivate!.rawAvatarUri).toBeUndefined()
      expect(cachedPrivate!.avatarUri).toBeUndefined()
      // Avatar falls through to sentinel's undefined
      expect(queryData.avatar).toBeUndefined()
    })

    it('public save then private save: evicted cache not re-populated', async () => {
      // Pre-populate with stale private data
      upsertCachedPrivateProfiles(
        new Map([
          [
            mockDid,
            {
              displayName: 'Stale',
              description: 'stale',
              avatarUri: 'https://cdn.test/stale',
              rawAvatarUri: 'media/stale',
            },
          ],
        ]),
      )

      // Go public — should evict
      await runMutationAndOnSuccess(makePublicParams())
      expect(getCachedPrivateProfile(mockDid)).toBeUndefined()
      expect(isDidChecked(mockDid)).toBe(true)

      // Go private — should get fresh data, not stale
      const freshKey = 'media/fresh-key'
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-new',
        sessionKey: 'key-new',
        avatarUri: freshKey,
        bannerUri: undefined,
      })

      const {cachedPrivate} = await runMutationAndOnSuccess(makePrivateParams())
      expect(cachedPrivate!.rawAvatarUri).toBe(freshKey)
    })
  })

  // ============================================================
  // Scenario-based tests: all 8 edit profile transitions
  // ============================================================

  describe('scenario 1: edit public profile with new avatar/banner upload', () => {
    const newAvatarImg = {
      path: '/tmp/new-avatar.jpg',
      mime: 'image/jpeg',
    } as any
    const newBannerImg = {
      path: '/tmp/new-banner.jpg',
      mime: 'image/jpeg',
    } as any

    it('uploadBlob is called for both avatar and banner', async () => {
      await runMutationAndOnSuccess(
        makePublicParams({
          newUserAvatar: newAvatarImg,
          newUserBanner: newBannerImg,
        }),
      )
      expect(mockedUploadBlob).toHaveBeenCalledTimes(2)
      expect(mockedUploadBlob).toHaveBeenCalledWith(
        mockAgent,
        '/tmp/new-avatar.jpg',
        'image/jpeg',
      )
    })

    it('queryData.avatar comes from fresh getProfile (not uploadBlob blob ref)', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({newUserAvatar: newAvatarImg}),
      )
      // Fresh getProfile returns mockCdnAvatar — the canonical URL
      expect(queryData.avatar).toBe(mockCdnAvatar)
    })

    it('queryData._privateProfile is {isPrivate: false}', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({newUserAvatar: newAvatarImg}),
      )
      expect(queryData._privateProfile).toEqual({isPrivate: false})
    })

    it('displayName and description are updated', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({newUserAvatar: newAvatarImg}),
      )
      expect(queryData.displayName).toBe('Alice Public')
      expect(queryData.description).toBe('My public bio')
    })

    it('queryData.banner comes from fresh getProfile', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({newUserBanner: newBannerImg}),
      )
      expect(queryData.banner).toBe(mockCdnBanner)
    })

    it('private cache is not populated', async () => {
      const {cachedPrivate} = await runMutationAndOnSuccess(
        makePublicParams({newUserAvatar: newAvatarImg}),
      )
      expect(cachedPrivate).toBeUndefined()
    })
  })

  describe('scenario 2: edit private profile with new avatar/banner upload', () => {
    const newKey = 'media/new-avatar-xyz'
    const newBKey = 'media/new-banner-xyz'

    beforeEach(() => {
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-123',
        sessionKey: 'key-abc',
        avatarUri: newKey,
        bannerUri: newBKey,
      })
    })

    it('_privateProfile.avatarUri is the raw Speakeasy key, not a CDN URL', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({
          newUserAvatar: {
            path: '/tmp/new-avatar.jpg',
            mime: 'image/jpeg',
          } as any,
        }),
      )
      expect(queryData._privateProfile.avatarUri).toBe(newKey)
      expect(queryData._privateProfile.avatarUri).not.toMatch(/^https?:/)
    })

    it('queryData.avatar is the resolved CDN URL', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({
          newUserAvatar: {
            path: '/tmp/new-avatar.jpg',
            mime: 'image/jpeg',
          } as any,
        }),
      )
      expect(queryData.avatar).toBe(`https://cdn.test/${newKey}`)
    })

    it('_privateProfile.dek is set', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePrivateParams())
      expect(queryData._privateProfile.dek).toBe('key-abc')
    })

    it('_privateProfile.isPrivate is true', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePrivateParams())
      expect(queryData._privateProfile.isPrivate).toBe(true)
    })

    it('cachedPrivate.rawAvatarUri is the raw key', async () => {
      const {cachedPrivate} = await runMutationAndOnSuccess(makePrivateParams())
      expect(cachedPrivate!.rawAvatarUri).toBe(newKey)
    })

    it('cachedPrivate.avatarUri is the CDN URL', async () => {
      const {cachedPrivate} = await runMutationAndOnSuccess(makePrivateParams())
      expect(cachedPrivate!.avatarUri).toBe(`https://cdn.test/${newKey}`)
    })

    it('displayName and description are set correctly', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePrivateParams())
      expect(queryData.displayName).toBe('Alice Private')
      expect(queryData.description).toBe('My private bio')
    })

    it('_privateProfile.bannerUri is the raw Speakeasy key', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePrivateParams())
      expect(queryData._privateProfile.bannerUri).toBe(newBKey)
    })

    it('cachedPrivate.rawBannerUri is the raw key', async () => {
      const {cachedPrivate} = await runMutationAndOnSuccess(makePrivateParams())
      expect(cachedPrivate!.rawBannerUri).toBe(newBKey)
    })

    it('cachedPrivate.bannerUri is the CDN URL', async () => {
      const {cachedPrivate} = await runMutationAndOnSuccess(makePrivateParams())
      expect(cachedPrivate!.bannerUri).toBe(`https://cdn.test/${newBKey}`)
    })

    it('result.privateData.pronouns is set', async () => {
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePrivateParams(),
      )
      if (result.type !== 'private') throw new Error('expected private')
      expect(result.privateData.pronouns).toBe('she/her')
    })
  })

  describe('scenario 3: public → private transition', () => {
    it('resolvePrivateProfileMedia receives profile.avatar as existingAvatarUri when no new avatar', async () => {
      const profileWithAvatar = makeProfile({
        avatar: 'https://cdn.bsky.app/avatar/old.jpg',
      })
      await runMutationAndOnSuccess(
        makePrivateParams({profile: profileWithAvatar}),
      )
      expect(mockedResolveMedia).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          existingAvatarUri: 'https://cdn.bsky.app/avatar/old.jpg',
        }),
      )
    })

    it('_privateProfile.isPrivate is true after transition', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePrivateParams())
      expect(queryData._privateProfile.isPrivate).toBe(true)
    })

    it('_privateProfile.publicDescription is set when publicDescription param provided', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({publicDescription: 'This profile is private'}),
      )
      // If this fails: withPrivateProfileMeta does not store publicDescription
      expect(queryData._privateProfile.publicDescription).toBe(
        'This profile is private',
      )
    })

    it('queryData.avatar is the CDN URL after transition', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePrivateParams())
      expect(queryData.avatar).toBe(`https://cdn.test/${mockAvatarKey}`)
    })

    it('_privateProfile.bannerUri is set after transition', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePrivateParams())
      expect(queryData._privateProfile.bannerUri).toBe(mockBannerKey)
    })

    it('result.privateData.pronouns is set after transition', async () => {
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePrivateParams(),
      )
      if (result.type !== 'private') throw new Error('expected private')
      expect(result.privateData.pronouns).toBe('she/her')
    })
  })

  describe('scenario 4: private → public transition', () => {
    it('resolvePrivateProfileMedia is NOT called for the public save', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      await runMutationAndOnSuccess(
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
          existingPrivateBannerUri: mockBannerKey,
        }),
      )
      expect(mockedResolveMedia).not.toHaveBeenCalled()
      expect(mockedMigrateMedia).toHaveBeenCalled()
    })

    it('queryData.avatar is the CDN URL from fresh getProfile', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(queryData.avatar).toBe(mockCdnAvatar)
    })

    it('private cache is evicted after going public', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      upsertCachedPrivateProfiles(
        new Map([
          [
            mockDid,
            {
              displayName: 'Alice Private',
              description: 'bio',
              avatarUri: `https://cdn.test/${mockAvatarKey}`,
              rawAvatarUri: mockAvatarKey,
            },
          ],
        ]),
      )
      const {cachedPrivate} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(cachedPrivate).toBeUndefined()
    })

    it('_privateProfile.isPrivate is false after transition', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(queryData._privateProfile.isPrivate).toBe(false)
    })

    it('queryData.banner is the CDN URL after transition', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
          existingPrivateBannerUri: mockBannerKey,
        }),
      )
      expect(queryData.banner).toBe(mockCdnBanner)
    })

    it('displayName and description are correct after going public', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(queryData.displayName).toBe('Alice Public')
      expect(queryData.description).toBe('My public bio')
    })

    it('_privateProfile has no avatarUri after going public (correct for modal re-open)', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(queryData._privateProfile).toEqual({isPrivate: false})
    })

    it('banner is undefined in _privateProfile after going public', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
          existingPrivateBannerUri: mockBannerKey,
        }),
      )
      expect(queryData._privateProfile.bannerUri).toBeUndefined()
    })
  })

  describe('scenario 5: public → private (no new images, profile has no avatar)', () => {
    beforeEach(() => {
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-123',
        sessionKey: 'key-abc',
        avatarUri: undefined,
        bannerUri: undefined,
      })
    })

    it('resolvePrivateProfileMedia receives undefined existingAvatarUri when profile has no avatar', async () => {
      const profileNoAvatar = makeProfile({
        avatar: undefined,
        banner: undefined,
      })
      await runMutationAndOnSuccess(
        makePrivateParams({profile: profileNoAvatar}),
      )
      expect(mockedResolveMedia).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          existingAvatarUri: undefined,
          existingBannerUri: undefined,
        }),
      )
    })

    it('_privateProfile.isPrivate is true', async () => {
      const profileNoAvatar = makeProfile({
        avatar: undefined,
        banner: undefined,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({profile: profileNoAvatar}),
      )
      expect(queryData._privateProfile.isPrivate).toBe(true)
    })

    it('queryData.avatar and banner are undefined (no media)', async () => {
      const profileNoAvatar = makeProfile({
        avatar: undefined,
        banner: undefined,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({profile: profileNoAvatar}),
      )
      expect(queryData.avatar).toBeUndefined()
      expect(queryData.banner).toBeUndefined()
    })

    it('_privateProfile.avatarUri is undefined', async () => {
      const profileNoAvatar = makeProfile({
        avatar: undefined,
        banner: undefined,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({profile: profileNoAvatar}),
      )
      expect(queryData._privateProfile.avatarUri).toBeUndefined()
    })
  })

  describe('scenario 5b: public → private, profile has existing avatar, no new images', () => {
    const existingCdnAvatar = 'https://cdn.bsky.app/avatar/old.jpg'
    const existingCdnBanner = 'https://cdn.bsky.app/banner/old.jpg'
    const newPrivateKey = 'media/encrypted-existing-avatar'
    const newPrivateBannerKey = 'media/encrypted-existing-banner'

    beforeEach(() => {
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-123',
        sessionKey: 'key-abc',
        avatarUri: newPrivateKey,
        bannerUri: newPrivateBannerKey,
      })
    })

    it('resolvePrivateProfileMedia receives the CDN avatar as existingAvatarUri', async () => {
      const profileWithAvatar = makeProfile({
        avatar: existingCdnAvatar,
        banner: existingCdnBanner,
      })
      await runMutationAndOnSuccess(
        makePrivateParams({
          profile: profileWithAvatar,
          newUserAvatar: undefined,
          existingPrivateAvatarUri: undefined,
        }),
      )
      expect(mockedResolveMedia).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          existingAvatarUri: existingCdnAvatar,
        }),
      )
    })

    it('_privateProfile.avatarUri is a raw Speakeasy key (not CDN URL)', async () => {
      const profileWithAvatar = makeProfile({avatar: existingCdnAvatar})
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({
          profile: profileWithAvatar,
          newUserAvatar: undefined,
          existingPrivateAvatarUri: undefined,
        }),
      )
      expect(queryData._privateProfile.avatarUri).toBe(newPrivateKey)
      expect(queryData._privateProfile.avatarUri).not.toMatch(/^https/)
    })

    it('queryData.avatar is the resolved CDN URL', async () => {
      const profileWithAvatar = makeProfile({avatar: existingCdnAvatar})
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({
          profile: profileWithAvatar,
          newUserAvatar: undefined,
          existingPrivateAvatarUri: undefined,
        }),
      )
      expect(queryData.avatar).toBe(`https://cdn.test/${newPrivateKey}`)
    })

    it('displayName and description are set correctly', async () => {
      const profileWithAvatar = makeProfile({avatar: existingCdnAvatar})
      const {queryData} = await runMutationAndOnSuccess(
        makePrivateParams({
          profile: profileWithAvatar,
          newUserAvatar: undefined,
          existingPrivateAvatarUri: undefined,
        }),
      )
      expect(queryData.displayName).toBe('Alice Private')
      expect(queryData.description).toBe('My private bio')
    })
  })

  describe('scenario 6: private → public (no new images)', () => {
    it('migrateMediaToAtProto called with existing Speakeasy key', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(mockedMigrateMedia).toHaveBeenCalledWith(
        mockAvatarKey,
        mockAgent,
        mockDek,
      )
    })

    it('DID is marked as checked after going public', async () => {
      const {isChecked} = await runMutationAndOnSuccess(makePublicParams())
      expect(isChecked).toBe(true)
    })

    it('queryData.avatar and banner are the CDN URLs from getProfile', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
          existingPrivateBannerUri: mockBannerKey,
        }),
      )
      expect(queryData.avatar).toBe(mockCdnAvatar)
      expect(queryData.banner).toBe(mockCdnBanner)
    })

    it('migrateMediaToAtProto called for banner too', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      await runMutationAndOnSuccess(
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
          existingPrivateBannerUri: mockBannerKey,
        }),
      )
      expect(mockedMigrateMedia).toHaveBeenCalledWith(
        mockBannerKey,
        mockAgent,
        mockDek,
      )
    })

    it('displayName and description are correct after going public', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePublicParams())
      expect(queryData.displayName).toBe('Alice Public')
      expect(queryData.description).toBe('My public bio')
    })

    it('_privateProfile has no avatarUri or bannerUri after going public', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePublicParams())
      expect(queryData._privateProfile).toEqual({isPrivate: false})
      expect(queryData._privateProfile.avatarUri).toBeUndefined()
      expect(queryData._privateProfile.bannerUri).toBeUndefined()
    })
  })

  describe('scenario 7: public → private, reopen modal, back to public', () => {
    it('second save uses _privateProfile.avatarUri from first save as existingPrivateAvatarUri', async () => {
      // Step 1: go private
      const {queryData: afterPrivate} = await runMutationAndOnSuccess(
        makePrivateParams(),
      )
      expect(afterPrivate._privateProfile.isPrivate).toBe(true)
      const savedAvatarKey = afterPrivate._privateProfile.avatarUri

      // Step 2: go back to public, passing the saved raw keys
      const savedBannerKey = afterPrivate._privateProfile.bannerUri
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData: afterPublic, cachedPrivate} =
        await runMutationAndOnSuccess(
          makePublicParams({
            existingPrivateAvatarUri: savedAvatarKey,
            existingPrivateBannerUri: savedBannerKey,
          }),
        )

      expect(afterPublic._privateProfile.isPrivate).toBe(false)
      expect(afterPublic.avatar).toBe(mockCdnAvatar)
      expect(afterPublic.banner).toBe(mockCdnBanner)
      expect(cachedPrivate).toBeUndefined()
      expect(mockedMigrateMedia).toHaveBeenCalledWith(
        savedAvatarKey,
        mockAgent,
        'key-abc', // dek set by profileOnSuccess after private save
      )
      expect(mockedMigrateMedia).toHaveBeenCalledWith(
        savedBannerKey,
        mockAgent,
        'key-abc', // dek set by profileOnSuccess after private save
      )
    })

    it('displayName and description are correct at each transition step', async () => {
      // Step 1: go private
      const {queryData: afterPrivate} = await runMutationAndOnSuccess(
        makePrivateParams(),
      )
      expect(afterPrivate.displayName).toBe('Alice Private')
      expect(afterPrivate.description).toBe('My private bio')

      // Step 2: go public
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData: afterPublic} = await runMutationAndOnSuccess(
        makePublicParams({
          existingPrivateAvatarUri: afterPrivate._privateProfile.avatarUri,
          existingPrivateBannerUri: afterPrivate._privateProfile.bannerUri,
        }),
      )
      // getProfile mock returns 'Alice Public' / 'My public bio'
      expect(afterPublic.displayName).toBe('Alice Public')
      expect(afterPublic.description).toBe('My public bio')
    })
  })

  describe('scenario 8: private → public, reopen modal, back to private', () => {
    it('second save migrates CDN URL back to Speakeasy', async () => {
      // Step 1: start private
      await runMutationAndOnSuccess(makePrivateParams())

      // Step 2: go public
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      const {queryData: afterPublic} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(afterPublic._privateProfile.isPrivate).toBe(false)
      expect(afterPublic.avatar).toBe(mockCdnAvatar)

      // Step 3: go back to private — profile now has CDN avatar
      const newPrivateKey = 'media/re-encrypted-avatar'
      const newPrivateBannerKey = 'media/re-encrypted-banner'
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-new',
        sessionKey: 'key-new',
        avatarUri: newPrivateKey,
        bannerUri: newPrivateBannerKey,
      })
      const profileAfterPublic = makeProfile({avatar: mockCdnAvatar})
      const {queryData: afterPrivate, cachedPrivate} =
        await runMutationAndOnSuccess(
          makePrivateParams({profile: profileAfterPublic}),
        )

      expect(afterPrivate._privateProfile.isPrivate).toBe(true)
      expect(afterPrivate._privateProfile.avatarUri).toBe(newPrivateKey)
      expect(afterPrivate._privateProfile.bannerUri).toBe(newPrivateBannerKey)
      expect(cachedPrivate!.rawAvatarUri).toBe(newPrivateKey)
      expect(cachedPrivate!.rawBannerUri).toBe(newPrivateBannerKey)
      // resolvePrivateProfileMedia received the CDN URL as existingAvatarUri
      expect(mockedResolveMedia).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({existingAvatarUri: mockCdnAvatar}),
      )
    })

    it('displayName and description are correct at final private save', async () => {
      // Step 1: start private
      await runMutationAndOnSuccess(makePrivateParams())

      // Step 2: go public
      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      // Step 3: go back to private
      const newPrivateKey = 'media/re-encrypted-avatar'
      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-new',
        sessionKey: 'key-new',
        avatarUri: newPrivateKey,
        bannerUri: undefined,
      })
      const {queryData: afterPrivate} = await runMutationAndOnSuccess(
        makePrivateParams({profile: makeProfile({avatar: mockCdnAvatar})}),
      )
      expect(afterPrivate.displayName).toBe('Alice Private')
      expect(afterPrivate.description).toBe('My private bio')
    })

    it('result.privateData.pronouns is set on final private save', async () => {
      // Go through the full flow
      await runMutationAndOnSuccess(makePrivateParams())

      mockedMigrateMedia.mockResolvedValue({
        response: {
          data: {blob: {$type: 'blob', ref: {$link: 'bafymig'}}},
        } as any,
      })
      await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-new',
        sessionKey: 'key-new',
        avatarUri: 'media/re-encrypted-avatar',
        bannerUri: undefined,
      })

      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePrivateParams({profile: makeProfile({avatar: mockCdnAvatar})}),
      )
      if (result.type !== 'private') throw new Error('expected private')
      expect(result.privateData.pronouns).toBe('she/her')
    })
  })

  describe('media URL validation and retry (fetchProfileWithValidatedMedia)', () => {
    let savedFetch: typeof global.fetch

    beforeEach(() => {
      savedFetch = global.fetch
      // Default: valid image response
      global.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        headers: {get: () => 'image/jpeg'},
      })
    })

    afterEach(() => {
      global.fetch = savedFetch
      jest.useRealTimers()
    })

    it('does not retry when URLs are already valid', async () => {
      // getProfile returns mockCdnAvatar/mockCdnBanner (defaults from makeAgent)
      // fetch returns image/jpeg so no retry needed
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams(),
      )
      await profileOnSuccess(queryClient, mockAgent, result, makePublicParams())

      const getProfile = mockAgent.app.bsky.actor
        .getProfile as jest.MockedFunction<any>
      expect(getProfile).toHaveBeenCalledTimes(1)

      const queryData = queryClient.getQueryData(RQKEY(mockDid)) as any
      expect(queryData.avatar).toBe(mockCdnAvatar)
    })

    it('retries when avatar is cdn.appview.com and returns valid on 2nd call', async () => {
      jest.useFakeTimers()

      const getProfile = mockAgent.app.bsky.actor
        .getProfile as jest.MockedFunction<any>
      let callCount = 0
      getProfile.mockImplementation(() => {
        callCount++
        const avatar =
          callCount === 1
            ? 'https://cdn.appview.com/img/avatar/pending.jpg'
            : mockCdnAvatar
        return Promise.resolve({
          data: {
            did: mockDid,
            handle: 'test.bsky.social',
            displayName: 'Alice Public',
            description: 'My public bio',
            avatar,
            banner: mockCdnBanner,
            followersCount: 10,
            followsCount: 5,
            postsCount: 42,
            indexedAt: '2024-01-01T00:00:00Z',
          },
        })
      })

      const mutationPromise = profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams(),
      )
      await jest.advanceTimersByTimeAsync(600)
      const result = await mutationPromise
      await profileOnSuccess(queryClient, mockAgent, result, makePublicParams())

      expect(getProfile).toHaveBeenCalledTimes(2)
      const queryData = queryClient.getQueryData(RQKEY(mockDid)) as any
      expect(queryData.avatar).toBe(mockCdnAvatar)
    })

    it('gives up after timeout and logs a warning', async () => {
      jest.useFakeTimers()

      const getProfile = mockAgent.app.bsky.actor
        .getProfile as jest.MockedFunction<any>
      getProfile.mockResolvedValue({
        data: {
          did: mockDid,
          handle: 'test.bsky.social',
          displayName: 'Alice Public',
          description: 'My public bio',
          avatar: 'https://cdn.appview.com/stuck.jpg',
          banner: mockCdnBanner,
          followersCount: 10,
          followsCount: 5,
          postsCount: 42,
          indexedAt: '2024-01-01T00:00:00Z',
        },
      })

      const mutationPromise = profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams(),
      )
      await jest.advanceTimersByTimeAsync(5000)
      await mutationPromise

      expect(mockedLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('timed out'),
      )
    })
  })

  // ============================================================
  // Integration tests: real migrateMediaToAtProto, I/O mocked
  // ============================================================
  // These tests intentionally do NOT mock migrateMediaToAtProto so that
  // the actual migration chain (fetch encrypted blob → decrypt → re-upload)
  // is exercised. Only the underlying I/O boundaries are mocked:
  //   - global.fetch: returns a plain JPEG blob (bypasses decryption since
  //     decryptEncryptedBlob is a passthrough for non-encrypted content types)
  //   - uploadBlobInternal: the uploadBlob used inside private-profiles.ts
  //
  // If migrateMediaToAtProto is broken (bad DEK handling, wrong URL format,
  // incorrect decryption path), these tests will fail where the mocked
  // version would still pass.

  describe('integration: private→public migration chain (migrateMediaToAtProto unmocked)', () => {
    const actualPrivateProfiles = jest.requireActual<
      typeof import('#/lib/api/private-profiles')
    >('#/lib/api/private-profiles')

    let savedFetch: typeof global.fetch

    beforeEach(() => {
      // Use the real migrateMediaToAtProto instead of the mock
      mockedMigrateMedia.mockImplementation(
        actualPrivateProfiles.migrateMediaToAtProto,
      )

      // Mock fetch to return a plain JPEG blob.
      // Since the blob type is 'image/jpeg' (not 'application/x-spkeasy-encrypted-media'),
      // decryptEncryptedBlob returns it unchanged — no real DEK needed for decryption.
      savedFetch = global.fetch
      ;(global as any).fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () =>
          Promise.resolve(new Blob(['fake-image-data'], {type: 'image/jpeg'})),
      })

      // Mock the uploadBlob used inside private-profiles.ts (imported directly from ./upload-blob)
      mockedUploadBlobInternal.mockResolvedValue({
        data: {
          blob: {
            $type: 'blob',
            ref: {$link: 'bafymockmigrated'},
            mimeType: 'image/jpeg',
            size: 1000,
          },
        },
      } as any)
    })

    afterEach(() => {
      global.fetch = savedFetch
    })

    it('avatar is a non-empty URL in queryData after private→public toggle', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      // getProfile (already mocked) returns mockCdnAvatar — migration must complete
      // without error for the fresh fetch to occur and this URL to appear
      expect(queryData.avatar).toBeTruthy()
      expect(queryData.avatar).toBe(mockCdnAvatar)
    })

    it('_privateProfile.isPrivate is false after private→public toggle', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(queryData._privateProfile.isPrivate).toBe(false)
    })

    it('_privateProfile has no avatarUri after going public', async () => {
      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )
      expect(queryData._privateProfile.avatarUri).toBeUndefined()
    })

    it('throws a clear error when DEK is missing during private→public migration', async () => {
      // Remove the cached DEK — simulates the case where the decryption key
      // is unavailable when buildAvatarBannerPromisesForPublicProfile is called
      clearAll()

      await expect(
        profileMutationFn(
          mockAgent,
          queryClient,
          makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
        ),
      ).rejects.toThrow('dek required to migrate private avatar to ATProto')
    })

    it('invalidates feed queries after private→public toggle', async () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')

      await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({queryKey: ['post-feed']}),
      )
      spy.mockRestore()
    })
  })

  // ============================================================
  // Dirty-check tests: skip unnecessary writes for already-private profiles
  // ============================================================

  describe('dirty-check: skip writes when nothing changed for already-private profile', () => {
    // Helper: make a profile that already has _privateProfile.isPrivate = true
    function makeAlreadyPrivateProfile(
      overrides: {publicDescription?: string} = {},
    ) {
      return {
        ...makeProfile({
          displayName: 'Alice Private',
          description: 'My private bio',
          avatar: undefined,
          banner: undefined,
        }),
        _privateProfile: {
          isPrivate: true,
          avatarUri: mockAvatarKey,
          bannerUri: mockBannerKey,
          dek: mockDek,
          publicDescription:
            overrides.publicDescription ?? 'This profile is private',
        },
      }
    }

    function makeAlreadyPrivateParams(
      overrides: Partial<ProfileUpdateParams> = {},
    ): ProfileUpdateParams {
      const profile = makeAlreadyPrivateProfile()
      return {
        profile,
        updates: (existing: any) => {
          existing = existing || {}
          existing.displayName = 'Alice Private'
          existing.description = 'My private bio'
          return existing
        },
        isPrivate: true,
        privateDisplayName: 'Alice Private',
        privateDescription: 'My private bio',
        publicDescription: 'This profile is private',
        existingPrivateAvatarUri: mockAvatarKey,
        existingPrivateBannerUri: mockBannerKey,
        pronouns: {native: 'she/her', sets: [{forms: ['she', 'her']}]},
        pronounsChanged: false,
        ...overrides,
      }
    }

    it('no changes: skips both Speakeasy write and ATProto upsert', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams(),
      )

      expect(mockedResolveMedia).not.toHaveBeenCalled()
      expect(mockedWriteRecord).not.toHaveBeenCalled()
      expect(mockAgent.upsertProfile).not.toHaveBeenCalled()
    })

    it('no changes: skips pronouns deleteRecord', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams(),
      )

      expect(mockAgent.api.com.atproto.repo.deleteRecord).not.toHaveBeenCalled()
    })

    it('no changes: result uses existing media URIs', async () => {
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams(),
      )

      if (result.type !== 'private') throw new Error('expected private')
      expect(result.privateData.avatarUri).toBe(mockAvatarKey)
      expect(result.privateData.bannerUri).toBe(mockBannerKey)
    })

    it('no changes: result.dek is existing cached DEK', async () => {
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams(),
      )

      if (result.type !== 'private') throw new Error('expected private')
      expect(result.dek).toBe(mockDek)
    })

    it('displayName changed: writes Speakeasy record, skips ATProto upsert', async () => {
      const profile = {
        ...makeAlreadyPrivateProfile(),
      }
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams({
          profile,
          privateDisplayName: 'Alice Renamed',
        }),
      )

      expect(mockedResolveMedia).toHaveBeenCalled()
      expect(mockedWriteRecord).toHaveBeenCalled()
      expect(mockAgent.upsertProfile).not.toHaveBeenCalled()
    })

    it('description changed: writes Speakeasy record, skips ATProto upsert', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams({
          privateDescription: 'Updated private bio',
        }),
      )

      expect(mockedResolveMedia).toHaveBeenCalled()
      expect(mockedWriteRecord).toHaveBeenCalled()
      expect(mockAgent.upsertProfile).not.toHaveBeenCalled()
    })

    it('publicDescription changed: writes ATProto upsert, skips Speakeasy write', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams({
          publicDescription: 'Updated public description',
        }),
      )

      expect(mockedResolveMedia).not.toHaveBeenCalled()
      expect(mockedWriteRecord).not.toHaveBeenCalled()
      expect(mockAgent.upsertProfile).toHaveBeenCalled()
    })

    it('publicDescription changed: skips pronouns deleteRecord (not transitioning)', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams({
          publicDescription: 'Updated public description',
        }),
      )

      expect(mockAgent.api.com.atproto.repo.deleteRecord).not.toHaveBeenCalled()
    })

    it('both displayName and publicDescription changed: both writes happen', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams({
          privateDisplayName: 'Alice Renamed',
          publicDescription: 'Updated public description',
        }),
      )

      expect(mockedResolveMedia).toHaveBeenCalled()
      expect(mockedWriteRecord).toHaveBeenCalled()
      expect(mockAgent.upsertProfile).toHaveBeenCalled()
    })

    it('new avatar: writes Speakeasy record', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams({
          newUserAvatar: {
            path: '/tmp/new-avatar.jpg',
            mime: 'image/jpeg',
          } as any,
        }),
      )

      expect(mockedResolveMedia).toHaveBeenCalled()
      expect(mockedWriteRecord).toHaveBeenCalled()
    })

    it('pronounsChanged=true: writes Speakeasy record', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams({pronounsChanged: true}),
      )

      expect(mockedResolveMedia).toHaveBeenCalled()
      expect(mockedWriteRecord).toHaveBeenCalled()
    })

    it('pronounsChanged=false, nothing else changed: skips Speakeasy write', async () => {
      await profileMutationFn(
        mockAgent,
        queryClient,
        makeAlreadyPrivateParams({pronounsChanged: false}),
      )

      expect(mockedResolveMedia).not.toHaveBeenCalled()
      expect(mockedWriteRecord).not.toHaveBeenCalled()
    })

    it('ATProto upsert failure: does NOT call deletePrivateProfile when no Speakeasy write', async () => {
      ;(mockAgent.upsertProfile as jest.Mock<any>).mockRejectedValue(
        new Error('ATProto write failed'),
      )

      await expect(
        profileMutationFn(
          mockAgent,
          queryClient,
          makeAlreadyPrivateParams({
            publicDescription: 'Updated public description',
          }),
        ),
      ).rejects.toThrow('ATProto write failed')

      // No Speakeasy record was written, so no rollback needed
      expect(mockedDeletePrivate).not.toHaveBeenCalled()
    })

    it('ATProto upsert failure: calls deletePrivateProfile when Speakeasy was written', async () => {
      ;(mockAgent.upsertProfile as jest.Mock<any>).mockRejectedValue(
        new Error('ATProto write failed'),
      )

      await expect(
        profileMutationFn(
          mockAgent,
          queryClient,
          makeAlreadyPrivateParams({
            privateDisplayName: 'Alice Renamed',
            publicDescription: 'Updated public description',
          }),
        ),
      ).rejects.toThrow('ATProto write failed')

      expect(mockedDeletePrivate).toHaveBeenCalled()
    })
  })
})

describe('defaultCheckCommittedForPublicProfile', () => {
  function makeResponse(
    overrides: Partial<AppBskyActorDefs.ProfileViewDetailed> = {},
  ) {
    return {
      data: {
        did: mockDid,
        handle: 'test.bsky.social',
        displayName: 'Alice',
        description: 'bio',
        avatar: 'https://cdn.bsky.app/avatar/new.jpg',
        banner: 'https://cdn.bsky.app/banner/new.jpg',
        ...overrides,
      },
    } as any
  }

  it('returns false (not yet committed) when profile had no prior avatar and app view returns null', () => {
    const profile = makeProfile({avatar: undefined})
    const check = defaultCheckCommittedForPublicProfile(
      profile,
      {displayName: 'Alice', description: 'bio'},
      {path: '/tmp/new.jpg', mime: 'image/jpeg'} as any,
      undefined,
    )
    // ATProto app view returns null for absent avatar — should not treat as committed
    const result = check(makeResponse({avatar: null as any}))
    expect(result).toBe(false)
  })

  it('returns true (committed) when app view returns the new avatar', () => {
    const profile = makeProfile({avatar: undefined})
    const newAvatarUrl = 'https://cdn.bsky.app/avatar/new.jpg'
    const check = defaultCheckCommittedForPublicProfile(
      profile,
      {displayName: 'Alice', description: 'bio'},
      {path: '/tmp/new.jpg', mime: 'image/jpeg'} as any,
      undefined,
    )
    const result = check(makeResponse({avatar: newAvatarUrl}))
    expect(result).toBe(true)
  })

  it('returns false when prior avatar matches app view (avatar not yet updated)', () => {
    const existingAvatar = 'https://cdn.bsky.app/avatar/old.jpg'
    const profile = makeProfile({avatar: existingAvatar})
    const check = defaultCheckCommittedForPublicProfile(
      profile,
      {displayName: 'Alice', description: 'bio'},
      {path: '/tmp/new.jpg', mime: 'image/jpeg'} as any,
      undefined,
    )
    // App view still returning old URL — not yet committed
    const result = check(makeResponse({avatar: existingAvatar}))
    expect(result).toBe(false)
  })
})

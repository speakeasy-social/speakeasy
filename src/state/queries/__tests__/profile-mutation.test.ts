import {AppBskyActorDefs, BskyAgent} from '@atproto/api'
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'

import {
  clearAll,
  getCachedPrivateProfile,
  isDidChecked,
  upsertCachedPrivateProfiles,
} from '#/state/cache/private-profile-cache'
import {
  profileMutationFn,
  profileOnSuccess,
  type ProfileUpdateParams,
  RQKEY,
} from '../profile'

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

jest.mock('#/lib/api/feed/utils', () => ({
  getBaseCdnUrl: jest.fn(() => 'https://cdn.test'),
}))

jest.mock('#/lib/async/until', () => ({
  until: jest.fn<any>().mockResolvedValue(true),
}))

jest.mock('#/logger', () => ({
  logger: {error: jest.fn(), info: jest.fn(), warn: jest.fn()},
}))

// Import mocked modules for setup
import {
  deletePrivateProfile,
  migrateMediaToAtProto,
  resolvePrivateProfileMedia,
  writePrivateProfileRecord,
} from '#/lib/api/private-profiles'
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

// --- Test fixtures ---

const mockDid = 'did:plc:testuser123'
const mockAvatarKey = 'media/avatar-abc123'
const mockBannerKey = 'media/banner-def456'
const mockBlobUrl = 'blob:http://localhost/avatar-blob'

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
              displayName: 'Private Profile',
              description: 'private desc',
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
  afterEach(() => {
    queryClient.clear()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    })
    clearAll()
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
    it('returns optimistic profile with blob URLs from migration', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
        blobUrl: mockBlobUrl,
      })

      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
        }),
      )

      expect(result.type).toBe('public')
      expect(result.optimisticProfile.avatar).toBe(mockBlobUrl)
    })

    it('returns existing avatar when no migration needed', async () => {
      const profile = makeProfile()
      const result = await profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams({profile}),
      )

      expect(result.type).toBe('public')
      expect(result.optimisticProfile.avatar).toBe(profile.avatar)
    })

    it('waits for app view to index migrated media (migrationAwareCheck)', async () => {
      const {until} =
        jest.requireMock<typeof import('#/lib/async/until')>(
          '#/lib/async/until',
        )
      const mockedUntil = until as jest.MockedFunction<typeof until>

      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
        blobUrl: mockBlobUrl,
      })

      await profileMutationFn(
        mockAgent,
        queryClient,
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      // until is called by whenAppViewReady
      expect(mockedUntil).toHaveBeenCalled()
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

    it('sets query data with optimistic profile (blob URLs)', async () => {
      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
        blobUrl: mockBlobUrl,
      })

      const {queryData} = await runMutationAndOnSuccess(
        makePublicParams({existingPrivateAvatarUri: mockAvatarKey}),
      )

      expect(queryData.avatar).toBe(mockBlobUrl)
    })

    it('does NOT invalidateQueries', async () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')

      await runMutationAndOnSuccess(makePublicParams())

      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('_privateProfile metadata is {isPrivate: false}', async () => {
      const {queryData} = await runMutationAndOnSuccess(makePublicParams())
      expect(queryData._privateProfile).toEqual({isPrivate: false})
    })
  })

  describe('full flows', () => {
    it('private→public: query data has working avatar/banner', async () => {
      // Save as private first
      await runMutationAndOnSuccess(makePrivateParams())

      // Now go public with migration
      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
        blobUrl: mockBlobUrl,
      })

      const {queryData, cachedPrivate} = await runMutationAndOnSuccess(
        makePublicParams({
          existingPrivateAvatarUri: mockAvatarKey,
          existingPrivateBannerUri: mockBannerKey,
        }),
      )

      // Private cache evicted
      expect(cachedPrivate).toBeUndefined()
      // Query data has blob URLs from migration
      expect(queryData.avatar).toBe(mockBlobUrl)
      expect(queryData._privateProfile.isPrivate).toBe(false)
    })

    it('private→public→private: new Speakeasy keys, not stale', async () => {
      // Save as private
      await runMutationAndOnSuccess(makePrivateParams())

      // Go public
      mockedMigrateMedia.mockResolvedValue({
        response: {data: {blob: 'blob-ref'}} as any,
        blobUrl: mockBlobUrl,
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

    it('private→public→private: blob: URLs migrated, not stored as keys', async () => {
      // After going public, optimistic profile may have blob: URL
      // When going back to private, resolvePrivateProfileMedia handles blob: migration
      // (tested in private-profiles.test.ts); here we verify the mutation doesn't
      // store blob: URLs as Speakeasy keys

      mockedResolveMedia.mockResolvedValue({
        sessionId: 'session-789',
        sessionKey: 'key-ghi',
        avatarUri: 'media/migrated-from-blob',
        bannerUri: undefined,
      })

      const {cachedPrivate} = await runMutationAndOnSuccess(
        makePrivateParams({
          profile: makeProfile({avatar: 'blob:http://localhost/some-blob'}),
        }),
      )

      // Key should be a Speakeasy key, not a blob: URL
      expect(cachedPrivate!.rawAvatarUri).toBe('media/migrated-from-blob')
      expect(cachedPrivate!.rawAvatarUri).not.toMatch(/^blob:/)
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
})

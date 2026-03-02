import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import type {PrivateProfileData} from '#/lib/api/private-profiles'

// --- Module mocks ---

jest.mock('#/lib/api/private-profiles', () => ({
  fetchPrivateProfiles: jest.fn(),
  mergePrivateProfileData: jest.fn((profile: any, privateData: any) => ({
    ...profile,
    ...privateData,
  })),
  shouldCheckPrivateProfile: jest.fn(() => false),
}))

jest.mock('#/state/cache/private-profile-cache', () => ({
  getCachedPrivateProfile: jest.fn(),
  markDidsChecked: jest.fn(),
  upsertCachedPrivateProfiles: jest.fn(),
}))

jest.mock('#/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}))

// Prevent the module from trying to resolve other imports at load time
jest.mock('#/lib/api/feed/private-posts', () => ({}))
jest.mock('#/lib/api/feed/utils', () => ({
  getBaseCdnUrl: jest.fn(() => 'https://cdn.test'),
}))
jest.mock('#/lib/api/speakeasy', () => ({callSpeakeasyApiWithAgent: jest.fn()}))
jest.mock('#/lib/moderatePost_wrapped', () => ({}))
jest.mock('#/state/queries/post-quotes', () => ({}))
jest.mock('#/state/queries/preferences/types', () => ({}))
jest.mock('#/state/queries/search-posts', () => ({}))
jest.mock('#/state/session', () => ({
  useAgent: jest.fn(),
  useSession: jest.fn(),
}))
jest.mock('#/state/queries/notifications/feed', () => ({}))
jest.mock('#/state/queries/post-feed', () => ({}))
jest.mock('#/state/queries/util', () => ({}))

import {fetchPrivateProfiles} from '#/lib/api/private-profiles'
import {
  getCachedPrivateProfile,
  markDidsChecked,
  upsertCachedPrivateProfiles,
} from '#/state/cache/private-profile-cache'
import {getPrivateProfilesForDids} from '#/state/queries/post-thread'

const mockedFetchPrivateProfiles = fetchPrivateProfiles as jest.MockedFunction<
  typeof fetchPrivateProfiles
>
const mockedGetCachedPrivateProfile =
  getCachedPrivateProfile as jest.MockedFunction<typeof getCachedPrivateProfile>
const mockedUpsertCachedPrivateProfiles =
  upsertCachedPrivateProfiles as jest.MockedFunction<
    typeof upsertCachedPrivateProfiles
  >
const mockedMarkDidsChecked = markDidsChecked as jest.MockedFunction<
  typeof markDidsChecked
>

const mockCall = jest.fn() as any
const mockBaseUrl = 'https://cdn.test'

const did1 = 'did:plc:user1'
const did2 = 'did:plc:user2'
const userDid = 'did:plc:viewer'
const mockDek = 'dek-abc'

function makePrivateData(
  overrides: Partial<PrivateProfileData> = {},
): PrivateProfileData {
  return {displayName: 'Private User', description: 'private bio', ...overrides}
}

describe('getPrivateProfilesForDids', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetCachedPrivateProfile.mockReturnValue(undefined)
    mockedFetchPrivateProfiles.mockResolvedValue({
      profiles: new Map(),
      deks: new Map(),
    } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns cached profiles without calling fetchPrivateProfiles', async () => {
    const cachedData = makePrivateData({displayName: 'Cached User'})
    mockedGetCachedPrivateProfile.mockImplementation(did => {
      if (did === did1) return cachedData
      return undefined
    })

    const result = await getPrivateProfilesForDids(
      [did1],
      userDid,
      mockCall,
      mockBaseUrl,
    )

    expect(result.get(did1)).toBe(cachedData)
    expect(mockedFetchPrivateProfiles).not.toHaveBeenCalled()
  })

  it('calls fetchPrivateProfiles for uncached DIDs and merges results', async () => {
    const freshData = makePrivateData({displayName: 'Fresh User'})
    mockedGetCachedPrivateProfile.mockReturnValue(undefined)
    mockedFetchPrivateProfiles.mockResolvedValue({
      profiles: new Map([[did1, freshData]]),
      deks: new Map([[did1, mockDek]]),
    } as any)

    const result = await getPrivateProfilesForDids(
      [did1],
      userDid,
      mockCall,
      mockBaseUrl,
    )

    expect(mockedFetchPrivateProfiles).toHaveBeenCalledWith(
      [did1],
      userDid,
      mockCall,
      mockBaseUrl,
    )
    expect(result.get(did1)).toBe(freshData)
  })

  it('passes DEKs from fetchPrivateProfiles to upsertCachedPrivateProfiles', async () => {
    // Regression: would have caught the broken caller that passed no deks
    const freshData = makePrivateData()
    const deks = new Map([[did1, mockDek]])
    mockedFetchPrivateProfiles.mockResolvedValue({
      profiles: new Map([[did1, freshData]]),
      deks,
    } as any)

    await getPrivateProfilesForDids([did1], userDid, mockCall, mockBaseUrl)

    expect(mockedUpsertCachedPrivateProfiles).toHaveBeenCalledWith(
      expect.any(Map),
      userDid,
      deks,
    )
  })

  it('returns partial results (cache-only) if fetchPrivateProfiles throws', async () => {
    const cachedData = makePrivateData({displayName: 'Cached'})
    mockedGetCachedPrivateProfile.mockImplementation(did => {
      if (did === did1) return cachedData
      return undefined
    })
    mockedFetchPrivateProfiles.mockRejectedValue(new Error('network error'))

    const result = await getPrivateProfilesForDids(
      [did1, did2],
      userDid,
      mockCall,
      mockBaseUrl,
    )

    // did1 was cached, so it's still present
    expect(result.get(did1)).toBe(cachedData)
    // did2 was uncached and fetch failed, so it's absent
    expect(result.has(did2)).toBe(false)
    // markDidsChecked is still called even on error
    expect(mockedMarkDidsChecked).toHaveBeenCalled()
  })

  it('returns empty map and skips fetchPrivateProfiles when userDid is undefined', async () => {
    const result = await getPrivateProfilesForDids(
      [did1, did2],
      undefined,
      mockCall,
      mockBaseUrl,
    )

    expect(result.size).toBe(0)
    expect(mockedFetchPrivateProfiles).not.toHaveBeenCalled()
  })
})

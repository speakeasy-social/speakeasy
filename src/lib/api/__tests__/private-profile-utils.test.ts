import {BskyAgent} from '@atproto/api'
import {describe, expect, it, jest} from '@jest/globals'

import {
  mergePrivateProfileData,
  parseSpeakeasyMediaKeyFromUrl,
  PRIVATE_PROFILE_DISPLAY_NAME,
  type PrivateProfileData,
} from '../private-profiles'

jest.mock('../feed/utils', () => ({
  getBaseCdnUrl: jest.fn(() => 'https://cdn.speakeasy.test/user-content'),
}))

const mockAgent = {} as unknown as BskyAgent

describe('parseSpeakeasyMediaKeyFromUrl', () => {
  it('Speakeasy CDN URL → returns the media key', () => {
    const result = parseSpeakeasyMediaKeyFromUrl(
      'https://cdn.speakeasy.test/user-content/media/abc123',
      mockAgent,
    )
    expect(result).toBe('media/abc123')
  })

  it('ATProto CDN URL → returns null (migration required)', () => {
    const result = parseSpeakeasyMediaKeyFromUrl(
      'https://cdn.bsky.app/img/avatar/abc123',
      mockAgent,
    )
    expect(result).toBeNull()
  })
})

describe('mergePrivateProfileData', () => {
  const baseProfile = {
    did: 'did:plc:alice',
    handle: 'alice.test',
    avatar: undefined as string | undefined,
    banner: undefined as string | undefined,
  }

  const privateData: PrivateProfileData = {
    displayName: 'Alice',
    description: 'Real bio',
    avatarUri: 'https://cdn.test/media/abc',
    bannerUri: undefined,
  }

  it('sentinel profile + private data → displayName and avatar merged', () => {
    const sentinelProfile = {
      ...baseProfile,
      displayName: PRIVATE_PROFILE_DISPLAY_NAME,
    }

    const result = mergePrivateProfileData(sentinelProfile, privateData)

    expect(result.displayName).toBe('Alice')
    expect(result.avatar).toBe('https://cdn.test/media/abc')
  })

  it('any profile + private data → private data always applied (caller decides whether to pass it)', () => {
    const publicProfile = {
      ...baseProfile,
      displayName: 'Regular User',
      avatar: 'https://cdn.bsky.app/original-avatar.jpg',
    }

    const result = mergePrivateProfileData(publicProfile, privateData)

    expect(result.displayName).toBe('Alice')
    expect(result.avatar).toBe('https://cdn.test/media/abc')
  })

  it('undefined displayName/description in private data falls back to ATProto values', () => {
    const sentinelProfile = {
      ...baseProfile,
      displayName: PRIVATE_PROFILE_DISPLAY_NAME,
      description: 'ATProto description',
    }

    const malformedPrivateData: PrivateProfileData = {
      displayName: undefined as unknown as string,
      description: undefined as unknown as string,
      avatarUri: 'https://cdn.test/media/abc',
    }

    const result = mergePrivateProfileData(
      sentinelProfile,
      malformedPrivateData,
    )

    expect(result.displayName).toBe(PRIVATE_PROFILE_DISPLAY_NAME)
    expect(result.description).toBe('ATProto description')
    expect(result.avatar).toBe('https://cdn.test/media/abc')
  })

  it('empty string displayName is preserved (not treated as undefined)', () => {
    const sentinelProfile = {
      ...baseProfile,
      displayName: PRIVATE_PROFILE_DISPLAY_NAME,
      description: 'ATProto description',
    }

    const emptyNameData: PrivateProfileData = {
      displayName: '',
      description: '',
    }

    const result = mergePrivateProfileData(sentinelProfile, emptyNameData)

    expect(result.displayName).toBe('')
    expect(result.description).toBe('')
  })
})

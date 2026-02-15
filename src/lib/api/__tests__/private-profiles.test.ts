import {BskyAgent} from '@atproto/api'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'

import * as encryption from '#/lib/encryption'
import {fetchPrivateProfiles, savePrivateProfile} from '../private-profiles'
import * as speakeasy from '../speakeasy'
import * as userKeys from '../user-keys'

// Mock external dependencies at module boundaries
jest.mock('../speakeasy')
jest.mock('../user-keys')
jest.mock('#/lib/encryption')

const mockedSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>
const mockedUserKeys = userKeys as jest.Mocked<typeof userKeys>
const mockedEncryption = encryption as jest.Mocked<typeof encryption>

describe('savePrivateProfile', () => {
  // Test fixtures
  const mockDid = 'did:plc:testuser123'
  const mockSessionId = 'session-abc-123'
  const mockEncryptedDek = 'encrypted-dek-base64'
  const mockDecryptedSessionKey = 'decrypted-session-key-256bit'
  const mockPrivateKey = 'mock-private-key'
  const mockUserKeyPairId = 'keypair-123'
  const mockEncryptedContent = 'encrypted-profile-data'
  const mockMediaKey = 'speakeasy-media-key-abc'
  const mockExistingAvatarUri = 'existing-avatar-uri'
  const mockExistingBannerUri = 'existing-banner-uri'

  let mockAgent: BskyAgent
  let mockCall: any
  let mockQueryClient: QueryClient

  beforeEach(() => {
    jest.clearAllMocks()

    mockAgent = {did: mockDid} as unknown as BskyAgent
    mockCall = jest.fn()
    mockQueryClient = {
      getQueryData: jest.fn(),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    // Default: session exists
    mockCall.mockImplementation(async (params: any) => {
      if (params.api === 'social.spkeasy.profileSession.getSession') {
        return {
          encryptedSessionKey: {
            sessionId: mockSessionId,
            encryptedDek: mockEncryptedDek,
          },
        }
      }
      if (params.api === 'social.spkeasy.actor.putProfile') {
        return {success: true}
      }
      if (params.api === 'social.spkeasy.actor.deleteProfile') {
        return {success: true}
      }
      return {}
    })

    mockedUserKeys.getPrivateKey.mockResolvedValue({
      privateKey: mockPrivateKey,
      userKeyPairId: mockUserKeyPairId,
    })
    mockedEncryption.decryptDEK.mockResolvedValue(mockDecryptedSessionKey)
    mockedEncryption.encryptContent.mockResolvedValue(mockEncryptedContent)
    mockedSpeakeasy.getErrorCode.mockReturnValue(undefined)
    mockedSpeakeasy.uploadMediaToSpeakeasy.mockResolvedValue({
      mediaId: 'test-media-id',
      data: {blob: {key: mockMediaKey}},
    } as any)
  })

  describe('when isPublic=true (switching to public)', () => {
    it('calls deleteProfile API', async () => {
      await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
        displayName: 'Test User',
        description: 'Test description',
        isPublic: true,
      })

      expect(mockCall).toHaveBeenCalledWith({
        api: 'social.spkeasy.actor.deleteProfile',
        method: 'POST',
      })
    })

    it('does not call putProfile API', async () => {
      await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
        displayName: 'Test User',
        description: 'Test description',
        isPublic: true,
      })

      expect(mockCall).not.toHaveBeenCalledWith(
        expect.objectContaining({api: 'social.spkeasy.actor.putProfile'}),
      )
    })

    it('does not call getSession API (no session needed)', async () => {
      await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
        displayName: 'Test User',
        description: 'Test description',
        isPublic: true,
      })

      expect(mockCall).not.toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'social.spkeasy.profileSession.getSession',
        }),
      )
    })

    it('does not upload media to speakeasy', async () => {
      await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
        displayName: 'Test User',
        description: 'Test description',
        isPublic: true,
        newAvatar: {path: 'file:///avatar.jpg', mime: 'image/jpeg'},
      })

      expect(mockedSpeakeasy.uploadMediaToSpeakeasy).not.toHaveBeenCalled()
    })

    it('ignores NotFound errors (profile may not exist)', async () => {
      const notFoundError = new Error('NotFound')
      mockCall.mockImplementation(async (params: any) => {
        if (params.api === 'social.spkeasy.actor.deleteProfile') {
          throw notFoundError
        }
        return {}
      })
      mockedSpeakeasy.getErrorCode.mockReturnValue('NotFound')

      // Should not throw
      await expect(
        savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: true,
        }),
      ).resolves.toBeUndefined()
    })

    it('propagates other deletion errors', async () => {
      const serverError = new Error('Internal Server Error')
      mockCall.mockImplementation(async (params: any) => {
        if (params.api === 'social.spkeasy.actor.deleteProfile') {
          throw serverError
        }
        return {}
      })
      mockedSpeakeasy.getErrorCode.mockReturnValue('InternalError')

      await expect(
        savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: true,
        }),
      ).rejects.toThrow('Internal Server Error')
    })
  })

  describe('when isPublic=false (private profile)', () => {
    it('saves encrypted profile with displayName and description', async () => {
      await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
        displayName: 'Test User',
        description: 'Test description',
        isPublic: false,
      })

      expect(mockCall).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'social.spkeasy.actor.putProfile',
          method: 'POST',
          body: expect.objectContaining({
            sessionId: mockSessionId,
            encryptedContent: mockEncryptedContent,
            isPublic: false,
          }),
        }),
      )
    })

    describe('text-only updates (no media or toggle changes)', () => {
      it('does not upload media when only displayName changes', async () => {
        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'New Name',
          description: 'Same description',
          isPublic: false,
          existingAvatarUri: mockExistingAvatarUri,
          existingBannerUri: mockExistingBannerUri,
        })

        expect(mockedSpeakeasy.uploadMediaToSpeakeasy).not.toHaveBeenCalled()
      })

      it('does not upload media when only description changes', async () => {
        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Same Name',
          description: 'New description',
          isPublic: false,
          existingAvatarUri: mockExistingAvatarUri,
          existingBannerUri: mockExistingBannerUri,
        })

        expect(mockedSpeakeasy.uploadMediaToSpeakeasy).not.toHaveBeenCalled()
      })

      it('preserves existing avatar and banner URIs in API call', async () => {
        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
          existingAvatarUri: mockExistingAvatarUri,
          existingBannerUri: mockExistingBannerUri,
        })

        expect(mockCall).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'social.spkeasy.actor.putProfile',
            body: expect.objectContaining({
              avatarUri: mockExistingAvatarUri,
              bannerUri: mockExistingBannerUri,
            }),
          }),
        )
      })
    })

    describe('avatar URI resolution', () => {
      it('clears avatarUri when newAvatar is null (deletion)', async () => {
        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
          newAvatar: null,
          existingAvatarUri: mockExistingAvatarUri,
        })

        expect(mockCall).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'social.spkeasy.actor.putProfile',
            body: expect.objectContaining({
              avatarUri: undefined,
            }),
          }),
        )
      })

      it('uploads to speakeasy and uses returned key when new avatar provided', async () => {
        // Use data: URL to avoid XMLHttpRequest (not available in Jest)
        const newAvatar = {
          path: 'data:image/jpeg;base64,/9j/4AAQ',
          mime: 'image/jpeg',
        }

        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
          newAvatar,
        })

        expect(mockedSpeakeasy.uploadMediaToSpeakeasy).toHaveBeenCalled()
        expect(mockCall).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'social.spkeasy.actor.putProfile',
            body: expect.objectContaining({
              avatarUri: mockMediaKey,
            }),
          }),
        )
      })

      it('preserves existingAvatarUri when no new avatar provided', async () => {
        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
          existingAvatarUri: mockExistingAvatarUri,
        })

        expect(mockCall).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'social.spkeasy.actor.putProfile',
            body: expect.objectContaining({
              avatarUri: mockExistingAvatarUri,
            }),
          }),
        )
      })
    })

    describe('banner URI resolution', () => {
      it('clears bannerUri when newBanner is null (deletion)', async () => {
        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
          newBanner: null,
          existingBannerUri: mockExistingBannerUri,
        })

        expect(mockCall).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'social.spkeasy.actor.putProfile',
            body: expect.objectContaining({
              bannerUri: undefined,
            }),
          }),
        )
      })

      it('uploads to speakeasy and uses returned key when new banner provided', async () => {
        // Use data: URL to avoid XMLHttpRequest (not available in Jest)
        const newBanner = {
          path: 'data:image/jpeg;base64,/9j/4AAQ',
          mime: 'image/jpeg',
        }

        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
          newBanner,
        })

        expect(mockedSpeakeasy.uploadMediaToSpeakeasy).toHaveBeenCalled()
        expect(mockCall).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'social.spkeasy.actor.putProfile',
            body: expect.objectContaining({
              bannerUri: mockMediaKey,
            }),
          }),
        )
      })

      it('preserves existingBannerUri when no new banner provided', async () => {
        await savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
          existingBannerUri: mockExistingBannerUri,
        })

        expect(mockCall).toHaveBeenCalledWith(
          expect.objectContaining({
            api: 'social.spkeasy.actor.putProfile',
            body: expect.objectContaining({
              bannerUri: mockExistingBannerUri,
            }),
          }),
        )
      })
    })
  })

  describe('error handling', () => {
    it('propagates session retrieval errors', async () => {
      const sessionError = new Error('Failed to get session')
      mockCall.mockImplementation(async (params: any) => {
        if (params.api === 'social.spkeasy.profileSession.getSession') {
          throw sessionError
        }
        return {}
      })
      mockedSpeakeasy.getErrorCode.mockReturnValue('InternalError')

      await expect(
        savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
        }),
      ).rejects.toThrow('Failed to get session')
    })

    it('propagates media upload errors', async () => {
      const uploadError = new Error('Upload failed')
      mockedSpeakeasy.uploadMediaToSpeakeasy.mockRejectedValue(uploadError)

      await expect(
        savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
          // Use data: URL to avoid XMLHttpRequest (not available in Jest)
          newAvatar: {
            path: 'data:image/jpeg;base64,/9j/4AAQ',
            mime: 'image/jpeg',
          },
        }),
      ).rejects.toThrow('Upload failed')
    })

    it('propagates API save errors', async () => {
      const saveError = new Error('Save failed')
      mockCall.mockImplementation(async (params: any) => {
        if (params.api === 'social.spkeasy.profileSession.getSession') {
          return {
            encryptedSessionKey: {
              sessionId: mockSessionId,
              encryptedDek: mockEncryptedDek,
            },
          }
        }
        if (params.api === 'social.spkeasy.actor.putProfile') {
          throw saveError
        }
        return {}
      })

      await expect(
        savePrivateProfile(mockAgent, mockCall, mockQueryClient, {
          displayName: 'Test User',
          description: 'Test description',
          isPublic: false,
        }),
      ).rejects.toThrow('Save failed')
    })
  })
})

describe('fetchPrivateProfiles', () => {
  const mockUserDid = 'did:plc:viewer123'
  const mockPrivateKey = 'mock-private-key'
  const mockDek = 'mock-dek-256bit'

  let mockCall: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockCall = jest.fn()

    mockedUserKeys.getPrivateKeyOrWarn.mockResolvedValue({
      privateKey: mockPrivateKey,
      userKeyPairId: 'keypair-123',
    })
    mockedEncryption.decryptDEK.mockResolvedValue(mockDek)

    // decryptBatch delegates to decryptDEK + decryptContent mocks
    // so individual tests can control decryption behavior per-item
    mockedEncryption.decryptBatch.mockImplementation(
      async (items: any[], sessionKeys: any[], privateKey: string) => {
        const keyMap = new Map(
          sessionKeys.map((k: any) => [k.sessionId, k.encryptedDek]),
        )
        const result = new Map<string, string>()
        for (const item of items) {
          const encryptedDek = keyMap.get(item.sessionId)
          if (!encryptedDek) continue
          try {
            const dek = await mockedEncryption.decryptDEK(
              encryptedDek,
              privateKey,
            )
            const content = await mockedEncryption.decryptContent(
              item.encryptedContent,
              dek,
            )
            result.set(item.id, content)
          } catch {
            // skip failed items
          }
        }
        return result
      },
    )
  })

  function mockGetProfilesResponse(
    profiles: Array<{
      did: string
      displayName: string
      description: string
      avatarUri?: string
      bannerUri?: string
    }>,
  ) {
    mockCall.mockImplementation(async (params: any) => {
      if (params.api === 'social.spkeasy.actor.getProfiles') {
        return {
          profiles: profiles.map(p => ({
            did: p.did,
            encryptedContent: JSON.stringify({
              displayName: p.displayName,
              description: p.description,
              avatarUri: p.avatarUri,
              bannerUri: p.bannerUri,
            }),
            encryptedDek: 'encrypted-dek-for-' + p.did,
            userKeyPairId: 'keypair-123',
            avatarUri: p.avatarUri,
            bannerUri: p.bannerUri,
          })),
        }
      }
      return {}
    })

    // Mock decryptContent to pass through the "encrypted" content
    mockedEncryption.decryptContent.mockImplementation(
      async (encrypted: string) => encrypted,
    )
  }

  it('returns empty Map for empty dids array', async () => {
    mockCall.mockResolvedValue({profiles: []})

    const result = await fetchPrivateProfiles(
      [],
      mockUserDid,
      mockCall,
      'https://cdn.test',
    )

    expect(result.size).toBe(0)
    // Should not call the API for empty input
    expect(mockCall).not.toHaveBeenCalled()
  })

  it('returns Map with decrypted profiles for accessible profiles', async () => {
    mockGetProfilesResponse([
      {
        did: 'did:plc:alice',
        displayName: 'Alice',
        description: 'Hello from Alice',
        avatarUri: 'alice-avatar-key',
      },
      {
        did: 'did:plc:bob',
        displayName: 'Bob',
        description: 'Hello from Bob',
      },
    ])

    const result = await fetchPrivateProfiles(
      ['did:plc:alice', 'did:plc:bob'],
      mockUserDid,
      mockCall,
      'https://cdn.test',
    )

    expect(result.size).toBe(2)
    expect(result.get('did:plc:alice')).toEqual({
      displayName: 'Alice',
      description: 'Hello from Alice',
      avatarUri: 'https://cdn.test/alice-avatar-key',
      rawAvatarUri: 'alice-avatar-key',
      rawBannerUri: undefined,
    })
    expect(result.get('did:plc:bob')).toEqual({
      displayName: 'Bob',
      description: 'Hello from Bob',
      rawAvatarUri: undefined,
      rawBannerUri: undefined,
    })
  })

  it('skips profiles that fail decryption', async () => {
    mockGetProfilesResponse([
      {
        did: 'did:plc:alice',
        displayName: 'Alice',
        description: 'Hello from Alice',
      },
      {
        did: 'did:plc:bob',
        displayName: 'Bob',
        description: 'Hello from Bob',
      },
    ])

    // Make decryption fail for Bob's DEK
    mockedEncryption.decryptDEK.mockImplementation(
      async (encryptedDek: string) => {
        if (encryptedDek === 'encrypted-dek-for-did:plc:bob') {
          throw new Error('Decryption failed')
        }
        return mockDek
      },
    )

    const result = await fetchPrivateProfiles(
      ['did:plc:alice', 'did:plc:bob'],
      mockUserDid,
      mockCall,
      'https://cdn.test',
    )

    expect(result.size).toBe(1)
    expect(result.has('did:plc:alice')).toBe(true)
    expect(result.has('did:plc:bob')).toBe(false)
  })

  it('propagates API errors from getPrivateProfiles', async () => {
    const apiError = new Error('Service unavailable')
    mockCall.mockRejectedValue(apiError)

    await expect(
      fetchPrivateProfiles(
        ['did:plc:alice'],
        mockUserDid,
        mockCall,
        'https://cdn.test',
      ),
    ).rejects.toThrow('Service unavailable')
  })

  it('returns empty Map when viewer has no private key', async () => {
    mockGetProfilesResponse([
      {
        did: 'did:plc:alice',
        displayName: 'Alice',
        description: 'Hello from Alice',
      },
    ])

    // No private key available
    mockedUserKeys.getPrivateKeyOrWarn.mockResolvedValue(null)

    const result = await fetchPrivateProfiles(
      ['did:plc:alice'],
      mockUserDid,
      mockCall,
      'https://cdn.test',
    )

    expect(result.size).toBe(0)
  })
})

import {BskyAgent} from '@atproto/api'
import {beforeEach,describe, expect, it, jest} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'

import * as encryption from '#/lib/encryption'
import * as trusted from '#/state/queries/trusted'
import {getOrCreatePrivateSession} from '../private-sessions'
import * as speakeasy from '../speakeasy'
import * as userKeys from '../user-keys'

// Mock dependencies
jest.mock('../user-keys')
jest.mock('../speakeasy')
jest.mock('#/lib/encryption')
jest.mock('#/state/queries/trusted')

const mockedUserKeys = userKeys as jest.Mocked<typeof userKeys>
const mockedSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>
const mockedEncryption = encryption as jest.Mocked<typeof encryption>
const mockedTrusted = trusted as jest.Mocked<typeof trusted>

describe('getOrCreatePrivateSession', () => {
  const mockDid = 'did:plc:testuser123'
  const mockSessionId = 'session-abc-123'
  const mockEncryptedDek = 'encrypted-dek-base64'
  const mockDecryptedSessionKey = 'decrypted-session-key'
  const mockPrivateKey = 'mock-private-key'
  const mockPublicKey = 'mock-public-key'
  const mockUserKeyPairId = 'keypair-123'
  const mockDek = 'generated-dek'

  let mockAgent: BskyAgent
  let mockCall: speakeasy.SpeakeasyApiCall
  let mockQueryClient: QueryClient
  let mockOnStateChange: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockAgent = {
      did: mockDid,
    } as unknown as BskyAgent

    mockCall = jest.fn() as unknown as speakeasy.SpeakeasyApiCall

    mockQueryClient = {
      getQueryData: jest.fn(),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    mockOnStateChange = jest.fn()

    // Default mock implementations
    mockedEncryption.decryptDEK.mockResolvedValue(mockDecryptedSessionKey)
  })

  describe('when session already exists', () => {
    beforeEach(() => {
      mockedUserKeys.getSession.mockResolvedValue({
        sessionId: mockSessionId,
        encryptedDek: mockEncryptedDek,
      })
      mockedUserKeys.getPrivateKey.mockResolvedValue({
        privateKey: mockPrivateKey,
        userKeyPairId: mockUserKeyPairId,
      })
    })

    it('returns existing session without creating new one', async () => {
      const result = await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(result).toEqual({
        sessionId: mockSessionId,
        sessionKey: mockDecryptedSessionKey,
      })
      expect(mockedUserKeys.getSession).toHaveBeenCalledWith(mockCall)
      expect(mockedUserKeys.getPrivateKey).toHaveBeenCalledWith(mockCall)
      expect(mockedEncryption.decryptDEK).toHaveBeenCalledWith(
        mockEncryptedDek,
        mockPrivateKey,
      )
    })

    it('does not call createNewSession', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockedUserKeys.getOrCreatePublicKey).not.toHaveBeenCalled()
      expect(mockedEncryption.generateDEK).not.toHaveBeenCalled()
    })
  })

  describe('when no session exists (NotFound)', () => {
    const mockTrustedUser1 = {recipientDid: 'did:plc:trusted1'}
    const mockTrustedUser2 = {recipientDid: 'did:plc:trusted2'}
    const mockTrustedUsers = [mockTrustedUser1, mockTrustedUser2]

    beforeEach(() => {
      // First call throws NotFound, simulating no existing session
      const notFoundError = new Error('NotFound') as Error & {code: string}
      notFoundError.code = 'NotFound'
      mockedUserKeys.getSession.mockRejectedValue(notFoundError)
      mockedSpeakeasy.getErrorCode.mockReturnValue('NotFound')

      // Setup for creating new session
      mockedUserKeys.getOrCreatePublicKey.mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
        userKeyPairId: mockUserKeyPairId,
      })

      mockedEncryption.generateDEK.mockResolvedValue(mockDek)
      mockedEncryption.encryptDEK.mockResolvedValue(mockEncryptedDek)

      mockedTrusted.RQKEY.mockReturnValue(['trusted', mockDid])
      ;(mockQueryClient.getQueryData as jest.Mock).mockReturnValue(undefined)
      mockedTrusted.getTrustedUsers.mockResolvedValue(mockTrustedUsers)

      mockedUserKeys.getPublicKeys.mockResolvedValue([
        {
          recipientDid: mockTrustedUser1.recipientDid,
          publicKey: 'trusted1-pubkey',
          userKeyPairId: 'trusted1-keypair',
        },
        {
          recipientDid: mockTrustedUser2.recipientDid,
          publicKey: 'trusted2-pubkey',
          userKeyPairId: 'trusted2-keypair',
        },
      ])

      // Mock the internal createSession call
      ;(mockCall as jest.Mock).mockResolvedValue({sessionId: mockSessionId})
    })

    it('creates a new session when none exists', async () => {
      const result = await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(result).toEqual({
        sessionId: mockSessionId,
        sessionKey: mockDecryptedSessionKey,
      })
    })

    it('calls getOrCreatePublicKey to get user keys', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockedUserKeys.getOrCreatePublicKey).toHaveBeenCalledWith(
        mockAgent,
        mockCall,
      )
    })

    it('generates a new DEK', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockedEncryption.generateDEK).toHaveBeenCalled()
    })

    it('fetches trusted users', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockedTrusted.getTrustedUsers).toHaveBeenCalledWith(
        mockDid,
        mockCall,
        mockQueryClient,
      )
    })

    it('gets public keys for all trusted users', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockedUserKeys.getPublicKeys).toHaveBeenCalledWith(
        [mockTrustedUser1.recipientDid, mockTrustedUser2.recipientDid],
        mockCall,
      )
    })

    it('encrypts DEK for current user and all trusted users', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      // Should encrypt for: current user + 2 trusted users = 3 calls
      expect(mockedEncryption.encryptDEK).toHaveBeenCalledTimes(3)
      expect(mockedEncryption.encryptDEK).toHaveBeenCalledWith(
        mockDek,
        mockPublicKey,
      )
      expect(mockedEncryption.encryptDEK).toHaveBeenCalledWith(
        mockDek,
        'trusted1-pubkey',
      )
      expect(mockedEncryption.encryptDEK).toHaveBeenCalledWith(
        mockDek,
        'trusted2-pubkey',
      )
    })

    it('calls createSession API with encrypted DEKs', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockCall).toHaveBeenCalledWith({
        api: 'social.spkeasy.privateSession.create',
        method: 'POST',
        body: {
          sessionKeys: expect.arrayContaining([
            expect.objectContaining({
              recipientDid: mockDid,
              encryptedDek: mockEncryptedDek,
            }),
          ]),
        },
      })
    })

    it('notifies state change when creating session', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockOnStateChange).toHaveBeenCalled()
    })

    it('uses cached trusted users when available', async () => {
      ;(mockQueryClient.getQueryData as jest.Mock).mockReturnValue(
        mockTrustedUsers,
      )

      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      // Should NOT call getTrustedUsers since data is cached
      expect(mockedTrusted.getTrustedUsers).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('re-throws non-NotFound errors from getSession', async () => {
      const serverError = new Error('Internal Server Error') as Error & {
        code: string
      }
      serverError.code = 'InternalError'
      mockedUserKeys.getSession.mockRejectedValue(serverError)
      mockedSpeakeasy.getErrorCode.mockReturnValue('InternalError')

      await expect(
        getOrCreatePrivateSession(
          mockAgent,
          mockCall,
          mockQueryClient,
          mockOnStateChange,
        ),
      ).rejects.toThrow('Internal Server Error')
    })
  })
})

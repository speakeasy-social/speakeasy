import {BskyAgent} from '@atproto/api'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'

import * as encryption from '#/lib/encryption'
import * as trusted from '#/state/queries/trusted'
import {getOrCreatePrivateSession} from '../private-sessions'
import * as speakeasy from '../speakeasy'
import * as userKeys from '../user-keys'

// Mock external dependencies at module boundaries
jest.mock('../user-keys')
jest.mock('../speakeasy')
jest.mock('#/lib/encryption')
jest.mock('#/state/queries/trusted')

const mockedUserKeys = userKeys as jest.Mocked<typeof userKeys>
const mockedSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>
const mockedEncryption = encryption as jest.Mocked<typeof encryption>
const mockedTrusted = trusted as jest.Mocked<typeof trusted>

describe('getOrCreatePrivateSession', () => {
  // Test fixtures
  const mockDid = 'did:plc:testuser123'
  const mockSessionId = 'session-abc-123'
  const mockEncryptedDek = 'encrypted-dek-base64'
  const mockDecryptedSessionKey = 'decrypted-session-key-256bit'
  const mockPrivateKey = 'mock-private-key'
  const mockPublicKey = 'mock-public-key'
  const mockUserKeyPairId = 'keypair-123'

  let mockAgent: BskyAgent

  let mockCall: any
  let mockQueryClient: QueryClient
  let mockOnStateChange: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockAgent = {did: mockDid} as unknown as BskyAgent
    mockCall = jest.fn()
    mockQueryClient = {
      getQueryData: jest.fn(),
      setQueryData: jest.fn(),
    } as unknown as QueryClient
    mockOnStateChange = jest.fn()

    // Default: decryption always works
    mockedEncryption.decryptDEK.mockResolvedValue(mockDecryptedSessionKey)
  })

  describe('when existing session is found', () => {
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

    it('returns the session with decrypted key', async () => {
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

    it('decrypts the DEK using the private key', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockedEncryption.decryptDEK).toHaveBeenCalledWith(
        mockEncryptedDek,
        mockPrivateKey,
      )
    })

    it('does not create a new session', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      // The call mock should not have been invoked for session creation
      expect(mockCall).not.toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'social.spkeasy.privateSession.create',
        }),
      )
    })
  })

  describe('when no session exists (NotFound error)', () => {
    const mockTrustedUsers = [
      {recipientDid: 'did:plc:trusted1', createdAt: '2024-01-01T00:00:00Z'},
      {recipientDid: 'did:plc:trusted2', createdAt: '2024-01-01T00:00:00Z'},
    ]

    beforeEach(() => {
      // getSession throws NotFound
      const notFoundError = new Error('NotFound') as Error & {code: string}
      notFoundError.code = 'NotFound'
      mockedUserKeys.getSession.mockRejectedValue(notFoundError)
      mockedSpeakeasy.getErrorCode.mockReturnValue('NotFound')

      // Setup key generation
      mockedUserKeys.getOrCreatePublicKey.mockResolvedValue({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
        userKeyPairId: mockUserKeyPairId,
      })

      // Setup DEK generation and encryption
      mockedEncryption.generateDEK.mockResolvedValue('generated-dek')
      mockedEncryption.encryptDEK.mockResolvedValue(mockEncryptedDek)

      // Setup trusted users
      mockedTrusted.RQKEY.mockReturnValue(['trusted', mockDid])
      ;(mockQueryClient.getQueryData as jest.Mock).mockReturnValue(undefined)
      mockedTrusted.getTrustedUsers.mockResolvedValue(mockTrustedUsers)

      // Setup public keys for trusted users
      mockedUserKeys.getPublicKeys.mockResolvedValue([
        {
          recipientDid: 'did:plc:trusted1',
          publicKey: 'trusted1-pubkey',
          userKeyPairId: 'trusted1-keypair',
        },
        {
          recipientDid: 'did:plc:trusted2',
          publicKey: 'trusted2-pubkey',
          userKeyPairId: 'trusted2-keypair',
        },
      ])

      // Session creation succeeds
      mockCall.mockResolvedValue({sessionId: mockSessionId})
    })

    it('returns a new session with decrypted key', async () => {
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

    it('creates a session via the privateSession.create API', async () => {
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
            expect.objectContaining({recipientDid: mockDid}),
            expect.objectContaining({recipientDid: 'did:plc:trusted1'}),
            expect.objectContaining({recipientDid: 'did:plc:trusted2'}),
          ]),
        },
      })
    })

    it('includes encrypted DEKs for all recipients', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      const createCall = mockCall.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as {api: string}).api ===
          'social.spkeasy.privateSession.create',
      )
      expect(createCall).toBeDefined()

      const sessionKeys = (createCall![0] as {body: {sessionKeys: unknown[]}})
        .body.sessionKeys
      expect(sessionKeys).toHaveLength(3) // current user + 2 trusted
    })

    it('notifies state change during session creation', async () => {
      await getOrCreatePrivateSession(
        mockAgent,
        mockCall,
        mockQueryClient,
        mockOnStateChange,
      )

      expect(mockOnStateChange).toHaveBeenCalled()
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

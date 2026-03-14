import {BskyAgent} from '@atproto/api'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'

import * as encryption from '#/lib/encryption'
import {
  decryptPosts,
  EncryptedPost,
  // EncryptedSessionKey,
} from '../private-posts'

// Mock post-feed to prevent the module-level setInterval in react-query.tsx
// from being registered (triggered by: post-feed → labeler → react-query).
jest.mock('#/state/queries/post-feed', () => ({
  transformPrivateEmbed: jest.fn(),
}))

jest.mock('#/lib/encryption')

const mockedEncryption = encryption as jest.Mocked<typeof encryption>

// Helpers to build fixtures
function makeEncryptedPost(
  overrides: Partial<EncryptedPost> = {},
): EncryptedPost {
  return {
    uri: 'at://did:plc:author1/social.spkeasy.private-post/abc123',
    rkey: 'abc123',
    authorDid: 'did:plc:author1',
    encryptedContent: 'encrypted-content-1',
    createdAt: '2026-01-15T12:00:00Z',
    sessionId: 'session-1',
    langs: ['en'],
    likeCount: 0,
    replyCount: 0,
    viewer: {like: false},
    ...overrides,
  }
}

// function makeSessionKey(
//   overrides: Partial<EncryptedSessionKey> = {},
// ): EncryptedSessionKey {
//   return {
//     sessionId: 'session-1',
//     encryptedDek: 'encrypted-dek-session-1',
//     recipientDid: 'did:plc:viewer',
//     ...overrides,
//   }
// }

function makeDecryptedContent(text: string) {
  return JSON.stringify({
    $type: 'social.spkeasy.feed.privatePost',
    text,
    facets: [],
    embed: {$type: 'social.spkeasy.embed.none'},
    viewer: {like: false},
    cid: 'bafyrei-fake-cid',
  })
}

describe('decryptPosts', () => {
  const mockAgent = {} as BskyAgent
  const mockDek = 'mock-dek-256bit'

  beforeEach(() => {
    jest.clearAllMocks()

    mockedEncryption.decryptContent.mockImplementation(
      async (_encrypted: string, _dek: string) => {
        throw new Error('decryptContent not set up for this input')
      },
    )
  })

  it('returns empty array for empty input', async () => {
    const dekMap = new Map<string, string>()
    const result = await decryptPosts(mockAgent, [], dekMap)
    expect(result).toEqual([])
  })

  it('decrypts posts with matching session keys', async () => {
    const post = makeEncryptedPost({encryptedContent: 'enc-hello'})
    const decryptedJson = makeDecryptedContent('Hello world')

    mockedEncryption.decryptContent.mockResolvedValue(decryptedJson)

    const dekMap = new Map([['session-1', mockDek]])
    const result = await decryptPosts(mockAgent, [post], dekMap)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Hello world')
  })

  it('preserves encrypted post metadata on decrypted output', async () => {
    const post = makeEncryptedPost({
      uri: 'at://did:plc:author1/social.spkeasy.private-post/xyz',
      rkey: 'xyz',
      authorDid: 'did:plc:author1',
      sessionId: 'session-1',
      createdAt: '2026-01-20T10:00:00Z',
      langs: ['en', 'fr'],
    })
    const decryptedJson = makeDecryptedContent('Bonjour')

    mockedEncryption.decryptContent.mockResolvedValue(decryptedJson)

    const dekMap = new Map([['session-1', mockDek]])
    const result = await decryptPosts(mockAgent, [post], dekMap)

    expect(result).toHaveLength(1)
    // Encrypted post metadata should be preserved
    expect(result[0].uri).toBe(post.uri)
    expect(result[0].rkey).toBe('xyz')
    expect(result[0].authorDid).toBe('did:plc:author1')
    expect(result[0].sessionId).toBe('session-1')
    expect(result[0].createdAt).toBe('2026-01-20T10:00:00Z')
    expect(result[0].langs).toEqual(['en', 'fr'])
  })

  it('skips posts with no matching session key', async () => {
    const post1 = makeEncryptedPost({
      uri: 'at://did:plc:a/social.spkeasy.private-post/1',
      sessionId: 'session-1',
      encryptedContent: 'enc-1',
    })
    const post2 = makeEncryptedPost({
      uri: 'at://did:plc:a/social.spkeasy.private-post/2',
      sessionId: 'session-unknown',
      encryptedContent: 'enc-2',
    })

    mockedEncryption.decryptContent.mockResolvedValue(
      makeDecryptedContent('Post 1'),
    )

    // dekMap only has session-1, not session-unknown
    const dekMap = new Map([['session-1', mockDek]])
    const result = await decryptPosts(mockAgent, [post1, post2], dekMap)

    // Filter nulls — code filters posts with missing sessionId from dekMap
    const successful = result.filter(Boolean)
    expect(successful).toHaveLength(1)
    expect(successful[0].uri).toBe(post1.uri)
  })

  it('skips posts where DEK was not in the dekMap (e.g. DEK decryption failed upstream)', async () => {
    const post1 = makeEncryptedPost({
      uri: 'at://did:plc:a/social.spkeasy.private-post/1',
      sessionId: 'session-good',
      encryptedContent: 'enc-1',
    })
    const post2 = makeEncryptedPost({
      uri: 'at://did:plc:a/social.spkeasy.private-post/2',
      sessionId: 'session-bad',
      encryptedContent: 'enc-2',
    })

    mockedEncryption.decryptContent.mockResolvedValue(
      makeDecryptedContent('Good post'),
    )

    // session-bad has no DEK (simulates getDEKMap failing to decrypt it)
    const dekMap = new Map([['session-good', mockDek]])
    const result = await decryptPosts(mockAgent, [post1, post2], dekMap)

    const successful = result.filter(Boolean)
    expect(successful).toHaveLength(1)
    expect(successful[0].uri).toBe(post1.uri)
  })

  it('skips posts where content decryption fails', async () => {
    const post1 = makeEncryptedPost({
      uri: 'at://did:plc:a/social.spkeasy.private-post/1',
      encryptedContent: 'enc-good',
    })
    const post2 = makeEncryptedPost({
      uri: 'at://did:plc:a/social.spkeasy.private-post/2',
      encryptedContent: 'enc-corrupted',
    })

    mockedEncryption.decryptContent.mockImplementation(
      async (encrypted: string) => {
        if (encrypted === 'enc-corrupted') {
          throw new Error('Content decryption failed')
        }
        return makeDecryptedContent('Good post')
      },
    )

    const dekMap = new Map([['session-1', mockDek]])
    const result = await decryptPosts(mockAgent, [post1, post2], dekMap)

    const successful = result.filter(Boolean)
    expect(successful).toHaveLength(1)
    expect(successful[0].uri).toBe(post1.uri)
  })

  it('decrypts multiple posts sharing the same session key', async () => {
    const post1 = makeEncryptedPost({
      uri: 'at://did:plc:a/social.spkeasy.private-post/1',
      encryptedContent: 'enc-1',
      sessionId: 'shared-session',
    })
    const post2 = makeEncryptedPost({
      uri: 'at://did:plc:a/social.spkeasy.private-post/2',
      encryptedContent: 'enc-2',
      sessionId: 'shared-session',
    })

    let callCount = 0
    mockedEncryption.decryptContent.mockImplementation(async () => {
      callCount++
      return makeDecryptedContent(`Post ${callCount}`)
    })

    const dekMap = new Map([['shared-session', mockDek]])
    const result = await decryptPosts(mockAgent, [post1, post2], dekMap)

    expect(result).toHaveLength(2)
    // Both posts should have been decrypted
    expect(result.map(p => p.uri)).toEqual([post1.uri, post2.uri])
  })

  it('merges decrypted content fields over encrypted post metadata', async () => {
    const post = makeEncryptedPost({
      encryptedContent: 'enc-content',
      createdAt: '2026-01-15T12:00:00Z',
    })

    // The decrypted JSON has a createdAt that differs from the encrypted metadata
    const decryptedJson = JSON.stringify({
      $type: 'social.spkeasy.feed.privatePost',
      text: 'Decrypted text',
      createdAt: '2026-01-15T11:00:00Z',
      facets: [],
      embed: {$type: 'social.spkeasy.embed.none'},
      viewer: {like: false},
      cid: 'bafyrei-fake-cid',
    })

    mockedEncryption.decryptContent.mockResolvedValue(decryptedJson)

    const dekMap = new Map([['session-1', mockDek]])
    const result = await decryptPosts(mockAgent, [post], dekMap)

    expect(result).toHaveLength(1)
    // Encrypted metadata spreads last, so encrypted createdAt wins
    expect(result[0].createdAt).toBe('2026-01-15T12:00:00Z')
    // But decrypted-only fields are present
    expect(result[0].text).toBe('Decrypted text')
  })
})

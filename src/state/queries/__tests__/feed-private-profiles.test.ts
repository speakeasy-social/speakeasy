import {AppBskyFeedDefs} from '@atproto/api'
import {describe, expect, it} from '@jest/globals'

import {
  PRIVATE_PROFILE_DISPLAY_NAME,
  PrivateProfileData,
  shouldCheckPrivateProfile,
} from '#/lib/api/private-profiles'
import {
  extractDidsFromFeed,
  mergeFeedItemWithPrivateProfiles,
} from '../feed-private-profiles'
import {FeedPageUnselected} from '../post-feed'

// Helper to create a mock ProfileViewBasic
function mockProfile(did: string, displayName = PRIVATE_PROFILE_DISPLAY_NAME) {
  return {
    did,
    handle: `${did.split(':').pop()}.test`,
    displayName,
    avatar: 'https://example.com/avatar.jpg',
  }
}

// Helper to create a mock PostView
function mockPostView(authorDid: string) {
  return {
    $type: 'app.bsky.feed.defs#postView',
    uri: `at://${authorDid}/app.bsky.feed.post/abc123`,
    cid: 'bafyrei...',
    author: mockProfile(authorDid),
    record: {
      $type: 'app.bsky.feed.post',
      text: 'Test post',
      createdAt: new Date().toISOString(),
    },
    indexedAt: new Date().toISOString(),
  } as AppBskyFeedDefs.PostView
}

// Helper to create a mock FeedViewPost
function mockFeedViewPost(
  authorDid: string,
  options?: {
    replyParentDid?: string
    replyRootDid?: string
    repostByDid?: string
  },
): AppBskyFeedDefs.FeedViewPost {
  const post = mockPostView(authorDid)

  const feedViewPost: AppBskyFeedDefs.FeedViewPost = {
    post,
  }

  if (options?.replyParentDid || options?.replyRootDid) {
    feedViewPost.reply = {
      parent: mockPostView(options.replyParentDid || authorDid),
      root: mockPostView(options.replyRootDid || authorDid),
    }
  }

  if (options?.repostByDid) {
    feedViewPost.reason = {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by: mockProfile(options.repostByDid),
      indexedAt: new Date().toISOString(),
    }
  }

  return feedViewPost
}

// Helper to create a mock FeedPageUnselected
function mockFeedPage(
  items: AppBskyFeedDefs.FeedViewPost[],
): FeedPageUnselected {
  return {
    api: {} as any,
    cursor: 'cursor123',
    feed: items,
    fetchedAt: Date.now(),
  }
}

describe('extractDidsFromFeed', () => {
  it('returns empty set for empty pages', () => {
    const result = extractDidsFromFeed([])
    expect(result.size).toBe(0)
  })

  it('extracts post author DIDs', () => {
    const pages = [
      mockFeedPage([
        mockFeedViewPost('did:plc:user1'),
        mockFeedViewPost('did:plc:user2'),
      ]),
    ]

    const result = extractDidsFromFeed(pages)

    expect(result.has('did:plc:user1')).toBe(true)
    expect(result.has('did:plc:user2')).toBe(true)
    expect(result.size).toBe(2)
  })

  it('extracts reply parent author DIDs', () => {
    const pages = [
      mockFeedPage([
        mockFeedViewPost('did:plc:user1', {
          replyParentDid: 'did:plc:parent',
        }),
      ]),
    ]

    const result = extractDidsFromFeed(pages)

    expect(result.has('did:plc:user1')).toBe(true)
    expect(result.has('did:plc:parent')).toBe(true)
  })

  it('extracts reply root author DIDs', () => {
    const pages = [
      mockFeedPage([
        mockFeedViewPost('did:plc:user1', {
          replyParentDid: 'did:plc:parent',
          replyRootDid: 'did:plc:root',
        }),
      ]),
    ]

    const result = extractDidsFromFeed(pages)

    expect(result.has('did:plc:root')).toBe(true)
  })

  it('extracts repost author DIDs', () => {
    const pages = [
      mockFeedPage([
        mockFeedViewPost('did:plc:user1', {
          repostByDid: 'did:plc:reposter',
        }),
      ]),
    ]

    const result = extractDidsFromFeed(pages)

    expect(result.has('did:plc:user1')).toBe(true)
    expect(result.has('did:plc:reposter')).toBe(true)
  })

  it('deduplicates DIDs across pages', () => {
    const pages = [
      mockFeedPage([
        mockFeedViewPost('did:plc:user1'),
        mockFeedViewPost('did:plc:user1'),
      ]),
      mockFeedPage([mockFeedViewPost('did:plc:user1')]),
    ]

    const result = extractDidsFromFeed(pages)

    expect(result.size).toBe(1)
    expect(result.has('did:plc:user1')).toBe(true)
  })

  it('skips authors without the private profile displayName', () => {
    const pages = [
      mockFeedPage([
        mockFeedViewPost('did:plc:private'),
        // Create a post with a non-private displayName
        {
          post: {
            ...mockPostView('did:plc:public'),
            author: mockProfile('did:plc:public', 'Regular User'),
          },
        } as AppBskyFeedDefs.FeedViewPost,
      ]),
    ]

    const result = extractDidsFromFeed(pages)

    expect(result.has('did:plc:private')).toBe(true)
    expect(result.has('did:plc:public')).toBe(false)
    expect(result.size).toBe(1)
  })

  it('handles multiple pages with different authors', () => {
    const pages = [
      mockFeedPage([mockFeedViewPost('did:plc:user1')]),
      mockFeedPage([mockFeedViewPost('did:plc:user2')]),
      mockFeedPage([mockFeedViewPost('did:plc:user3')]),
    ]

    const result = extractDidsFromFeed(pages)

    expect(result.size).toBe(3)
  })
})

// --- shouldCheckPrivateProfile ---

describe('shouldCheckPrivateProfile', () => {
  it('returns true for the Private Profile sentinel displayName', () => {
    const profile = mockProfile('did:plc:test', PRIVATE_PROFILE_DISPLAY_NAME)
    expect(shouldCheckPrivateProfile(profile)).toBe(true)
  })

  it('returns false for any other displayName', () => {
    const profile = mockProfile('did:plc:test', 'Alice')
    expect(shouldCheckPrivateProfile(profile)).toBe(false)
  })

  it('returns false for empty string displayName', () => {
    const profile = mockProfile('did:plc:test', '')
    expect(shouldCheckPrivateProfile(profile)).toBe(false)
  })

  it('returns false for null profile', () => {
    expect(shouldCheckPrivateProfile(null)).toBe(false)
  })

  it('returns false for undefined profile', () => {
    expect(shouldCheckPrivateProfile(undefined)).toBe(false)
  })

  it('returns false for profile with undefined displayName', () => {
    const profile = {...mockProfile('did:plc:test'), displayName: undefined}
    expect(shouldCheckPrivateProfile(profile)).toBe(false)
  })
})

// --- mergeFeedItemWithPrivateProfiles ---

const privateData: PrivateProfileData = {
  displayName: 'Alice Private',
  description: 'Private bio',
  avatarUri: 'https://cdn.test/media/encrypted-avatar',
}

describe('mergeFeedItemWithPrivateProfiles', () => {
  it('merges private avatar and displayName when cache has data for the post author', () => {
    const item = mockFeedViewPost('did:plc:alice')
    const getPrivateProfile = (did: string) =>
      did === 'did:plc:alice' ? privateData : undefined

    const result = mergeFeedItemWithPrivateProfiles(item, getPrivateProfile)

    expect(result.post.author.displayName).toBe('Alice Private')
    expect(result.post.author.avatar).toBe(
      'https://cdn.test/media/encrypted-avatar',
    )
  })

  it('returns the item unchanged when no cached private data exists for the author', () => {
    const item = mockFeedViewPost('did:plc:alice')
    const originalDisplayName = item.post.author.displayName
    const originalAvatar = item.post.author.avatar
    const getPrivateProfile = (_did: string) => undefined

    const result = mergeFeedItemWithPrivateProfiles(item, getPrivateProfile)

    expect(result.post.author.displayName).toBe(originalDisplayName)
    expect(result.post.author.avatar).toBe(originalAvatar)
  })

  it('merges reply parent author when parent has private data', () => {
    const item = mockFeedViewPost('did:plc:alice', {
      replyParentDid: 'did:plc:parent',
    })
    const getPrivateProfile = (did: string) =>
      did === 'did:plc:parent' ? privateData : undefined

    const result = mergeFeedItemWithPrivateProfiles(item, getPrivateProfile)

    const parent = result.reply?.parent
    if (!parent || !AppBskyFeedDefs.isPostView(parent)) {
      throw new Error('Expected reply parent to be a PostView')
    }
    expect(parent.author.displayName).toBe('Alice Private')
    expect(parent.author.avatar).toBe('https://cdn.test/media/encrypted-avatar')
  })

  it('does NOT merge when getPrivateProfile returns undefined (stale pre-sentinel feed item)', () => {
    // Regression scenario: feed item was cached before user went private.
    // The embedded ATProto author has a real displayName (not the sentinel),
    // so extractDidsFromFeed skips this DID → it is never fetched → getPrivateProfile returns undefined.
    const staleItem: AppBskyFeedDefs.FeedViewPost = {
      post: {
        ...mockPostView('did:plc:alice'),
        author: mockProfile('did:plc:alice', 'Alice'), // pre-sentinel displayName
      },
    }
    // Simulate: cache has data, but this DID was never fetched because it wasn't extracted
    const getPrivateProfile = (_did: string) => undefined

    const result = mergeFeedItemWithPrivateProfiles(
      staleItem,
      getPrivateProfile,
    )

    expect(result.post.author.displayName).toBe('Alice')
    expect(result.post.author.avatar).toBe('https://example.com/avatar.jpg')
  })
})

// --- Stale vs fresh feed item after profile save ---

describe('stale vs fresh feed item after profile becomes private', () => {
  const authorDid = 'did:plc:alice'
  const cache = new Map<string, PrivateProfileData>([[authorDid, privateData]])
  const getPrivateProfile = (did: string) => cache.get(did)

  it('stale item (pre-sentinel displayName) is NOT in the extracted DID set, so cache is never queried', () => {
    const staleItem: AppBskyFeedDefs.FeedViewPost = {
      post: {
        ...mockPostView(authorDid),
        author: mockProfile(authorDid, 'Alice'), // pre-sentinel: user went private after this was cached
      },
    }
    const pages = [mockFeedPage([staleItem])]
    const fetchedDids = extractDidsFromFeed(pages)

    // The stale displayName means this DID is gated out of fetching
    expect(fetchedDids.has(authorDid)).toBe(false)

    // Consequently, getPrivateProfile would never be populated for this DID
    // and mergeFeedItemWithPrivateProfiles receives undefined → no merge
    const noDataForStaleDid = (_did: string) => undefined
    const result = mergeFeedItemWithPrivateProfiles(
      staleItem,
      noDataForStaleDid,
    )
    expect(result.post.author.displayName).toBe('Alice')
  })

  it('fresh item (sentinel displayName) IS in the extracted DID set, so private data is fetched and merged', () => {
    const freshItem = mockFeedViewPost(authorDid) // sentinel displayName by default

    const pages = [mockFeedPage([freshItem])]
    const fetchedDids = extractDidsFromFeed(pages)

    // Sentinel displayName → DID is extracted for fetching
    expect(fetchedDids.has(authorDid)).toBe(true)

    // After fetching, getPrivateProfile has data → merge produces private avatar
    const result = mergeFeedItemWithPrivateProfiles(
      freshItem,
      getPrivateProfile,
    )
    expect(result.post.author.displayName).toBe('Alice Private')
    expect(result.post.author.avatar).toBe(
      'https://cdn.test/media/encrypted-avatar',
    )
  })
})

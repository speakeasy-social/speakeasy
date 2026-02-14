import {AppBskyFeedDefs} from '@atproto/api'
import {describe, expect, it, jest} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'

import {PrivateProfileData} from '#/lib/api/private-profiles'
import {
  extractDidsFromFeed,
  updateFeedCacheWithPrivateProfiles,
} from '../feed-private-profiles'
import {FeedPageUnselected} from '../post-feed'

// Helper to create a mock ProfileViewBasic
function mockProfile(did: string, displayName = 'Test User') {
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

describe('updateFeedCacheWithPrivateProfiles', () => {
  it('returns false when no data in cache', () => {
    const queryClient = {
      getQueryData: jest.fn().mockReturnValue(undefined),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    const privateProfiles = new Map<string, PrivateProfileData>()

    const result = updateFeedCacheWithPrivateProfiles(
      queryClient,
      ['post-feed', 'following', {}],
      privateProfiles,
    )

    expect(result).toBe(false)
    expect(queryClient.setQueryData).not.toHaveBeenCalled()
  })

  it('returns false when no pages in data', () => {
    const queryClient = {
      getQueryData: jest.fn().mockReturnValue({pages: []}),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    const privateProfiles = new Map<string, PrivateProfileData>()

    const result = updateFeedCacheWithPrivateProfiles(
      queryClient,
      ['post-feed', 'following', {}],
      privateProfiles,
    )

    expect(result).toBe(false)
  })

  it('updates post author with private profile data', () => {
    const feedItem = mockFeedViewPost('did:plc:user1')
    const queryData = {
      pages: [mockFeedPage([feedItem])],
      pageParams: [],
    }

    const queryClient = {
      getQueryData: jest.fn().mockReturnValue(queryData),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    const privateProfiles = new Map<string, PrivateProfileData>([
      [
        'did:plc:user1',
        {
          displayName: 'Private Name',
          description: 'Private bio',
          avatarUri: 'https://speakeasy.test/avatar.jpg',
        },
      ],
    ])

    const result = updateFeedCacheWithPrivateProfiles(
      queryClient,
      ['post-feed', 'following', {}],
      privateProfiles,
    )

    expect(result).toBe(true)
    expect(feedItem.post.author.displayName).toBe('Private Name')
    expect(feedItem.post.author.description).toBe('Private bio')
    expect(feedItem.post.author.avatar).toBe(
      'https://speakeasy.test/avatar.jpg',
    )
    expect(queryClient.setQueryData).toHaveBeenCalled()
  })

  it('updates reply parent author with private profile data', () => {
    const feedItem = mockFeedViewPost('did:plc:user1', {
      replyParentDid: 'did:plc:parent',
    })
    const queryData = {
      pages: [mockFeedPage([feedItem])],
      pageParams: [],
    }

    const queryClient = {
      getQueryData: jest.fn().mockReturnValue(queryData),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    const privateProfiles = new Map<string, PrivateProfileData>([
      [
        'did:plc:parent',
        {
          displayName: 'Private Parent',
          description: 'Parent bio',
        },
      ],
    ])

    updateFeedCacheWithPrivateProfiles(
      queryClient,
      ['post-feed', 'following', {}],
      privateProfiles,
    )

    const parent = feedItem.reply?.parent as AppBskyFeedDefs.PostView
    expect(parent.author.displayName).toBe('Private Parent')
  })

  it('updates repost author with private profile data', () => {
    const feedItem = mockFeedViewPost('did:plc:user1', {
      repostByDid: 'did:plc:reposter',
    })
    const queryData = {
      pages: [mockFeedPage([feedItem])],
      pageParams: [],
    }

    const queryClient = {
      getQueryData: jest.fn().mockReturnValue(queryData),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    const privateProfiles = new Map<string, PrivateProfileData>([
      [
        'did:plc:reposter',
        {
          displayName: 'Private Reposter',
          description: 'Reposter bio',
        },
      ],
    ])

    updateFeedCacheWithPrivateProfiles(
      queryClient,
      ['post-feed', 'following', {}],
      privateProfiles,
    )

    expect(
      (feedItem.reason as AppBskyFeedDefs.ReasonRepost).by.displayName,
    ).toBe('Private Reposter')
  })

  it('preserves original avatar when private profile has no avatarUri', () => {
    const feedItem = mockFeedViewPost('did:plc:user1')
    const originalAvatar = feedItem.post.author.avatar
    const queryData = {
      pages: [mockFeedPage([feedItem])],
      pageParams: [],
    }

    const queryClient = {
      getQueryData: jest.fn().mockReturnValue(queryData),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    const privateProfiles = new Map<string, PrivateProfileData>([
      [
        'did:plc:user1',
        {
          displayName: 'Private Name',
          description: 'Private bio',
          // No avatarUri
        },
      ],
    ])

    updateFeedCacheWithPrivateProfiles(
      queryClient,
      ['post-feed', 'following', {}],
      privateProfiles,
    )

    expect(feedItem.post.author.avatar).toBe(originalAvatar)
  })

  it('returns false when no profiles match', () => {
    const feedItem = mockFeedViewPost('did:plc:user1')
    const queryData = {
      pages: [mockFeedPage([feedItem])],
      pageParams: [],
    }

    const queryClient = {
      getQueryData: jest.fn().mockReturnValue(queryData),
      setQueryData: jest.fn(),
    } as unknown as QueryClient

    const privateProfiles = new Map<string, PrivateProfileData>([
      [
        'did:plc:different-user',
        {
          displayName: 'Different User',
          description: 'Different bio',
        },
      ],
    ])

    const result = updateFeedCacheWithPrivateProfiles(
      queryClient,
      ['post-feed', 'following', {}],
      privateProfiles,
    )

    expect(result).toBe(false)
    expect(queryClient.setQueryData).not.toHaveBeenCalled()
  })
})

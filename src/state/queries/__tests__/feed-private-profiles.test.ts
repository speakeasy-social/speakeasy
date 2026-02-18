import {AppBskyFeedDefs} from '@atproto/api'
import {describe, expect, it} from '@jest/globals'

import {PRIVATE_PROFILE_DISPLAY_NAME} from '#/lib/api/private-profiles'
import {extractDidsFromFeed} from '../feed-private-profiles'
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

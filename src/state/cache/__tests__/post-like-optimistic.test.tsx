import {Pressable, Text} from 'react-native'
import {AppBskyFeedDefs} from '@atproto/api'
import {describe, expect, it, jest} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'
import {fireEvent} from '@testing-library/react-native'

// Mock the heavy transitive dependencies that post-shadow.ts pulls in.
// We only need findAllPostsInQueryData from post-feed; the others can be stubs.
jest.mock('../../queries/notifications/feed', () => ({
  findAllPostsInQueryData: jest.fn(function* () {}),
}))
jest.mock('../../queries/post-thread', () => ({
  findAllPostsInQueryData: jest.fn(function* () {}),
}))
jest.mock('../../queries/search-posts', () => ({
  findAllPostsInQueryData: jest.fn(function* () {}),
}))
jest.mock('../../queries/post-quotes', () => ({
  findAllPostsInQueryData: jest.fn(function* () {}),
}))

import {renderWithProviders} from '../../../../jest/renderWithProviders'
import {mergeFeedItemWithPrivateProfiles} from '../../queries/feed-private-profiles'
import {FeedPageUnselected, RQKEY} from '../../queries/post-feed'
import {POST_TOMBSTONE, updatePostShadow, usePostShadow} from '../post-shadow'

/**
 * Minimal component that renders post like state via usePostShadow.
 * Exposes a "like" button that calls updatePostShadow to simulate
 * the optimistic update performed by queueLike.
 */
function PostLikeDisplay({
  post,
  queryClient,
}: {
  post: AppBskyFeedDefs.PostView
  queryClient: QueryClient
}) {
  const shadow = usePostShadow(post)
  if (shadow === POST_TOMBSTONE) {
    return null
  }
  return (
    <>
      <Text testID="like-state">
        {shadow.viewer?.like ? 'liked' : 'not liked'}
      </Text>
      <Pressable
        onPress={() => {
          updatePostShadow(queryClient, post.uri, {
            likeUri: 'at://me/app.bsky.feed.like/optimistic',
          })
        }}
        accessibilityRole="button"
        testID="like-button">
        <Text>like</Text>
      </Pressable>
    </>
  )
}

function makePost(did: string): AppBskyFeedDefs.PostView {
  return {
    $type: 'app.bsky.feed.defs#postView',
    uri: `at://${did}/app.bsky.feed.post/abc123`,
    cid: 'bafyrei-test',
    author: {
      did,
      handle: 'test.bsky.social',
      displayName: 'Test User',
      avatar: undefined,
    },
    record: {
      $type: 'app.bsky.feed.post',
      text: 'hello world',
      createdAt: new Date().toISOString(),
    },
    indexedAt: new Date().toISOString(),
  } as AppBskyFeedDefs.PostView
}

function setupFeedAndRender(mergedItem: AppBskyFeedDefs.FeedViewPost) {
  const feedQueryKey = RQKEY('following')
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  })
  const feedPage: FeedPageUnselected = {
    api: {} as any,
    cursor: undefined,
    feed: [mergedItem],
    fetchedAt: Date.now(),
  }
  queryClient.setQueryData(feedQueryKey, {pages: [feedPage], pageParams: []})

  const result = renderWithProviders(
    <PostLikeDisplay post={mergedItem.post} queryClient={queryClient} />,
    {queryClient},
  )
  return result
}

describe('post like optimistic update', () => {
  it('repost with private profile reason author: post like works', () => {
    const postAuthorDid = 'did:plc:postauthor'
    const repostAuthorDid = 'did:plc:repostauthor'
    const rawPost = makePost(postAuthorDid)
    const feedItem: AppBskyFeedDefs.FeedViewPost = {
      post: rawPost,
      reason: {
        $type: 'app.bsky.feed.defs#reasonRepost',
        by: {
          did: repostAuthorDid,
          handle: 'reposter.bsky.social',
          displayName: 'Reposter',
        },
        indexedAt: new Date().toISOString(),
      },
    }

    // Only the repost reason author has private data; post author does not
    const merged = mergeFeedItemWithPrivateProfiles(feedItem, did => {
      if (did === repostAuthorDid) {
        return {displayName: 'Private Reposter'} as any
      }
      return undefined
    })

    // Post object identity is preserved (no private data on post author)
    expect(merged.post).toBe(rawPost)

    const {getByTestId} = setupFeedAndRender(merged)

    expect(getByTestId('like-state').props.children).toBe('not liked')
    fireEvent.press(getByTestId('like-button'))
    expect(getByTestId('like-state').props.children).toBe('liked')
  })

  it('post author has private profile: like works via URI fallback', () => {
    const rawPost = makePost('did:plc:privateauthor')
    const feedItem: AppBskyFeedDefs.FeedViewPost = {post: rawPost}

    // Post author has private data — merge creates a new post object
    const merged = mergeFeedItemWithPrivateProfiles(feedItem, did => {
      if (did === 'did:plc:privateauthor') {
        return {displayName: 'Secret Name'} as any
      }
      return undefined
    })

    // Confirm a new post object was created
    expect(merged.post).not.toBe(rawPost)
    expect(merged.post.author.displayName).toBe('Secret Name')

    const {getByTestId} = setupFeedAndRender(merged)

    // Shadow should still work via shadowsByUri fallback
    expect(getByTestId('like-state').props.children).toBe('not liked')
    fireEvent.press(getByTestId('like-button'))
    expect(getByTestId('like-state').props.children).toBe('liked')
  })

  it('like survives select re-run (new merged objects from same raw post)', () => {
    const rawPost = makePost('did:plc:reselect-author')
    const feedItem: AppBskyFeedDefs.FeedViewPost = {post: rawPost}
    const getPrivateProfile = (did: string) => {
      if (did === 'did:plc:reselect-author') {
        return {displayName: 'Secret Name'} as any
      }
      return undefined
    }

    // First merge — simulates initial select
    const merged1 = mergeFeedItemWithPrivateProfiles(
      feedItem,
      getPrivateProfile,
    )

    const feedQueryKey = RQKEY('following')
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    })
    const feedPage: FeedPageUnselected = {
      api: {} as any,
      cursor: undefined,
      feed: [feedItem],
      fetchedAt: Date.now(),
    }
    queryClient.setQueryData(feedQueryKey, {pages: [feedPage], pageParams: []})

    const {getByTestId, rerender} = renderWithProviders(
      <PostLikeDisplay post={merged1.post} queryClient={queryClient} />,
      {queryClient},
    )

    // Like the post
    expect(getByTestId('like-state').props.children).toBe('not liked')
    fireEvent.press(getByTestId('like-button'))
    expect(getByTestId('like-state').props.children).toBe('liked')

    // Simulate select re-run: create entirely new merged objects
    const merged2 = mergeFeedItemWithPrivateProfiles(
      feedItem,
      getPrivateProfile,
    )

    // Confirm these are different object references
    expect(merged2.post).not.toBe(merged1.post)

    // Re-render with the new merged post (simulating what React Query select does)
    rerender(<PostLikeDisplay post={merged2.post} queryClient={queryClient} />)

    // Like shadow should survive via shadowsByUri
    expect(getByTestId('like-state').props.children).toBe('liked')
  })
})

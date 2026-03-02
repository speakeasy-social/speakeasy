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

describe('post like optimistic update', () => {
  it('reflects like in UI after post passes through mergeFeedItemWithPrivateProfiles', () => {
    const rawPost = makePost('did:plc:testuser')
    const feedItem: AppBskyFeedDefs.FeedViewPost = {post: rawPost}

    // Run through the merge function as the real select() pipeline does
    const merged = mergeFeedItemWithPrivateProfiles(
      feedItem,
      () => undefined, // no private profile data
    )

    // The merged item should preserve object identity (the fix)
    expect(merged.post).toBe(rawPost)

    // Seed the query client with a feed page containing this post
    const feedQueryKey = RQKEY('following')
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    })
    const feedPage: FeedPageUnselected = {
      api: {} as any,
      cursor: undefined,
      feed: [merged],
      fetchedAt: Date.now(),
    }
    queryClient.setQueryData(feedQueryKey, {pages: [feedPage], pageParams: []})

    const {getByTestId} = renderWithProviders(
      <PostLikeDisplay post={merged.post} queryClient={queryClient} />,
      {queryClient},
    )

    // Initial state — not liked
    expect(getByTestId('like-state').props.children).toBe('not liked')

    // Simulate optimistic like
    fireEvent.press(getByTestId('like-button'))

    // Shadow should now reflect the like
    expect(getByTestId('like-state').props.children).toBe('liked')
  })

  it('still merges private profile data when available', () => {
    const rawPost = makePost('did:plc:privateuser')
    const feedItem: AppBskyFeedDefs.FeedViewPost = {post: rawPost}

    const merged = mergeFeedItemWithPrivateProfiles(feedItem, did => {
      if (did === 'did:plc:privateuser') {
        return {displayName: 'Secret Name'} as any
      }
      return undefined
    })

    // When private data exists, a new object IS created
    expect(merged.post).not.toBe(rawPost)
    expect(merged.post.author.displayName).toBe('Secret Name')
  })
})

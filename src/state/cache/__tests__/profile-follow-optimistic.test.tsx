import {Pressable, Text} from 'react-native'
import {AppBskyActorDefs} from '@atproto/api'
import {describe, expect, it} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'
import {fireEvent} from '@testing-library/react-native'

import {renderWithProviders} from '../../../../jest/renderWithProviders'
import {updateProfileShadow, useProfileShadow} from '../profile-shadow'

/**
 * Minimal component that renders follow state via useProfileShadow.
 * Exposes a "follow" button that calls updateProfileShadow to simulate
 * the optimistic update performed by useProfileFollowMutationQueue.
 */
function ProfileFollowDisplay({
  profile,
  queryClient,
}: {
  profile: AppBskyActorDefs.ProfileView
  queryClient: QueryClient
}) {
  const shadow = useProfileShadow(profile)
  return (
    <>
      <Text testID="follow-state">
        {shadow.viewer?.following ? 'following' : 'not following'}
      </Text>
      <Pressable
        onPress={() => {
          updateProfileShadow(queryClient, profile.did, {
            followingUri: 'at://me/app.bsky.graph.follow/optimistic',
          })
        }}
        accessibilityRole="button"
        testID="follow-button">
        <Text>follow</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          updateProfileShadow(queryClient, profile.did, {
            followingUri: undefined,
          })
        }}
        accessibilityRole="button"
        testID="unfollow-button">
        <Text>unfollow</Text>
      </Pressable>
    </>
  )
}

function makeProfile(did: string): AppBskyActorDefs.ProfileView {
  return {
    did,
    handle: 'test.bsky.social',
    displayName: 'Test User',
    avatar: undefined,
  }
}

describe('profile follow optimistic update', () => {
  it('follow updates UI immediately', () => {
    const profile = makeProfile('did:plc:followtest')
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    })

    const {getByTestId} = renderWithProviders(
      <ProfileFollowDisplay profile={profile} queryClient={queryClient} />,
      {queryClient},
    )

    expect(getByTestId('follow-state').props.children).toBe('not following')
    fireEvent.press(getByTestId('follow-button'))
    expect(getByTestId('follow-state').props.children).toBe('following')
  })

  it('follow persists when profile object changes (simulating query refetch)', () => {
    const did = 'did:plc:refetchtest'
    const profile1 = makeProfile(did)
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    })

    const {getByTestId, rerender} = renderWithProviders(
      <ProfileFollowDisplay profile={profile1} queryClient={queryClient} />,
      {queryClient},
    )

    // Follow the profile
    fireEvent.press(getByTestId('follow-button'))
    expect(getByTestId('follow-state').props.children).toBe('following')

    // Simulate a query refetch creating a new object with the same DID
    const profile2 = makeProfile(did)
    expect(profile2).not.toBe(profile1)

    rerender(
      <ProfileFollowDisplay profile={profile2} queryClient={queryClient} />,
    )

    // Shadow should persist because it's keyed by DID, not object identity
    expect(getByTestId('follow-state').props.children).toBe('following')
  })

  it('unfollow after follow', () => {
    const profile = makeProfile('did:plc:unfollowtest')
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}},
    })

    const {getByTestId} = renderWithProviders(
      <ProfileFollowDisplay profile={profile} queryClient={queryClient} />,
      {queryClient},
    )

    expect(getByTestId('follow-state').props.children).toBe('not following')

    // Follow
    fireEvent.press(getByTestId('follow-button'))
    expect(getByTestId('follow-state').props.children).toBe('following')

    // Unfollow
    fireEvent.press(getByTestId('unfollow-button'))
    expect(getByTestId('follow-state').props.children).toBe('not following')
  })
})

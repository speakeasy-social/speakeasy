import {describe, expect, it} from '@jest/globals'

import {shouldShowReply} from '../reply-filter'

describe('shouldShowReply', () => {
  const userDid = 'did:plc:currentuser'
  const trustedDids = new Set(['did:plc:trusted1', 'did:plc:trusted2'])

  it('shows replies from the current user', () => {
    expect(
      shouldShowReply({
        likeCount: 0,
        authorDid: userDid,
        authorIsFollowed: false,
        userDid,
        trustedDids,
      }),
    ).toBe(true)
  })

  it('shows replies from followed users', () => {
    expect(
      shouldShowReply({
        likeCount: 0,
        authorDid: 'did:plc:stranger',
        authorIsFollowed: true,
        userDid,
        trustedDids,
      }),
    ).toBe(true)
  })

  it('shows replies from trusted users', () => {
    expect(
      shouldShowReply({
        likeCount: 0,
        authorDid: 'did:plc:trusted1',
        authorIsFollowed: false,
        userDid,
        trustedDids,
      }),
    ).toBe(true)
  })

  it('shows replies with 2 or more likes', () => {
    expect(
      shouldShowReply({
        likeCount: 2,
        authorDid: 'did:plc:stranger',
        authorIsFollowed: false,
        userDid,
        trustedDids,
      }),
    ).toBe(true)
  })

  it('shows replies with more than 2 likes', () => {
    expect(
      shouldShowReply({
        likeCount: 10,
        authorDid: 'did:plc:stranger',
        authorIsFollowed: false,
        userDid,
        trustedDids,
      }),
    ).toBe(true)
  })

  it('hides replies from unknown users with 0 likes', () => {
    expect(
      shouldShowReply({
        likeCount: 0,
        authorDid: 'did:plc:stranger',
        authorIsFollowed: false,
        userDid,
        trustedDids,
      }),
    ).toBe(false)
  })

  it('hides replies from unknown users with 1 like', () => {
    expect(
      shouldShowReply({
        likeCount: 1,
        authorDid: 'did:plc:stranger',
        authorIsFollowed: false,
        userDid,
        trustedDids,
      }),
    ).toBe(false)
  })

  it('hides replies when trustedDids is empty and author is unknown', () => {
    expect(
      shouldShowReply({
        likeCount: 0,
        authorDid: 'did:plc:stranger',
        authorIsFollowed: false,
        userDid,
        trustedDids: new Set(),
      }),
    ).toBe(false)
  })
})

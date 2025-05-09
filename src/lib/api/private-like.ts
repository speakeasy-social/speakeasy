import {BskyAgent} from '@atproto/api'

import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'

export async function likePrivatePost(agent: BskyAgent, postUri: string) {
  return callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.reaction.createReaction',
    method: 'POST',
    body: {
      uri: postUri,
    },
  })
}

export async function unlikePrivatePost(agent: BskyAgent, postUri: string) {
  return callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.reaction.deleteReaction',
    method: 'POST',
    body: {
      uri: postUri,
    },
  })
}

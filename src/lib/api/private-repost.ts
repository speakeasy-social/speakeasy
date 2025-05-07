import {BskyAgent} from '@atproto/api'
import {nanoid} from 'nanoid'

import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {encryptContent} from '#/lib/encryption'

export async function putPrivateRepost(
  agent: BskyAgent,
  originalPost: {uri: string; cid: string; langs?: string[]},
  sessionId: string,
  sessionKey: string,
) {
  const rkey = nanoid()

  console.log('reposting', originalPost, rkey)

  const uri = `at://${agent.assertDid}/social.spkeasy.feed.repost/${rkey}`

  const postContent = {
    $type: 'social.spkeasy.feed.repost',
    embed: {
      type: 'spkeasy.social.embed.repost',
      record: {
        uri: originalPost.uri,
        cid: originalPost.cid,
      },
    },
  }

  console.log('postContent', postContent)

  const encryptedPosts = [
    {
      uri,
      rkey,
      encryptedContent: await encryptContent(
        JSON.stringify(postContent),
        sessionKey,
      ),
      langs: originalPost.langs || [],
      media: [],
    },
  ]

  await callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.privatePost.createPosts',
    method: 'POST',
    body: {
      sessionId,
      encryptedPosts,
    },
  })
}

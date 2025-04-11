import {BskyAgent} from '@atproto/api'

export function getPrivatePostsServerUrl(agent: BskyAgent): string {
  // If PDS is localhost, use localhost for private posts server
  // Otherwise use production URL
  return agent.pdsUrl?.toString().includes('localhost')
    ? 'http://localhost:3002'
    : 'https://api.spkeasy.social'
}

import {BskyAgent} from '@atproto/api'

export function getPrivatePostsServerUrl(
  agent: BskyAgent,
  endpoint: string,
): string {
  //   if (!agent.pdsUrl?.toString().includes('localhost')) {
  //     return 'https://api.spkeasy.social'
  //   }

  // Temporary, lets get an NGINX proxy running in develop
  const devHosts = [
    {prefix: 'social.spkeasy.graph', host: 'http://localhost:3001'},
    {prefix: 'social.spkeasy.keys', host: 'http://localhost:whatport'},
    // Catch all
    {prefix: 'social.spkeasy', host: 'http://localhost:3002'},
  ]

  const host = devHosts.find(h => endpoint.startsWith(h.prefix))?.host

  return host || 'https://localhost:3002'
}

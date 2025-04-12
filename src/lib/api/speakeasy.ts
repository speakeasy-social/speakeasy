import {BskyAgent} from '@atproto/api'

import {useAgent} from '#/state/session'

type SpeakeasyApiOptions = {
  api: string
  query?: Record<string, string>
  body?: Record<string, unknown>
  method?: 'GET' | 'POST'
}

export function getHost(agent: BskyAgent, endpoint: string): string {
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

export async function callSpeakeasyApiWithAgent(
  agent: BskyAgent,
  {api, query = {}, body, method = 'GET'}: Omit<SpeakeasyApiOptions, 'agent'>,
) {
  const serverUrl = getHost(agent, api)
  const queryString = new URLSearchParams(query).toString()
  const url = `${serverUrl}/xrpc/${api}${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${agent.session?.accessJwt}`,
    },
    ...(body && {body: JSON.stringify(body)}),
  })

  if (!response.ok) {
    const errorData = await response.json()
    const error = new Error(errorData.message || 'Unknown error')
    Object.assign(error, errorData)
    throw error
  }

  return response.json()
}

export function useSpeakeasyApi() {
  const agent = useAgent()

  return {
    call: async (options: SpeakeasyApiOptions) => {
      return callSpeakeasyApiWithAgent(agent, options)
    },
  }
}

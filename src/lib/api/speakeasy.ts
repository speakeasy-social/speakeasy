import {BskyAgent} from '@atproto/api'

import {useAgent} from '#/state/session'

export type SpeakeasyApiOptions = {
  api: string
  query?: Record<string, string>
  body?: Record<string, unknown>
  method?: 'GET' | 'POST'
}

export type SpeakeasyApiCall = (options: SpeakeasyApiOptions) => Promise<any>

/**
 * Get the host for the Speakeasy API based on the agent's PDS URL
 * @param agent - The BskyAgent instance
 * @param endpoint - The endpoint to call
 * @returns The host for the Speakeasy API
 */
export function getHost(agent: BskyAgent, endpoint: string): string {
  if (!agent.pdsUrl?.toString().includes('localhost')) {
    if (endpoint.startsWith('social.spkeasy.keys')) {
      return 'https://keys.spkeasy.social'
    }
    return 'https://api.spkeasy.social'
  }

  // Temporary, lets get an NGINX proxy running in develop
  const devHosts = [
    {prefix: 'social.spkeasy.graph', host: 'http://localhost:3001'},
    {prefix: 'social.spkeasy.keys', host: 'http://localhost:3004'},
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

export function getErrorCode(error: any) {
  return error && typeof error === 'object' && 'code' in error
    ? error.code
    : null
}

export function useSpeakeasyApi(): {
  call: SpeakeasyApiCall
} {
  const agent = useAgent()

  return {
    call: async (options: SpeakeasyApiOptions): Promise<any> => {
      return callSpeakeasyApiWithAgent(agent, options)
    },
  }
}

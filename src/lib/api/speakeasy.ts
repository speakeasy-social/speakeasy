import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'

import {logger} from '#/logger'
import {useAgent} from '#/state/session'

export type SpeakeasyApiOptions = {
  api: string
  query?: Record<string, any>
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
    if (endpoint.startsWith('social.spkeasy.key')) {
      return 'https://keys.spkeasy.social'
    }
    return 'https://api.spkeasy.social'
  }

  // Temporary, lets get an NGINX proxy running in develop
  const devHosts = [
    {prefix: 'social.spkeasy.graph', host: 'http://localhost:3001'},
    {prefix: 'social.spkeasy.key', host: 'http://localhost:3004'},
    {prefix: 'social.spkeasy.actor', host: 'http://localhost:3005'},
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
  const queryString = Object.entries(query)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value
          .map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
          .join('&')
      }
      if (typeof value !== 'undefined') {
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      }
      return ''
    })
    .join('&')
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

export type Feature = {
  key: string
  value: string
}

/**
 * Get the features for the current user
 * @param agent - The BskyAgent instance
 * @returns The features for the current user
 */
export async function getFeatures(agent: BskyAgent): Promise<Feature[]> {
  try {
    const response = await callSpeakeasyApiWithAgent(agent, {
      api: 'social.spkeasy.actor.getFeatures',
      query: {did: agent.session!.did},
    })
    return response.features
  } catch (error) {
    // Feature flags are disabled by default, so assume none rather than throw an error
    console.error(error)
    return []
  }
}

export function isAnyPostView(v: any): v is AppBskyFeedDefs.PostView {
  return AppBskyFeedDefs.isPostView(v) || isPrivatePostView(v)
}

export function isPrivatePostView(v: any): v is AppBskyFeedDefs.PostView {
  return v?.$type === 'social.spkeasy.feed.defs#privatePostView'
}

/**
 * Upload media to the Speakeasy media service
 * @param agent - The BskyAgent instance
 * @param blob - The blob to upload
 * @param mime - MIME type of the file
 * @returns Promise with the upload response
 */
export async function uploadMediaToSpeakeasy(
  agent: BskyAgent,
  blob: Blob,
  mime: string,
  sessionId: string,
): Promise<any> {
  try {
    // Use the appropriate endpoint for Speakeasy uploads
    const uploadEndpoint = 'social.spkeasy.media.upload'

    // Get the host using the host resolution logic
    const serverUrl = getHost(agent, uploadEndpoint)

    const response = await fetch(`${serverUrl}/xrpc/${uploadEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': mime,
        Authorization: `Bearer ${agent.session?.accessJwt}`,
        'x-speakeasy-session-id': sessionId,
      },
      body: blob,
    })

    if (!response.ok) {
      const errorData = await response.json()
      logger.error('Failed to upload to Speakeasy API', {
        status: response.status,
        error: errorData,
      })
      throw new Error(
        `Failed to upload media: ${errorData.message || response.statusText}`,
      )
    }

    const result = await response.json()

    // Format the response to match what uploadBlob returns
    return {
      mediaId: result.mediaId,
      data: {
        blob: {
          mediaId: result.mediaId,
          ref: result.media.key,
          mimeType: mime,
          size: blob.size,
          original: blob,
          key: result.media.key,
        },
      },
    }
  } catch (e: any) {
    logger.error('Failed to upload blob to Speakeasy', {
      safeMessage: e.message,
    })
    throw e
  }
}

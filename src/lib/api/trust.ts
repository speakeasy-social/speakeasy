import {BskyAgent} from '@atproto/api'

import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'

/**
 * Bulk trust a list of recipients
 * @param agent - The agent to use
 * @param recipientDids - The list of recipient DIDs to trust
 * @returns The list of recipient DIDs that were trusted (may be a subset of the input list)
 */
export async function bulkTrust(
  agent: BskyAgent,
  recipientDids: string[],
): Promise<{recipientDids: string[]}> {
  return callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.graph.bulkAddTrusted',
    method: 'POST',
    body: {
      recipientDids,
    },
  })
}

/**
 * Bulk untrust a list of recipients
 * @param agent - The agent to use
 * @param recipientDids - The list of recipient DIDs to untrust
 * @returns The list of recipient DIDs that were untrusted (may be a subset of the input list)
 */
export async function bulkUntrust(
  agent: BskyAgent,
  recipientDids: string[],
): Promise<{recipientDids: string[]}> {
  return callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.graph.bulkRemoveTrusted',
    method: 'POST',
    body: {
      recipientDids,
    },
  })
}

export async function getDailyTrustedQuota(
  agent: BskyAgent,
): Promise<{maxDaily: number; remaining: number}> {
  return callSpeakeasyApiWithAgent(agent, {
    api: 'social.spkeasy.graph.getDailyTrustedQuota',
    method: 'GET',
  })
}

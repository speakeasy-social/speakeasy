import {useCallback} from 'react'
import {BskyAgent} from '@atproto/api'
import {t} from '@lingui/macro'
import {QueryClient, useQueryClient} from '@tanstack/react-query'

import {
  getErrorCode,
  SpeakeasyApiCall,
  useSpeakeasyApi,
} from '#/lib/api/speakeasy'
import {decryptDEK, encryptDEK, generateDEK} from '#/lib/encryption'
import {getTrustedUsers, RQKEY} from '#/state/queries/trusted'
import {useAgent} from '#/state/session'
import {
  getOrCreatePublicKey,
  getPrivateKey,
  getPublicKeys,
  getSession,
} from './user-keys'

async function createSession(
  sessionKeys: {recipientDid: string; encryptedDek: string}[],
  call: SpeakeasyApiCall,
) {
  const {sessionId} = await call({
    api: 'social.spkeasy.privateSession.create',
    method: 'POST',
    body: {
      sessionKeys,
    },
  })

  return {sessionId}
}

/**
 * Creates a new session with the current user and their trusted users.
 * @param {string} myDid - The DID of the current user
 * @param {string} myPublicKey - The public key of the current user
 * @returns {Promise<{sessionId: string, encryptedDek: string}>} The session ID and encrypted data encryption key
 */
async function createNewSession(
  myPublicKey: string,
  myUserKeyPairId: string,
  agent: BskyAgent,
  call: SpeakeasyApiCall,
  queryClient: QueryClient,
) {
  const dek = await generateDEK()

  // Get cached trusted users data
  let trustedUsers: {recipientDid: string}[] | undefined =
    queryClient.getQueryData(RQKEY(agent.did!))

  if (trustedUsers) {
    trustedUsers = trustedUsers
  } else {
    trustedUsers = await getTrustedUsers(agent.did!, call, queryClient)
  }

  const recipientPublicKeys = await getPublicKeys(
    trustedUsers.map(user => user.recipientDid),
    call,
  )

  // Create a session with the current user and their trusted users
  const allSessionUsers = [
    {
      recipientDid: agent.did!,
      publicKey: myPublicKey,
      userKeyPairId: myUserKeyPairId,
    },
    ...recipientPublicKeys,
  ]

  // Fetch all trusted users
  const encryptedDeks = await Promise.all(
    allSessionUsers.map(async recipient => {
      const encryptedDek = await encryptDEK(dek, recipient.publicKey)
      return {
        encryptedDek,
        recipientDid: recipient.recipientDid,
        userKeyPairId: recipient.userKeyPairId,
      }
    }),
  )

  const {sessionId} = await createSession(encryptedDeks, call)

  return {sessionId, encryptedDek: encryptedDeks[0].encryptedDek}
}

/**
 * Retrieves or creates a private session for the current user.
 * @param {any} agent - The agent object containing user information
 * @param {any} call - The API call function
 * @param {any} queryClient - The React Query client instance
 * @returns {Promise<{sessionId: string, sessionKey: string}>} The session ID and decrypted session key
 */
export async function getOrCreatePrivateSession(
  agent: BskyAgent,
  call: SpeakeasyApiCall,
  queryClient: QueryClient,
  onStateChange: (state: string) => void,
) {
  let privateKey
  let publicKey
  let encryptedDek
  let sessionId
  let userKeyPairId

  // Get the session
  try {
    ;({sessionId, encryptedDek} = await getSession(call))
  } catch (error) {
    if (getErrorCode(error) === 'NotFound') {
      ;({publicKey, privateKey, userKeyPairId} = await getOrCreatePublicKey(
        agent,
        call,
      ))

      onStateChange(t`Creating private session...`)
      ;({sessionId, encryptedDek} = await createNewSession(
        publicKey,
        userKeyPairId,
        agent,
        call,
        queryClient,
      ))
    } else {
      throw error
    }
  }

  if (!privateKey) {
    ;({privateKey, userKeyPairId} = await getPrivateKey(call))
  }

  const sessionKey = await decryptDEK(encryptedDek, privateKey)

  return {
    sessionId,
    sessionKey,
  }
}

/**
 * React hook for managing private sessions.
 * @returns {Function} A callback function that returns the trusted users data
 */
export function usePrivateSession() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {call} = useSpeakeasyApi()

  return useCallback(
    async ({onStateChange}: {onStateChange: (state: string) => void}) => {
      return getOrCreatePrivateSession(agent, call, queryClient, onStateChange)
    },
    [agent, call, queryClient],
  )
}

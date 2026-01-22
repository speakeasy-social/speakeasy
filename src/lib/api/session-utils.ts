import {BskyAgent} from '@atproto/api'
import {QueryClient} from '@tanstack/react-query'

import {encryptDEK, generateDEK} from '#/lib/encryption'
import {getTrustedUsers, RQKEY} from '#/state/queries/trusted'
import {SpeakeasyApiCall} from './speakeasy'
import {getPublicKeys} from './user-keys'

export type EncryptedDekEntry = {
  encryptedDek: string
  recipientDid: string
  userKeyPairId: string
}

/**
 * Generates a DEK and encrypts it for the current user and all their trusted users.
 * This shared utility is used by both private posts sessions and profile sessions.
 *
 * @param myPublicKey - The current user's public key
 * @param myUserKeyPairId - The current user's key pair ID
 * @param agent - The BskyAgent containing user information
 * @param call - The API call function
 * @param queryClient - The React Query client instance
 * @returns The generated DEK and array of encrypted DEKs for all recipients
 */
export async function encryptDekForTrustedUsers(
  myPublicKey: string,
  myUserKeyPairId: string,
  agent: BskyAgent,
  call: SpeakeasyApiCall,
  queryClient: QueryClient,
): Promise<{dek: string; encryptedDeks: EncryptedDekEntry[]}> {
  const dek = await generateDEK()

  // Get cached trusted users data or fetch from API
  let trustedUsers: {recipientDid: string}[] | undefined =
    queryClient.getQueryData(RQKEY(agent.did!))

  if (!trustedUsers) {
    trustedUsers = await getTrustedUsers(agent.did!, call, queryClient)
  }

  const recipientPublicKeys = await getPublicKeys(
    trustedUsers.map(user => user.recipientDid),
    call,
  )

  // Build list of all session users: current user + trusted users
  const allSessionUsers = [
    {
      recipientDid: agent.did!,
      publicKey: myPublicKey,
      userKeyPairId: myUserKeyPairId,
    },
    ...recipientPublicKeys,
  ]

  // Encrypt DEK for all recipients
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

  return {dek, encryptedDeks}
}

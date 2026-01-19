import {BskyAgent} from '@atproto/api'
import {QueryClient} from '@tanstack/react-query'

import {
  decryptContent,
  decryptDEK,
  encryptContent,
  encryptDEK,
  generateDEK,
} from '#/lib/encryption'
import {getTrustedUsers, RQKEY} from '#/state/queries/trusted'
import {getErrorCode, SpeakeasyApiCall} from './speakeasy'
import {getOrCreatePublicKey, getPrivateKey, getPublicKeys} from './user-keys'

/**
 * Private profile types for encrypted profile data
 */

/**
 * Decrypted private profile content
 */
export type PrivateProfileData = {
  displayName: string // max 64 graphemes
  description: string // max 256 graphemes
  avatarUri?: string // speakeasy media service URI
  bannerUri?: string // speakeasy media service URI
}

/**
 * Encrypted profile response from social.spkeasy.actor.getProfile
 */
export type EncryptedProfileResponse = {
  did: string
  encryptedContent: string // encrypted PrivateProfileData
  encryptedDek: string // base64 - viewer's DEK for this profile
  userKeyPairId: string
  avatarUri?: string
  bannerUri?: string
}

/**
 * Batch response from social.spkeasy.actor.getProfiles
 */
export type EncryptedProfilesResponse = {
  profiles: EncryptedProfileResponse[]
}

/**
 * Creates a new profile session with encrypted DEKs for recipients.
 */
export async function createProfileSession(
  sessionKeys: {recipientDid: string; encryptedDek: string}[],
  call: SpeakeasyApiCall,
) {
  const {sessionId} = await call({
    api: 'social.spkeasy.profileSession.create',
    method: 'POST',
    body: {
      sessionKeys,
    },
  })

  return {sessionId}
}

/**
 * Retrieves the current user's profile session.
 */
export async function getProfileSession(
  call: SpeakeasyApiCall,
): Promise<{sessionId: string; encryptedDek: string}> {
  const data = await call({
    api: 'social.spkeasy.profileSession.getSession',
  })

  return data.encryptedSessionKey
}

/**
 * Encrypts profile data using AES-256-GCM with the provided DEK.
 * @param data - The private profile data to encrypt
 * @param dek - The Data Encryption Key (SafeText format)
 * @returns Encrypted profile data in SafeText format
 */
export async function encryptProfileData(
  data: PrivateProfileData,
  dek: string,
): Promise<string> {
  const serialized = JSON.stringify(data)
  return encryptContent(serialized, dek)
}

/**
 * Decrypts encrypted profile data using AES-256-GCM with the provided DEK.
 * @param encryptedData - The encrypted profile data in SafeText format
 * @param dek - The Data Encryption Key (SafeText format)
 * @returns Decrypted private profile data
 */
export async function decryptProfileData(
  encryptedData: string,
  dek: string,
): Promise<PrivateProfileData> {
  const decrypted = await decryptContent(encryptedData, dek)
  return JSON.parse(decrypted) as PrivateProfileData
}

/**
 * Creates a new profile session with the current user and their trusted users.
 */
async function createNewProfileSession(
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

  if (!trustedUsers) {
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

  // Encrypt DEK for all trusted users
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

  const {sessionId} = await createProfileSession(encryptedDeks, call)

  return {sessionId, encryptedDek: encryptedDeks[0].encryptedDek}
}

/**
 * Stores encrypted profile data to the Speakeasy API.
 * @param params - Profile data including sessionId, encrypted content, and privacy flag
 * @param call - The API call function
 */
export async function putPrivateProfile(
  params: {
    sessionId: string
    encryptedContent: string
    isPublic: boolean
    avatarUri?: string
    bannerUri?: string
  },
  call: SpeakeasyApiCall,
): Promise<void> {
  await call({
    api: 'social.spkeasy.actor.putProfile',
    method: 'POST',
    body: params,
  })
}

/**
 * Retrieves encrypted profile data for a single user.
 * @param did - The DID of the profile to fetch
 * @param call - The API call function
 * @returns Encrypted profile data if viewer has access, null otherwise
 */
export async function getPrivateProfile(
  did: string,
  call: SpeakeasyApiCall,
): Promise<EncryptedProfileResponse | null> {
  try {
    return await call({
      api: 'social.spkeasy.actor.getProfile',
      query: {did},
    })
  } catch (error) {
    if (getErrorCode(error) === 'NotFound') {
      return null
    }
    throw error
  }
}

/**
 * Retrieves encrypted profile data for multiple users in a batch.
 * @param dids - Array of DIDs to fetch profiles for
 * @param call - The API call function
 * @returns Array of encrypted profiles the viewer has access to
 */
export async function getPrivateProfiles(
  dids: string[],
  call: SpeakeasyApiCall,
): Promise<EncryptedProfileResponse[]> {
  if (dids.length === 0) {
    return []
  }

  const response: EncryptedProfilesResponse = await call({
    api: 'social.spkeasy.actor.getProfiles',
    query: {dids},
  })

  return response.profiles
}

/**
 * Retrieves or creates a profile session for the current user.
 * @param agent - The BskyAgent containing user information
 * @param call - The API call function
 * @param queryClient - The React Query client instance
 * @returns The session ID and decrypted session key
 */
export async function getOrCreateProfileSession(
  agent: BskyAgent,
  call: SpeakeasyApiCall,
  queryClient: QueryClient,
): Promise<{sessionId: string; sessionKey: string}> {
  let privateKey
  let publicKey
  let encryptedDek
  let sessionId
  let userKeyPairId

  // Try to get existing session
  try {
    ;({sessionId, encryptedDek} = await getProfileSession(call))
  } catch (error) {
    if (getErrorCode(error) === 'NotFound') {
      // No session exists, create a new one
      ;({publicKey, privateKey, userKeyPairId} = await getOrCreatePublicKey(
        agent,
        call,
      ))
      ;({sessionId, encryptedDek} = await createNewProfileSession(
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

  // Get private key if we don't have it yet
  if (!privateKey) {
    ;({privateKey} = await getPrivateKey(call))
  }

  const sessionKey = await decryptDEK(encryptedDek, privateKey)

  return {
    sessionId,
    sessionKey,
  }
}

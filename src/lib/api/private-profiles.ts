import {
  AppBskyActorProfile,
  BskyAgent,
  ComAtprotoRepoUploadBlob,
} from '@atproto/api'
import {QueryClient} from '@tanstack/react-query'

import {decryptBatch, decryptDEK, encryptContent} from '#/lib/encryption'
import {getBaseCdnUrl} from './feed/utils'
import {encryptDekForTrustedUsers} from './session-utils'
import {
  getErrorCode,
  SpeakeasyApiCall,
  uploadMediaToSpeakeasy,
} from './speakeasy'
import {uploadBlob} from './upload-blob'
import {
  getOrCreatePublicKey,
  getPrivateKey,
  getPrivateKeyOrWarn,
} from './user-keys'

/**
 * Private profile types for encrypted profile data
 */

/**
 * Decrypted private profile content
 */
export type PrivateProfileData = {
  displayName: string // max 64 graphemes
  description: string // max 256 graphemes
  avatarUri?: string // resolved CDN URL (for display)
  bannerUri?: string // resolved CDN URL (for display)
  rawAvatarUri?: string // original Speakeasy media key (for _privateProfile metadata)
  rawBannerUri?: string // original Speakeasy media key (for _privateProfile metadata)
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
 * Decrypts an encrypted profile response if the viewer has access.
 * Returns null if decryption fails for any reason (no access, missing key, etc.)
 *
 * @param encryptedResponse - The encrypted profile from getPrivateProfile
 * @param userDid - The viewer's DID
 * @param call - The API call function
 * @returns Decrypted profile data or null if not accessible
 */
export async function decryptProfileIfAccessible(
  encryptedResponse: EncryptedProfileResponse,
  userDid: string,
  call: SpeakeasyApiCall,
): Promise<PrivateProfileData | null> {
  const privateKey = await getPrivateKeyOrWarn(userDid, call)
  if (!privateKey) {
    return null
  }

  const decryptedMap = await decryptBatch(
    [
      {
        id: encryptedResponse.did,
        encryptedContent: encryptedResponse.encryptedContent,
        sessionId: encryptedResponse.did,
      },
    ],
    [
      {
        sessionId: encryptedResponse.did,
        encryptedDek: encryptedResponse.encryptedDek,
      },
    ],
    privateKey.privateKey,
  )

  const content = decryptedMap.get(encryptedResponse.did)
  if (!content) return null
  return JSON.parse(content) as PrivateProfileData
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
  const {encryptedDeks} = await encryptDekForTrustedUsers(
    myPublicKey,
    myUserKeyPairId,
    agent,
    call,
    queryClient,
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
 * Deletes the current user's private profile.
 * @param call - The API call function
 */
export async function deletePrivateProfile(
  call: SpeakeasyApiCall,
): Promise<void> {
  await call({
    api: 'social.spkeasy.actor.deleteProfile',
    method: 'POST',
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
 * Fetches and decrypts private profiles for multiple users in a batch.
 * Returns a Map of DID -> decrypted profile data for all accessible profiles.
 * Fetches the private key once and decrypts all profiles in parallel.
 *
 * @param dids - Array of DIDs to fetch profiles for
 * @param userDid - The viewer's DID (needed for decryption)
 * @param call - The API call function
 * @returns Map of DID to decrypted private profile data
 */
/**
 * Resolves avatarUri/bannerUri storage keys to full CDN URLs.
 * Keys are stored as relative paths (e.g. "media/abc123") and need
 * the base CDN URL prepended to form valid image URLs.
 */
export function resolvePrivateProfileUrls(
  data: PrivateProfileData,
  baseUrl: string,
): PrivateProfileData {
  return {
    ...data,
    rawAvatarUri: data.avatarUri,
    rawBannerUri: data.bannerUri,
    avatarUri: data.avatarUri ? `${baseUrl}/${data.avatarUri}` : undefined,
    bannerUri: data.bannerUri ? `${baseUrl}/${data.bannerUri}` : undefined,
  }
}

export async function fetchPrivateProfiles(
  dids: string[],
  userDid: string,
  call: SpeakeasyApiCall,
  baseUrl: string,
): Promise<Map<string, PrivateProfileData>> {
  const encrypted = await getPrivateProfiles(dids, call)
  if (encrypted.length === 0) return new Map()

  const privateKey = await getPrivateKeyOrWarn(userDid, call)
  if (!privateKey) return new Map()

  // Normalize into decryptBatch shape (use DID as session key)
  const items = encrypted.map(p => ({
    id: p.did,
    encryptedContent: p.encryptedContent,
    sessionId: p.did,
  }))
  const sessionKeys = encrypted.map(p => ({
    sessionId: p.did,
    encryptedDek: p.encryptedDek,
  }))

  const decryptedMap = await decryptBatch(
    items,
    sessionKeys,
    privateKey.privateKey,
  )

  const result = new Map<string, PrivateProfileData>()
  for (const [did, content] of decryptedMap) {
    const data = JSON.parse(content) as PrivateProfileData
    result.set(did, resolvePrivateProfileUrls(data, baseUrl))
  }
  return result
}

/**
 * Profile type that can be merged with private data.
 * Covers ProfileViewBasic, ProfileViewDetailed, and similar types.
 */
type MergeableProfile = {
  did: string
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  banner?: string
}

/**
 * Merges private profile data into an AT Protocol profile.
 * If privateData is provided, overlays displayName, description, avatar, and banner.
 *
 * @param atprotoProfile - The base AT Protocol profile
 * @param privateData - Optional decrypted private profile data
 * @returns Merged profile with private data overlaid if available
 */
export function mergePrivateProfileData<T extends MergeableProfile>(
  atprotoProfile: T,
  privateData: PrivateProfileData | null | undefined,
): T {
  if (!privateData) {
    return atprotoProfile
  }

  return {
    ...atprotoProfile,
    displayName: privateData.displayName,
    description: privateData.description,
    avatar: privateData.avatarUri ?? atprotoProfile.avatar,
    banner: privateData.bannerUri ?? atprotoProfile.banner,
  }
}

/**
 * Creates an anonymized ATProto profile record for private profile mode.
 * Removes avatar/banner and sets placeholder display name and bio.
 */
export function anonymizeAtProtoProfile(): AppBskyActorProfile.Record {
  return {
    displayName: 'Private User',
    description:
      'This is a private profile only visible to trusted followers on @spkeasy.social',
  }
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

/**
 * Converts a file path to a Blob for upload.
 * Handles file://, absolute paths, data:, http:, https:, and blob: URLs.
 */
async function pathToBlob(path: string): Promise<Blob> {
  if (path.startsWith('file:')) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.onload = () => resolve(xhr.response)
      xhr.onerror = () => reject(new Error('Failed to load blob'))
      xhr.responseType = 'blob'
      xhr.open('GET', path, true)
      xhr.send(null)
    })
  } else if (path.startsWith('/')) {
    return fetch(`file://${path}`).then(r => r.blob())
  } else if (
    path.startsWith('data:') ||
    path.startsWith('http:') ||
    path.startsWith('https:') ||
    path.startsWith('blob:')
  ) {
    return fetch(path).then(r => r.blob())
  }
  throw new TypeError(`Invalid path for blob conversion: ${path}`)
}

/**
 * Constructs a full Speakeasy media URL from a media key.
 * @param key - The media key stored in the private profile
 * @param agent - The BskyAgent to determine the correct CDN
 * @returns Full URL to the media
 */
export function getSpeakeasyMediaUrl(key: string, agent: BskyAgent): string {
  return `${getBaseCdnUrl(agent)}/${key}`
}

/**
 * Migrates media from Speakeasy storage to ATProto blob storage.
 * Used when switching from private to public profile.
 * @param speakeasyKey - The media key from the private profile
 * @param agent - The BskyAgent for uploading
 * @returns ATProto blob upload response
 */
export async function migrateMediaToAtProto(
  speakeasyKey: string,
  agent: BskyAgent,
): Promise<ComAtprotoRepoUploadBlob.Response> {
  const url = getSpeakeasyMediaUrl(speakeasyKey, agent)
  const blob = await pathToBlob(url)
  return uploadBlob(agent, blob, blob.type || 'image/jpeg')
}

/**
 * Migrates media from ATProto to Speakeasy storage.
 * Used when switching from public to private profile.
 * @param atprotoUrl - The ATProto CDN URL (e.g., https://cdn.bsky.app/...)
 * @param agent - The BskyAgent for authentication
 * @param sessionId - The Speakeasy session ID for upload
 * @returns Speakeasy media key
 */
export async function migrateMediaToSpeakeasy(
  atprotoUrl: string,
  agent: BskyAgent,
  sessionId: string,
): Promise<string> {
  const blob = await pathToBlob(atprotoUrl)
  const result = await uploadMediaToSpeakeasy(
    agent,
    blob,
    blob.type || 'image/jpeg',
    sessionId,
  )
  return result.data.blob.key
}

/**
 * Input type for new avatar/banner media.
 */
type NewMedia = {path: string; mime: string}

/**
 * Saves a private profile by orchestrating session management, media upload, and encryption.
 *
 * @param agent - The BskyAgent containing user information
 * @param call - The API call function
 * @param queryClient - The React Query client instance
 * @param profileData - The profile data to save
 */
export async function savePrivateProfile(
  agent: BskyAgent,
  call: SpeakeasyApiCall,
  queryClient: QueryClient,
  profileData: {
    displayName: string
    description: string
    isPublic: boolean
    newAvatar?: NewMedia | null // null = delete, undefined = keep existing
    newBanner?: NewMedia | null
    existingAvatarUri?: string
    existingBannerUri?: string
  },
): Promise<void> {
  const {isPublic} = profileData

  // When switching to public, delete private profile and return early
  // Caller must ensure AT Proto save succeeded before calling this
  if (isPublic) {
    try {
      await deletePrivateProfile(call)
    } catch (error) {
      // Ignore NotFound - profile may not exist if user was never private
      if (getErrorCode(error) !== 'NotFound') {
        throw error
      }
    }
    return
  }

  // Private profile: get/create session and save encrypted data
  const {sessionId, sessionKey} = await getOrCreateProfileSession(
    agent,
    call,
    queryClient,
  )

  const {
    displayName,
    description,
    newAvatar,
    newBanner,
    existingAvatarUri,
    existingBannerUri,
  } = profileData

  // Resolve avatar URI
  let avatarUri: string | undefined
  if (newAvatar === null) {
    // Explicit deletion
    avatarUri = undefined
  } else if (newAvatar) {
    // Upload new avatar to speakeasy
    const blob = await pathToBlob(newAvatar.path)
    const result = await uploadMediaToSpeakeasy(
      agent,
      blob,
      newAvatar.mime,
      sessionId,
    )
    avatarUri = result.data.blob.key
  } else if (existingAvatarUri?.startsWith('http')) {
    // Migration from ATProto: fetch and upload to Speakeasy
    avatarUri = await migrateMediaToSpeakeasy(
      existingAvatarUri,
      agent,
      sessionId,
    )
  } else {
    // No change - keep existing Speakeasy key
    avatarUri = existingAvatarUri
  }

  // Resolve banner URI
  let bannerUri: string | undefined
  if (newBanner === null) {
    // Explicit deletion
    bannerUri = undefined
  } else if (newBanner) {
    // Upload new banner to speakeasy
    const blob = await pathToBlob(newBanner.path)
    const result = await uploadMediaToSpeakeasy(
      agent,
      blob,
      newBanner.mime,
      sessionId,
    )
    bannerUri = result.data.blob.key
  } else if (existingBannerUri?.startsWith('http')) {
    // Migration from ATProto: fetch and upload to Speakeasy
    bannerUri = await migrateMediaToSpeakeasy(
      existingBannerUri,
      agent,
      sessionId,
    )
  } else {
    // No change - keep existing Speakeasy key
    bannerUri = existingBannerUri
  }

  // Build and encrypt profile data
  const privateData: PrivateProfileData = {
    displayName,
    description,
    avatarUri,
    bannerUri,
  }
  const encryptedContent = await encryptProfileData(privateData, sessionKey)

  // Save to API
  await putPrivateProfile(
    {
      sessionId,
      encryptedContent,
      isPublic: false,
      avatarUri,
      bannerUri,
    },
    call,
  )
}

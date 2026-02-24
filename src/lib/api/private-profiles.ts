import {
  AppBskyActorDefs,
  AppBskyActorProfile,
  AppBskyRichtextFacet,
  BskyAgent,
  ComAtprotoRepoUploadBlob,
  RichText as RichTextAPI,
} from '@atproto/api'
import {QueryClient} from '@tanstack/react-query'

import {decryptBatch, decryptDEK, encryptContent} from '#/lib/encryption'
import {isWeb} from '#/platform/detection'
import {type PronounSet} from '#/state/queries/pronouns'
import {getBaseCdnUrl} from './feed/utils'
import {encryptDekForTrustedUsers} from './session-utils'
import {
  getErrorCode,
  getHost,
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
 * Public / private profile display and caching
 * ------------------------------------------
 *
 * Full rules (display, cache, save order, optimistic updates, fetcher, notifications):
 *   docs/private-profiles.md
 * Follow them so future revisions go forward, not backward.
 *
 * Summary:
 *   Display: Only mergePrivateProfileData(public, getCachedPrivateProfile(did)) decides
 *   what to show. Only overlay when public has the sentinel (shouldCheckPrivateProfile).
 *   Caching: Private data in module cache; merge at read time; clearAll() on account switch/logout.
 *   Optimistic: Every profile mutation must update cache and/or setQueryData — no refetch-only.
 */

/**
 * Constants for the @spkeasy.social mention in anonymized profiles
 */
export const SPKEASY_MENTION = '@spkeasy.social'
export const SPKEASY_DID = 'did:plc:spkeasy.social'
export const DEFAULT_PRIVATE_DESCRIPTION = `This is a private profile only visible to trusted followers on ${SPKEASY_MENTION}`

/**
 * Ensures @spkeasy.social in a RichText resolves to the correct DID.
 * Should be called after detectFacets() to fix up the mention DID.
 *
 * Follows the same pattern as createDefaultHiddenMessage() in src/lib/api/index.ts
 */
export function ensureSpkeasyMention(rt: RichTextAPI): void {
  const text = rt.text
  const mentionIndex = text.indexOf(SPKEASY_MENTION)
  if (mentionIndex === -1) return

  const encoder = new TextEncoder()
  const byteStart = encoder.encode(text.slice(0, mentionIndex)).byteLength
  const byteEnd = byteStart + encoder.encode(SPKEASY_MENTION).byteLength

  // Check if detectFacets already found this mention
  if (rt.facets) {
    for (const facet of rt.facets) {
      if (
        facet.index.byteStart === byteStart &&
        facet.index.byteEnd === byteEnd
      ) {
        // Fix up the DID on the existing mention facet
        for (const feature of facet.features) {
          if (AppBskyRichtextFacet.isMention(feature)) {
            feature.did = SPKEASY_DID
            return
          }
        }
      }
    }
  }

  // No existing facet found — add one
  if (!rt.facets) {
    rt.facets = []
  }
  rt.facets.push({
    index: {byteStart, byteEnd},
    features: [
      {
        $type: 'app.bsky.richtext.facet#mention',
        did: SPKEASY_DID,
      },
    ],
  })
}

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
  pronouns?: string | PronounSet[] // < 2 sets = string, >= 2 sets = PronounSet[]
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

export const PRIVATE_PROFILE_DISPLAY_NAME = 'Private Profile'
const CHECK_ALL_PROFILES = false

/**
 * Minimal metadata attached to merged profile when viewer has access to private data.
 * Used by feed/thread/notification authors; full PrivateProfileMetadata lives in profile.ts.
 */
export type ProfileWithPrivateMeta = {
  _privateProfile?: {isPrivate: boolean}
}

/**
 * Whether the public/ATProto profile indicates a private profile (e.g. sentinel
 * displayName). Use this to decide if we should fetch and merge private data.
 * The actual display profile is always computed by mergePrivateProfileData();
 * do not duplicate that logic.
 */
export function shouldCheckPrivateProfile(
  profile: AppBskyActorDefs.ProfileViewBasic | null | undefined,
): boolean {
  return (
    CHECK_ALL_PROFILES || profile?.displayName === PRIVATE_PROFILE_DISPLAY_NAME
  )
}

/**
 * True when the profile is private (sentinel displayName or _privateProfile.isPrivate).
 * Use with hasAccessToPrivateProfile to choose pill vs icon-only.
 */
export function isPrivateProfile(
  profile:
    | (AppBskyActorDefs.ProfileViewBasic & ProfileWithPrivateMeta)
    | null
    | undefined,
): boolean {
  if (!profile) return false
  return (
    profile.displayName === PRIVATE_PROFILE_DISPLAY_NAME ||
    profile._privateProfile?.isPrivate === true
  )
}

/**
 * True when the viewer has access to the private profile (decrypted data merged).
 * Only true when _privateProfile.isPrivate is set (by mergePrivateProfileData).
 */
export function hasAccessToPrivateProfile(
  profile:
    | (AppBskyActorDefs.ProfileViewBasic & ProfileWithPrivateMeta)
    | null
    | undefined,
): boolean {
  return profile?._privateProfile?.isPrivate === true
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

/**
 * Fetches and decrypts private profiles for multiple users in a batch.
 * Returns a Map of DID -> decrypted profile data for all accessible profiles.
 * Fetches the private key once and decrypts all profiles in parallel.
 *
 * @param dids - Array of DIDs to fetch profiles for
 * @param userDid - The viewer's DID (needed for decryption)
 * @param call - The API call function
 * @param baseUrl - Base CDN URL for resolving media keys
 * @returns Map of DID to decrypted private profile data
 */
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
 * Single place that determines the profile to display. Implements:
 *   displayProfile = isProfilePrivate(public) ? (private ? merge(public, private) : public) : public
 * Only overlays private when the public profile has the private sentinel (see
 * shouldCheckPrivateProfile); otherwise returns public as-is. All UI must use
 * the result of this function (or of hooks that call it) — do not duplicate.
 *
 * @param atprotoProfile - The base AT Protocol profile (from feed, profile query, etc.)
 * @param privateData - Optional decrypted private profile data from cache
 * @returns Profile to display: merged when public is sentinel and we have private; else public
 */
export function mergePrivateProfileData<T extends MergeableProfile>(
  atprotoProfile: T,
  privateData: PrivateProfileData | null | undefined,
): T {
  if (
    !privateData ||
    atprotoProfile.displayName !== PRIVATE_PROFILE_DISPLAY_NAME
  ) {
    return atprotoProfile
  }

  // Derive native pronouns string from private data
  let nativePronouns: string | undefined
  if (privateData.pronouns) {
    if (Array.isArray(privateData.pronouns)) {
      nativePronouns = privateData.pronouns[0]?.forms.join('/') || undefined
    } else {
      nativePronouns = privateData.pronouns
    }
  }

  return {
    ...atprotoProfile,
    displayName: privateData.displayName,
    description: privateData.description,
    avatar: privateData.avatarUri ?? atprotoProfile.avatar,
    banner: privateData.bannerUri ?? atprotoProfile.banner,
    ...(nativePronouns !== undefined ? {pronouns: nativePronouns} : {}),
    _privateProfile: {isPrivate: true},
  } as T & ProfileWithPrivateMeta
}

/**
 * Creates an anonymized ATProto profile record for private profile mode.
 * Builds the record from scratch (no spread of existing). Removes avatar, banner,
 * and pronouns; sets placeholder display name and bio. Optionally preserves
 * pinnedPost (or other fields passed in preserve).
 */
export function anonymizeAtProtoProfile(
  publicDescription?: string,
  preserve?: Pick<AppBskyActorProfile.Record, 'pinnedPost'>,
): AppBskyActorProfile.Record {
  return {
    displayName: PRIVATE_PROFILE_DISPLAY_NAME,
    description: publicDescription || DEFAULT_PRIVATE_DESCRIPTION,
    ...(preserve?.pinnedPost != null && {pinnedPost: preserve.pinnedPost}),
  }
}

/**
 * In-flight promise so concurrent callers share one session creation.
 * Cleared in finally so the next caller gets a fresh creation; do not leave set across retries.
 */
let sessionCreationPromise: Promise<{
  sessionId: string
  sessionKey: string
}> | null = null

/**
 * Retrieves or creates a profile session for the current user.
 * Concurrent callers that get NotFound share a single creation so only one
 * create runs.
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
  try {
    const {sessionId, encryptedDek} = await getProfileSession(call)
    const {privateKey} = await getPrivateKey(call)
    const sessionKey = await decryptDEK(encryptedDek, privateKey)
    return {sessionId, sessionKey}
  } catch (error) {
    if (getErrorCode(error) !== 'NotFound') {
      throw error
    }
  }

  if (!sessionCreationPromise) {
    sessionCreationPromise = (async () => {
      try {
        const {publicKey, privateKey, userKeyPairId} =
          await getOrCreatePublicKey(agent, call)
        const {sessionId, encryptedDek} = await createNewProfileSession(
          publicKey,
          userKeyPairId,
          agent,
          call,
          queryClient,
        )
        const sessionKey = await decryptDEK(encryptedDek, privateKey)
        return {sessionId, sessionKey}
      } finally {
        sessionCreationPromise = null
      }
    })()
  }
  return sessionCreationPromise
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
 * If the URL is a Speakeasy CDN media URL, returns the media key (e.g. "media/abc123").
 * Otherwise returns null. Used to avoid re-downloading/re-uploading when saving private
 * profile with existing Speakeasy avatar/banner URLs (e.g. after toggling public then back to private).
 */
export function parseSpeakeasyMediaKeyFromUrl(
  url: string,
  agent: BskyAgent,
): string | null {
  const baseUrl = getBaseCdnUrl(agent)
  if (!url.startsWith(baseUrl)) return null
  const key = url.slice(baseUrl.length).replace(/^\//, '')
  return key || null
}

/**
 * Fetches Speakeasy media as a Blob via the API with auth (avoids CORS on web).
 */
async function fetchSpeakeasyMediaBlob(
  agent: BskyAgent,
  speakeasyKey: string,
): Promise<Blob> {
  const serverUrl = getHost(agent, 'social.spkeasy.media.upload')
  const url = `${serverUrl}/xrpc/social.spkeasy.media.get?key=${encodeURIComponent(
    speakeasyKey,
  )}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${agent.session?.accessJwt}`,
    },
  })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Speakeasy media: ${response.status} ${response.statusText}`,
    )
  }
  return response.blob()
}

/**
 * Result of migrating one media asset from Speakeasy to ATProto.
 * blobUrl is set on web so the optimistic profile can show the image immediately
 * without relying on getProfile or Speakeasy CDN after delete.
 */
export type MigrateMediaToAtProtoResult = {
  response: ComAtprotoRepoUploadBlob.Response
  blobUrl?: string
}

/**
 * Migrates media from Speakeasy storage to ATProto blob storage.
 * Used when switching from private to public profile.
 * On web, fetches via authenticated API to avoid CORS (direct CDN fetch fails).
 * Returns the upload response and a blob URL (when createObjectURL is available)
 * so the optimistic profile can display the image before refetch.
 * @param speakeasyKey - The media key from the private profile
 * @param agent - The BskyAgent for uploading
 * @returns Upload response and optional blob URL for optimistic display
 */
export async function migrateMediaToAtProto(
  speakeasyKey: string,
  agent: BskyAgent,
): Promise<MigrateMediaToAtProtoResult> {
  let blob: Blob
  if (isWeb) {
    blob = await fetchSpeakeasyMediaBlob(agent, speakeasyKey)
  } else {
    const url = getSpeakeasyMediaUrl(speakeasyKey, agent)
    blob = await pathToBlob(url)
  }
  const blobUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(blob)
      : undefined
  const response = await uploadBlob(agent, blob, blob.type || 'image/jpeg')
  return {response, blobUrl}
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
 * Parameters for resolving private profile media (step 1 of Public → Private).
 * Same as savePrivateProfile profileData but without isPublic.
 */
export type ResolvePrivateProfileMediaParams = {
  displayName: string
  description: string
  newAvatar?: NewMedia | null // null = delete, undefined = keep existing
  newBanner?: NewMedia | null
  existingAvatarUri?: string
  existingBannerUri?: string
  pronouns?: string | PronounSet[]
}

/**
 * Step 1 of Public → Private: resolve avatar and banner (upload/migrate to Speakeasy).
 * Returns session and URIs for use in writePrivateProfileRecord.
 */
export async function resolvePrivateProfileMedia(
  agent: BskyAgent,
  call: SpeakeasyApiCall,
  queryClient: QueryClient,
  profileData: ResolvePrivateProfileMediaParams,
): Promise<{
  sessionId: string
  sessionKey: string
  avatarUri?: string
  bannerUri?: string
}> {
  const {sessionId, sessionKey} = await getOrCreateProfileSession(
    agent,
    call,
    queryClient,
  )

  const {newAvatar, newBanner, existingAvatarUri, existingBannerUri} =
    profileData

  const resolveAvatar = async (): Promise<string | undefined> => {
    if (newAvatar === null) return undefined
    if (newAvatar) {
      const blob = await pathToBlob(newAvatar.path)
      const result = await uploadMediaToSpeakeasy(
        agent,
        blob,
        newAvatar.mime,
        sessionId,
      )
      return result.data.blob.key
    }
    if (existingAvatarUri?.startsWith('http')) {
      const key = parseSpeakeasyMediaKeyFromUrl(existingAvatarUri, agent)
      if (key) return key
      return migrateMediaToSpeakeasy(existingAvatarUri, agent, sessionId)
    }
    if (existingAvatarUri?.startsWith('blob:')) {
      return migrateMediaToSpeakeasy(existingAvatarUri, agent, sessionId)
    }
    return existingAvatarUri
  }

  const resolveBanner = async (): Promise<string | undefined> => {
    if (newBanner === null) return undefined
    if (newBanner) {
      const blob = await pathToBlob(newBanner.path)
      const result = await uploadMediaToSpeakeasy(
        agent,
        blob,
        newBanner.mime,
        sessionId,
      )
      return result.data.blob.key
    }
    if (existingBannerUri?.startsWith('http')) {
      const key = parseSpeakeasyMediaKeyFromUrl(existingBannerUri, agent)
      if (key) return key
      return migrateMediaToSpeakeasy(existingBannerUri, agent, sessionId)
    }
    if (existingBannerUri?.startsWith('blob:')) {
      return migrateMediaToSpeakeasy(existingBannerUri, agent, sessionId)
    }
    return existingBannerUri
  }

  const [avatarUri, bannerUri] = await Promise.all([
    resolveAvatar(),
    resolveBanner(),
  ])

  return {sessionId, sessionKey, avatarUri, bannerUri}
}

/**
 * Step 2 of Public → Private: write the private record to Speakeasy (encrypt + put).
 * Call after resolvePrivateProfileMedia; call clear public profile only after this succeeds.
 */
export async function writePrivateProfileRecord(
  call: SpeakeasyApiCall,
  params: {
    sessionId: string
    sessionKey: string
    displayName: string
    description: string
    avatarUri?: string
    bannerUri?: string
    pronouns?: string | PronounSet[]
  },
): Promise<void> {
  const {
    sessionId,
    sessionKey,
    displayName,
    description,
    avatarUri,
    bannerUri,
    pronouns,
  } = params
  const privateData: PrivateProfileData = {
    displayName,
    description,
    avatarUri,
    bannerUri,
    pronouns,
  }
  const encryptedContent = await encryptProfileData(privateData, sessionKey)
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

/**
 * Saves a private profile by orchestrating session management, media upload, and encryption.
 * For Public → Private transitions, callers should use resolvePrivateProfileMedia,
 * writePrivateProfileRecord, then clear public profile (with rollback on failure) so the
 * order of operations avoids data loss.
 *
 * @param agent - The BskyAgent containing user information
 * @param call - The API call function
 * @param queryClient - The React Query client instance
 * @param profileData - The profile data to save
 * @returns Resolved avatar and banner URIs (Speakeasy media keys) for optimistic cache updates
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
    pronouns?: string | PronounSet[]
  },
): Promise<{avatarUri?: string; bannerUri?: string}> {
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
    return {}
  }

  const resolved = await resolvePrivateProfileMedia(agent, call, queryClient, {
    displayName: profileData.displayName,
    description: profileData.description,
    newAvatar: profileData.newAvatar,
    newBanner: profileData.newBanner,
    existingAvatarUri: profileData.existingAvatarUri,
    existingBannerUri: profileData.existingBannerUri,
    pronouns: profileData.pronouns,
  })
  await writePrivateProfileRecord(call, {
    sessionId: resolved.sessionId,
    sessionKey: resolved.sessionKey,
    displayName: profileData.displayName,
    description: profileData.description,
    avatarUri: resolved.avatarUri,
    bannerUri: resolved.bannerUri,
    pronouns: profileData.pronouns,
  })
  return {avatarUri: resolved.avatarUri, bannerUri: resolved.bannerUri}
}

import {BskyAgent} from '@atproto/api'
import {chunk, throttle} from 'lodash'

import {generateKeyPair} from '#/lib/encryption'
import {logger} from '#/logger'
import * as Toast from '#/view/com/util/Toast'
import {getErrorCode, SpeakeasyApiCall} from './speakeasy'

// Throttled toast for private key errors - only show once per 30 seconds
const showPrivateKeyErrorToast = throttle(() => {
  Toast.show('Unable to load private data', 'xmark')
}, 30_000)

let cachedPrivateKeyPromise:
  | Promise<SpeakeasyPrivateKey | undefined>
  | undefined
let cachedPrivateKeyUserDid: string | undefined
let handledPrivateKeyPromise: Promise<SpeakeasyPrivateKey | void>

/**
 * Retrieves the encrypted session key from the Speakeasy API.
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<string>} The encrypted session key
 */
export async function getSession(
  speakeasyApi: SpeakeasyApiCall,
): Promise<{sessionId: string; encryptedDek: string}> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.privateSession.getSession',
  })

  return data.encryptedSessionKey
}

/**
 * Retrieves the public key for a given DID from the Speakeasy API.
 * @param {string} did - The DID (Decentralized Identifier) of the user
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<string>} The user's public key
 */
export async function getPublicKey(
  did: string,
  speakeasyApi: SpeakeasyApiCall,
): Promise<{userKeyPairId: string; publicKey: string}> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.key.getPublicKey',
    query: {
      did,
    },
  })

  return data
}

/**
 * Retrieves the public keys for given DIDs from the Speakeasy API.
 * @param {string[]} dids - Array of DIDs (Decentralized Identifiers)
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<string[]>} Array of public keys
 */
export async function getPublicKeys(
  dids: string[],
  speakeasyApi: SpeakeasyApiCall,
): Promise<{publicKey: string; recipientDid: string; userKeyPairId: string}[]> {
  const CHUNK_SIZE = 25
  const chunks = chunk(dids, CHUNK_SIZE)
  const allPublicKeys: {
    publicKey: string
    recipientDid: string
    userKeyPairId: string
  }[] = []

  for (const didChunk of chunks) {
    const data = await speakeasyApi({
      api: 'social.spkeasy.key.getPublicKeys',
      query: {
        dids: didChunk.join(','),
      },
    })
    allPublicKeys.push(...data.publicKeys)
  }

  return allPublicKeys
}

export type SpeakeasyPrivateKey = {
  privateKey: string
  userKeyPairId: string
}

/**
 * Retrieves and caches the private key for a given user DID.
 * @param {string} userDid - The DID of the user
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<{privateKey: string, userKeyPairId: string}>} The cached private key
 */
export async function getCachedPrivateKey(
  userDid: string,
  speakeasyApi: SpeakeasyApiCall,
  ignoreError = false,
) {
  if (!userDid) return

  if (!(cachedPrivateKeyUserDid === userDid && cachedPrivateKeyPromise)) {
    cachedPrivateKeyUserDid = userDid
    cachedPrivateKeyPromise = getPrivateKey(speakeasyApi)
    handledPrivateKeyPromise = cachedPrivateKeyPromise.catch(() => {
      cachedPrivateKeyPromise = undefined
    })
  }
  return ignoreError ? handledPrivateKeyPromise : cachedPrivateKeyPromise
}

/**
 * Gets the cached private key, logging and showing a toast on error.
 * Use this when you need the private key for decryption and want to
 * gracefully handle errors with user feedback.
 *
 * @returns The private key, or null if unavailable/error
 */
export async function getPrivateKeyOrWarn(
  userDid: string,
  speakeasyApi: SpeakeasyApiCall,
): Promise<SpeakeasyPrivateKey | null> {
  try {
    const privateKey = await getCachedPrivateKey(userDid, speakeasyApi)
    return privateKey ?? null
  } catch (error) {
    logger.error('getPrivateKeyOrWarn: failed to get private key', {error})
    showPrivateKeyErrorToast()
    return null
  }
}

export async function cachePrivateKey(
  userDid: string,
  privateKey: SpeakeasyPrivateKey,
) {
  cachedPrivateKeyUserDid = userDid
  cachedPrivateKeyPromise = Promise.resolve(privateKey)
  handledPrivateKeyPromise = cachedPrivateKeyPromise
}

/**
 * Retrieves the private key for the current user from the Speakeasy API.
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<string>} The user's private key
 */
export async function getPrivateKey(
  speakeasyApi: SpeakeasyApiCall,
): Promise<SpeakeasyPrivateKey> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.key.getPrivateKey',
  })

  console.log('private key fetched', data)
  return data
}

interface KeyPair {
  privateKey: string
  publicKey: string
}

/**
 * Updates the user's key pair in the Speakeasy API.
 * @param {KeyPair} keyPair - The key pair parameters
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<void>}
 */
export async function updateUserKeyPair(
  {privateKey, publicKey}: KeyPair,
  agent: BskyAgent,
  speakeasyApi: SpeakeasyApiCall,
): Promise<{userKeyPairId: string}> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.key.rotate',
    method: 'POST',
    body: {
      privateKey,
      publicKey,
    },
  })
  // Save the private key for decryption
  cachePrivateKey(agent.did!, {
    privateKey,
    userKeyPairId: data.userKeyPairId,
  })

  return {userKeyPairId: data.userKeyPairId}
}

/**
 * Gets or creates a public key for the given agent.
 * @param {any} agent - The agent object containing user information
 * @param {any} call - The API call function
 * @returns {Promise<{publicKey: string, privateKey: string}>} The public and private key pair
 */
export async function getOrCreatePublicKey(agent: BskyAgent, call: any) {
  let publicKey: string
  let privateKey: string | null = null
  let userKeyPairId: string

  try {
    ;({publicKey, userKeyPairId} = await getPublicKey(agent.did!, call))
  } catch (error) {
    if (getErrorCode(error) === 'NotFound') {
      ;({publicKey, privateKey} = await generateKeyPair())
      ;({userKeyPairId} = await updateUserKeyPair(
        {publicKey, privateKey},
        agent,
        call,
      ))
    } else {
      throw error
    }
  }
  return {publicKey, privateKey, userKeyPairId}
}

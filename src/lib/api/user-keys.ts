import {chunk} from 'lodash'

import {generateKeyPair} from '#/lib/encryption'
import {getErrorCode, SpeakeasyApiCall} from './speakeasy'

/**
 * Retrieves the encrypted session key from the Speakeasy API.
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<string>} The encrypted session key
 */
export async function getSession(
  speakeasyApi: SpeakeasyApiCall,
): Promise<{sessionId: string; encryptedDek: string}> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.graph.getSession',
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
): Promise<string> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.keys.getPublicKey',
    query: {
      did,
    },
  })

  return data.sessionKey
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
): Promise<{publicKey: string; recipientDid: string}[]> {
  const CHUNK_SIZE = 25
  const chunks = chunk(dids, CHUNK_SIZE)
  const allPublicKeys: {publicKey: string; recipientDid: string}[] = []

  for (const didChunk of chunks) {
    const data = await speakeasyApi({
      api: 'social.spkeasy.keys.getPublicKeys',
      query: {
        dids: didChunk.join(','),
      },
    })
    allPublicKeys.push(...data.publicKeys)
  }

  return allPublicKeys
}

/**
 * Retrieves the private key for the current user from the Speakeasy API.
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<string>} The user's private key
 */
export async function getPrivateKey(
  speakeasyApi: SpeakeasyApiCall,
): Promise<string> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.keys.getPrivateKey',
  })

  return data.sessionKey
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
  speakeasyApi: SpeakeasyApiCall,
): Promise<void> {
  await speakeasyApi({
    api: 'social.spkeasy.keys.setKeyPair',
    body: {
      privateKey,
      publicKey,
    },
  })
}

/**
 * Gets or creates a public key for the given agent.
 * @param {any} agent - The agent object containing user information
 * @param {any} call - The API call function
 * @returns {Promise<{publicKey: string, privateKey: string}>} The public and private key pair
 */
export async function getOrCreatePublicKey(agent: any, call: any) {
  let publicKey: string
  let privateKey: string | null = null

  try {
    publicKey = await getPublicKey(agent.did!, call)
  } catch (error) {
    if (getErrorCode(error) === 'NotFound') {
      ;({publicKey, privateKey} = await generateKeyPair())
      await updateUserKeyPair({publicKey, privateKey}, call)
    } else {
      throw error
    }
  }
  return {publicKey, privateKey}
}

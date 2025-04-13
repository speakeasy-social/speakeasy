import {chunk} from 'lodash'

import {SpeakeasyApi} from './speakeasy'

/**
 * Retrieves the encrypted session key from the Speakeasy API.
 * @param {SpeakeasyApi} speakeasyApi - The Speakeasy API client instance
 * @returns {Promise<string>} The encrypted session key
 */
export async function getSession(
  speakeasyApi: SpeakeasyApi,
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
  speakeasyApi: SpeakeasyApi,
): Promise<string> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.user.getPublicKey',
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
  speakeasyApi: SpeakeasyApi,
): Promise<{publicKey: string; recipientDid: string}[]> {
  const CHUNK_SIZE = 25
  const chunks = chunk(dids, CHUNK_SIZE)
  const allPublicKeys: {publicKey: string; recipientDid: string}[] = []

  for (const didChunk of chunks) {
    const data = await speakeasyApi({
      api: 'social.spkeasy.user.getPublicKeys',
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
  speakeasyApi: SpeakeasyApi,
): Promise<string> {
  const data = await speakeasyApi({
    api: 'social.spkeasy.user.getPrivateKey',
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
  speakeasyApi: SpeakeasyApi,
): Promise<void> {
  await speakeasyApi({
    api: 'social.spkeasy.user.setKeyPair',
    body: {
      privateKey,
      publicKey,
    },
  })
}

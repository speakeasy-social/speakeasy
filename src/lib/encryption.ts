import basex from 'base-x'
import {MlKem768} from 'mlkem'

// =====================
// Utility Functions
// =====================

// Cache for tracking recent random values
const randomValueCache = new Map<number, Uint8Array[]>()
const MAX_CACHE_SIZE = 5
let isRandomDisabled = false

/**
 * Secure wrapper around crypto.getRandomValues that guards against poor randomness
 * by checking for duplicate values in recent history.
 *
 * @param array - The array to fill with random values
 * @returns The same array filled with random values
 * @throws Error if duplicate values are detected or if the function has been disabled
 */
function secureGetRandomValues<T extends ArrayBufferView>(array: T): T {
  if (isRandomDisabled) {
    throw new Error(
      'Random value generation has been disabled due to detected poor randomness',
    )
  }

  const result = crypto.getRandomValues(array)

  // Only track Uint8Array values for simplicity
  if (array instanceof Uint8Array) {
    const length = array.length
    const currentCache = randomValueCache.get(length) || []

    // Check if this value exists in the cache
    const isDuplicate = currentCache.some(
      cached =>
        cached.length === array.length &&
        cached.every((val, idx) => val === array[idx]),
    )

    if (isDuplicate) {
      isRandomDisabled = true
      throw new Error(
        'Duplicate random value detected - random number generation appears compromised',
      )
    }

    // Add to cache and maintain size limit
    currentCache.unshift(array.slice())
    if (currentCache.length > MAX_CACHE_SIZE) {
      currentCache.pop()
    }
    randomValueCache.set(length, currentCache)
  }

  return result
}

/**
 * Converts a Uint8Array to SafeText (URL-safe Base64)
 *
 * Used to turn keys and encrypted content into strings that are safe
 * for transport and storage
 *
 * @param {Uint8Array} buf - The input byte array.
 * @returns {string} The SafeText (URL-safe Base64) representation of the input.
 */
const safeBtoa = (buf: Uint8Array): string =>
  btoa(String.fromCharCode(...buf))
    // Replace / & + with _ & -
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    // Remove trailing '=' padding
    .replace(/[=]+$/, '')

/**
 * Converts SafeText (URL-safe Base64) to a Uint8Array.
 * @param {string} str - The SafeText input string.
 * @returns {Uint8Array} The decoded byte array.
 */
const safeAtob = (str: string): Uint8Array => {
  const base64 = str
    // Replace _ & - with / & +
    .replace(/_/g, '/')
    .replace(/-/g, '+')
    // Add '=' padding if necessary
    .padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

/**
 * ML-KEM-768 Post encryption
 */

// ========================
// Key Generation Functions
// ========================

/**
 * Generates ML-KEM-768 key pair
 * @returns {Promise<{publicKey: string, privateKey: string}>} SafeText encoded keys
 */
export async function generateKeyPair(): Promise<{
  publicKey: string
  privateKey: string
}> {
  // mlkem will generate it's own random values,
  // but let's check first that the random number
  // generator is working
  secureGetRandomValues(new Uint8Array(32))
  secureGetRandomValues(new Uint8Array(32))

  const mlkem = new MlKem768()
  const [publicKey, privateKey] = await mlkem.generateKeyPair()

  return {
    publicKey: safeBtoa(publicKey),
    privateKey: safeBtoa(privateKey),
  }
}

/**
 * Generates a Data Encryption Key (DEK) for symmetric encryption.
 * @returns {Promise<string>} SafeText encoded 256-bit random key
 */
export async function generateDEK(): Promise<string> {
  const dek = secureGetRandomValues(new Uint8Array(32))
  const safe = safeBtoa(dek)
  // Attempt to wipe raw DEK from memory after conversion to prevent leakage
  secureWipe(dek)

  return safe
}

// =====================
// DEK Encryption/Decryption Functions
// =====================

/**
 * Encrypts a session DEK using ML-KEM
 * @param {string} dek - The Data Encryption Key to encrypt (SafeText format).
 * @param {string} recipientPublicKey - The recipient's public key (SafeText format).
 * @returns {Promise<string>} The encrypted DEK in SafeText format.
 */
export async function encryptDEK(
  dek: string,
  recipientPublicKey: string,
): Promise<string> {
  // Decode SafeText inputs into Uint8Array for cryptographic operations
  const dekBytes = safeAtob(dek)
  const pubKeyBytes = safeAtob(recipientPublicKey)

  try {
    const mlkem = new MlKem768()
    const [ciphertext, sharedSecret] = await mlkem.encap(pubKeyBytes)

    // Generate salt and IV for HKDF and AES-GCM respectively
    const salt = secureGetRandomValues(new Uint8Array(32))
    const iv = secureGetRandomValues(new Uint8Array(12))

    // Derive AES and HMAC keys using HKDF from the shared secret
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      {name: 'HKDF'},
      false,
      ['deriveBits'],
    )

    const derivedKeys = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: new TextEncoder().encode('ML-KEM-768-AES-HMAC'),
      },
      hkdfKey,
      512, // Derive both AES-GCM (256 bits) and HMAC-SHA256 (256 bits) keys
    )

    // Split derived keys into AES-GCM key and HMAC key
    const [aesKey, hmacKey] = await Promise.all([
      crypto.subtle.importKey(
        'raw',
        new Uint8Array(derivedKeys.slice(0, 32)),
        {name: 'AES-GCM', length: 256},
        false,
        ['encrypt'],
      ),
      crypto.subtle.importKey(
        'raw',
        new Uint8Array(derivedKeys.slice(32, 64)),
        {name: 'HMAC', hash: 'SHA-256'},
        false,
        ['sign'],
      ),
    ])

    // Encrypt the DEK using AES-GCM with the derived AES key and IV
    const encryptedDek = await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv},
      aesKey,
      dekBytes,
    )

    // Authenticate ciphertext + IV using HMAC-SHA256 to prevent tampering
    const authData = new Uint8Array([...ciphertext, ...iv])
    const hmac = await crypto.subtle.sign('HMAC', hmacKey, authData)

    // Package all components together with a version header for future compatibility
    const versionHeader = new TextEncoder().encode('KEMv1|')
    const packaged = new Uint8Array(
      versionHeader.length +
        salt.length +
        ciphertext.length +
        iv.length +
        hmac.byteLength +
        encryptedDek.byteLength,
    )

    let offset = 0
    packaged.set(versionHeader, offset)
    offset += versionHeader.length
    packaged.set(salt, offset)
    offset += salt.length
    packaged.set(ciphertext, offset)
    offset += ciphertext.length
    packaged.set(iv, offset)
    offset += iv.length
    packaged.set(new Uint8Array(hmac), offset)
    offset += hmac.byteLength
    packaged.set(new Uint8Array(encryptedDek), offset)

    return safeBtoa(packaged)
  } finally {
    secureWipe(dekBytes)
    secureWipe(pubKeyBytes)
  }
}

/**
 * Decrypts an encrypted session DEK using ML-KEM
 * @param {string} encryptedDek - The encrypted DEK in SafeText format.
 * @param {string} recipientPrivateKey - The recipient's private key (SafeText format).
 * @returns {Promise<string>} The decrypted DEK in SafeText format.
 */
export async function decryptDEK(
  encryptedDek: string,
  recipientPrivateKey: string,
): Promise<string> {
  // Decode private key and encrypted data from SafeText to Uint8Array format
  const privateKeyBytes = safeAtob(recipientPrivateKey)
  const data = safeAtob(encryptedDek)

  try {
    // Validate version header for compatibility checks
    const versionHeader = new TextEncoder().encode('KEMv1|')
    if (
      !data
        .slice(0, versionHeader.length)
        .every((val, idx) => val === versionHeader[idx])
    ) {
      const versionDelimiter = data.indexOf('|'.charCodeAt(0))
      const version = new TextDecoder().decode(data.slice(0, versionDelimiter))
      console.log('Invalid encrypted DEK version header:', version)
      throw new Error('Invalid version header')
    }

    let offset = versionHeader.length
    const components = {
      salt: data.slice(offset, offset + 32),
      ciphertext: data.slice(offset + 32, offset + 32 + 1088),
      iv: data.slice(offset + 32 + 1088, offset + 32 + 1088 + 12),
      hmac: data.slice(offset + 32 + 1088 + 12, offset + 32 + 1088 + 12 + 32),
      encryptedKey: data.slice(offset + 32 + 1088 + 12 + 32),
    }

    const mlkem = new MlKem768()
    const sharedSecret = await mlkem.decap(
      components.ciphertext,
      privateKeyBytes,
    )

    // Derive AES and HMAC keys using HKDF from the shared secret and salt
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      {name: 'HKDF'},
      false,
      ['deriveBits'],
    )

    const derivedKeys = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: components.salt,
        info: new TextEncoder().encode('ML-KEM-768-AES-HMAC'),
      },
      hkdfKey,
      512,
    )

    // Split derived keys into AES-GCM key and HMAC key
    const [aesKey, hmacKey] = await Promise.all([
      crypto.subtle.importKey(
        'raw',
        new Uint8Array(derivedKeys.slice(0, 32)),
        {name: 'AES-GCM', length: 256},
        false,
        ['decrypt'],
      ),
      crypto.subtle.importKey(
        'raw',
        new Uint8Array(derivedKeys.slice(32, 64)),
        {name: 'HMAC', hash: 'SHA-256'},
        false,
        ['verify'],
      ),
    ])

    // Verify authentication tag using HMAC-SHA256 to ensure integrity of ciphertext + IV
    const authData = new Uint8Array([
      ...components.ciphertext,
      ...components.iv,
    ])
    const valid = await crypto.subtle.verify(
      'HMAC',
      hmacKey,
      components.hmac,
      authData,
    )

    if (!valid) throw new Error('DEK Authentication failed')

    // Decrypt the DEK using AES-GCM with the derived AES key and IV
    const decryptedDekBytes = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv: components.iv},
      aesKey,
      components.encryptedKey,
    )

    // Convert decrypted DEK to SafeText format for secure handling and return it
    const safeDek = safeBtoa(new Uint8Array(decryptedDekBytes))

    return safeDek
  } catch (error) {
    console.error(
      'Decryption failed:',
      error instanceof Error ? error.message : error,
    )
    throw new Error('Decryption failed')
  } finally {
    secureWipe(privateKeyBytes)
  }
}

// =====================
// Content Encryption/Decryption Functions
// =====================

/**
 * Encrypts content using AES-256-GCM with a provided DEK.
 * @param {string} content - The plaintext content to encrypt.
 * @param {string} dek - The Data Encryption Key (SafeText format).
 * @returns {Promise<string>} Encrypted content in SafeText format.
 */
export async function encryptContent(
  content: string,
  dek: string,
): Promise<string> {
  const dekBytes = safeAtob(dek)

  try {
    const iv = secureGetRandomValues(new Uint8Array(12)) // Generate random IV for AES-GCM

    const key = await crypto.subtle.importKey(
      'raw',
      dekBytes,
      {name: 'AES-GCM', length: 256},
      false,
      ['encrypt'],
    )

    const encryptedContentBytes = await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv},
      key,
      new TextEncoder().encode(content),
    )

    // Combine IV and ciphertext into a single package for storage or transport
    const packagedContent = new Uint8Array([
      ...iv,
      ...new Uint8Array(encryptedContentBytes),
    ])

    return safeBtoa(packagedContent) // Return as SafeText format
  } finally {
    secureWipe(dekBytes)
  }
}

/**
 * Decrypts content that was encrypted using AES-256-GCM with a provided DEK.
 * @param {string} encryptedData - The encrypted content in SafeText format.
 * @param {string} dek - The Data Encryption Key (SafeText format).
 * @returns {Promise<string>} Decrypted plaintext content.
 */
export async function decryptContent(
  encryptedData: string,
  dek: string,
): Promise<string> {
  const dekBytes = safeAtob(dek)

  try {
    const packagedContentBytes = safeAtob(encryptedData)

    // Extract IV from the first part of the package; remaining is ciphertext/auth tag
    const iv = packagedContentBytes.slice(0, 12)
    const ciphertext = packagedContentBytes.slice(12)

    // Import the DEK for AES-GCM decryption
    const key = await crypto.subtle.importKey(
      'raw',
      dekBytes,
      {name: 'AES-GCM', length: 256},
      false,
      ['decrypt'],
    )

    // Decrypt the ciphertext using AES-GCM with the provided DEK and IV
    const decryptedContentBytes = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv},
      key,
      ciphertext,
    )

    // Decode the decrypted content from bytes to string
    return new TextDecoder().decode(decryptedContentBytes)
  } catch (error) {
    console.error(
      'Decryption failed:',
      error instanceof Error ? error.message : error,
    )
    throw new Error('Decryption failed')
  } finally {
    // Wipe sensitive data from memory after use
    secureWipe(dekBytes)
  }
}

// =====================
// Batch Decryption
// =====================

/**
 * An encrypted item with an identifier and a session key reference.
 */
export type EncryptedItem = {
  id: string
  encryptedContent: string
  sessionId: string
}

/**
 * A session key mapping a session ID to its encrypted DEK.
 */
export type EncryptedSessionKey = {
  sessionId: string
  encryptedDek: string
}

/**
 * Decrypts a batch of encrypted items in parallel.
 * Looks up each item's DEK from session keys, decrypts content, and returns
 * a Map of id to decrypted content string.
 * Items with missing session keys or decryption failures are silently skipped.
 *
 * @param items - Array of encrypted items to decrypt
 * @param sessionKeys - Array of session keys for DEK lookup
 * @param privateKey - The private key for DEK decryption (SafeText format)
 * @returns Map of item id to decrypted content string
 */
export async function decryptBatch(
  items: EncryptedItem[],
  sessionKeys: EncryptedSessionKey[],
  privateKey: string,
): Promise<Map<string, string>> {
  const sessionKeyMap = new Map(
    sessionKeys.map(k => [k.sessionId, k.encryptedDek]),
  )

  const results = await Promise.all(
    items.map(async item => {
      const encryptedDek = sessionKeyMap.get(item.sessionId)
      if (!encryptedDek) return null

      try {
        const dek = await decryptDEK(encryptedDek, privateKey)
        const content = await decryptContent(item.encryptedContent, dek)
        return {id: item.id, content}
      } catch {
        return null
      }
    }),
  )

  const map = new Map<string, string>()
  for (const r of results) {
    if (r) map.set(r.id, r.content)
  }
  return map
}

/**
 * Wipes a Uint8Array from memory by overwriting its contents.
 * @param {Uint8Array} buf - The byte array to wipe.
 */
const secureWipe = (buf: Uint8Array): void => {
  // Overwrite all bytes with zeros
  buf.fill(0)
}

const BASE36 = '123456789abcdefghijkmnopqrstuvwxyz'

export function base36encode(text: string) {
  const bs36 = basex(BASE36)
  return bs36.encode(new TextEncoder().encode(text))
}

export function base36decode(encoded: string) {
  const bs36 = basex(BASE36)
  return new TextDecoder().decode(bs36.decode(encoded))
}

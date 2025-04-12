import {MlKem768} from 'mlkem'

/**
 * Generates a Data Encryption Key (DEK) for symmetric encryption
 * @returns A 32-byte (256-bit) random key
 */
export async function generateDEK(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(32))
}

/**
 * Encrypts a DEK using ML-KEM post-quantum encryption
 * @param dek The Data Encryption Key to encrypt
 * @param recipientPublicKey The recipient's public key in ML-KEM format
 * @returns The encrypted DEK in base64 format
 */
export async function encryptDEK(
  dek: Uint8Array,
  recipientPublicKey: Uint8Array,
): Promise<string> {
  // Initialize ML-KEM with the appropriate security level (ML-KEM-768 is recommended)
  const mlkem = new MlKem768()

  // Encapsulate the DEK using the recipient's public key
  const [ciphertext, sharedSecret] = await mlkem.encap(recipientPublicKey)

  // Combine the ciphertext and shared secret for storage
  const encryptedKey = new Uint8Array(ciphertext.length + sharedSecret.length)
  encryptedKey.set(ciphertext)
  encryptedKey.set(sharedSecret, ciphertext.length)

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...encryptedKey))
}

/**
 * Encrypts content using AES-256-GCM
 * @param content The content to encrypt
 * @param dek The Data Encryption Key
 * @returns The encrypted content and IV in base64 format
 */
export async function encryptContent(
  content: string,
  dek: Uint8Array,
): Promise<{encryptedContent: string; iv: string}> {
  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Import the DEK for use with AES-GCM
  const key = await crypto.subtle.importKey(
    'raw',
    dek,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt'],
  )

  // Encrypt the content
  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    new TextEncoder().encode(content),
  )

  // Convert to base64 for storage
  return {
    encryptedContent: btoa(
      String.fromCharCode(...new Uint8Array(encryptedContent)),
    ),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

/**
 * Generates a public/private key pair using ML-KEM-768
 * @returns An object containing the public and private keys
 */
export async function generateKeyPair(): Promise<{
  publicKey: Uint8Array
  privateKey: Uint8Array
}> {
  const mlkem = new MlKem768()
  const [publicKey, privateKey] = await mlkem.generateKeyPair()
  return {publicKey, privateKey}
}

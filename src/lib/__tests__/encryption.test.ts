/**
 * @jest-environment node
 *
 * Uses @jest-environment node to get globalThis.crypto.subtle (Web Crypto API).
 * jest.mock('crypto', ...) in jestSetup.js only mocks Node's require('crypto'),
 * not globalThis.crypto.subtle, so this environment gives us real AES-CTR support.
 */
import {beforeEach, describe, expect, it, jest} from '@jest/globals'

import {migrateMediaToAtProto} from '#/lib/api/private-profiles'
import {decryptEncryptedBlob} from '#/lib/encryption'

// Mock platform detection to force web path in migrateMediaToAtProto
jest.mock('#/platform/detection', () => ({isWeb: true}))

// Mock upload-blob to capture what gets uploaded
jest.mock('#/lib/api/upload-blob', () => ({
  uploadBlob: jest.fn(),
}))

// Mock speakeasy API helpers used in fetchSpeakeasyMediaBlob
jest.mock('#/lib/api/speakeasy', () => ({
  getHost: jest.fn(() => 'https://speakeasy.test'),
}))

// Mock feed/utils which accesses window.location at module load time
jest.mock('#/lib/api/feed/utils', () => ({
  getBaseCdnUrl: jest.fn(() => 'https://cdn.test'),
}))

// Mock logger to prevent noise
jest.mock('#/logger', () => ({
  logger: {error: jest.fn(), info: jest.fn(), warn: jest.fn()},
}))

// Mock cache module (imported by private-profiles)
jest.mock('#/state/cache/private-profile-cache', () => ({
  setCachedDek: jest.fn(),
}))

// Mock session-utils which transitively imports many UI modules that access window.location
jest.mock('#/lib/api/session-utils', () => ({
  encryptDekForTrustedUsers: jest.fn(),
}))

// Mock user-keys (imported by private-profiles)
jest.mock('#/lib/api/user-keys', () => ({
  getOrCreatePublicKey: jest.fn(),
  getPrivateKey: jest.fn(),
  getPrivateKeyOrWarn: jest.fn(),
}))

import {uploadBlob} from '#/lib/api/upload-blob'
const mockedUploadBlob = uploadBlob as jest.MockedFunction<typeof uploadBlob>

// =====================
// Test helpers
// =====================

/**
 * Converts a Uint8Array to URL-safe base64 (the same format used as DEK in encryption.ts).
 */
function uint8ToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/[=]/g, '')
}

/**
 * Creates a valid AES-CTR encrypted blob in the format used by Speakeasy media storage.
 * Format: [16-byte counter][AES-CTR-encrypt([1-byte mimeLen][mimeType bytes][image bytes])]
 */
async function makeEncryptedBlob(
  imageBytes: Uint8Array,
  mimeType: string,
  dek: string,
): Promise<Blob> {
  // Decode the URL-safe base64 DEK to raw bytes
  const dekBase64 = dek
    .replace(/_/g, '/')
    .replace(/-/g, '+')
    .padEnd(dek.length + ((4 - (dek.length % 4)) % 4), '=')
  const dekBytes = Uint8Array.from(atob(dekBase64), c => c.charCodeAt(0))

  // Build plaintext: [1-byte mimeLen][mimeType bytes][image bytes]
  const mimeBytes = new TextEncoder().encode(mimeType)
  const plaintext = new Uint8Array(1 + mimeBytes.length + imageBytes.length)
  plaintext[0] = mimeBytes.length
  plaintext.set(mimeBytes, 1)
  plaintext.set(imageBytes, 1 + mimeBytes.length)

  const counter = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    dekBytes,
    {name: 'AES-CTR', length: 256},
    false,
    ['encrypt'],
  )
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {name: 'AES-CTR', counter, length: 64},
      key,
      plaintext,
    ),
  )

  const result = new Uint8Array(16 + encrypted.length)
  result.set(counter)
  result.set(encrypted, 16)

  return new Blob([result], {type: 'application/x-spkeasy-encrypted-media'})
}

// =====================
// decryptEncryptedBlob tests
// =====================

describe('decryptEncryptedBlob', () => {
  let dek: string
  const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]) // fake JPEG bytes
  const mimeType = 'image/jpeg'

  beforeEach(() => {
    // Generate a fresh 32-byte DEK for each test
    const dekBytes = crypto.getRandomValues(new Uint8Array(32))
    dek = uint8ToBase64Url(dekBytes)
  })

  it('decrypts to correct image bytes and MIME type', async () => {
    const encryptedBlob = await makeEncryptedBlob(imageBytes, mimeType, dek)

    const result = await decryptEncryptedBlob(encryptedBlob, dek)

    expect(result.type).toBe(mimeType)
    const resultBytes = new Uint8Array(await result.arrayBuffer())
    expect(resultBytes).toEqual(imageBytes)
  })

  it('returns blob unchanged if not encrypted content type', async () => {
    const plainBlob = new Blob([imageBytes], {type: 'image/jpeg'})

    const result = await decryptEncryptedBlob(plainBlob, dek)

    expect(result).toBe(plainBlob)
  })

  it('throws on truncated content (too short after decryption)', async () => {
    // Create a blob that is encrypted but produces content too short to parse
    const counter = crypto.getRandomValues(new Uint8Array(16))
    const tinyPlaintext = new Uint8Array(0) // empty — will fail mimeTypeLength check

    const dekBase64 = dek
      .replace(/_/g, '/')
      .replace(/-/g, '+')
      .padEnd(dek.length + ((4 - (dek.length % 4)) % 4), '=')
    const dekBytes = Uint8Array.from(atob(dekBase64), c => c.charCodeAt(0))

    const key = await crypto.subtle.importKey(
      'raw',
      dekBytes,
      {name: 'AES-CTR', length: 256},
      false,
      ['encrypt'],
    )
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt(
        {name: 'AES-CTR', counter, length: 64},
        key,
        tinyPlaintext,
      ),
    )

    const result = new Uint8Array(16 + encrypted.length)
    result.set(counter)
    result.set(encrypted, 16)

    const truncatedBlob = new Blob([result], {
      type: 'application/x-spkeasy-encrypted-media',
    })

    await expect(decryptEncryptedBlob(truncatedBlob, dek)).rejects.toThrow(
      'Decrypted content too short',
    )
  })

  it('decrypts PNG content correctly', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG magic bytes
    const encryptedBlob = await makeEncryptedBlob(pngBytes, 'image/png', dek)

    const result = await decryptEncryptedBlob(encryptedBlob, dek)

    expect(result.type).toBe('image/png')
    const resultBytes = new Uint8Array(await result.arrayBuffer())
    expect(resultBytes).toEqual(pngBytes)
  })
})

// =====================
// migrateMediaToAtProto tests
// =====================

describe('migrateMediaToAtProto', () => {
  const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x10, 0x20, 0x30])
  const mimeType = 'image/jpeg'
  const speakeasyKey = 'media/avatar-abc123'

  let dek: string
  let mockAgent: any

  beforeEach(() => {
    jest.clearAllMocks()

    const dekBytes = crypto.getRandomValues(new Uint8Array(32))
    dek = uint8ToBase64Url(dekBytes)

    mockAgent = {
      session: {accessJwt: 'mock-jwt'},
    }

    mockedUploadBlob.mockResolvedValue({
      data: {
        blob: {
          $type: 'blob',
          ref: {$link: 'bafymock123'},
          mimeType: 'image/jpeg',
          size: 100,
        },
      },
    } as any)
  })

  it('uploadBlob is called with decrypted image blob, not encrypted blob', async () => {
    const encryptedBlob = await makeEncryptedBlob(imageBytes, mimeType, dek)

    // Mock fetch to return the encrypted blob (as fetchSpeakeasyMediaBlob would)
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(encryptedBlob),
    } as any)

    await migrateMediaToAtProto(speakeasyKey, mockAgent, dek)

    expect(mockedUploadBlob).toHaveBeenCalledTimes(1)
    const [, blobArg] = (mockedUploadBlob as jest.MockedFunction<any>).mock
      .calls[0]

    // The uploaded blob must NOT be the encrypted blob
    expect(blobArg.type).toBe(mimeType)
    expect(blobArg.type).not.toBe('application/x-spkeasy-encrypted-media')
  })

  it('uploaded blob bytes match the original image bytes', async () => {
    const encryptedBlob = await makeEncryptedBlob(imageBytes, mimeType, dek)

    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(encryptedBlob),
    } as any)

    await migrateMediaToAtProto(speakeasyKey, mockAgent, dek)

    const [, blobArg] = (mockedUploadBlob as jest.MockedFunction<any>).mock
      .calls[0]
    const uploadedBytes = new Uint8Array(await blobArg.arrayBuffer())
    expect(uploadedBytes).toEqual(imageBytes)
  })

  it('returns the upload response', async () => {
    const encryptedBlob = await makeEncryptedBlob(imageBytes, mimeType, dek)

    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(encryptedBlob),
    } as any)

    const result = await migrateMediaToAtProto(speakeasyKey, mockAgent, dek)

    expect(result.response).toBeDefined()
    expect(result.response.data.blob).toBeDefined()
  })
})

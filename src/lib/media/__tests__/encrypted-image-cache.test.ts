import {beforeEach, describe, expect, it, jest} from '@jest/globals'

import * as encryption from '#/lib/encryption'
import {
  clearEncryptedImageCache,
  decryptAndCacheImage,
} from '../encrypted-image-cache'

jest.mock('#/lib/encryption')

const mockedEncryption = encryption as jest.Mocked<typeof encryption>

describe('decryptAndCacheImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearEncryptedImageCache()
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url') as any
  })

  it('calls decryptMediaBlob with url and dek, returns blob URL', async () => {
    const fakeBlob = new Blob(['fake-image-data'], {type: 'image/jpeg'})
    mockedEncryption.decryptMediaBlob.mockResolvedValue(fakeBlob)

    const result = await decryptAndCacheImage(
      'https://cdn.speakeasy.test/media/abc',
      'mock-dek',
    )

    expect(mockedEncryption.decryptMediaBlob).toHaveBeenCalledWith(
      'https://cdn.speakeasy.test/media/abc',
      'mock-dek',
    )
    expect(result).toBe('blob:mock-url')
  })

  it('returns cached blob URL on second call without re-decrypting', async () => {
    const fakeBlob = new Blob(['fake-image-data'], {type: 'image/jpeg'})
    mockedEncryption.decryptMediaBlob.mockResolvedValue(fakeBlob)

    await decryptAndCacheImage(
      'https://cdn.speakeasy.test/media/abc',
      'mock-dek',
    )
    const result = await decryptAndCacheImage(
      'https://cdn.speakeasy.test/media/abc',
      'mock-dek',
    )

    expect(mockedEncryption.decryptMediaBlob).toHaveBeenCalledTimes(1)
    expect(result).toBe('blob:mock-url')
  })
})

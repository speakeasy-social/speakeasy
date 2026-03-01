import {useEffect, useState} from 'react'

import {
  decryptAndCacheImage,
  getCachedBlobUrl,
} from '#/lib/media/encrypted-image-cache'

/**
 * Lazily decrypts a private media URL and returns the decrypted blob URL.
 *
 * Returns undefined while decryption is in progress (render placeholder/nothing).
 * Returns the blob URL once decryption completes.
 * Is a no-op when dek is undefined (public images — returns undefined so caller
 * falls back to the original URL).
 *
 * @param url - CDN URL of the media
 * @param dek - Data Encryption Key; undefined for non-encrypted images
 */
export function useDecryptedImageUrl(
  url: string | undefined,
  dek: string | undefined,
): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(() =>
    url && dek ? getCachedBlobUrl(url) : undefined,
  )

  useEffect(() => {
    if (!url || !dek) {
      setBlobUrl(undefined)
      return
    }
    const cached = getCachedBlobUrl(url)
    if (cached) {
      setBlobUrl(cached)
      return
    }
    setBlobUrl(undefined) // clear stale blob while new URL decrypts
    let cancelled = false
    decryptAndCacheImage(url, dek)
      .then(result => {
        if (!cancelled) setBlobUrl(result)
      })
      .catch(() => {
        // Silent fail — image stays hidden while loading
      })
    return () => {
      cancelled = true
    }
  }, [url, dek]) // blobUrl intentionally excluded from deps

  return blobUrl
}

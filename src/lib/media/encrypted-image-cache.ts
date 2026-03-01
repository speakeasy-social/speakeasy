import {decryptMediaBlob} from '#/lib/encryption'

/**
 * Module-level cache for decrypted private media blob URLs.
 *
 * resolvedCache: CDN URL → blob: URL (fully decrypted, ready to use)
 * inFlightCache: CDN URL → in-progress promise (deduplicates concurrent requests)
 *
 * Call clearEncryptedImageCache() on account switch/logout to revoke blob URLs
 * and free memory.
 */
const resolvedCache = new Map<string, string>()
const inFlightCache = new Map<string, Promise<string>>()

export function getCachedBlobUrl(url: string): string | undefined {
  return resolvedCache.get(url)
}

/**
 * Decrypts a CDN media URL and caches the resulting blob URL.
 * Concurrent callers for the same URL share a single in-flight promise.
 */
export async function decryptAndCacheImage(
  url: string,
  dek: string,
): Promise<string> {
  const cached = resolvedCache.get(url)
  if (cached) return cached

  const inFlight = inFlightCache.get(url)
  if (inFlight) return inFlight

  const promise = decryptMediaBlob(url, dek)
    .then(blob => {
      console.debug('[encrypted-image-cache] decrypted image', url)
      const blobUrl = URL.createObjectURL(blob)
      resolvedCache.set(url, blobUrl)
      inFlightCache.delete(url)
      return blobUrl
    })
    .catch(err => {
      inFlightCache.delete(url)
      throw err
    })

  inFlightCache.set(url, promise)
  return promise
}

/**
 * Revokes all cached blob URLs and clears both caches.
 * Call on account switch or logout to prevent memory leaks.
 */
export function clearEncryptedImageCache(): void {
  for (const blobUrl of resolvedCache.values()) {
    URL.revokeObjectURL(blobUrl)
  }
  resolvedCache.clear()
  inFlightCache.clear()
}

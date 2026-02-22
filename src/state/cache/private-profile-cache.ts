import {useEffect, useState} from 'react'
import EventEmitter from 'eventemitter3'

import {PrivateProfileData} from '#/lib/api/private-profiles'

/**
 * Module-level singleton cache for decrypted private profile data.
 *
 * Stores decrypted profiles by DID so they can be merged at read time
 * via `select` callbacks, rather than mutating React Query caches directly.
 *
 * A `null` entry means "checked, no private profile found".
 * An absent key means "not yet checked".
 * getCachedPrivateProfile() returns undefined for both absent and null; use
 * isDidChecked(did) when you need to distinguish "not yet checked".
 *
 * Two usage patterns:
 * - Feed/notifications: usePrivateProfileFetcher fills the cache; select()
 *   merges via getCachedPrivateProfile; privateProfileVersion in selectArgs
 *   triggers re-run when cache updates.
 * - Profile screen / post-thread: queryFn fetches and merges inline, and
 *   (profile only) useMemo re-merges when cache updates via usePrivateProfileCacheVersion().
 *
 * Follows the profile-shadow.ts EventEmitter + Map pattern.
 */

const cache = new Map<string, PrivateProfileData | null>()
const inflightDids = new Set<string>()
const emitter = new EventEmitter()

// --- Read API ---

export function getCachedPrivateProfile(
  did: string,
): PrivateProfileData | undefined {
  return cache.get(did) ?? undefined
}

export function isDidChecked(did: string): boolean {
  return cache.has(did)
}

// --- Write API ---

export function upsertCachedPrivateProfiles(
  profiles: Map<string, PrivateProfileData>,
): void {
  let changed = false
  for (const [did, data] of profiles) {
    const existing = cache.get(did)
    if (
      !existing ||
      existing.displayName !== data.displayName ||
      existing.description !== data.description ||
      existing.avatarUri !== data.avatarUri ||
      existing.bannerUri !== data.bannerUri ||
      existing.rawAvatarUri !== data.rawAvatarUri ||
      existing.rawBannerUri !== data.rawBannerUri ||
      JSON.stringify(existing.pronouns) !== JSON.stringify(data.pronouns)
    ) {
      cache.set(did, data)
      changed = true
    }
  }
  if (changed) {
    emitter.emit('change')
  }
}

export function markDidsChecked(dids: string[]): void {
  let changed = false
  for (const did of dids) {
    if (!cache.has(did)) {
      cache.set(did, null)
      changed = true
    }
  }
  if (changed) {
    emitter.emit('change')
  }
}

export function evictDid(did: string): void {
  if (cache.delete(did)) {
    emitter.emit('change')
  }
}

// --- Inflight dedup ---

/**
 * Claims DIDs for fetching. Returns only the DIDs that were successfully
 * claimed (not already inflight). Caller must call releaseDids when done.
 */
export function claimDids(dids: string[]): string[] {
  const claimed: string[] = []
  for (const did of dids) {
    if (!inflightDids.has(did)) {
      inflightDids.add(did)
      claimed.push(did)
    }
  }
  return claimed
}

export function releaseDids(dids: string[]): void {
  for (const did of dids) {
    inflightDids.delete(did)
  }
}

// --- Lifecycle ---

/**
 * Clears everything — call on account switch.
 */
export function clearAll(): void {
  cache.clear()
  inflightDids.clear()
  emitter.emit('change')
}

// --- React hook ---

/**
 * Subscribes to cache 'change' events, returns an incrementing counter.
 * Include the return value in selectArgs to trigger select re-runs
 * when private profile data changes.
 */
export function usePrivateProfileCacheVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    function onUpdate() {
      setVersion(v => v + 1)
    }
    emitter.addListener('change', onUpdate)
    return () => {
      emitter.removeListener('change', onUpdate)
    }
  }, [])
  return version
}

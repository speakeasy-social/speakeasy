import {useEffect, useState} from 'react'
import EventEmitter from 'eventemitter3'

import type {PrivateProfileData} from '#/lib/api/private-profiles'
import {logger} from '#/logger'

/**
 * Module-level singleton cache for decrypted private profile data.
 *
 * Stores decrypted profiles by DID so they can be merged at read time
 * via mergePrivateProfileData(publicProfile, getCachedPrivateProfile(did))
 * (see private-profiles.ts). Display rule: use that single merge point only.
 *
 * Optimistic updates: profile mutations must call upsertCachedPrivateProfiles()
 * (and/or setQueryData for the profile query) so the UI updates without refetch
 * and avoids content flashes. Do not rely on refetch after save.
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
const dekCache = new Map<string, string>()
const inflightDids = new Set<string>()
const emitter = new EventEmitter()

let ownerDid: string | undefined

/**
 * Sets the owner DID for this cache. If the DID changes, clears all cached data.
 */
export function setOwnerDid(did: string): void {
  logger.debug('private-profile-cache: setOwnerDid', {did, prevOwner: ownerDid})
  if (ownerDid && ownerDid !== did) {
    clearAll()
  }
  ownerDid = did
}

/**
 * Guard: if a viewerDid is provided and doesn't match ownerDid, clears everything.
 * Prevents wrong-account data from entering the cache.
 */
function assertOwner(viewerDid: string): void {
  if (ownerDid && ownerDid !== viewerDid) {
    logger.debug('private-profile-cache: assertOwner mismatch — clearing', {
      ownerDid,
      viewerDid,
    })
    clearAll()
  }
  ownerDid = viewerDid
}

// --- Read API ---

export function getCachedPrivateProfile(
  did: string,
): PrivateProfileData | undefined {
  return cache.get(did) ?? undefined
}

export function isDidChecked(did: string): boolean {
  return cache.has(did)
}

export function getCachedDek(did: string): string | undefined {
  return dekCache.get(did)
}

export function setCachedDek(
  did: string,
  dek: string,
  viewerDid?: string,
): void {
  if (viewerDid) assertOwner(viewerDid)
  dekCache.set(did, dek)
  logger.debug('private-profile-cache: setCachedDek', {
    did,
    ownerDid,
    dekCacheSize: dekCache.size,
  })
}

// --- Write API ---

export function upsertCachedPrivateProfiles(
  profiles: Map<string, PrivateProfileData>,
  viewerDid?: string,
  deks?: Map<string, string>,
): void {
  if (viewerDid) assertOwner(viewerDid)
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
  if (deks) {
    for (const [did, dek] of deks) {
      if (dekCache.get(did) !== dek) {
        dekCache.set(did, dek)
        changed = true
      }
    }
  }
  if (changed) {
    logger.debug('private-profile-cache: upsert changed', {
      dids: Array.from(profiles.keys()),
      avatarUris: Array.from(profiles.entries()).map(([did, d]) => ({
        did,
        avatarUri: d.avatarUri?.slice(0, 60),
      })),
    })
    emitter.emit('change')
  }
}

export function markDidsChecked(dids: string[], viewerDid?: string): void {
  if (viewerDid) assertOwner(viewerDid)
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
  const changed = cache.delete(did)
  dekCache.delete(did)
  if (changed) {
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
  const stack = new Error().stack?.split('\n').slice(1, 4).join(' | ') ?? ''
  logger.debug('private-profile-cache: clearAll called', {
    ownerDid,
    dekCacheSize: dekCache.size,
    stack,
  })
  cache.clear()
  dekCache.clear()
  inflightDids.clear()
  ownerDid = undefined
  emitter.emit('change')
}

// --- Debug exposure (dev only) ---
if (typeof window !== 'undefined') {
  ;(window as any).__ppDebug = {
    getDekCacheSize: () => dekCache.size,
    getDekCacheDids: () => Array.from(dekCache.keys()),
    getDek: (did: string) => dekCache.get(did),
    getCacheSize: () => cache.size,
    getCacheDids: () => Array.from(cache.keys()),
  }
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

# Plan: Fix profile still showing as private after private→public save

## Problem

**Repro**: Go public → private (save), then private → public (save). The profile still looks private (name shows "Private Profile", user doesn't have permission to view it). A refresh fixes it.

So the server state is correct (public), but the client cache/display state is wrong until refresh.

---

## What we need to consider (from prior work)

- **Display**: Only `mergePrivateProfileData(publicProfile, getCachedPrivateProfile(did))` decides what to show. If the module cache has private data for the DID, it gets merged and the profile looks private.
- **Cache semantics** ([`private-profile-cache.ts`](src/state/cache/private-profile-cache.ts)): `cache.has(did)` = checked; `cache.get(did) === null` = checked, no private profile; `cache.get(did) === data` = has private profile. **Absent key** = "not yet checked". `getCachedPrivateProfile(did)` returns `undefined` for both absent and null.
- **When going public** we currently call `evictDid(did)` (which **deletes** the key) and `setQueryData` with the optimistic public profile. We do **not** call `markDidsChecked([did])`.
- **Batch fetcher** ([`use-private-profile-fetcher.ts`](src/state/queries/use-private-profile-fetcher.ts)): Only fetches DIDs where `!isDidChecked(did)`. So it skips DIDs that are already "checked" (including "checked, no private profile" = null entry).
- **Profile query** ([`profile.ts`](src/state/queries/profile.ts)): The `useMemo` that produces the final profile does `const cached = getCachedPrivateProfile(did)`; if `cached` is truthy it merges and shows private. So if the module cache has private data again, the UI shows private.

---

## Root cause (hypothesis)

When we save **private → public** we:

1. Call `evictDid(did)` → the DID is **removed** from the cache (key absent).
2. Do **not** call `markDidsChecked([did])`.

So after the mutation, the DID is in state **"not checked"** (absent). That leads to:

- **Batch fetcher**: Any query that still has this DID (e.g. feed, notifications) with **stale** data (e.g. sentinel `displayName`) will have this DID extracted. Because `!isDidChecked(did)` is true, the fetcher will **fetch** this DID. If Speakeasy still returns the old private profile (e.g. eventual consistency or the request was in flight before delete), the fetcher calls `upsertCachedPrivateProfiles` and the module cache is **re-populated with private data**. The profile query’s `useMemo` then merges that cached private data over the public profile and the UI shows "Private Profile" until refresh.
- **Profile query refetch**: On refetch, `isDidChecked(did)` is false, so the query doesn’t take the "already checked" early return and may call Speakeasy again; depending on ordering and cache updates, the merged result can still end up with private overlay if the cache was filled in the meantime.

So the bug is: **we evict but we don’t mark the DID as "checked, no private profile".** Anything that re-fetches or re-merges can then treat the DID as "needs private check" and can re-populate the cache or show private.

---

## Fix

In the **onSuccess** path when going public (the `else` branch in `useProfileUpdateMutation` in [`src/state/queries/profile.ts`](src/state/queries/profile.ts)):

1. Keep `evictDid(did)` (remove private data from the cache).
2. **Add** `markDidsChecked([did])` immediately after `evictDid(did)`.

Effect:

- The cache will have `cache.set(did, null)` → "checked, no private profile".
- `getCachedPrivateProfile(did)` stays `undefined` (null → undefined in the API), so the profile query’s useMemo returns `base` (public) and never overlays private.
- The batch fetcher will skip this DID because `isDidChecked(did)` is true, so it won’t re-fetch and won’t upsert private data.

Order in code:

```ts
evictDid(did)
markDidsChecked([did])  // add this
// then build optimisticPublic and setQueryData...
```

---

## Rule updates (so this doesn’t regress)

Update **[docs/private-profiles.md](docs/private-profiles.md)** as follows.

### 1. In "Optimistic updates" (or "Cache")

- Current: "for public, `evictDid(did)` and setQueryData with optimistic profile..."
- Change to: **"For public: call `evictDid(did)` then `markDidsChecked([did])` so the DID is recorded as 'checked, no private profile'; then setQueryData with the optimistic profile. Without `markDidsChecked`, the batch fetcher or a refetch can re-fetch and re-populate the cache with private data, making the profile appear private again until refresh."**

### 2. In "Cache" section (optional but recommended)

- Add a bullet: **"When switching a profile to public (after `deletePrivateProfile`), the mutation must call both `evictDid(did)` and `markDidsChecked([did])`. This keeps the cache in a consistent 'checked, no private profile' state and prevents the batch fetcher from re-fetching and overlaying private data."**

### 3. In "Fetcher and batch"

- Already says the fetcher only fetches DIDs where `!isDidChecked(did)`. Optional clarification: **"So after going public, calling `markDidsChecked([did])` ensures this DID is skipped by the fetcher and the cache is not re-populated with private data."**

---

## Verification

1. Implement the fix (add `markDidsChecked([did])` after `evictDid(did)` when going public).
2. Manually test: public → private (save) → private → public (save). Profile should show as public immediately without refresh.
3. Optionally add a short unit test or integration test that asserts: after a private→public save, `isDidChecked(did)` is true and `getCachedPrivateProfile(did)` is undefined (so no private overlay).

---

## Summary

- **Cause**: After private→public we only `evictDid(did)`, leaving the DID "not checked". The batch fetcher or refetch can then re-fetch and re-populate the cache with private data, so the UI shows private until refresh.
- **Fix**: After `evictDid(did)` when going public, call `markDidsChecked([did])` so the DID is "checked, no private profile" and the fetcher skips it.
- **Docs**: Update `docs/private-profiles.md` so the public-save flow explicitly requires both `evictDid(did)` and `markDidsChecked([did])`.

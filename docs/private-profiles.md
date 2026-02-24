# Private profiles — rules (do not regress)

These rules were distilled from the feature/private-profile-editor branch. **Follow them so future changes move forward, not backward.** Any AI agent or human working on private profiles should read this doc. The centralised implementation lives in `src/lib/api/private-profiles.ts`; this file is the single source of truth for behaviour and invariants. The profile mutation logic (`profileMutationFn`, `profileOnSuccess`) lives in `src/state/queries/profile.ts` with integration tests in `src/state/queries/__tests__/profile-mutation.test.ts`.

---

## Display (single source of truth)

- **Only** `mergePrivateProfileData(publicProfile, getCachedPrivateProfile(did))` decides what profile to show.
- **Only overlay private when the public profile has the sentinel** (e.g. `displayName === PRIVATE_PROFILE_DISPLAY_NAME`). Use `shouldCheckPrivateProfile(profile)` to decide if we should fetch/merge; never overlay when public is not the sentinel.
- Do **not** duplicate display logic elsewhere. All UI uses the result of `mergePrivateProfileData` or hooks that call it.
- Use `isPrivateProfile(profile)` for “is this a private profile?” and `hasAccessToPrivateProfile(profile)` for “does the viewer see decrypted data?” (e.g. pill vs icon-only).

## Cache

- **Module-level cache** in `src/state/cache/private-profile-cache.ts`: `cache.has(did)` = checked; `cache.get(did) === null` = checked, no private profile; `cache.get(did) === data` = has private profile.
- `getCachedPrivateProfile(did)` returns `undefined` for both “not checked” and “checked, no profile”. Use `isDidChecked(did)` when you need to distinguish.
- **Clear cache on account switch and logout**: call `clearAll()` so the next account doesn’t see the previous account’s private data.

- **When switching a profile to public** (after `deletePrivateProfile`), the mutation must call both `evictDid(did)` and `markDidsChecked([did])`. This keeps the cache in a consistent "checked, no private profile" state and prevents the batch fetcher from re-fetching and overlaying private data (which would make the profile appear private again until refresh).

## Mutation architecture

- **`profileMutationFn`** (exported, testable): orchestrates the save and returns a discriminated `ProfileMutationResult` (`type: ‘private’ | ‘public’`) with **complete** optimistic data — no reconstruction needed in `onSuccess`.
  - Private path returns `privateData` (raw Speakeasy keys) + `optimisticProfile` (sentinel merged with resolved private data).
  - Public path returns `optimisticProfile` with `blob:` URLs from migration (or existing avatar/banner).
- **`profileOnSuccess`** (exported, testable): simple setter — resolves URLs, upserts cache, sets query data. No data reconstruction from fragments.
- **`useProfileUpdateMutation`**: thin hook that wires `profileMutationFn` and `profileOnSuccess` to `useMutation`.

## Optimistic updates

- **All profile updates must be optimistic**: update the private-profile cache and/or React Query profile data (`setQueryData`) so the UI updates immediately **without refetch**. Relying on refetch causes content flash when saving private or switching to public.
- **Cancel in-flight queries before optimistic updates** (`cancelQueries` before `setQueryData`). When going public, `invalidateQueries` triggers a background refetch. If the user then saves as private before that refetch completes, the stale refetch can overwrite the optimistic data with public-only data. Because `mergePrivateProfileData` requires the sentinel `displayName` to overlay private data, the stale public name causes the merge to no-op and the profile appears public. `cancelQueries` prevents this race.
- After save: `upsertCachedPrivateProfiles` + `markDidsChecked` for private; for public, call `evictDid(did)` **then** `markDidsChecked([did])` (so the DID is "checked, no private profile"), then setQueryData with optimistic profile (keep current avatar/banner so content doesn’t disappear; refetch will replace with canonical refs). Without `markDidsChecked`, the batch fetcher or a refetch can re-fetch and re-populate the cache with private data, making the profile appear private again until refresh.
- **Do not `invalidateQueries` after public save**: the optimistic data uses `blob:` URLs from `URL.createObjectURL` (web) which render correctly. An immediate refetch can overwrite them with CDN URLs that haven’t indexed yet. The staleTime refetch (15s) replaces with canonical ATProto CDN URLs. If the user goes back to private before the refetch, `resolvePrivateProfileMedia` handles `blob:` URLs by migrating them to Speakeasy (see Media section).

## Save flow (private)

- **Order**: 1) Resolve media (`resolvePrivateProfileMedia`), 2) Write private record (`writePrivateProfileRecord`), 3) Anonymize public (ATProto). If step 3 fails, roll back by calling `deletePrivateProfile(call)` so the profile is still considered public.
- **Preserve pinned post** when anonymizing: pass `preserve: { pinnedPost }` to `anonymizeAtProtoProfile`.

## Save flow (public)

- **Order**: 1) Migrate avatar/banner to ATProto (including when switching from private — use existing Speakeasy media keys / upload new blobs), 2) Write public record, 3) Delete private (`deletePrivateProfile`). If step 3 fails, log but don’t rethrow; profile is already public.
- **whenAppViewReady must check avatar/banner after migration**: `defaultCheckCommittedForPublicProfile` skips avatar/banner checks when `newUserAvatar`/`newUserBanner` are `undefined`. When migrating private media to ATProto (i.e., `avatarRes`/`bannerRes` from migration exist), pass a custom check that waits for the app view to index the new avatar/banner. Otherwise `invalidateQueries` can overwrite optimistic data with stale (no-avatar) app view data.

## Media and types

- **PrivateProfileData**: `avatarUri`/`bannerUri` = resolved CDN URLs (for display). `rawAvatarUri`/`rawBannerUri` = Speakeasy media keys (for save/migration and `_privateProfile` metadata). Resolve with `resolvePrivateProfileUrls(data, baseUrl)` before putting in cache or displaying.
- **PrivateProfileMetadata** (on profile query): `avatarUri`/`bannerUri` are **raw Speakeasy media keys**, not CDN URLs (used for migration when going public).
- **`blob:` URLs in `resolvePrivateProfileMedia`**: After public save, optimistic `profile.avatar` may be a `blob:` URL from `URL.createObjectURL`. If the user goes back to private before the staleTime refetch, this `blob:` URL leaks into `existingAvatarUri`. `resolvePrivateProfileMedia` detects `blob:` URIs and migrates them to Speakeasy via `migrateMediaToSpeakeasy` (pathToBlob supports `blob:` URLs on web). Without this, the `blob:` URL would be stored as a Speakeasy media key and `resolvePrivateProfileUrls` would produce a garbage URL.

## Fetcher and batch

- **usePrivateProfileFetcher**: Only fills the module cache; it does **not** mutate query caches. Consumers merge at read time via `select` + `getCachedPrivateProfile(did)` and depend on `usePrivateProfileCacheVersion()` so cache updates re-run select. It only fetches DIDs where `!isDidChecked(did)`; after going public, calling `markDidsChecked([did])` ensures that DID is skipped and the cache is not re-populated with private data.
- After a batch, **mark all claimed DIDs as checked** (`markDidsChecked`), including null sentinel for DIDs without private data. **Re-run fetch once** after the batch (e.g. `queueMicrotask(() => fetchProfiles())`) to catch DIDs that appeared in the query while the batch was in flight.
- Use **claimDids** / **releaseDids** so concurrent fetchers don’t double-fetch the same DIDs.

## Profile query and author context

- **useProfileQuery**: Re-merges when cache updates (e.g. `usePrivateProfileCacheVersion()`) so optimistic cache updates show without refetch. Skip Speakeasy lookup when public `displayName !== PRIVATE_PROFILE_DISPLAY_NAME`.
- **Author feed**: Pass the resolved author profile into the author feed so posts show the correct author after private→public (don’t rely on stale public-only data).

## Notifications and embeds

- When merging private data into notification items, **clone nested structures** (e.g. quoted embed) so shared query cache isn’t mutated. Merge into all author slots: notification author, additional authors, subject author, quoted post author.

## Keys and session

- **getOrCreatePublicKey** must return the private key when the user already has keys (needed for profile session creation). Don’t only return public key.

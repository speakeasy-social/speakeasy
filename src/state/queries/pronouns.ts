import {useEffect, useMemo, useState} from 'react'
import {AppBskyActorDefs, AppBskyActorProfile, BskyAgent} from '@atproto/api'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {retry} from '#/lib/async/retry'
import {useWarnMaxGraphemeCount} from '#/lib/strings/helpers'
import {
  getCachedPrivateProfile,
  usePrivateProfileCacheVersion,
} from '#/state/cache/private-profile-cache'
import {STALE} from '#/state/queries'
import {useAgent} from '#/state/session'

const PRONOUNS_COLLECTION = 'app.nearhorizon.actor.pronouns'

export const PRONOUNS_MAX_GRAPHEMES = 20

export type PronounSet = {
  forms: string[]
}

type AtProtoPronounsRecord = {
  sets: PronounSet[]
  displayMode?: string
}

/**
 * Extracts the native pronouns string from a profile, handling the
 * extended type that includes the non-standard `pronouns` field.
 */
export function getProfilePronouns(
  profile: AppBskyActorDefs.ProfileViewDetailed | undefined,
): string | undefined {
  return (
    (profile as AppBskyActorDefs.ProfileViewDetailed & {pronouns?: string})
      ?.pronouns || undefined
  )
}

type ProfileRecordWithPronouns = AppBskyActorProfile.Record & {
  pronouns?: string
}

export function setProfilePronouns(
  record: AppBskyActorProfile.Record,
  nativeValue: string,
): AppBskyActorProfile.Record {
  ;(record as ProfileRecordWithPronouns).pronouns = nativeValue || undefined
  return record
}

const RQKEY_ROOT = 'pronouns'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

async function getAtProtoPronounsRecord({
  agent,
  did,
}: {
  agent: BskyAgent
  did: string
}): Promise<AtProtoPronounsRecord | undefined> {
  try {
    const {data} = await retry(
      2,
      e => !e.message?.includes('Could not locate record:'),
      () =>
        agent.api.com.atproto.repo.getRecord({
          repo: did,
          collection: PRONOUNS_COLLECTION,
          rkey: 'self',
        }),
    )

    const value = data.value as AtProtoPronounsRecord | undefined
    if (value && Array.isArray(value.sets) && value.sets.length > 0) {
      return value
    }
    return undefined
  } catch (e: any) {
    if (e.message.includes('Could not locate record:')) {
      return undefined
    }
    throw e
  }
}

function formatSets(sets: PronounSet[], separator: string): string {
  return sets.map(set => set.forms.join('/')).join(separator)
}

export function formatPronounSets(record: AtProtoPronounsRecord): string {
  const sets =
    record.displayMode === 'firstOnly' ? record.sets.slice(0, 1) : record.sets

  return formatSets(sets, ' · ')
}

/**
 * Formats pronoun sets for editing (comma-separated).
 * e.g. [{forms:["she","her"]}, {forms:["they","them"]}] -> "she/her, they/them"
 */
export function formatPronounSetsForEditing(
  record: AtProtoPronounsRecord,
): string {
  return formatSets(record.sets, ', ')
}

/**
 * Parses raw user input into structured pronoun sets.
 *
 * Algorithm:
 * 1. Trim whitespace, return [] if empty
 * 2. Split on comma, semicolon, period, or whitespace
 * 3. If only the first part contains `/`, treat entire input as single freeform entry
 * 4. Otherwise each part becomes a set with forms split on `/`
 */
export function parsePronounsInput(input: string): PronounSet[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  const parts = trimmed
    .split(/[,;.\s]+/)
    .map(p => p.trim())
    .filter(Boolean)

  // Check if any parts after the first contain `/`
  const laterPartsHaveSlashes = parts.slice(1).some(p => p.includes('/'))

  if (!laterPartsHaveSlashes) {
    // Treat entire input as single freeform entry.
    // e.g. "she/her any" → 1 set with forms ["she", "her", "any"].
    // Because sets.length < 2, this is written only to the native profile
    // field (not the atproto record). Users wanting separate sets should
    // use comma separation ("she/her, any").
    if (trimmed.includes('/')) {
      return [{forms: parts.flatMap(p => p.split('/'))}]
    }
    return [{forms: [trimmed]}]
  }

  // Multiple sets: each part becomes a set
  return parts.map(p => ({forms: p.split('/')}))
}

/**
 * Returns the string to write to the native Bluesky profile.pronouns field.
 * Uses only the first set.
 */
export function getNativePronouns(sets: PronounSet[]): string {
  if (sets.length === 0) return ''
  return sets[0].forms.join('/')
}

export function usePronounsQuery({
  did,
  nativePronouns,
  enabled = true,
}: {
  did: string | undefined
  nativePronouns?: string
  enabled?: boolean
}) {
  const agent = useAgent()

  return useQuery<string>({
    queryKey: RQKEY(did ?? ''),
    staleTime: STALE.MINUTES.FIVE,
    enabled: !!did && enabled,
    async queryFn() {
      const record = await getAtProtoPronounsRecord({agent, did: did!})
      if (record) {
        return formatPronounSets(record)
      }
      return nativePronouns ?? ''
    },
  })
}

const EDITABLE_RQKEY_ROOT = 'pronouns-editable'
const EDITABLE_RQKEY = (did: string) => [EDITABLE_RQKEY_ROOT, did]

/**
 * Returns the editable string for the pronouns text field.
 * Fetches the atproto record and formats for editing; falls back to nativePronouns.
 */
export function useEditablePronounsQuery({
  did,
  nativePronouns,
}: {
  did: string | undefined
  nativePronouns?: string
}) {
  const agent = useAgent()

  return useQuery<string>({
    queryKey: EDITABLE_RQKEY(did ?? ''),
    staleTime: STALE.MINUTES.FIVE,
    enabled: !!did,
    async queryFn() {
      const record = await getAtProtoPronounsRecord({agent, did: did!})
      if (record && record.sets?.length > 0) {
        return formatPronounSetsForEditing(record)
      }
      return nativePronouns ?? ''
    },
  })
}

/**
 * Mutation to save pronoun sets to the atproto pronouns record.
 * If sets.length >= 2: putRecord with the sets
 * If sets.length < 2: deleteRecord (swallows "Could not locate record" errors)
 */
export function useSavePronounsMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()

  return useMutation({
    async mutationFn({did, sets}: {did: string; sets: PronounSet[]}) {
      if (sets.length >= 2) {
        await agent.api.com.atproto.repo.putRecord({
          repo: did,
          collection: PRONOUNS_COLLECTION,
          rkey: 'self',
          record: {
            $type: PRONOUNS_COLLECTION,
            sets,
          },
        })
      } else {
        try {
          await agent.api.com.atproto.repo.deleteRecord({
            repo: did,
            collection: PRONOUNS_COLLECTION,
            rkey: 'self',
          })
        } catch (e: any) {
          if (!e.message?.includes('Could not locate record')) {
            throw e
          }
        }
      }
    },
    onSuccess(_data, {did, sets}) {
      const nativeValue = getNativePronouns(sets)
      const displayValue =
        sets.length >= 2 ? formatPronounSets({sets}) : nativeValue
      const editableValue =
        sets.length >= 2 ? formatPronounSetsForEditing({sets}) : nativeValue

      queryClient.setQueriesData({queryKey: RQKEY(did)}, () => displayValue)
      queryClient.setQueriesData(
        {queryKey: EDITABLE_RQKEY(did)},
        () => editableValue,
      )
    },
  })
}

/**
 * Centralizes the editable pronouns state logic used by both edit profile
 * components. Fetches the editable string, manages local state, and provides
 * parsed/derived values plus a grapheme-length warning.
 */
export function useEditablePronouns(
  profile: AppBskyActorDefs.ProfileViewDetailed,
) {
  const nativePronouns = getProfilePronouns(profile) || ''
  const cacheVersion = usePrivateProfileCacheVersion()
  const privateEditablePronouns = useMemo(() => {
    const cached = getCachedPrivateProfile(profile.did)
    if (!cached?.pronouns) return undefined
    if (Array.isArray(cached.pronouns)) {
      return formatPronounSetsForEditing({sets: cached.pronouns})
    }
    return cached.pronouns
  }, [profile.did, cacheVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const {data: editablePronouns} = useEditablePronounsQuery({
    did: profile.did,
    nativePronouns,
  })

  const effectiveEditable = privateEditablePronouns ?? editablePronouns

  const [pronouns, setPronouns] = useState('')
  const [initialPronouns, setInitialPronouns] = useState('')

  useEffect(() => {
    if (effectiveEditable !== undefined) {
      setPronouns(effectiveEditable)
      setInitialPronouns(effectiveEditable)
    }
  }, [effectiveEditable])

  const parsedSets = useMemo(() => parsePronounsInput(pronouns), [pronouns])
  const nativePronounsValue = useMemo(
    () => getNativePronouns(parsedSets),
    [parsedSets],
  )
  const pronounsTooLong = useWarnMaxGraphemeCount({
    text: nativePronounsValue,
    maxCount: PRONOUNS_MAX_GRAPHEMES,
  })

  return {
    pronouns,
    setPronouns,
    initialPronouns,
    parsedSets,
    nativePronounsValue,
    pronounsTooLong,
  }
}

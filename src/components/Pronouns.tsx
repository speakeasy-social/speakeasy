import {useMemo} from 'react'
import {AppBskyActorDefs} from '@atproto/api'

import {
  getCachedPrivateProfile,
  usePrivateProfileCacheVersion,
} from '#/state/cache/private-profile-cache'
import {
  formatPronounSets,
  getProfilePronouns,
  usePronounsQuery,
} from '#/state/queries/pronouns'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function Pronouns({
  did,
  profile,
  size = 'md',
  prefix,
}: {
  did: string
  profile?: AppBskyActorDefs.ProfileViewDetailed
  size?: 'sm' | 'md'
  prefix?: string
}) {
  const t = useTheme()
  const cacheVersion = usePrivateProfileCacheVersion()
  const privatePronouns = useMemo(() => {
    const cached = getCachedPrivateProfile(did)
    if (!cached?.pronouns) return undefined
    if (Array.isArray(cached.pronouns)) {
      return formatPronounSets({sets: cached.pronouns})
    }
    return cached.pronouns
  }, [did, cacheVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const nativePronouns = getProfilePronouns(profile)
  const {data: atProtoPronouns} = usePronounsQuery({
    did,
    nativePronouns,
    enabled: !privatePronouns,
  })

  const displayText = privatePronouns || atProtoPronouns

  if (!displayText) return null

  return (
    <Text
      style={[
        size === 'sm' ? a.text_sm : a.text_md,
        a.leading_snug,
        t.atoms.text_contrast_medium,
      ]}
      numberOfLines={1}>
      {prefix}
      {displayText}
    </Text>
  )
}

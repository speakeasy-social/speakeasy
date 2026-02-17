import {AppBskyActorDefs} from '@atproto/api'

import {getProfilePronouns, usePronounsQuery} from '#/state/queries/pronouns'
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
  const nativePronouns = getProfilePronouns(profile)
  const {data: pronouns} = usePronounsQuery({did, nativePronouns})

  if (!pronouns) return null

  return (
    <Text
      style={[
        size === 'sm' ? a.text_sm : a.text_md,
        a.leading_snug,
        t.atoms.text_contrast_medium,
      ]}
      numberOfLines={1}>
      {prefix}
      {pronouns}
    </Text>
  )
}

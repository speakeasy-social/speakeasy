import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native'

import {useUserContributionsQuery} from '#/state/queries/testimonials'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {SupporterBadge} from './SupporterBadge'
import {deduplicateContributions} from './types'

export function SupporterBadges({
  did,
  style,
}: {
  did: string
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {data: contributions} = useUserContributionsQuery(did)

  if (!contributions || contributions.length === 0) {
    return null
  }

  const displayContributions = deduplicateContributions(contributions)

  if (displayContributions.length === 0) {
    return null
  }

  return (
    <Link
      to="/supporters"
      label="View supporters"
      style={[styles.container, style]}>
      {displayContributions.map((c, idx) => (
        <View
          key={`${c.contribution}:${c.public?.recognition ?? ''}:${idx}`}
          style={styles.badge}>
          {idx > 0 && (
            <Text
              style={[a.text_md, a.font_bold, t.atoms.text_contrast_medium]}>
              {' \u00b7 '}
            </Text>
          )}
          <SupporterBadge
            contribution={c.contribution}
            recognition={c.public?.recognition}
            isRegularGift={c.public?.isRegularGift}
          />
        </View>
      ))}
    </Link>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})

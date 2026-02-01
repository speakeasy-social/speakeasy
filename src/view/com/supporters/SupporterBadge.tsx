import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {SupporterTier} from './types'

const TIER_STYLES: Record<
  SupporterTier,
  {backgroundColor: string; label: string}
> = {
  founder: {
    backgroundColor: '#D4AF37', // gold
    label: '✊ Founding Donor',
  },
  supporter: {
    backgroundColor: '#C0C0C0', // silver
    label: '💜 Donor',
  },
  contributor: {
    backgroundColor: '#CD7F32', // bronze
    label: '⚒️ Contributor',
  },
}

export function SupporterBadge({tier}: {tier: SupporterTier}) {
  const t = useTheme()
  const {backgroundColor, label} = TIER_STYLES[tier]

  return (
    <View
      style={[
        {
          backgroundColor,
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 4,
        },
        a.justify_center,
      ]}>
      <Text
        style={[
          a.text_xs,
          a.leading_tight,
          a.font_bold,
          {color: t.name === 'light' ? '#000' : '#fff'},
        ]}>
        {label}
      </Text>
    </View>
  )
}

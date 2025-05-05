import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'
import {Text} from '#/components/Typography'

export function PrivatePostPill() {
  const t = useTheme()
  const {_} = useLingui()

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.rounded_xs,
        t.atoms.bg_contrast_50,
        t.atoms.border_contrast_medium,
        {gap: 3},
        {paddingLeft: 4, paddingRight: 3, paddingVertical: 3},
      ]}>
      <LockIcon
        style={{color: t.atoms.text_contrast_medium.color}}
        width={12}
        height={12}
        title={_(msg`Private post`)}
        aria-label={_(msg`Private post`)}
      />
      <Text
        style={[
          a.text_xs,
          a.font_bold,
          a.leading_tight,
          t.atoms.text_contrast_medium,
          {paddingRight: 3},
        ]}>
        {_(msg`Private Post`)}
      </Text>
    </View>
  )
}

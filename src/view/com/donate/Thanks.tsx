import {StyleProp, Text, View, ViewStyle} from 'react-native'
import {Trans} from '@lingui/macro'

import {atoms as a, useTheme} from '#/alf'

export function Thanks({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const t = useTheme()

  return (
    <View testID={testID} style={style}>
      <View style={[a.flex_col, a.align_center, a.gap_sm, a.w_full]}>
        <Text style={[t.atoms.text, a.text_2xl, a.p_5xl]}>
          <Trans>Thank you! Your donation has been processed</Trans>
        </Text>
      </View>
    </View>
  )
}

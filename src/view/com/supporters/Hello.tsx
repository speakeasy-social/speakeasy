import {StyleProp, Text, View, ViewStyle} from 'react-native'
import {Trans} from '@lingui/macro'

import {atoms as a, useTheme} from '#/alf'

export function Hello({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const t = useTheme()
  return (
    <View testID={testID} style={style}>
      <View
        style={[
          a.flex_col,
          a.align_center,
          a.gap_sm,
          a.px_xl,
          a.pt_xl,
          a.w_full,
        ]}>
        <Text style={[t.atoms.text, a.text_2xl, a.px_5xl]}>
          <Trans>Hello there.</Trans>
        </Text>
      </View>
    </View>
  )
}

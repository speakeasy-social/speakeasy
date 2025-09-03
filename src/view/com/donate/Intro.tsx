import {StyleProp, Text, View, ViewStyle} from 'react-native'
import {Image} from 'expo-image'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {ButtonText} from '#/components/Button'
import {Input} from '#/components/forms/TextField'
import {Link} from '#/components/Link'

export function Intro({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const {_} = useLingui()
  const t = useTheme()

  return (
    <View testID={testID} style={style}>
      <View style={[a.flex_col, a.align_center, a.w_full, a.px_6xl, a.gap_2xl]}>
        <Text style={[t.atoms.text, a.text_5xl]}>
          <Trans>Feed your hunger for a better internet</Trans>
        </Text>
        <Image
          source={require('../../../../assets/speakeasy/share-noodles.jpg')}
          accessibilityLabel="Two people sitting on a picnic rug, eating noodles"
          accessibilityHint=""
          accessibilityIgnoresInvertColors
          style={[{width: '100%', aspectRatio: 1.5}]}
        />
        <Text style={[t.atoms.text, a.text_2xl]}>
          <Trans>
            Donate monthly what you’d normally spend on a good meal to support
            social media by humans, for humans
          </Trans>
        </Text>
        <View style={{width: '80%'}}>
          <Input label="Enter donation amount" />
        </View>
        <View style={[a.flex_row, a.gap_2xl]}>
          <Link
            to="/donate/payment"
            size="large"
            color="secondary"
            variant="outline"
            label={_(msg`Donate one time to Speakeasy`)}
            style={[a.rounded_full]}>
            <ButtonText>
              <Trans>Donate One Time</Trans>
            </ButtonText>
          </Link>
          <Link
            to="/donate/payment"
            size="large"
            color="primary"
            variant="solid"
            label={_(msg`Donate monthly to Speakeasy`)}
            style={[a.rounded_full]}>
            <ButtonText>
              <Trans>Donate Monthly</Trans>
            </ButtonText>
          </Link>
        </View>
      </View>
    </View>
  )
}

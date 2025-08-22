import {StyleProp, Text, View, ViewStyle} from 'react-native'
import {Image} from 'expo-image'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'

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
      <View
        style={[
          a.flex_col,
          a.align_center,
          a.gap_sm,
          a.px_xl,
          a.pt_xl,
          a.w_full,
        ]}>
        <Text style={[a.text_5xl, t.atoms.text]}>
          <Trans>Feed your hunger for a better internet</Trans>
        </Text>
        <Image
          source={require('../../../../assets/speakeasy/share-noodles.jpg')}
          accessibilityLabel="Two people sitting on a picnic rug, eating noodles"
          accessibilityHint=""
          accessibilityIgnoresInvertColors
          style={[{width: '100%', aspectRatio: 1.4}]}
        />
        <Text style={[a.text_2xl, t.atoms.text]}>
          <Trans>
            Donate monthly what you’d normally spend on a good meal to support
            social media by humans, for humans
          </Trans>
        </Text>
        <Button
          testID="donateButton"
          size="large"
          color="primary"
          variant="solid"
          onPress={() => {
            alert('stripe goes here')
          }}
          label={_(msg`Donate to Speakeasy`)}
          style={[a.rounded_full]}>
          <ButtonText>
            <Trans>Donate</Trans>
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}

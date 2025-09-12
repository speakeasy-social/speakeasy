import {Text, View} from 'react-native'
import {Image} from 'expo-image'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Input} from '#/components/forms/TextField'
import {StepState} from './util'

export function Intro({
  handleOnChange,
  hasInputError,
  disableButtons,
  onPress,
}: {
  handleOnChange: (event: any) => void
  hasInputError: boolean
  disableButtons: boolean
  onPress: (step: StepState['currentStep']) => () => void
}) {
  const {_} = useLingui()
  const t = useTheme()

  return (
    <View>
      <View style={[a.flex_col, a.align_center, a.w_full, a.gap_2xl]}>
        <Text style={[t.atoms.text, a.text_5xl, a.px_6xl]}>
          <Trans>Feed your hunger for a better internet</Trans>
        </Text>
        <Image
          source={require('../../../../assets/speakeasy/share-noodles.jpg')}
          accessibilityLabel="Two people sitting on a picnic rug, eating noodles"
          accessibilityHint=""
          accessibilityIgnoresInvertColors
          style={[{width: '100%', aspectRatio: 1.5}]}
        />
        <Text style={[t.atoms.text, a.text_2xl, a.px_6xl]}>
          <Trans>
            Donate monthly what you’d normally spend on a good meal to support
            social media by humans, for humans
          </Trans>
        </Text>
        <View style={[a.px_6xl, {width: '80%'}]}>
          <Input
            placeholder="$"
            label="Enter donation amount"
            onChange={handleOnChange}
            isInvalid={hasInputError}
          />
        </View>
        <View style={[a.flex_row, a.gap_2xl, a.px_6xl]}>
          <Button
            onPress={onPress('payment')}
            disabled={disableButtons}
            size="large"
            color="secondary"
            variant="outline"
            label={_(msg`Donate one time to Speakeasy`)}
            style={[a.rounded_full]}>
            <ButtonText>
              <Trans>Donate One Time</Trans>
            </ButtonText>
          </Button>
          <Button
            onPress={onPress('subscription')}
            disabled={disableButtons}
            size="large"
            color="primary"
            variant="solid"
            label={_(msg`Donate monthly to Speakeasy`)}
            style={[a.rounded_full]}>
            <ButtonText>
              <Trans>Donate Monthly</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
    </View>
  )
}

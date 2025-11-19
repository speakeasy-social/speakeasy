import {useCallback, useRef} from 'react'
import {Text, TextInput, View} from 'react-native'
import {Image} from 'expo-image'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect} from '@react-navigation/native'

import {useSession} from '#/state/session'
import {atoms as a, tokens, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {STRIPE_CURRENCIES, StepState} from './util'

export function Intro({
  handleOnChange,
  hasInputError,
  disableButtons,
  onPress,
  currency,
  onCurrencyChange,
  useAccountEmail,
  onUseAccountEmailChange,
}: {
  handleOnChange: (event: any) => void
  hasInputError: boolean
  disableButtons: boolean
  onPress: (step: StepState['currentStep']) => () => void
  currency: string
  onCurrencyChange: (currency: string) => void
  useAccountEmail: boolean
  onUseAccountEmailChange: (value: boolean) => void
}) {
  const {_} = useLingui()
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const {hasSession, currentAccount} = useSession()
  const inputRef = useRef<TextInput>(null)

  const userEmail = currentAccount?.email
  const showEmailCheckbox = hasSession && !!userEmail

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }, []),
  )

  const handleCurrencyChange = useCallback(
    (event: any) => {
      onCurrencyChange(event.target.value)
    },
    [onCurrencyChange],
  )

  return (
    <View>
      <View style={[a.flex_col, a.align_center, a.w_full, a.gap_2xl]}>
        <Text style={[t.atoms.text, a.text_4xl, a.px_6xl]}>
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
        <View style={[a.px_6xl, a.gap_md, {width: '80%'}]}>
          <TextField.Root>
            <TextField.PrefixText
              label="Dollar sign"
              gradient={tokens.gradients.sunset}>
              $
            </TextField.PrefixText>
            <TextField.Input
              label="Donation Amount"
              onChange={handleOnChange}
              isInvalid={hasInputError}
              inputRef={inputRef}
              autoFocus={true}
            />
          </TextField.Root>

          <View style={[a.gap_xs]}>
            <Text style={[t.atoms.text_contrast_medium, a.text_sm]}>
              <Trans>Currency</Trans>
            </Text>
            <select
              value={currency}
              onChange={handleCurrencyChange}
              aria-label={_(msg`Select currency`)}
              style={{
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: t.palette.contrast_300,
                backgroundColor: t.atoms.bg.backgroundColor,
                color: t.atoms.text.color,
                fontSize: 16,
              }}>
              {STRIPE_CURRENCIES.map(({code, name}) => (
                <option key={code} value={code}>
                  {code} - {name}
                </option>
              ))}
            </select>
          </View>

          {showEmailCheckbox && (
            <Toggle.Item
              type="checkbox"
              name="useAccountEmail"
              label={_(msg`Use my account email for the donation`)}
              value={useAccountEmail}
              onChange={onUseAccountEmailChange}>
              <Toggle.Checkbox />
              <Toggle.LabelText>
                <Trans>Use my account email for the donation</Trans>
              </Toggle.LabelText>
            </Toggle.Item>
          )}
        </View>
        <View
          style={[
            gtMobile ? a.flex_row : a.flex_col,
            a.gap_2xl,
            a.px_6xl,
            gtMobile ? {} : a.w_full,
          ]}>
          {gtMobile ? (
            <>
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
            </>
          ) : (
            <>
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
            </>
          )}
        </View>
      </View>
    </View>
  )
}

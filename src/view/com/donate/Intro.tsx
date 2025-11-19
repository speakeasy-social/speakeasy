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
import {CurrencyDropdown} from './CurrencyDropdown'
import {getCurrencySymbol, StepState} from './util'

export function Intro({
  handleOnChange,
  inputValue,
  hasInputError,
  disableButtons,
  onPress,
  currency,
  onCurrencyChange,
  useAccountEmail,
  onUseAccountEmailChange,
}: {
  handleOnChange: (event: any) => void
  inputValue: string
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
    (newCurrency: string) => {
      onCurrencyChange(newCurrency)
    },
    [onCurrencyChange],
  )

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!disableButtons) {
        onPress('subscription')()
      }
    },
    [disableButtons, onPress],
  )

  const currencySymbol = getCurrencySymbol(currency)

  return (
    <View>
      <View style={[a.flex_col, a.align_center, a.w_full, a.gap_2xl]}>
        <Text style={[t.atoms.text, a.text_3xl, a.px_6xl]}>
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
        <form onSubmit={handleSubmit} style={{width: '100%'}}>
          <View style={[a.px_lg, a.gap_md]}>
            <View style={[a.flex_row, a.gap_md, a.align_end, a.justify_center]}>
              <CurrencyDropdown
                value={currency}
                onChange={handleCurrencyChange}
                style={[a.flex_0]}
              />
              <View style={[{maxWidth: 200}]}>
                <TextField.Root>
                  <TextField.PrefixText
                    label={_(msg`Currency symbol`)}
                    gradient={tokens.gradients.sunset}>
                    {currencySymbol}
                  </TextField.PrefixText>
                  <TextField.Input
                    label={_(msg`Donation Amount`)}
                    value={inputValue}
                    onChange={handleOnChange}
                    isInvalid={hasInputError}
                    inputRef={inputRef}
                    autoFocus={true}
                  />
                </TextField.Root>
              </View>
            </View>

            {showEmailCheckbox && (
              <View style={[a.flex_row, a.justify_center]}>
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
              </View>
            )}
          </View>
        </form>
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

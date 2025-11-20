import {Text, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {getCurrencySymbol, isZeroDecimalCurrency} from './util'

export function Upsell({
  value,
  currency,
  onSelectMonthly,
  onSelectOneTime,
  onBack,
}: {
  value: string
  currency: string
  onSelectMonthly: (value: string) => void
  onSelectOneTime: () => void
  onBack: () => void
}) {
  const {_} = useLingui()
  const t = useTheme()

  const currencySymbol = getCurrencySymbol(currency)
  const numValue = Number.parseFloat(value)
  const quarterValue = numValue / 4

  // Round up to nearest dollar (or nearest 10 for zero-decimal currencies)
  const upsellValue = isZeroDecimalCurrency(currency)
    ? Math.ceil(quarterValue / 10) * 10
    : Math.ceil(quarterValue)

  // Format display values
  const displayAmount = value
  const displayUpsellAmount = upsellValue.toString()

  return (
    <View style={[a.flex_col, a.align_center, a.w_full, a.gap_2xl, a.px_6xl]}>
      <View style={[a.w_full]}>
        <Text style={[t.atoms.text, a.text_3xl, a.text_left]}>
          <Trans>Regular donations allow us to focus on building for you</Trans>
        </Text>
      </View>

      <View style={[a.w_full]}>
        <Text style={[t.atoms.text, a.text_xl, a.text_left]}>
          <Trans>
            We know times are tough, but if you have the means to make an
            ongoing contribution of any amount, it helps us plan for the future
          </Trans>
        </Text>
      </View>

      <View style={[a.flex_col, a.gap_lg, a.w_full, {maxWidth: 400}]}>
        <Button
          onPress={() => onSelectMonthly(value)}
          size="large"
          color="primary"
          variant="solid"
          label={_(msg`Give ${currencySymbol}${displayAmount} monthly`)}
          style={[a.rounded_full]}>
          <ButtonText>
            <Trans>
              Give {currencySymbol}
              {displayAmount} monthly
            </Trans>
          </ButtonText>
        </Button>

        <Button
          onPress={() => onSelectMonthly(displayUpsellAmount)}
          size="large"
          color="secondary"
          variant="solid"
          label={_(msg`Give ${currencySymbol}${displayUpsellAmount} monthly`)}
          style={[a.rounded_full]}>
          <ButtonText>
            <Trans>
              Give {currencySymbol}
              {displayUpsellAmount} monthly
            </Trans>
          </ButtonText>
        </Button>

        <Button
          onPress={onSelectOneTime}
          size="large"
          color="secondary"
          variant="outline"
          label={_(msg`Give ${currencySymbol}${displayAmount} once`)}
          style={[a.rounded_full]}>
          <ButtonText>
            <Trans>
              Give {currencySymbol}
              {displayAmount} once
            </Trans>
          </ButtonText>
        </Button>
      </View>

      <Button
        onPress={onBack}
        size="small"
        color="secondary"
        variant="ghost"
        label={_(msg`Go back`)}>
        <ButtonText>
          <Trans>Back</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

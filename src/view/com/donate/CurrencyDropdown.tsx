import React from 'react'
import {View} from 'react-native'
import RNPickerSelect, {PickerSelectProps} from 'react-native-picker-select'

import {atoms as a, useTheme, ViewStyleProp} from '#/alf'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDown} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import {CURRENCY_SYMBOLS, STRIPE_CURRENCIES} from './util'

export function CurrencyDropdown({
  value,
  onChange,
  style,
}: {
  value: string
  onChange: (currency: string) => void
} & ViewStyleProp) {
  const t = useTheme()

  const handleChange = React.useCallback(
    (newValue: Parameters<PickerSelectProps['onValueChange']>[0]) => {
      if (newValue) {
        onChange(newValue)
      }
    },
    [onChange],
  )

  return (
    <View
      style={[
        {
          height: 48,
          width: 70,
        },
        style,
      ]}>
      <View
        style={[
          a.flex_row,
          a.gap_sm,
          a.align_center,
          a.justify_between,
          a.px_md,
          a.h_full,
          a.rounded_sm,
          a.border,
          {
            borderColor: t.palette.contrast_300,
            backgroundColor: t.atoms.bg.backgroundColor,
          },
        ]}>
        <Text aria-hidden={true} style={[t.atoms.text, a.text_md, a.font_bold]}>
          {value}
        </Text>
        <ChevronDown fill={t.atoms.text.color} size="xs" style={a.flex_0} />
      </View>

      <View style={[a.absolute, a.inset_0]}>
        <RNPickerSelect
          darkTheme={t.scheme === 'dark'}
          placeholder={{}}
          value={value}
          onValueChange={handleChange}
          items={STRIPE_CURRENCIES.map(({code, name}) => {
            const symbol = CURRENCY_SYMBOLS[code]
            return {
              label: `${code} ${symbol} - ${name}`,
              value: code,
              key: code,
            }
          })}
          useNativeAndroidPickerStyle={false}
          style={{
            inputAndroid: {
              color: 'transparent',
              fontSize: 18,
              position: 'absolute',
              inset: 0,
            },
            inputIOS: {
              color: 'transparent',
              fontSize: 18,
              position: 'absolute',
              inset: 0,
            },
          }}
        />
      </View>
    </View>
  )
}

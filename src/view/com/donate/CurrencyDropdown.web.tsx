import React from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

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
  const {_} = useLingui()
  const t = useTheme()

  const handleChange = React.useCallback(
    (ev: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = ev.target.value
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

      <select
        value={value}
        onChange={handleChange}
        aria-label={_(msg`Select currency`)}
        style={{
          fontSize: 18,
          cursor: 'pointer',
          position: 'absolute',
          inset: 0,
          opacity: 0,
          color: t.atoms.text.color,
          background: t.atoms.bg.backgroundColor,
          padding: 12,
          borderRadius: 8,
          maxWidth: '100%',
        }}>
        {STRIPE_CURRENCIES.map(({code, name}) => {
          const symbol = CURRENCY_SYMBOLS[code]
          return (
            <option key={code} value={code}>
              {/* eslint-disable-next-line bsky-internal/avoid-unwrapped-text */}
              {code} {symbol} - {name}
            </option>
          )
        })}
      </select>
    </View>
  )
}

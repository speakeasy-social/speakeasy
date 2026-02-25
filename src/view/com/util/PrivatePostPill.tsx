import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'
import {Text} from '#/components/Typography'

/**
 * Shared pill: lock icon + label. Used by PrivatePostPill and PrivateProfileIndicator.
 */
export function LockPill({
  label,
  ariaLabel,
}: {
  label: string
  ariaLabel?: string
}) {
  const t = useTheme()
  const a11y = ariaLabel ?? label

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.rounded_xs,
        t.atoms.bg_contrast_50,
        t.atoms.border_contrast_medium,
        {gap: 3},
        {paddingLeft: 4, paddingRight: 3, paddingVertical: 3},
      ]}>
      <LockIcon
        style={{color: t.atoms.text_contrast_medium.color}}
        width={12}
        height={12}
        title={a11y}
        aria-label={a11y}
      />
      <Text
        style={[
          a.text_xs,
          a.font_bold,
          a.leading_tight,
          t.atoms.text_contrast_medium,
          {paddingRight: 3},
        ]}>
        {label}
      </Text>
    </View>
  )
}

export function PrivatePostPill() {
  const {_} = useLingui()
  return (
    <LockPill label={_(msg`Private Post`)} ariaLabel={_(msg`Private post`)} />
  )
}

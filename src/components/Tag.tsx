import React from 'react'
import {View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {atoms as a, tokens, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export type TagVariant =
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'blue'
  | 'emerald'
  | 'violet'
  | 'gradient_primary'
  | 'gradient_sky'
  | 'gradient_midnight'
  | 'gradient_sunrise'
  | 'gradient_sunset'
  | 'gradient_summer'
  | 'gradient_nordic'
  | 'gradient_bonfire'

const SOLID_VARIANTS: Record<
  Exclude<TagVariant, `gradient_${string}`>,
  string
> = {
  gold: '#D4AF37',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  blue: '#2563EB',
  emerald: '#10B981',
  violet: '#8B5CF6',
}

/**
 * Calculate relative luminance of a color (0-1 scale)
 * Uses the formula from WCAG: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getLuminance(hex: string): number {
  // Remove # if present
  const cleanHex = hex.replace('#', '')

  // Parse RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255

  // Apply gamma correction
  const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear
}

/**
 * Determine text color (black or white) based on background luminance
 */
function getTextColorForBackground(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor)
  // Use white text on dark backgrounds (luminance < 0.5), black on light
  return luminance < 0.5 ? '#fff' : '#000'
}

export interface TagProps {
  label: string
  variant?: TagVariant
  color?: string
}

export function Tag({label, variant, color}: TagProps) {
  const t = useTheme()

  // Determine if we're using a gradient
  const isGradient = variant?.startsWith('gradient_')
  const gradientName =
    isGradient && variant
      ? (variant.replace('gradient_', '') as keyof typeof tokens.gradients)
      : null

  // Determine background color
  let backgroundColor: string | undefined
  let textColor: string

  if (color) {
    // Custom color takes precedence
    backgroundColor = color
    textColor = getTextColorForBackground(color)
  } else if (isGradient && gradientName) {
    // Gradient variant - use white text
    textColor = '#fff'
  } else if (variant && variant in SOLID_VARIANTS) {
    // Solid variant
    backgroundColor = SOLID_VARIANTS[variant as keyof typeof SOLID_VARIANTS]
    // Blue and violet always use white text, others use theme-aware text color
    if (variant === 'blue' || variant === 'violet') {
      textColor = '#fff'
    } else {
      textColor = t.name === 'light' ? '#000' : '#fff'
    }
  } else {
    // Fallback - shouldn't happen with proper usage
    backgroundColor = '#ccc'
    textColor = '#000'
  }

  // Get gradient values if needed
  const gradientValues = React.useMemo(() => {
    if (!isGradient || !gradientName) return null

    const gradient = tokens.gradients[gradientName]
    if (!gradient || gradient.values.length < 2) return null

    return {
      colors: gradient.values.map(([_, c]) => c) as [
        string,
        string,
        ...string[],
      ],
      locations: gradient.values.map(([location, _]) => location) as [
        number,
        number,
        ...number[],
      ],
    }
  }, [isGradient, gradientName])

  const content = (
    <Text
      emoji
      style={[a.text_xs, a.leading_tight, a.font_bold, {color: textColor}]}>
      {label}
    </Text>
  )

  if (isGradient && gradientValues) {
    const reversed =
      variant === 'gradient_summer' || variant === 'gradient_nordic'
    return (
      <LinearGradient
        colors={gradientValues.colors}
        locations={gradientValues.locations}
        start={reversed ? {x: 1, y: 1} : {x: 0, y: 0}}
        end={reversed ? {x: 0, y: 0} : {x: 1, y: 1}}
        style={[
          {
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 4,
          },
          a.justify_center,
        ]}>
        {content}
      </LinearGradient>
    )
  }

  return (
    <View
      style={[
        {
          backgroundColor,
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 4,
        },
        a.justify_center,
      ]}>
      {content}
    </View>
  )
}

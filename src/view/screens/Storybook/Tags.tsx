import {View} from 'react-native'

import {atoms as a} from '#/alf'
import {Tag, TagVariant} from '#/components/Tag'
import {H1} from '#/components/Typography'

export function Tags() {
  const solidVariants: TagVariant[] = [
    'gold',
    'silver',
    'bronze',
    'blue',
    'emerald',
    'violet',
  ]

  const gradientVariants: TagVariant[] = [
    'gradient_primary',
    'gradient_sky',
    'gradient_midnight',
    'gradient_sunrise',
    'gradient_sunset',
    'gradient_summer',
    'gradient_nordic',
    'gradient_bonfire',
  ]

  return (
    <View style={[a.gap_md]}>
      <H1>Tags</H1>

      <View style={[a.gap_sm]}>
        <View style={[a.flex_row, a.flex_wrap, a.gap_md, a.align_start]}>
          {solidVariants.map(variant => (
            <Tag key={variant} variant={variant} label={`${variant} tag`} />
          ))}
        </View>
      </View>

      <View style={[a.gap_sm]}>
        <View style={[a.flex_row, a.flex_wrap, a.gap_md, a.align_start]}>
          {gradientVariants.map(variant => (
            <Tag
              key={variant}
              variant={variant}
              label={variant.replace('gradient_', '')}
            />
          ))}
        </View>
      </View>

      <View style={[a.gap_sm]}>
        <View style={[a.flex_row, a.flex_wrap, a.gap_md, a.align_start]}>
          <Tag color="#E53E3E" label="Custom red" />
          <Tag color="#38A169" label="Custom green" />
          <Tag color="#3182CE" label="Custom blue" />
          <Tag color="#805AD5" label="Custom purple" />
          <Tag color="#D69E2E" label="Custom yellow" />
          <Tag color="#2D3748" label="Custom dark" />
        </View>
      </View>
    </View>
  )
}

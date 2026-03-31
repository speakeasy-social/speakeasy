import React from 'react'
import {View} from 'react-native'

import {capitalize} from '#/lib/strings/capitalize'
import {atoms as a, tokens, useTheme} from '#/alf'
import {Props as IconProps} from '#/components/icons/common'
import {DonorDark_Stroke2_Corner0_Rounded as DonorDarkIcon} from '#/components/icons/DonorDark'
import {Volunteer_Stroke2_Corner0_Rounded as VolunteerIcon} from '#/components/icons/Volunteer'
import {Text} from '#/components/Typography'

type IconComponent = React.ComponentType<IconProps>

type BadgeInfo = {
  icon: IconComponent
  label: string
  gradient?: keyof typeof tokens.gradients
}

function getBadgeInfo(
  contribution: string,
  recognition?: string | null,
  isRegularGift?: boolean,
): BadgeInfo {
  if (contribution === 'donor' && recognition === 'Founding Donor') {
    return {icon: DonorDarkIcon, label: 'Founding Donor', gradient: 'sunset'}
  }

  if (contribution === 'donor' && isRegularGift) {
    return {icon: DonorDarkIcon, label: 'Frequent Donor', gradient: 'sunrise'}
  }

  if (contribution === 'donor') {
    return {icon: DonorDarkIcon, label: 'Donor'}
  }

  const labelMap: Record<string, string> = {
    contributor: 'Contributor',
    designer: 'UX & Design',
    engineer: 'Software Development',
    testing: 'Testing & QA',
    community: 'Community Building',
  }

  return {
    icon: VolunteerIcon,
    label:
      labelMap[contribution] ?? capitalize(contribution.replace(/_/g, ' ')),
  }
}

export function SupporterBadge({
  contribution,
  recognition,
  isRegularGift,
}: {
  contribution: string
  recognition?: string | null
  isRegularGift?: boolean
}) {
  const t = useTheme()
  const {
    icon: Icon,
    label,
    gradient,
  } = getBadgeInfo(contribution, recognition, isRegularGift)
  const color = t.atoms.text_contrast_medium.color

  return (
    <View style={[a.flex_row, a.align_center, {gap: 4}]}>
      <Icon size="sm" fill={color} gradient={gradient} />
      <Text style={[a.text_md, a.font_bold, {color}]}>{label}</Text>
    </View>
  )
}

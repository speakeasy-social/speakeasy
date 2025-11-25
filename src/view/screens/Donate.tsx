import React from 'react'
import {Pressable, useWindowDimensions, View} from 'react-native'
import {useFocusEffect, useLinkProps} from '@react-navigation/native'

import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import * as Layout from '#/components/Layout'
import {DonationFlow} from '../com/donate/DonationFlow'
import {Logo} from '../icons/Logo'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Donate'>
export function DonateScreen({}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()
  const {onPress: onPressLogo} = useLinkProps({to: '/'})
  const {gtMobile} = useBreakpoints()
  const t = useTheme()
  const {height} = useWindowDimensions()
  const needsPadding = gtMobile || height > 700

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(true)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="donateScreen">
      <View
        style={[
          a.w_full,
          a.border_b,
          a.flex_row,
          a.align_center,
          a.py_xs,
          t.atoms.border_contrast_low,
          web([a.sticky, {top: 0}, a.z_10, t.atoms.bg]),
          {minHeight: 52},
          gtMobile &&
            web({
              position: 'fixed',
              left: '50%',
              transform: [
                {translateX: '-50%'},
                {translateX: -300},
                {translateX: -240},
                ...a.scrollbar_offset.transform,
              ],
              width: 240,
              borderBottom: 'none',
            }),
        ]}>
        <View style={[a.px_lg]}>
          <Pressable
            onPress={onPressLogo}
            accessibilityRole="link"
            accessibilityLabel="Go to home page"
            accessibilityHint="Navigate to the home page">
            <Logo />
          </Pressable>
        </View>
      </View>
      <Layout.Content
        contentContainerStyle={[needsPadding && {paddingTop: 100}]}>
        <DonationFlow style={a.flex_grow} />
      </Layout.Content>
    </Layout.Screen>
  )
}

import React from 'react'
import {Pressable, View} from 'react-native'
import {useFocusEffect, useLinkProps} from '@react-navigation/native'

import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {DonationFlow} from '../com/donate/DonationFlow'
import {Logo} from '../icons/Logo'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Donate'>
export function DonateScreen({}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()
  const {onPress: onPressLogo} = useLinkProps({to: '/'})

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(true)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="donateScreen">
      <Layout.Header.Outer noBottomBorder>
        <Layout.Header.Content align="platform">
          <View style={[a.align_center]}>
            <Pressable
              onPress={onPressLogo}
              accessibilityRole="link"
              accessibilityLabel="Go to home page"
              accessibilityHint="Navigate to the home page">
              <Logo />
            </Pressable>
          </View>
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Content>
        <DonationFlow style={a.flex_grow} />
      </Layout.Content>
    </Layout.Screen>
  )
}

import React from 'react'
import {View} from 'react-native'
import {useFocusEffect} from '@react-navigation/native'

import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {DonationFlow} from '../com/donate/DonationFlow'
import {Logo} from '../icons/Logo'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Donate'>
export function DonateScreen({}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="donateScreen">
      <Layout.Header.Outer noBottomBorder>
        <Layout.Header.Content align="platform">
          <View style={[a.align_center]}>
            <Logo />
          </View>
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Content>
        <DonationFlow style={a.flex_grow} />
      </Layout.Content>
    </Layout.Screen>
  )
}

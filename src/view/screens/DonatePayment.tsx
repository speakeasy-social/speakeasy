import React from 'react'
import {useFocusEffect} from '@react-navigation/native'

import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useSetMinimalShellMode} from '#/state/shell'
import * as Layout from '#/components/Layout'
import {Payment} from '../com/donate/Payment'
import {Logo} from '../icons/Logo'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'DonatePayment'>
export function DonatePaymentScreen({}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="donatePaymentScreen">
      <Layout.Header.Outer noBottomBorder>
        <Layout.Header.Content align="platform">
          <Logo />
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Content>
        <Payment />
      </Layout.Content>
    </Layout.Screen>
  )
}

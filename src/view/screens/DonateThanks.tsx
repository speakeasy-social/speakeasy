import React from 'react'
import {useFocusEffect} from '@react-navigation/native'

import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useSetMinimalShellMode} from '#/state/shell'
import * as Layout from '#/components/Layout'
import {Thanks} from '../com/donate/Thanks'
import {Logo} from '../icons/Logo'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'DonateThanks'>
export function DonateThanksScreen({}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="donateThanksScreen">
      <Layout.Header.Outer noBottomBorder>
        <Layout.Header.Content align="platform">
          <Logo />
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Content>
        <Thanks />
      </Layout.Content>
    </Layout.Screen>
  )
}

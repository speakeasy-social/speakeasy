import React from 'react'
import {Pressable} from 'react-native'
import {useFocusEffect, useLinkProps} from '@react-navigation/native'

import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useSetMinimalShellMode} from '#/state/shell'
import * as Layout from '#/components/Layout'
import {Thanks} from '../com/donate/Thanks'
import {Logo} from '../icons/Logo'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'DonateThanks'>
export function DonateThanksScreen({}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()
  const {onPress: onPressLogo} = useLinkProps({to: '/'})

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(true)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="donateThanksScreen">
      <Layout.Header.Outer noBottomBorder>
        <Layout.Header.Content align="platform">
          <Pressable
            onPress={onPressLogo}
            accessibilityRole="link"
            accessibilityLabel="Go to home page"
            accessibilityHint="Navigate to the home page">
            <Logo />
          </Pressable>
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Content>
        <Thanks />
      </Layout.Content>
    </Layout.Screen>
  )
}

import React from 'react'
import {View} from 'react-native'
import {StackActions, useNavigation} from '@react-navigation/native'

import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {useTheme} from '#/alf'
import {atoms as a} from '#/alf/atoms'
import {Button, ButtonText} from '#/components/Button'
import {H3, Text} from '#/components/Typography'
import {router} from '../../../routes'

export function DonateCTA({onKeepScrolling}: {onKeepScrolling: () => void}) {
  const t = useTheme()
  const navigation = useNavigation()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const displayName = profile?.displayName || 'friend'

  const handleDonate = React.useCallback(() => {
    const [routeName, params] = router.matchPath('/donate')
    navigation.dispatch(StackActions.push(routeName, params))
  }, [navigation])

  return (
    <>
      <View
        style={[
          t.atoms.bg_gray,
          a.pb_xl,
          a.pt_5xl,
          a.p_lg,
          a.border_t,
          t.atoms.border_contrast_low,
          a.gap_md,
          a.align_center,
        ]}>
        <H3
          style={[
            a.font_bold,
            a.text_lg,
            a.text_left,
            {width: '100%'},
            t.atoms.text_contrast_high,
          ]}>
          Help us keep building social media by people, for people.
        </H3>

        <Text
          style={[
            t.atoms.text_contrast_high,
            a.text_md,
            a.leading_normal,
            a.text_left,
            {width: '100%'},
          ]}>
          <Text style={[a.text_md]}>Hi </Text>
          <Text style={[a.text_md]}>{displayName}</Text>
          <Text style={[a.text_md]}>
            , it looks like you're enjoying Speakeasy. We're so glad you're here
            😊
            {'\n\n'}
          </Text>
          <Text style={[a.text_md]}>Our success is measured in </Text>
          <Text style={[a.font_bold, a.text_md]}>your happiness</Text>
          <Text style={[a.text_md]}>
            {' '}
            and we know the only way to stay true to that goal is to ensure that
            our income comes from the people we serve. You.
            {'\n\n'}
            We operate on a Wikipedia model: donation funded by those who use
            the platform.
            {'\n\n'}
            Can you support us to continue building a platform that truly serves
            you?
          </Text>
        </Text>

        <View style={[a.flex_row, a.gap_md, a.mt_xl, {width: '100%'}]}>
          <Button
            variant="solid"
            color="primary"
            size="small"
            label="Donate now"
            onPress={handleDonate}>
            <ButtonText>Donate now</ButtonText>
          </Button>

          <Button
            variant="outline"
            color="primary"
            size="small"
            label="Keep Scrolling"
            onPress={onKeepScrolling}>
            <ButtonText>Keep Scrolling</ButtonText>
          </Button>
        </View>
      </View>
      {/* Spacer so that this isn't flush against the bottom and obscured
      by the jump to top */}
      <View style={{height: 300}} />
    </>
  )
}

import {useState} from 'react'
import {StyleProp, TextStyle, View} from 'react-native'
import {AppBskyActorDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {Shadow} from '#/state/cache/types'
import {Button} from '../util/forms/Button'

export function TrustButton({
  profile,
  labelStyle,
}: {
  profile: Shadow<AppBskyActorDefs.ProfileViewBasic>
  labelStyle?: StyleProp<TextStyle>
}) {
  const {_} = useLingui()
  const [isTrusted, setIsTrusted] = useState(false)

  const onPressTrust = async () => {
    setIsTrusted(!isTrusted)
    // TODO: Implement actual trust functionality
  }

  if (!profile.viewer) {
    return <View />
  }

  return (
    <Button
      type={isTrusted ? 'purple-outline' : 'purple'}
      onPress={onPressTrust}
      label={_(msg`${isTrusted ? 'Untrust' : 'Trust'}`)}
      labelStyle={labelStyle}
    />
  )
}

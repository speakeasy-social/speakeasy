import {useState} from 'react'
import {StyleProp, TextStyle, View} from 'react-native'
import {AppBskyActorDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {Shadow} from '#/state/cache/types'
import {useTrustMutationQueue} from '#/state/queries/trust'
import {Button} from '../util/forms/Button'
import * as Toast from '../util/Toast'

export function TrustButton({
  profile,
  labelStyle,
}: {
  profile: Shadow<AppBskyActorDefs.ProfileViewBasic>
  labelStyle?: StyleProp<TextStyle>
}) {
  const {_} = useLingui()
  const [isTrusted, setIsTrusted] = useState(false)
  const [queueTrust, queueUntrust] = useTrustMutationQueue(profile)

  const onPressTrust = async () => {
    try {
      if (isTrusted) {
        await queueUntrust()
      } else {
        await queueTrust()
      }
      setIsTrusted(!isTrusted)
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        Toast.show(_(msg`An issue occurred, please try again.`), 'xmark')
      }
    }
  }

  if (!profile.viewer) {
    return <View />
  }

  return (
    <Button
      type={isTrusted ? 'purple' : 'purple-outline'}
      onPress={onPressTrust}
      label={_(msg`${isTrusted ? 'Trusted' : 'Trust'}`)}
      labelStyle={labelStyle}
    />
  )
}

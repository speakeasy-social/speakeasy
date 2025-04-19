import {StyleProp, TextStyle, View} from 'react-native'
import {AppBskyActorDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useTrustMutationQueue} from '#/state/queries/trust'
import {useTrustStatusQuery} from '#/state/queries/trust-status'
import {useSession} from '#/state/session'
import {Button} from '../util/forms/Button'
import * as Toast from '../util/Toast'

export function TrustButton({
  profile,
  labelStyle,
}: {
  profile: AppBskyActorDefs.ProfileViewDetailed
  labelStyle?: StyleProp<TextStyle>
}) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const isOwnProfile = currentAccount?.did === profile.did

  const {data: isTrusted} = useTrustStatusQuery(profile.did)
  const [queueTrust, queueUntrust] = useTrustMutationQueue(profile)

  const onPressTrust = async () => {
    try {
      if (isTrusted) {
        await queueUntrust()
      } else {
        await queueTrust()
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        Toast.show(_(msg`An issue occurred, please try again.`), 'xmark')
      }
    }
  }

  if (!profile.viewer) {
    return <View />
  }

  if (isOwnProfile) {
    return null
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

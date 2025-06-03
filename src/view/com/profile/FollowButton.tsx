import {StyleProp, TextStyle, View} from 'react-native'
import {AppBskyActorDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {Shadow} from '#/state/cache/types'
import {FirstTimeFollowDialog} from '#/components/dialogs/FirstTimeFollowDialog'
import {
  useFirstTimeFollowDialog,
  useFollowWithTrustMethods,
} from '#/components/hooks/useFollowMethods'
import * as Prompt from '#/components/Prompt'
import {Button, ButtonType} from '../util/forms/Button'

export function FollowButton({
  unfollowedType = 'inverted',
  followedType = 'default',
  profile,
  labelStyle,
  logContext,
}: {
  unfollowedType?: ButtonType
  followedType?: ButtonType
  profile: Shadow<AppBskyActorDefs.ProfileViewBasic>
  labelStyle?: StyleProp<TextStyle>
  logContext: 'ProfileCard' | 'StarterPackProfilesList'
}) {
  const {follow, unfollow} = useFollowWithTrustMethods({
    profile,
    logContext,
  })
  const {shouldShowDialog} = useFirstTimeFollowDialog({onFollow: follow})
  const promptControl = Prompt.usePromptControl()
  const {_} = useLingui()

  const handleFollowPress = () => {
    if (shouldShowDialog) {
      promptControl.open()
    } else {
      follow()
    }
  }

  if (!profile.viewer) {
    return <View />
  }

  return (
    <>
      {profile.viewer.following ? (
        <Button
          type={followedType}
          labelStyle={labelStyle}
          onPress={unfollow}
          label={_(msg({message: 'Unfollow', context: 'action'}))}
        />
      ) : !profile.viewer.followedBy ? (
        <Button
          type={unfollowedType}
          labelStyle={labelStyle}
          onPress={handleFollowPress}
          label={_(msg({message: 'Follow', context: 'action'}))}
        />
      ) : (
        <Button
          type={unfollowedType}
          labelStyle={labelStyle}
          onPress={handleFollowPress}
          label={_(msg({message: 'Follow Back', context: 'action'}))}
        />
      )}
      <FirstTimeFollowDialog onFollow={follow} control={promptControl} />
    </>
  )
}

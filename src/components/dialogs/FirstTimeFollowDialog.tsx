import React from 'react'
import {GestureResponderEvent} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useTrustPreferences} from '#/state/preferences/trust'
import {DialogControlProps} from '#/components/Dialog'
import * as Prompt from '#/components/Prompt'

export function FirstTimeFollowDialog({
  onFollow,
  control,
}: {
  onFollow: (forceTrust: boolean) => void
  control: DialogControlProps
}) {
  const {_} = useLingui()
  const {setAutoTrustOnFollow} = useTrustPreferences()

  const handleConfirm = React.useCallback(
    (e: GestureResponderEvent) => {
      const isCancel = e.nativeEvent.target === 'cancel'
      setAutoTrustOnFollow(!isCancel)
      onFollow(!isCancel)
    },
    [setAutoTrustOnFollow, onFollow],
  )

  return (
    <Prompt.Basic
      control={control}
      title={_(msg`Trust when following?`)}
      description={_(
        msg`Would you like to automatically trust users when you follow them?`,
      )}
      admonition={{
        type: 'info',
        content: _(
          msg`This setting only applies to future follows. You can change it in your Privacy & Security settings`,
        ),
      }}
      confirmButtonCta={_(msg`Yes`)}
      cancelButtonCta={_(msg`No`)}
      onConfirm={handleConfirm}
      showCancel={true}
    />
  )
}

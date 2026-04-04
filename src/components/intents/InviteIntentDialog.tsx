import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {LimitedBetaModal} from '#/components/dialogs/LimitedBetaModal'
import {useIntentDialogs} from '#/components/intents/IntentDialogs'

export function InviteIntentDialog() {
  const {_} = useLingui()
  const {inviteDialogControl: control, inviteState: state} = useIntentDialogs()

  return (
    <LimitedBetaModal
      control={control}
      featureName={_(msg`Private Post to Trusted Communities`)}
      featureDescription={_(
        msg`We're trialing a new feature to make your posts only visible to your trusted community.`,
      )}
      utmParams={{
        source: 'invite_link',
        medium: 'deep_link',
        campaign: 'beta_features',
      }}
      initialCode={state?.code}
    />
  )
}

import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {DialogOuterProps} from '#/components/Dialog'
import {LimitedBetaModal} from '#/components/dialogs/LimitedBetaModal'

interface ModalProps {
  groupsDialogControl: DialogOuterProps['control']
  selectedFeature: 'groups' | 'mutual-aid'
}

const Modal = ({groupsDialogControl, selectedFeature}: ModalProps) => {
  const {_} = useLingui()

  return (
    <LimitedBetaModal
      control={groupsDialogControl}
      featureName={
        selectedFeature === 'groups' ? _(msg`Groups`) : _(msg`Mutual Aid`)
      }
      featureDescription={
        selectedFeature === 'groups'
          ? _(
              msg`We're trialing a new feature to support private discussion groups.`,
            )
          : _(msg`We're working on a new feature to support mutual aid.`)
      }
      utmParams={{
        source: 'leftnav',
        medium:
          selectedFeature === 'groups' ? 'groups_button' : 'mutual_aid_button',
        campaign:
          selectedFeature === 'groups' ? 'groups_beta' : 'mutual_aid_beta',
      }}
    />
  )
}

export default Modal

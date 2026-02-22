import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'

export interface PrivateProfileInfoDialogProps {
  control: Dialog.DialogControlProps
  onAck: () => void
}

export function PrivateProfileInfoDialog({
  control,
  onAck,
}: PrivateProfileInfoDialogProps) {
  const {_} = useLingui()
  const t = useTheme()

  const handleGotIt = () => {
    control.close(onAck)
  }

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Private Profile`)}>
        <View style={[a.gap_xl]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Private Profile</Trans>
          </Text>

          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
            <Trans>
              There's only so much we can make private on a Bluesky account.
              Setting your account to private will hide the following from the
              public and show it only to people you trust:
            </Trans>
          </Text>

          <View style={[a.pl_md]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>• Display Name</Trans>
            </Text>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>• Pronouns</Trans>
            </Text>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>• Description</Trans>
            </Text>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>• Profile Picture and Banner</Trans>
            </Text>
          </View>

          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
            <Trans>Things that will still be visible to the public:</Trans>
          </Text>

          <View style={[a.pl_md]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>• Who you follow / who follows you</Trans>
            </Text>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>
                • Any public posts you have already made, or any public posts
                you make in the future
              </Trans>
            </Text>
          </View>

          <Button
            variant="solid"
            color="primary"
            size="large"
            label={_(msg`Got it`)}
            onPress={handleGotIt}>
            <ButtonText>
              <Trans>Got it</Trans>
            </ButtonText>
          </Button>
        </View>
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

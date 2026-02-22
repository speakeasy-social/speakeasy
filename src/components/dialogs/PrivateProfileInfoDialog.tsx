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
        <View style={[a.gap_lg]}>
          <Text style={[a.text_2xl, a.font_bold, a.pb_sm, a.leading_snug]}>
            <Trans>Making your Profile Private</Trans>
          </Text>

          <View style={[a.gap_xs, a.pb_lg]}>
            <Text
              style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
              <Trans>
                There's only so much we can make private on a Bluesky account.
                Setting your account to private will hide the following from the
                public and show it only to people you trust:
              </Trans>
            </Text>
            <View style={[a.pl_md, a.gap_xs]}>
              <Text
                style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
                <Trans>• Display Name</Trans>
              </Text>
              <Text
                style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
                <Trans>• Pronouns</Trans>
              </Text>
              <Text
                style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
                <Trans>• Description</Trans>
              </Text>
              <Text
                style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
                <Trans>• Profile Picture and Banner</Trans>
              </Text>
            </View>
          </View>

          <View style={[a.gap_xs]}>
            <Text
              style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
              <Trans>Things that will still be visible to the public:</Trans>
            </Text>
            <View style={[a.pl_md, a.gap_xs]}>
              <Text
                style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
                <Trans>• Who you follow / who follows you</Trans>
              </Text>
              <Text
                style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
                <Trans>• Any existing or future public posts</Trans>
              </Text>
            </View>
          </View>

          <View style={[a.pt_xl]}>
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
        </View>
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

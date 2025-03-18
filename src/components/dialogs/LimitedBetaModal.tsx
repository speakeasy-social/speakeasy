import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'

export interface LimitedBetaModalProps {
  control: Dialog.DialogControlProps
  featureName: string
  featureDescription: string
  utmParams?: {
    source?: string
    medium?: string
    campaign?: string
  }
}

export function LimitedBetaModal({
  control,
  featureName,
  featureDescription,
  utmParams,
}: LimitedBetaModalProps) {
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()
  const t = useTheme()
  const openLink = useOpenLink()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})

  const handleLearnMore = () => {
    const baseUrl = 'https://about.spkeasy.social/feature'
    const params = new URLSearchParams({
      utm_source: utmParams?.source || 'app',
      utm_medium: utmParams?.medium || 'modal',
      utm_campaign: utmParams?.campaign || 'beta_features',
      feature: featureName,
      bluesky_handle: currentAccount?.handle || '',
      email: currentAccount?.email || '',
      name: (profile?.displayName || '').split(' ')[0],
    })

    const url = `${baseUrl}?${params.toString()}`
    control.close(() => {
      openLink(url)
    })
  }

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Please bear with us!`)}>
        <View style={[a.gap_2xl]}>
          <View style={[a.justify_center, gtMobile ? a.gap_lg : a.gap_md]}>
            <Text style={[a.text_2xl, a.font_bold, a.mb_sm]}>
              {_(msg`${featureName}`)}
            </Text>
            <Text style={[a.text_md, t.atoms.text_contrast_medium, a.mb_md]}>
              {featureDescription}
            </Text>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              {_(
                msg`Join us in in building genuine connections in community-owned social media.`,
              )}
            </Text>
          </View>

          <Button
            variant="solid"
            color="primary"
            size={gtMobile ? 'small' : 'large'}
            label={_(msg`Learn More and Get Early Access`)}
            onPress={handleLearnMore}
            style={[a.mt_lg]}>
            <ButtonText>{_(msg`Learn More and Get Early Access`)}</ButtonText>
          </Button>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

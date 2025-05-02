import React from 'react'
import {TextInput, View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useMutation} from '@tanstack/react-query'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import * as Toast from '#/view/com/util/Toast'
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
  const {call} = useSpeakeasyApi()
  const [showInviteCode, setShowInviteCode] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const applyInviteCode = useMutation({
    mutationFn: async (inviteCode: string) => {
      try {
        await call({
          api: 'social.spkeasy.actor.applyInviteCode',
          method: 'POST',
          body: {code: inviteCode},
        })
        return true
      } catch (err: any) {
        setError(err.message || 'Invalid invite code')
        return false
      }
    },
  })

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

  const handleSubmit = async () => {
    setError(null)
    const success = await applyInviteCode.mutateAsync(code)
    if (success) {
      Toast.show(_(msg`${featureName} has been activated!`))
      control.close()
    }
  }

  return (
    <Dialog.Outer
      control={control}
      onClose={() => {
        setShowInviteCode(false)
      }}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Please bear with us!`)}>
        <View style={[a.gap_2xl]}>
          {!showInviteCode ? (
            <>
              <View style={[a.justify_center, gtMobile ? a.gap_lg : a.gap_md]}>
                <Text style={[a.text_2xl, a.font_bold, a.mb_sm]}>
                  {_(msg`${featureName}`)}
                </Text>
                <Text
                  style={[a.text_md, t.atoms.text_contrast_medium, a.mb_md]}>
                  {featureDescription}
                </Text>
                <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                  {_(
                    msg`Join us in in building genuine connections in cooperatively owned social media.`,
                  )}
                </Text>
              </View>

              <View style={[a.gap_sm]}>
                <Button
                  variant="solid"
                  color="primary"
                  size={gtMobile ? 'small' : 'large'}
                  label={_(msg`Learn More and Get Early Access`)}
                  onPress={handleLearnMore}
                  style={[a.mt_lg]}>
                  <ButtonText>
                    {_(msg`Learn More and Get Early Access`)}
                  </ButtonText>
                </Button>

                <Button
                  variant="ghost"
                  color="primary"
                  size={gtMobile ? 'small' : 'large'}
                  label={_(msg`I have an invite code`)}
                  onPress={() => setShowInviteCode(true)}
                  style={[a.mt_sm]}>
                  <ButtonText>{_(msg`I have an invite code`)}</ButtonText>
                </Button>
              </View>
            </>
          ) : (
            <>
              <View style={[a.justify_center, gtMobile ? a.gap_lg : a.gap_md]}>
                <Text style={[a.text_2xl, a.font_bold, a.mb_sm]}>
                  {_(msg`Activate Invite Code`)}
                </Text>
              </View>
              <Text style={[a.text_md, t.atoms.text_contrast_medium, a.mb_md]}>
                {_(msg`Enter your invite code to activate ${featureName}`)}
              </Text>
              <TextInput
                style={[
                  a.text_md,
                  t.atoms.text,
                  a.px_md,
                  a.py_sm,
                  a.rounded_sm,
                  t.atoms.bg_contrast_25,
                ]}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={_(msg`Enter your invite code`)}
                placeholderTextColor={t.atoms.text_contrast_medium.color}
                accessibilityLabel={_(msg`Invite code input`)}
                accessibilityHint={_(
                  msg`Enter your invite code to activate ${featureName}`,
                )}
              />
              {error && (
                <Text
                  style={[a.text_sm, {color: t.palette.negative_500}, a.mt_sm]}>
                  {error}
                </Text>
              )}
              <View style={[a.gap_sm]}>
                <Button
                  variant="solid"
                  color="primary"
                  size={gtMobile ? 'small' : 'large'}
                  label={_(msg`Activate Feature`)}
                  onPress={handleSubmit}
                  style={[a.mt_lg]}>
                  <ButtonText>{_(msg`Activate Feature`)}</ButtonText>
                </Button>
                <Button
                  variant="ghost"
                  color="primary"
                  size={gtMobile ? 'small' : 'large'}
                  label={_(msg`Back`)}
                  onPress={() => {
                    setShowInviteCode(false)
                    setCode('')
                    setError(null)
                  }}
                  style={[a.mt_sm]}>
                  <ButtonText>{_(msg`Back`)}</ButtonText>
                </Button>
              </View>
            </>
          )}
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

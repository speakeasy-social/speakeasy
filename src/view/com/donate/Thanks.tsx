import {useCallback, useEffect, useMemo, useState} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'
import {RichText} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Globe_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Text} from '#/components/Typography'
import {CharProgress} from '../composer/char-progress/CharProgress'
import {TextInput} from '../composer/text-input/TextInput'
import {getCurrencySymbol} from './util'

const MAX_TESTIMONIAL_LENGTH = 300

interface DonationInfo {
  amount: string
  currency: string
  monthly: boolean
}

export function Thanks({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const t = useTheme()
  const {_} = useLingui()

  const [donationInfo, setDonationInfo] = useState<DonationInfo | null>(null)
  const [richtext, setRichText] = useState(
    () =>
      new RichText({
        text: "I donated to @spkeasy.social to support safe social media that's designed for people to thrive",
      }),
  )
  const [shareAsPost, setShareAsPost] = useState(true)
  const [audience, setAudience] = useState<'public' | 'trusted'>('public')

  // Read donation info from localStorage on mount, then clear it
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pendingDonation')
      if (stored) {
        const parsed = JSON.parse(stored) as DonationInfo
        setDonationInfo(parsed)
        localStorage.removeItem('pendingDonation')
      }
    } catch {
      // Ignore parsing errors
    }
  }, [])

  const graphemeLength = useMemo(() => {
    return richtext.graphemeLength
  }, [richtext])

  const isTextEmpty = graphemeLength === 0

  const handleSave = useCallback(() => {
    // TODO: Wire up to backend
    throw new Error('not yet implemented')
  }, [])

  // No-op handlers for TextInput
  const noOpPhoto = useCallback(() => {}, [])
  const noOpLink = useCallback(() => {}, [])
  const noOpError = useCallback(() => {}, [])
  const noOpPublish = useCallback(() => {}, [])
  const noOpFocus = useCallback(() => {}, [])

  const handleShareToggle = useCallback((values: string[]) => {
    setShareAsPost(values.includes('shareAsPost'))
  }, [])

  const handleAudienceToggle = useCallback(() => {
    setAudience(prev => (prev === 'public' ? 'trusted' : 'public'))
  }, [])

  const thankYouMessage = donationInfo
    ? donationInfo.monthly
      ? _(
          msg`Thank you! Your monthly donation of ${getCurrencySymbol(
            donationInfo.currency,
          )}${donationInfo.amount} has been processed.`,
        )
      : _(
          msg`Thank you! Your donation of ${getCurrencySymbol(
            donationInfo.currency,
          )}${donationInfo.amount} has been processed.`,
        )
    : _(msg`Thank you! Your donation has been processed.`)

  return (
    <View testID={testID} style={style}>
      <View style={[a.flex_col, a.align_center, a.gap_lg, a.w_full, a.px_lg]}>
        <Text style={[t.atoms.text, a.text_2xl, a.pt_5xl, a.self_start]}>
          {thankYouMessage}
        </Text>

        <Text
          style={[
            t.atoms.text_contrast_high,
            a.text_lg,
            a.pt_lg,
            a.self_start,
          ]}>
          <Trans>Can you take a moment to inspire others?</Trans>
        </Text>

        <View style={[a.w_full, a.gap_md]}>
          <Text style={[t.atoms.text_contrast_medium, a.text_md]}>
            <Trans>Tell us why you support Speakeasy</Trans>
          </Text>

          <View
            style={[
              a.w_full,
              a.border,
              a.rounded_sm,
              t.atoms.border_contrast_low,
              t.atoms.bg,
              {minHeight: 120},
            ]}>
            <TextInput
              richtext={richtext}
              placeholder={_(msg`Share your thoughts...`)}
              webForceMinHeight={false}
              hasRightPadding={false}
              isActive={true}
              setRichText={setRichText}
              onPhotoPasted={noOpPhoto}
              onPressPublish={noOpPublish}
              onNewLink={noOpLink}
              onError={noOpError}
              onFocus={noOpFocus}
              disableDrop={true}
              accessible={true}
              accessibilityLabel={_(msg`Write testimonial`)}
              accessibilityHint={_(
                msg`Share why you support Speakeasy, up to ${MAX_TESTIMONIAL_LENGTH} characters`,
              )}
            />
          </View>

          <CharProgress
            count={graphemeLength}
            max={MAX_TESTIMONIAL_LENGTH}
            size={20}
          />
        </View>

        <View
          style={[a.pt_md, a.flex_row, a.align_center, a.gap_sm, a.self_start]}>
          <Toggle.Group
            label={_(msg`Sharing options`)}
            values={shareAsPost ? ['shareAsPost'] : []}
            onChange={handleShareToggle}>
            <Toggle.Item
              name="shareAsPost"
              label={_(msg`Also share this in a post`)}>
              <Toggle.Checkbox />
              <Toggle.LabelText>
                <Trans>Also share this in a post</Trans>
              </Toggle.LabelText>
            </Toggle.Item>
          </Toggle.Group>

          {shareAsPost && (
            <Button
              variant="solid"
              color="secondary"
              onPress={handleAudienceToggle}
              style={[{borderRadius: 6}, a.py_xs, a.px_sm]}
              label={audience === 'public' ? _(msg`Public`) : _(msg`Trusted`)}>
              <ButtonIcon
                icon={audience === 'public' ? Globe : Lock}
                size="sm"
              />
              <ButtonText style={[a.ml_xs]}>
                {audience === 'public' ? (
                  <Trans>Public</Trans>
                ) : (
                  <Trans>Trusted</Trans>
                )}
              </ButtonText>
            </Button>
          )}
        </View>

        <View style={[a.w_full, a.pt_lg]}>
          <Button
            onPress={handleSave}
            size="large"
            color="primary"
            variant="solid"
            disabled={isTextEmpty}
            label={_(msg`Save testimonial`)}>
            <ButtonText>
              <Trans>Save</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
    </View>
  )
}

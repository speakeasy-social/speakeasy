import {useCallback, useEffect, useMemo, useState} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'
import {RichText} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'
import {nanoid} from 'nanoid/non-secure'

import * as apilib from '#/lib/api/index'
// import {usePrivateSession} from '#/lib/api/private-sessions'
// import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {createPostgateRecord} from '#/state/queries/postgate/util'
import {
  useCheckContributionQuery,
  useCreateTestimonialMutation,
} from '#/state/queries/testimonial'
import {useAgent, useSession} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useCloseAllActiveElements} from '#/state/util'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
// import {Globe_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
// import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {CharProgress} from '../composer/char-progress/CharProgress'
import {ThreadDraft} from '../composer/state/composer'
import {TextInput} from '../composer/text-input/TextInput'
import {getCurrencySymbol} from '../donate/util'
import * as Toast from '../util/Toast'

const MAX_TESTIMONIAL_LENGTH = 300

const CONTRIBUTION_LABELS: Record<string, string> = {
  engineer: 'code',
  designer: 'designs',
  testing: 'testing & qa',
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

const DONOR_DEFAULT_TEXT =
  "I donated to @spkeasy.social to support safe social media that's designed for people to thrive"
function getContributorDefaultText(contributions: string[]): string {
  const volunteerLabels = contributions
    .filter(c => c !== 'donor')
    .map(c => CONTRIBUTION_LABELS[c])
    .filter(Boolean)
  const contributionText =
    volunteerLabels.length > 0 ? formatList(volunteerLabels) : ''
  return `We deserve social media that is safe, and respects our autonomy and attention.\n\nThat's why I contribute ${contributionText} to @spkeasy.social.`
}

interface DonationInfo {
  amount: string
  currency: string
  monthly: boolean
}

export function SupportersAddForm({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {hasSession} = useSession()
  const agent = useAgent()
  const queryClient = useQueryClient()
  const navigation = useNavigation<NavigationProp>()
  const {requestSwitchToAccount} = useLoggedOutViewControls()
  const closeAllActiveElements = useCloseAllActiveElements()
  const createTestimonial = useCreateTestimonialMutation()
  // const getPrivateSession = usePrivateSession()

  const [donationInfo, setDonationInfo] = useState<DonationInfo | null>(null)
  const [localStorageChecked, setLocalStorageChecked] = useState(false)
  const [richtext, setRichText] = useState(
    () =>
      new RichText({
        text: DONOR_DEFAULT_TEXT,
      }),
  )
  const [shareAsPost, setShareAsPost] = useState(true)
  // const [audience, setAudience] = useState<'public' | 'trusted'>('public')
  const audience = 'public' as const
  const [isSaving, setIsSaving] = useState(false)

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
    setLocalStorageChecked(true)
  }, [])

  // Only check contribution status if localStorage didn't have donation info
  const shouldCheckContribution =
    hasSession && localStorageChecked && donationInfo === null
  const {data: contributionData, isLoading: isCheckingContribution} =
    useCheckContributionQuery({enabled: shouldCheckContribution})

  // Update default testimonial text for contributors (non-donors)
  // Uses synchronous state update during render so the correct text is set
  // before the TextInput mounts (TipTap only reads richtext on initialization)
  const [prevContributionData, setPrevContributionData] =
    useState(contributionData)
  if (contributionData !== prevContributionData) {
    setPrevContributionData(contributionData)
    if (contributionData) {
      const contributions = contributionData.contributions ?? []
      const hasVolunteerContributions = contributions.some(c => c !== 'donor')
      if (hasVolunteerContributions && richtext.text === DONOR_DEFAULT_TEXT) {
        setRichText(
          new RichText({text: getContributorDefaultText(contributions)}),
        )
      }
    }
  }

  // Determine if user is a valid contributor
  const hasDonationFromLocalStorage = donationInfo !== null
  const isConfirmedContributor = contributionData?.isContributor === true
  const isValidContributor =
    hasDonationFromLocalStorage || isConfirmedContributor

  // Determine if we're still loading contribution status
  const isStillLoading =
    !localStorageChecked || (shouldCheckContribution && isCheckingContribution)

  const graphemeLength = useMemo(() => {
    return richtext.graphemeLength
  }, [richtext])

  const isTextEmpty = graphemeLength === 0

  const handleSave = useCallback(async () => {
    if (isSaving || isTextEmpty || graphemeLength > MAX_TESTIMONIAL_LENGTH) {
      return
    }

    setIsSaving(true)
    try {
      await createTestimonial.mutateAsync({
        content: {text: richtext.text, facets: richtext.facets},
      })

      if (shareAsPost) {
        const thread: ThreadDraft = {
          posts: [
            {
              id: nanoid(),
              richtext,
              labels: [],
              embed: {quote: undefined, media: undefined, link: undefined},
              realTalk: undefined,
              shortenedGraphemeLength: richtext.graphemeLength,
              audience,
            },
          ],
          postgate: createPostgateRecord({post: ''}),
          threadgate: [],
        }

        // TODO: Re-enable when private testimonies are implemented
        // if (audience === 'trusted') {
        //   const {sessionId, sessionKey} = await getPrivateSession({
        //     onStateChange: () => {},
        //   })
        //
        //   const {writes, uris, cids} = await apilib.preparePost(
        //     agent,
        //     queryClient,
        //     {
        //       thread,
        //       onStateChange: () => {},
        //       langs: [],
        //       collection: 'social.spkeasy.feed.privatePost',
        //       sessionId,
        //       sessionKey,
        //     },
        //   )
        //
        //   const authorDid = agent.assertDid
        //
        //   const posts = await apilib.formatPrivatePosts(
        //     apilib.combinePostGates(authorDid, writes, uris, cids),
        //     sessionKey,
        //   )
        //
        //   await callSpeakeasyApiWithAgent(agent, {
        //     api: 'social.spkeasy.privatePost.createPosts',
        //     method: 'POST',
        //     body: {
        //       sessionId,
        //       encryptedPosts: posts,
        //     },
        //   })
        // } else {
        await apilib.post(agent, queryClient, {
          thread,
          onStateChange: () => {},
          langs: [],
          collection: 'app.bsky.feed.post',
        })
        // }
      }

      Toast.show(_(msg`Testimonial saved!`))
      navigation.navigate('Home')
    } catch (e: any) {
      logger.error(e, {message: 'Failed to save testimonial'})
      Toast.show(_(msg`Failed to save testimonial`), 'xmark')
    } finally {
      setIsSaving(false)
    }
  }, [
    isSaving,
    isTextEmpty,
    graphemeLength,
    createTestimonial,
    richtext,
    shareAsPost,
    agent,
    queryClient,
    navigation,
    _,
  ])

  // No-op handlers for TextInput
  const noOpPhoto = useCallback(() => {}, [])
  const noOpLink = useCallback(() => {}, [])
  const noOpError = useCallback(() => {}, [])
  const noOpPublish = useCallback(() => {}, [])
  const noOpFocus = useCallback(() => {}, [])

  const handleShareToggle = useCallback((values: string[]) => {
    setShareAsPost(values.includes('shareAsPost'))
  }, [])

  // const handleAudienceToggle = useCallback(() => {
  //   setAudience(prev => (prev === 'public' ? 'trusted' : 'public'))
  // }, [])

  const handleSignIn = useCallback(() => {
    closeAllActiveElements()
    requestSwitchToAccount({requestedAccount: 'none'})
  }, [closeAllActiveElements, requestSwitchToAccount])

  const handleCreateAccount = useCallback(() => {
    closeAllActiveElements()
    requestSwitchToAccount({requestedAccount: 'new'})
  }, [closeAllActiveElements, requestSwitchToAccount])

  const thankYouMessage = useMemo(() => {
    // localStorage donation: show specific amount message
    if (donationInfo) {
      return donationInfo.monthly
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
    }

    // API-based supporter: build contribution-aware message
    const contributions = contributionData?.contributions ?? []
    const isDonor = contributions.includes('donor')
    const volunteerLabels = contributions
      .filter(c => c !== 'donor')
      .map(c => CONTRIBUTION_LABELS[c])
      .filter(Boolean)

    if (isDonor && volunteerLabels.length > 0) {
      return _(
        msg`Thank you for donating and contributing ${formatList(
          volunteerLabels,
        )} to Speakeasy`,
      )
    }
    if (isDonor) {
      return _(msg`Thank you for donating to Speakeasy`)
    }
    if (volunteerLabels.length > 0) {
      return _(
        msg`Thank you for contributing ${formatList(
          volunteerLabels,
        )} to Speakeasy`,
      )
    }
    return _(msg`Thank you for contributing to Speakeasy`)
  }, [donationInfo, contributionData, _])

  // Show loading state while checking contribution status
  if (hasSession && isStillLoading) {
    return (
      <View testID={testID} style={style}>
        <View style={[a.flex_col, a.align_center, a.gap_lg, a.w_full, a.px_lg]}>
          <View style={[a.pt_5xl, a.pb_xl]}>
            <Loader size="xl" />
          </View>
        </View>
      </View>
    )
  }

  // Show sign-in prompt if not logged in
  if (!hasSession) {
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

          <Text
            style={[
              t.atoms.text_contrast_medium,
              a.text_md,
              a.pt_md,
              a.self_start,
            ]}>
            <Trans>Sign in to share why you support Speakeasy</Trans>
          </Text>

          <View style={[a.w_full, a.flex_col, a.gap_md, a.pt_lg]}>
            <Button
              variant="solid"
              color="primary"
              size="large"
              onPress={handleCreateAccount}
              label={_(msg`Create an account`)}>
              <ButtonText>
                <Trans>Create an account</Trans>
              </ButtonText>
            </Button>

            <Button
              variant="solid"
              color="secondary"
              size="large"
              onPress={handleSignIn}
              label={_(msg`Sign in`)}>
              <ButtonText>
                <Trans>Sign in</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
      </View>
    )
  }

  // Show error if signed-in user arrived without being a contributor
  if (!isValidContributor) {
    return (
      <View testID={testID} style={style}>
        <View style={[a.flex_col, a.align_center, a.gap_lg, a.w_full, a.px_lg]}>
          <Text style={[t.atoms.text, a.text_2xl, a.pt_5xl, a.self_start]}>
            <Trans>Something went wrong</Trans>
          </Text>
          <Text
            style={[
              t.atoms.text_contrast_medium,
              a.text_md,
              a.pt_md,
              a.self_start,
            ]}>
            <Trans>We're not sure how you got here.</Trans>
          </Text>
          <View style={[a.w_full, a.pt_lg]}>
            <Button
              variant="solid"
              color="secondary"
              size="large"
              onPress={() => navigation.navigate('Home')}
              label={_(msg`Home`)}>
              <ButtonText>
                <Trans>Home</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
      </View>
    )
  }

  // Signed in and valid contributor - show testimony form
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
              autoFocus={false}
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

          {/* This toggle is misleading unless we also implement private testimony's (otherwise while shared privately, the testimony itself will be public */}
          {/* shareAsPost && (
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
          ) */}
        </View>

        <View style={[a.w_full, a.pt_lg]}>
          <Button
            onPress={handleSave}
            size="large"
            color="primary"
            variant="solid"
            disabled={
              isTextEmpty || isSaving || graphemeLength > MAX_TESTIMONIAL_LENGTH
            }
            label={_(msg`Save testimonial`)}>
            {isSaving ? (
              <ButtonIcon icon={Loader} />
            ) : (
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            )}
          </Button>
        </View>
      </View>
    </View>
  )
}

import React from 'react'
import {Pressable, View} from 'react-native'
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {useKawaiiMode} from '#/state/preferences/kawaii'
import {ErrorBoundary} from '#/view/com/util/ErrorBoundary'
import {Logo} from '#/view/icons/Logo'
import {Logotype} from '#/view/icons/Logotype'
import {
  AppClipOverlay,
  postAppClipMessage,
} from '#/screens/StarterPack/StarterPackLandingScreen'
import {atoms as a, useTheme} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {Button, ButtonText} from '#/components/Button'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'
import {CenteredView} from '../util/Views'

export const SplashScreen = ({
  onDismiss,
  onPressSignin,
  onPressCreateAccount
}:
{
  onDismiss?: () => void
  onPressSignin: () => void
  onPressCreateAccount: () => void
}) => {
  const {_} = useLingui()
  const t = useTheme()
  const {isTabletOrMobile: isMobileWeb} = useWebMediaQueries()
  const [showClipOverlay, setShowClipOverlay] = React.useState(false)

  React.useEffect(() => {
    const getParams = new URLSearchParams(window.location.search)
    const clip = getParams.get('clip')
    if (clip === 'true') {
      setShowClipOverlay(true)
      postAppClipMessage({
        action: 'present',
      })
    }
  }, [])

  const kawaii = useKawaiiMode()

  return (
    <>
      {onDismiss && (
        <Pressable
          accessibilityRole="button"
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: 20,
            zIndex: 100,
          }}
          onPress={onDismiss}>
          <FontAwesomeIcon
            icon="x"
            size={24}
            style={{
              color: String(t.atoms.text.color),
            }}
          />
        </Pressable>
      )}

      <CenteredView style={[a.h_full, a.flex_1]}>
        <View
          testID="noSessionView"
          style={[
            a.h_full,
            a.justify_center,
            // @ts-ignore web only
            {paddingBottom: '20vh'},
            isMobileWeb && a.pb_5xl,
            t.atoms.border_contrast_medium,
            a.align_center,
            a.gap_5xl,
            a.flex_1,
          ]}>
          <ErrorBoundary>
            <View style={[a.justify_center, a.align_center]}>
              <Logo width={kawaii ? 300 : 92} fill="sky" />

              {!kawaii && (
                <View style={[a.pb_sm, a.pt_5xl]}>
                  <Logotype width={161} fill={t.atoms.text.color} />
                </View>
              )}

              <Text
                style={[a.text_md, a.font_bold, t.atoms.text_contrast_medium]}>
                <Trans>By us, for us</Trans>
              </Text>

              <View
                style={[
                  a.mt_2xl,
                  a.self_center,
                  {
                    width: '80%',
                    maxWidth: 500,
                    minWidth: 280,
                  },
                ]}>
                <View
                  style={[
                    a.px_md,
                    a.py_sm,
                    a.rounded_sm,
                    a.border,
                    t.atoms.bg_contrast_25,
                    t.atoms.border_contrast_low,
                    a.align_center,
                  ]}>
                  <View style={[a.gap_sm]}>
                    <Text
                      style={[a.leading_normal, t.atoms.text_contrast_medium]}>
                      <Trans>Welcome to the Beta Release!</Trans>
                    </Text>
                    <Text
                      style={[a.leading_normal, t.atoms.text_contrast_medium]}>
                      <Trans>
                        We plan to add signup support soon, but for now, you can
                        sign in with your Bluesky account.
                      </Trans>
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View
              testID="signinOrCreateAccount"
              style={[a.w_full, a.px_xl, a.gap_md, a.pb_2xl, {maxWidth: 320}]}>
              <Button
                testID="signInButton"
                onPress={onPressSignin}
                label={_(msg`Sign in to Speakeasy`)}
                accessibilityHint={_(
                  msg`Opens flow to sign into your existing Bluesky account`,
                )}
                size="large"
                variant="solid"
                color="primary">
                <ButtonText>
                  <Trans>Sign in to Speakeasy</Trans>
                </ButtonText>
              </Button>
              <Button
                testID="createAccountButton"
                onPress={onPressCreateAccount}
                label={_(msg`Create SpeakEasy account`)}
                accessibilityHint={_(
                  msg`Opens flow to create a new SpeakEasy account`,
                )}
                size="large"
                variant="solid"
                color="bluesky">
                <ButtonText>
                  <Trans>Create a Bluesky account</Trans>
                </ButtonText>
              </Button>
            </View>
          </ErrorBoundary>
        </View>
        <Footer />
      </CenteredView>
      <AppClipOverlay
        visible={showClipOverlay}
        setIsVisible={setShowClipOverlay}
      />
    </>
  )
}

function Footer() {
  const t = useTheme()
  const {_} = useLingui()

  return (
    <View
      style={[
        a.absolute,
        a.inset_0,
        {top: 'auto'},
        a.p_xl,
        a.border_t,
        a.flex_row,
        a.flex_wrap,
        a.gap_xl,
        a.flex_1,
        t.atoms.border_contrast_medium,
      ]}>
      <InlineLinkText
        label={_(msg`Learn more about Bluesky`)}
        to="https://about.spkeasy.social">
        <Trans>About</Trans>
      </InlineLinkText>

      <View style={a.flex_1} />

      <AppLanguageDropdown />
    </View>
  )
}

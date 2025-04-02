import React, {ComponentProps} from 'react'
import {GestureResponderEvent, View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {BottomTabBarProps} from '@react-navigation/bottom-tabs'
import {StackActions} from '@react-navigation/native'

import {PressableScale} from '#/lib/custom-animations/PressableScale'
import {useDedupe} from '#/lib/hooks/useDedupe'
import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {useNavigationTabState} from '#/lib/hooks/useNavigationTabState'
import {usePalette} from '#/lib/hooks/usePalette'
import {clamp} from '#/lib/numbers'
import {getTabState, TabState} from '#/lib/routes/helpers'
import {useGate} from '#/lib/statsig/statsig'
import {emitSoftReset} from '#/state/events'
import {useHomeBadge} from '#/state/home-badge'
import {useUnreadMessageCount} from '#/state/queries/messages/list-conversations'
import {useUnreadNotifications} from '#/state/queries/notifications/unread'
import {useSession} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useShellLayout} from '#/state/shell/shell-layout'
import {useCloseAllActiveElements} from '#/state/util'
import {Text} from '#/view/com/util/text/Text'
import {Logo} from '#/view/icons/Logo'
import {Logotype} from '#/view/icons/Logotype'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {LimitedBetaModal} from '#/components/dialogs/LimitedBetaModal'
import {SwitchAccountDialog} from '#/components/dialogs/SwitchAccount'
import {
  Bell_Filled_Corner0_Rounded as BellFilled,
  Bell_Stroke2_Corner0_Rounded as Bell,
} from '#/components/icons/Bell'
import {Group3_Stroke2_Corner0_Rounded as Group} from '#/components/icons/Group'
import {Heart2_Stroke2_Corner0_Rounded as Heart} from '#/components/icons/Heart2'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilled,
  HomeOpen_Stoke2_Corner0_Rounded as Home,
} from '#/components/icons/HomeOpen'
import {MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as MagnifyingGlassFilled} from '#/components/icons/MagnifyingGlass'
import {MagnifyingGlass2_Stroke2_Corner0_Rounded as MagnifyingGlass} from '#/components/icons/MagnifyingGlass2'
import {
  Message_Stroke2_Corner0_Rounded as Message,
  Message_Stroke2_Corner0_Rounded_Filled as MessageFilled,
} from '#/components/icons/Message'
import {styles} from './BottomBarStyles'

type TabOptions =
  | 'Home'
  | 'Search'
  | 'Notifications'
  | 'MyProfile'
  | 'Feeds'
  | 'Messages'
  | 'Groups'

export function BottomBar({navigation}: BottomTabBarProps) {
  const {hasSession} = useSession()
  const {isAtHome} = useNavigationTabState()
  const pal = usePalette('default')
  const {_} = useLingui()
  const safeAreaInsets = useSafeAreaInsets()
  const {footerHeight} = useShellLayout()
  const {isAtSearch, isAtNotifications, isAtMessages} = useNavigationTabState()
  const numUnreadNotifications = useUnreadNotifications()
  const numUnreadMessages = useUnreadMessageCount()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const {requestSwitchToAccount, setShowLoggedOut} = useLoggedOutViewControls()
  const closeAllActiveElements = useCloseAllActiveElements()
  const dedupe = useDedupe()
  const accountSwitchControl = useDialogControl()
  const hasHomeBadge = useHomeBadge()
  const gate = useGate()
  const iconWidth = 28
  const groupsDialogControl = useDialogControl()
  const [selectedFeature, setSelectedFeature] = React.useState<
    'groups' | 'mutual-aid'
  >('groups')

  const showSignIn = React.useCallback(() => {
    closeAllActiveElements()
    requestSwitchToAccount({requestedAccount: 'none'})
  }, [requestSwitchToAccount, closeAllActiveElements])

  const showCreateAccount = React.useCallback(() => {
    closeAllActiveElements()
    requestSwitchToAccount({requestedAccount: 'new'})
    // setShowLoggedOut(true)
  }, [requestSwitchToAccount, closeAllActiveElements])

  const onPressTab = React.useCallback(
    (tab: TabOptions) => {
      const state = navigation.getState()
      const tabState = getTabState(state, tab)
      if (tabState === TabState.InsideAtRoot) {
        emitSoftReset()
      } else if (tabState === TabState.Inside) {
        dedupe(() => navigation.dispatch(StackActions.popToTop()))
      } else {
        dedupe(() => navigation.navigate(`${tab}Tab`))
      }
    },
    [navigation, dedupe],
  )
  const onPressHome = React.useCallback(() => onPressTab('Home'), [onPressTab])
  const onPressSearch = React.useCallback(
    () => onPressTab('Search'),
    [onPressTab],
  )
  const onPressNotifications = React.useCallback(
    () => onPressTab('Notifications'),
    [onPressTab],
  )
  const onPressMessages = React.useCallback(() => {
    onPressTab('Messages')
  }, [onPressTab])

  // Check if the current route is the Intent route
  const isIntentScreen = isAtHome // Adjust this logic based on actual route checking

  // Conditionally render the bottom bar
  if (hasSession && isIntentScreen) {
    return null
  }

  return (
    <>
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
          source: 'bottombar',
          medium:
            selectedFeature === 'groups'
              ? 'groups_button'
              : 'mutual_aid_button',
          campaign:
            selectedFeature === 'groups' ? 'groups_beta' : 'mutual_aid_beta',
        }}
      />
      <SwitchAccountDialog control={accountSwitchControl} />

      <Animated.View
        style={[
          styles.bottomBar,
          pal.view,
          pal.border,
          {paddingBottom: clamp(safeAreaInsets.bottom, 15, 60)},
          footerMinimalShellTransform,
        ]}
        onLayout={e => {
          footerHeight.set(e.nativeEvent.layout.height)
        }}>
        {hasSession ? (
          <>
            <Btn
              testID="bottomBarHomeBtn"
              icon={
                isAtHome ? (
                  <HomeFilled
                    width={iconWidth + 1}
                    style={[styles.ctrlIcon, pal.text, styles.homeIcon]}
                  />
                ) : (
                  <Home
                    width={iconWidth + 1}
                    style={[styles.ctrlIcon, pal.text, styles.homeIcon]}
                  />
                )
              }
              hasNew={hasHomeBadge && gate('remove_show_latest_button')}
              onPress={onPressHome}
              accessibilityRole="tab"
              accessibilityLabel={_(msg`Home`)}
              accessibilityHint=""
            />
            <Btn
              icon={
                isAtSearch ? (
                  <MagnifyingGlassFilled
                    width={iconWidth + 2}
                    style={[styles.ctrlIcon, pal.text, styles.searchIcon]}
                  />
                ) : (
                  <MagnifyingGlass
                    testID="bottomBarSearchBtn"
                    width={iconWidth + 2}
                    style={[styles.ctrlIcon, pal.text, styles.searchIcon]}
                  />
                )
              }
              onPress={onPressSearch}
              accessibilityRole="search"
              accessibilityLabel={_(msg`Search`)}
              accessibilityHint=""
            />
            <Btn
              testID="bottomBarGroupsBtn"
              icon={
                <Group width={iconWidth} style={[styles.ctrlIcon, pal.text]} />
              }
              onPress={() => {
                setSelectedFeature('groups')
                groupsDialogControl.open()
              }}
              accessibilityRole="button"
              accessibilityLabel={_(msg`Groups`)}
              accessibilityHint=""
            />
            <Btn
              testID="bottomBarMutualAidBtn"
              icon={
                <Heart width={iconWidth} style={[styles.ctrlIcon, pal.text]} />
              }
              onPress={() => {
                setSelectedFeature('mutual-aid')
                groupsDialogControl.open()
              }}
              notificationCount="1"
              accessibilityRole="button"
              accessibilityLabel={_(msg`Mutual Aid`)}
              accessibilityHint=""
            />
            <Btn
              testID="bottomBarMessagesBtn"
              icon={
                isAtMessages ? (
                  <MessageFilled
                    width={iconWidth - 1}
                    style={[styles.ctrlIcon, pal.text, styles.feedsIcon]}
                  />
                ) : (
                  <Message
                    width={iconWidth - 1}
                    style={[styles.ctrlIcon, pal.text, styles.feedsIcon]}
                  />
                )
              }
              onPress={onPressMessages}
              notificationCount={numUnreadMessages.numUnread}
              accessible={true}
              accessibilityRole="tab"
              accessibilityLabel={_(msg`Chat`)}
              accessibilityHint={
                numUnreadMessages.count > 0
                  ? _(msg`${numUnreadMessages.numUnread} unread items`)
                  : ''
              }
            />
            <Btn
              testID="bottomBarNotificationsBtn"
              icon={
                isAtNotifications ? (
                  <BellFilled
                    width={iconWidth}
                    style={[styles.ctrlIcon, pal.text, styles.bellIcon]}
                  />
                ) : (
                  <Bell
                    width={iconWidth}
                    style={[styles.ctrlIcon, pal.text, styles.bellIcon]}
                  />
                )
              }
              onPress={onPressNotifications}
              notificationCount={numUnreadNotifications}
              accessible={true}
              accessibilityRole="tab"
              accessibilityLabel={_(msg`Notifications`)}
              accessibilityHint={
                numUnreadNotifications === ''
                  ? ''
                  : _(msg`${numUnreadNotifications} unread items`)
              }
            />
          </>
        ) : (
          <>
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 14,
                paddingBottom: 2,
                paddingLeft: 14,
                paddingRight: 6,
                gap: 8,
              }}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Logo width={28} />
                <View style={{paddingTop: 4}}>
                  <Logotype width={80} fill={pal.text.color} />
                </View>
              </View>

              <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
                <Button
                  onPress={showCreateAccount}
                  label={_(msg`Create account`)}
                  size="small"
                  variant="solid"
                  color="primary">
                  <ButtonText>
                    <Trans>Create account</Trans>
                  </ButtonText>
                </Button>
                <Button
                  onPress={showSignIn}
                  label={_(msg`Sign in`)}
                  size="small"
                  variant="solid"
                  color="secondary">
                  <ButtonText>
                    <Trans>Sign in</Trans>
                  </ButtonText>
                </Button>
              </View>
            </View>
          </>
        )}
      </Animated.View>
    </>
  )
}

interface BtnProps
  extends Pick<
    ComponentProps<typeof PressableScale>,
    | 'accessible'
    | 'accessibilityRole'
    | 'accessibilityHint'
    | 'accessibilityLabel'
  > {
  testID?: string
  icon: JSX.Element
  notificationCount?: string
  hasNew?: boolean
  onPress?: (event: GestureResponderEvent) => void
  onLongPress?: (event: GestureResponderEvent) => void
}

function Btn({
  testID,
  icon,
  hasNew,
  notificationCount,
  onPress,
  onLongPress,
  accessible,
  accessibilityHint,
  accessibilityLabel,
}: BtnProps) {
  return (
    <PressableScale
      testID={testID}
      style={[styles.ctrl, a.flex_1]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      targetScale={0.8}>
      {icon}
      {notificationCount ? (
        <View style={[styles.notificationCount, a.rounded_full]}>
          <Text style={styles.notificationCountLabel}>{notificationCount}</Text>
        </View>
      ) : hasNew ? (
        <View style={[styles.hasNewBadge, a.rounded_full]} />
      ) : null}
    </PressableScale>
  )
}

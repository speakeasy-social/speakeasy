import React from 'react'
import {View} from 'react-native'
import {GestureResponderEvent} from 'react-native'
import Animated from 'react-native-reanimated'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigationState} from '@react-navigation/native'

import {IntentionFilter} from '#/lib/hooks/useIntention'
import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {getCurrentRoute, isTab} from '#/lib/routes/helpers'
import {CommonNavigatorParams} from '#/lib/routes/types'
import {useGate} from '#/lib/statsig/statsig'
import {useHomeBadge} from '#/state/home-badge'
import {useUnreadMessageCount} from '#/state/queries/messages/list-conversations'
import {useUnreadNotifications} from '#/state/queries/notifications/unread'
import {useSession} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useCloseAllActiveElements} from '#/state/util'
import {Link} from '#/view/com/util/Link'
import {Logo} from '#/view/icons/Logo'
import {Logotype} from '#/view/icons/Logotype'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {LimitedBetaModal} from '#/components/dialogs/LimitedBetaModal'
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
import {Text} from '#/components/Typography'
import {styles} from './BottomBarStyles'

export function BottomBarWeb() {
  const {_} = useLingui()
  const {hasSession} = useSession()
  const t = useTheme()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const {requestSwitchToAccount} = useLoggedOutViewControls()
  const closeAllActiveElements = useCloseAllActiveElements()
  const iconWidth = 26

  const unreadMessageCount = useUnreadMessageCount()
  const notificationCountStr = useUnreadNotifications()
  const hasHomeBadge = useHomeBadge()
  const gate = useGate()
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
      <Animated.View
        role="navigation"
        style={[
          styles.bottomBar,
          styles.bottomBarWeb,
          t.atoms.bg,
          t.atoms.border_contrast_low,
          footerMinimalShellTransform,
        ]}>
        {hasSession ? (
          <>
            <NavItem
              routeName="Intent"
              href="/"
              hasNew={hasHomeBadge && gate('remove_show_latest_button')}>
              {({isActive}) => {
                const Icon = isActive ? HomeFilled : Home
                return (
                  <Icon
                    aria-hidden={true}
                    width={iconWidth + 1}
                    style={[styles.ctrlIcon, t.atoms.text, styles.homeIcon]}
                  />
                )
              }}
            </NavItem>
            <IntentionFilter routeName="Search">
              <NavItem routeName="Search" href="/search">
                {({isActive}) => {
                  const Icon = isActive
                    ? MagnifyingGlassFilled
                    : MagnifyingGlass
                  return (
                    <Icon
                      aria-hidden={true}
                      width={iconWidth + 2}
                      style={[styles.ctrlIcon, t.atoms.text, styles.searchIcon]}
                    />
                  )
                }}
              </NavItem>
            </IntentionFilter>
            <IntentionFilter routeName="Groups">
              <NavItem
                routeName="Groups"
                href="#"
                onClick={e => {
                  e.preventDefault()
                  setSelectedFeature('groups')
                  groupsDialogControl.open()
                }}>
                {() => (
                  <Group
                    aria-hidden={true}
                    width={iconWidth}
                    style={[styles.ctrlIcon, t.atoms.text]}
                  />
                )}
              </NavItem>
            </IntentionFilter>
            <IntentionFilter routeName="MutualAid">
              <NavItem
                routeName="MutualAid"
                href="#"
                notificationCount="1"
                onClick={e => {
                  e.preventDefault()
                  setSelectedFeature('mutual-aid')
                  groupsDialogControl.open()
                }}>
                {() => (
                  <Heart
                    aria-hidden={true}
                    width={iconWidth}
                    style={[styles.ctrlIcon, t.atoms.text]}
                  />
                )}
              </NavItem>
            </IntentionFilter>

            {hasSession && (
              <>
                <IntentionFilter routeName="Messages">
                  <NavItem
                    routeName="Messages"
                    href="/messages"
                    notificationCount={
                      unreadMessageCount.count > 0
                        ? unreadMessageCount.numUnread
                        : undefined
                    }>
                    {({isActive}) => {
                      const Icon = isActive ? MessageFilled : Message
                      return (
                        <Icon
                          aria-hidden={true}
                          width={iconWidth - 1}
                          style={[
                            styles.ctrlIcon,
                            t.atoms.text,
                            styles.messagesIcon,
                          ]}
                        />
                      )
                    }}
                  </NavItem>
                </IntentionFilter>
                <IntentionFilter routeName="Notifications">
                  <NavItem
                    routeName="Notifications"
                    href="/notifications"
                    notificationCount={notificationCountStr}>
                    {({isActive}) => {
                      const Icon = isActive ? BellFilled : Bell
                      return (
                        <Icon
                          aria-hidden={true}
                          width={iconWidth}
                          style={[
                            styles.ctrlIcon,
                            t.atoms.text,
                            styles.bellIcon,
                          ]}
                        />
                      )
                    }}
                  </NavItem>
                </IntentionFilter>
              </>
            )}
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
                paddingBottom: 14,
                paddingLeft: 14,
                paddingRight: 6,
                gap: 8,
              }}>
              <View
                style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                <Logo width={32} />
                <View style={{paddingTop: 4}}>
                  <Logotype width={80} fill={t.atoms.text.color} />
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

const NavItem: React.FC<{
  children: (props: {isActive: boolean}) => React.ReactChild
  href: string
  routeName: string
  hasNew?: boolean
  notificationCount?: string
  onClick?: (e: GestureResponderEvent) => void
}> = ({children, href, routeName, hasNew, notificationCount, onClick}) => {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const currentRoute = useNavigationState(state => {
    if (!state) {
      return {name: 'Home'}
    }
    return getCurrentRoute(state)
  })
  const isActive =
    currentRoute.name === 'Profile'
      ? isTab(currentRoute.name, routeName) &&
        (currentRoute.params as CommonNavigatorParams['Profile']).name ===
          currentAccount?.handle
      : isTab(currentRoute.name, routeName)

  const extra: {onPress?: (e: GestureResponderEvent) => void} = {}
  if (onClick) extra.onPress = onClick

  return (
    <Link
      href={href}
      style={[styles.ctrl, a.pb_lg]}
      navigationAction="navigate"
      aria-role="link"
      aria-label={routeName}
      accessible={true}
      {...extra}>
      {children({isActive})}
      {notificationCount ? (
        <View
          style={styles.notificationCount}
          aria-label={_(msg`${notificationCount} unread items`)}>
          <Text style={styles.notificationCountLabel}>{notificationCount}</Text>
        </View>
      ) : hasNew ? (
        <View style={styles.hasNewBadge} />
      ) : null}
    </Link>
  )
}

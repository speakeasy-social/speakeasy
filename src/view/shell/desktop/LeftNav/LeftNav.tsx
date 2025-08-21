import React from 'react'
import {StyleSheet, View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {IntentionFilter} from '#/lib/hooks/useIntention'
import {usePalette} from '#/lib/hooks/usePalette'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {makeProfileLink} from '#/lib/routes/links'
import {useGate} from '#/lib/statsig/statsig'
import {useHomeBadge} from '#/state/home-badge'
import {useSession} from '#/state/session'
import {NavSignupCard} from '#/view/shell/NavSignupCard'
import {atoms as a} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {LimitedBetaModal} from '#/components/dialogs/LimitedBetaModal'
import {
  Bell_Filled_Corner0_Rounded as BellFilled,
  Bell_Stroke2_Corner0_Rounded as Bell,
} from '#/components/icons/Bell'
import {
  BulletList_Filled_Corner0_Rounded as ListFilled,
  BulletList_Stroke2_Corner0_Rounded as List,
} from '#/components/icons/BulletList'
import {
  Group3_Stroke2_Corner0_Rounded as Group,
  Group3_Stroke2_Corner0_Rounded as GroupFilled,
} from '#/components/icons/Group'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartFilled,
  Heart2_Stroke2_Corner0_Rounded as Heart,
} from '#/components/icons/Heart2'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilled,
  HomeOpen_Stoke2_Corner0_Rounded as Home,
} from '#/components/icons/HomeOpen'
import {MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as MagnifyingGlassFilled} from '#/components/icons/MagnifyingGlass'
import {MagnifyingGlass2_Stroke2_Corner0_Rounded as MagnifyingGlass} from '#/components/icons/MagnifyingGlass2'
import {News2_Stroke2_Corner0_Rounded as News} from '#/components/icons/News2'
import {
  SettingsGear2_Filled_Corner0_Rounded as SettingsFilled,
  SettingsGear2_Stroke2_Corner0_Rounded as Settings,
} from '#/components/icons/SettingsGear2'
import {
  UserCircle_Filled_Corner0_Rounded as UserCircleFilled,
  UserCircle_Stroke2_Corner0_Rounded as UserCircle,
} from '#/components/icons/UserCircle'
import ChatNavItem from './ChatNavItem'
import ComposeBtn from './ComposeBtn'
import {NAV_ICON_WIDTH} from './constants'
import NavItem from './NavItem'
import ProfileCard from './ProfileCard'
//import {VideoClip_Stroke2_Corner0_Rounded as VideoClipIcon} from '#/components/icons/VideoClip'

export function LeftNav() {
  const {hasSession, currentAccount} = useSession()
  const pal = usePalette('default')
  const {_} = useLingui()
  const {isDesktop, isTablet} = useWebMediaQueries()
  const hasHomeBadge = useHomeBadge()
  const gate = useGate()
  const groupsDialogControl = useDialogControl()
  const [selectedFeature, setSelectedFeature] = React.useState<
    'groups' | 'mutual-aid'
  >('groups')

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
          source: 'leftnav',
          medium:
            selectedFeature === 'groups'
              ? 'groups_button'
              : 'mutual_aid_button',
          campaign:
            selectedFeature === 'groups' ? 'groups_beta' : 'mutual_aid_beta',
        }}
      />
      <View
        role="navigation"
        style={[
          a.px_xl,
          styles.leftNav,
          isTablet && styles.leftNavTablet,
          pal.border,
        ]}>
        {hasSession ? (
          <ProfileCard />
        ) : isDesktop ? (
          <View style={[a.pt_xl]}>
            <NavSignupCard />
          </View>
        ) : null}

        {hasSession && (
          <>
            <NavItem
              href="/"
              hasNew={hasHomeBadge && gate('remove_show_latest_button')}
              icon={
                <Home
                  aria-hidden={true}
                  width={NAV_ICON_WIDTH}
                  style={pal.text}
                />
              }
              iconFilled={
                <HomeFilled
                  aria-hidden={true}
                  width={NAV_ICON_WIDTH}
                  style={pal.text}
                />
              }
              label={_(msg`Home`)}
            />
            <IntentionFilter routeName="Feed">
              <NavItem
                href="/feed"
                hasNew={hasHomeBadge && gate('remove_show_latest_button')}
                icon={
                  <News
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                iconFilled={
                  <News
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                label={_(msg`Feed`)}
              />
            </IntentionFilter>
            <IntentionFilter routeName="Search">
              <NavItem
                href="/search"
                icon={
                  <MagnifyingGlass
                    style={pal.text}
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                  />
                }
                iconFilled={
                  <MagnifyingGlassFilled
                    style={pal.text}
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                  />
                }
                label={_(msg`Search`)}
              />
            </IntentionFilter>
            <IntentionFilter routeName="Notifications">
              <NavItem
                href="/notifications"
                icon={
                  <Bell
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                iconFilled={
                  <BellFilled
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                label={_(msg`Notifications`)}
              />
            </IntentionFilter>
            <IntentionFilter routeName="Messages">
              <ChatNavItem />
            </IntentionFilter>
            <IntentionFilter routeName="Groups">
              <NavItem
                href="/groups"
                icon={
                  <Group
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                iconFilled={
                  <GroupFilled
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                label={_(msg`Groups`)}
                onPress={() => {
                  setSelectedFeature('groups')
                  groupsDialogControl.open()
                }}
              />
            </IntentionFilter>
            <IntentionFilter routeName="Mutual">
              <NavItem
                href="/mutual"
                icon={
                  <Heart
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                iconFilled={
                  <HeartFilled
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                label={_(msg`Mutual Aid`)}
                onPress={() => {
                  setSelectedFeature('mutual-aid')
                  groupsDialogControl.open()
                }}
              />
            </IntentionFilter>
            {/* <IntentionFilter routeName="VideoFeed">
              <NavItem
                href="/reels"
                count="1"
                icon={
                  <VideoClipIcon
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                iconFilled={
                  <VideoClipIcon
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                label={_(msg`Reels`)}
                onPress={() => {
                  setSelectedFeature('mutual-aid')
                  groupsDialogControl.open()
                }}
              />
            </IntentionFilter> */}
            <IntentionFilter routeName="Lists">
              <NavItem
                href="/lists"
                icon={
                  <List
                    style={pal.text}
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                  />
                }
                iconFilled={
                  <ListFilled
                    style={pal.text}
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                  />
                }
                label={_(msg`Lists`)}
              />
            </IntentionFilter>
            <IntentionFilter routeName="Profile">
              <NavItem
                href={currentAccount ? makeProfileLink(currentAccount) : '/'}
                icon={
                  <UserCircle
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                iconFilled={
                  <UserCircleFilled
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                label={_(msg`Profile`)}
              />
            </IntentionFilter>
            <IntentionFilter routeName="Settings">
              <NavItem
                href="/settings"
                icon={
                  <Settings
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                iconFilled={
                  <SettingsFilled
                    aria-hidden={true}
                    width={NAV_ICON_WIDTH}
                    style={pal.text}
                  />
                }
                label={_(msg`Settings`)}
              />
            </IntentionFilter>

            <ComposeBtn />
          </>
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  leftNav: {
    // @ts-ignore web only
    position: 'fixed',
    top: 10,
    // @ts-ignore web only
    left: '50%',
    transform: [
      {
        translateX: -300,
      },
      {
        translateX: '-100%',
      },
      ...a.scrollbar_offset.transform,
    ],
    width: 240,
    // @ts-ignore web only
    maxHeight: 'calc(100vh - 10px)',
    overflowY: 'auto',
  },
  leftNavTablet: {
    top: 0,
    left: 0,
    right: 'auto',
    borderRightWidth: 1,
    height: '100%',
    width: 76,
    paddingLeft: 0,
    paddingRight: 0,
    alignItems: 'center',
    transform: [],
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
  },
})

import React from 'react'
import {StyleSheet, View} from 'react-native'

import {IntentionFilter} from '#/lib/hooks/useIntention'
import {usePalette} from '#/lib/hooks/usePalette'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {useGate} from '#/lib/statsig/statsig'
import {useHomeBadge} from '#/state/home-badge'
import {useSession} from '#/state/session'
import {NavSignupCard} from '#/view/shell/NavSignupCard'
import {atoms as a} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import ComposeBtn from './ComposeBtn'
import {
  Chat,
  Feed,
  Groups,
  Home,
  Lists,
  MutualAid,
  Notifications,
  Profile,
  Search,
  Settings,
} from './items'
import Modal from './Modal'
import ProfileCard from './ProfileCard'

export function LeftNav() {
  const {hasSession} = useSession()
  const pal = usePalette('default')
  const {isDesktop, isTablet} = useWebMediaQueries()
  const hasHomeBadge = useHomeBadge()
  const gate = useGate()
  const groupsDialogControl = useDialogControl()
  const [selectedFeature, setSelectedFeature] = React.useState<
    'groups' | 'mutual-aid'
  >('groups')

  return (
    <>
      <Modal
        groupsDialogControl={groupsDialogControl}
        selectedFeature={selectedFeature}
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
            <Home gate={gate} hasHomeBadge={hasHomeBadge} />
            <IntentionFilter routeName="Feed">
              <Feed gate={gate} hasHomeBadge={hasHomeBadge} />
            </IntentionFilter>
            <IntentionFilter routeName="Search">
              <Search />
            </IntentionFilter>
            <IntentionFilter routeName="Notifications">
              <Notifications />
            </IntentionFilter>
            <IntentionFilter routeName="Messages">
              <Chat />
            </IntentionFilter>
            <IntentionFilter routeName="Groups">
              <Groups
                onPress={() => {
                  setSelectedFeature('groups')
                  groupsDialogControl.open()
                }}
              />
            </IntentionFilter>
            <IntentionFilter routeName="Mutual">
              <MutualAid
                onPress={() => {
                  setSelectedFeature('mutual-aid')
                  groupsDialogControl.open()
                }}
              />
            </IntentionFilter>
            <IntentionFilter routeName="Lists">
              <Lists />
            </IntentionFilter>
            <IntentionFilter routeName="Profile">
              <Profile />
            </IntentionFilter>
            <IntentionFilter routeName="Settings">
              <Settings />
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

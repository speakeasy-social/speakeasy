import React from 'react'
import {ScrollView, StyleSheet, Text, View} from 'react-native'

import {useIntention} from '#/lib/hooks/useIntention'
import {usePalette} from '#/lib/hooks/usePalette'
import {useSession} from '#/state/session'
import {useComposerControls} from '#/state/shell/composer'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {Logo} from '#/view/icons/Logo'
import {atoms as a, useTheme} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {LimitedBetaModal} from '#/components/dialogs/LimitedBetaModal'
// import {Bell_Stroke2_Corner0_Rounded as Bell} from '#/components/icons/Bell'
import {EditBig_Stroke2_Corner0_Rounded as EditBig} from '#/components/icons/EditBig'
// import {Explosion_Stroke2_Corner0_Rounded as Explosion} from '#/components/icons/Explosion'
// import {Group3_Stroke2_Corner0_Rounded as Group} from '#/components/icons/Group'
// import {Heart2_Stroke2_Corner0_Rounded as Heart} from '#/components/icons/Heart2'
import {MagnifyingGlass2_Stroke2_Corner0_Rounded as MagnifyingGlass} from '#/components/icons/MagnifyingGlass2'
import {Message_Stroke2_Corner0_Rounded as Message} from '#/components/icons/Message'
import {News2_Stroke2_Corner0_Rounded as News} from '#/components/icons/News2'
// import {SettingsGear2_Stroke2_Corner0_Rounded as Settings} from '#/components/icons/SettingsGear2'
// import {UserCircle_Stroke2_Corner0_Rounded as UserCircle} from '#/components/icons/UserCircle'
// import {VideoClip_Stroke2_Corner0_Rounded as VideoClipIcon} from '#/components/icons/VideoClip'
import {TitleText} from '#/components/Layout/Header'
import {navigate} from '../Navigation'

const NAV_ICON_WIDTH = 50

const ActionItem = ({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
}) => {
  const theme = useTheme()
  const pal = usePalette('default')

  return (
    <PressableWithHover
      style={[
        a.align_center,
        a.p_md,
        a.rounded_sm,
        a.gap_sm,
        a.outline_inset_1,
        a.transition_color,
        styles.actionItem,
      ]}
      onPress={onPress}
      role="link"
      hoverStyle={theme.atoms.bg_contrast_25}
      accessibilityLabel={label}
      accessibilityHint="">
      <View
        style={[
          a.align_center,
          a.justify_center,
          a.z_10,
          {
            width: NAV_ICON_WIDTH,
            height: NAV_ICON_WIDTH,
          },
        ]}>
        {icon}
      </View>
      <Text
        style={[
          a.text_xl,
          a.font_normal,
          a.mt_md,
          {color: pal.text.color, textAlign: 'center'},
        ]}>
        {label}
      </Text>
    </PressableWithHover>
  )
}

const IntentScreen = () => {
  const {openComposer} = useComposerControls()
  const groupsDialogControl = useDialogControl()
  const [selectedFeature /*, setSelectedFeature */] = React.useState<
    'groups' | 'mutual-aid'
  >('groups')
  const {setIntention} = useIntention()

  // const handleFeatureSelect = (feature: 'groups' | 'mutual-aid') => {
  //   setSelectedFeature(feature)
  //   setIntention(feature)
  //   groupsDialogControl.open()
  // }

  const onIntentionPress = (feature: string, intent?: string) => {
    setIntention(intent || feature)
    navigate(feature)
  }

  const {hasSession} = useSession()
  const {setShowLoggedOut} = useLoggedOutViewControls()

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={[a.px_xl, styles.container]} role="navigation">
        <Logo full width={360} style={{maxWidth: '70%', ...a.mb_xl}} />
        <TitleText style={{...styles.title, ...a.mb_xl}}>
          What do you want to do?
        </TitleText>
        <View style={styles.grid}>
          <ActionItem
            icon={<News width={NAV_ICON_WIDTH} aria-hidden={true} />}
            label="Scroll"
            onPress={() => onIntentionPress('Feed')}
          />
          {/* <ActionItem
            icon={<VideoClipIcon width={NAV_ICON_WIDTH} aria-hidden={true} />}
            label="Reels"
            onPress={() => onIntentionPress('VideoFeed')}
          /> */}
          <ActionItem
            icon={<MagnifyingGlass width={NAV_ICON_WIDTH} aria-hidden={true} />}
            label="Search"
            onPress={() => onIntentionPress('Search')}
          />
          {/* <ActionItem
            icon={<Group width={NAV_ICON_WIDTH} aria-hidden={true} />}
            label="Groups"
            onPress={() => handleFeatureSelect('groups')}
          /> */}
          {/* <ActionItem
            icon={<Explosion width={NAV_ICON_WIDTH} aria-hidden={true} />}
            label="Everything"
            onPress={() => onIntentionPress('Home', 'Everything')}
          /> */}
          <ActionItem
            icon={<EditBig width={NAV_ICON_WIDTH} aria-hidden={true} />}
            label="Post"
            onPress={() => {
              if (hasSession) {
                openComposer('default')
              } else {
                setShowLoggedOut(true)
              }
            }}
          />
          <ActionItem
            icon={<Message width={NAV_ICON_WIDTH} aria-hidden={true} />}
            label="Chat"
            onPress={() => onIntentionPress('Messages')}
          />
          {/* <ActionItem
            icon={<Heart width={NAV_ICON_WIDTH} aria-hidden={true} />}
            label="Mutual Aid"
            onPress={() => handleFeatureSelect('mutual-aid')}
          /> */}
        </View>
        <LimitedBetaModal
          control={groupsDialogControl}
          featureName={selectedFeature === 'groups' ? 'Groups' : 'Mutual Aid'}
          featureDescription={
            selectedFeature === 'groups'
              ? "We're trialing a new feature to support private discussion groups."
              : "We're working on a new feature to support mutual aid."
          }
          utmParams={{
            source: 'intent-screen',
            medium:
              selectedFeature === 'groups'
                ? 'groups_button'
                : 'mutual_aid_button',
            campaign:
              selectedFeature === 'groups' ? 'groups_beta' : 'mutual_aid_beta',
          }}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 600,
  },
  actionItem: {
    alignItems: 'center',
    margin: 10,
    flexBasis: '30%',
  },
})

export default IntentScreen

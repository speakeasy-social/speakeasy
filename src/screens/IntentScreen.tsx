import {StyleSheet, Text, View} from 'react-native'

import {usePalette} from '#/lib/hooks/usePalette'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useTheme} from '#/alf'
import {Bell_Stroke2_Corner0_Rounded as Bell} from '#/components/icons/Bell'
import {EditBig_Stroke2_Corner0_Rounded as EditBig} from '#/components/icons/EditBig'
import {Explosion_Stroke2_Corner0_Rounded as Explosion} from '#/components/icons/Explosion'
import {Group3_Stroke2_Corner0_Rounded as Group} from '#/components/icons/Group'
import {Heart2_Stroke2_Corner0_Rounded as Heart} from '#/components/icons/Heart2'
import {MagnifyingGlass2_Stroke2_Corner0_Rounded as MagnifyingGlass} from '#/components/icons/MagnifyingGlass2'
import {Message_Stroke2_Corner0_Rounded as Message} from '#/components/icons/Message'
import {News2_Stroke2_Corner0_Rounded as News} from '#/components/icons/News2'
import {VideoClip_Stroke2_Corner0_Rounded as VideoClipIcon} from '#/components/icons/VideoClip'

const NAV_ICON_WIDTH = 75

const ActionItem = ({icon, label, onPress}) => {
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
        <Text
          style={[a.text_xl, a.font_normal, a.mt_md, {color: pal.text.color}]}>
          {label}
        </Text>
      </View>
    </PressableWithHover>
  )
}

const IntentScreen = () => {
  return (
    <View style={[a.px_xl, styles.container]} role="navigation">
      <Text style={styles.title}>What do you want to do?</Text>
      <View style={styles.grid}>
        <ActionItem
          icon={<News width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Feed"
          onPress={() => console.log('Navigating to Home')}
        />
        <ActionItem
          icon={<VideoClipIcon width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Reels"
          onPress={() => console.log('Navigating to Feed')}
        />
        <ActionItem
          icon={<MagnifyingGlass width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Search"
          onPress={() => console.log('Navigating to Search')}
        />
        <ActionItem
          icon={<Group width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Groups"
          onPress={() => console.log('Navigating to Notifications')}
        />
        <ActionItem
          icon={<Explosion width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Everything"
          onPress={() => console.log('Navigating to Home')}
        />
        <ActionItem
          icon={<Bell width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Notifications"
          onPress={() => console.log('Navigating to Notifications')}
        />
        <ActionItem
          icon={<EditBig width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Post"
          onPress={() => console.log('Navigating to Profile')}
        />
        <ActionItem
          icon={<Message width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Chat"
          onPress={() => console.log('Navigating to Chat')}
        />
        <ActionItem
          icon={<Heart width={NAV_ICON_WIDTH} aria-hidden={true} />}
          label="Mutual Aid"
          onPress={() => console.log('Navigating to Profile')}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
  },
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

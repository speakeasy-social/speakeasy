import * as React from 'react'
import {ScrollView, Text, View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
// Import all icons
import {Alien_Stroke2_Corner0_Rounded as Alien} from '#/components/icons/Alien'
import {AndroidLogo} from '#/components/icons/AndroidLogo'
import {Apple_Stroke2_Corner0_Rounded as Apple} from '#/components/icons/Apple'
import {ArrowTopRight_Stroke2_Corner0_Rounded as ArrowTopRight} from '#/components/icons/Arrow'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Atom_Stroke2_Corner0_Rounded as Atom} from '#/components/icons/Atom'
import {Bell2_Stroke2_Corner0_Rounded as Bell} from '#/components/icons/Bell2'
import {BirthdayCake_Stroke2_Corner2_Rounded as BirthdayCake} from '#/components/icons/BirthdayCake'
import {BubbleInfo_Stroke2_Corner2_Rounded as BubbleInfo} from '#/components/icons/BubbleInfo'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarDays} from '#/components/icons/CalendarDays'
import {Camera_Stroke2_Corner0_Rounded as Camera} from '#/components/icons/Camera'
import {Celebrate_Stroke2_Corner0_Rounded as Celebrate} from '#/components/icons/Celebrate'
import {ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeft} from '#/components/icons/Chevron'
import {CircleInfo_Stroke2_Corner0_Rounded as CircleInfo} from '#/components/icons/CircleInfo'
import {CircleQuestion_Stroke2_Corner2_Rounded as CircleQuestion} from '#/components/icons/CircleQuestion'
import {CodeBrackets_Stroke2_Corner0_Rounded as CodeBrackets} from '#/components/icons/CodeBrackets'
import {CodeLines_Stroke2_Corner2_Rounded as CodeLines} from '#/components/icons/CodeLines'
import {Coffee_Stroke2_Corner0_Rounded as Coffee} from '#/components/icons/Coffee'
import {ColorPalette_Stroke2_Corner0_Rounded as ColorPalette} from '#/components/icons/ColorPalette'
import {Crop_Stroke2_Corner0_Rounded as Crop} from '#/components/icons/Crop'
import {DotGrid_Stroke2_Corner0_Rounded as DotGrid} from '#/components/icons/DotGrid'
import {Download_Stroke2_Corner0_Rounded as Download} from '#/components/icons/Download'
import {EditBig_Stroke2_Corner0_Rounded as EditBig} from '#/components/icons/EditBig'
import {
  EmojiArc_Stroke2_Corner0_Rounded as EmojiArc,
  EmojiHeartEyes_Stroke2_Corner0_Rounded as EmojiHeartEyes,
} from '#/components/icons/Emoji'
import {Envelope_Stroke2_Corner2_Rounded as Envelope} from '#/components/icons/Envelope'
import {Envelope_Open_Stroke2_Corner0_Rounded as EnvelopeOpen} from '#/components/icons/EnveopeOpen'
import {Explosion_Stroke2_Corner0_Rounded as Explosion} from '#/components/icons/Explosion'
import {Eye_Stroke2_Corner0_Rounded as Eye} from '#/components/icons/Eye'
import {EyeSlash_Stroke2_Corner0_Rounded as EyeSlash} from '#/components/icons/EyeSlash'
import {Filter_Stroke2_Corner0_Rounded as Filter} from '#/components/icons/Filter'
import {FilterTimeline_Stroke2_Corner0_Rounded as FilterTimeline} from '#/components/icons/FilterTimeline'
import {Flag_Stroke2_Corner0_Rounded as Flag} from '#/components/icons/Flag'
import {FlipVertical_Stroke2_Corner0_Rounded as FlipImage} from '#/components/icons/FlipImage'
import {FloppyDisk_Stroke2_Corner0_Rounded as FloppyDisk} from '#/components/icons/FloppyDisk'
import {Freeze_Stroke2_Corner2_Rounded as Freeze} from '#/components/icons/Freeze'
import {GameController_Stroke2_Corner0_Rounded as GameController} from '#/components/icons/GameController'
import {Gif_Stroke2_Corner0_Rounded as Gif} from '#/components/icons/Gif'
import {Gift1_Stroke2_Corner0_Rounded as Gift} from '#/components/icons/Gift1'
import {
  Earth_Stroke2_Corner2_Rounded as Earth,
  Globe_Stroke2_Corner0_Rounded as Globe,
} from '#/components/icons/Globe'
import {Group3_Stroke2_Corner0_Rounded as Group} from '#/components/icons/Group'
import {Growth_Stroke2_Corner0_Rounded as Growth} from '#/components/icons/Growth'
import {Haptic_Stroke2_Corner2_Rounded as Haptic} from '#/components/icons/Haptic'
import {Hashtag_Stroke2_Corner0_Rounded as Hashtag} from '#/components/icons/Hashtag'
import {Heart2_Stroke2_Corner0_Rounded as Heart} from '#/components/icons/Heart2'
import {Home_Stroke2_Corner0_Rounded as Home} from '#/components/icons/Home'
import {HomeOpen_Stoke2_Corner0_Rounded as HomeOpen} from '#/components/icons/HomeOpen'
import {Image_Stroke2_Corner0_Rounded as Image} from '#/components/icons/Image'
import {Key_Stroke2_Corner2_Rounded as Key} from '#/components/icons/Key'
import {Lab_Stroke2_Corner0_Rounded as Lab} from '#/components/icons/Lab'
import {Leaf_Stroke2_Corner0_Rounded as Leaf} from '#/components/icons/Leaf'
import {ListMagnifyingGlass_Stroke2_Corner0_Rounded as ListMagnifyingGlass} from '#/components/icons/ListMagnifyingGlass'
import {ListPlus_Stroke2_Corner0_Rounded as ListPlus} from '#/components/icons/ListPlus'
import {ListSparkle_Stroke2_Corner0_Rounded as ListSparkle} from '#/components/icons/ListSparkle'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Mark as Logo} from '#/components/icons/Logo'
import {Macintosh_Stroke2_Corner2_Rounded as Macintosh} from '#/components/icons/Macintosh'
import {MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as MagnifyingGlass} from '#/components/icons/MagnifyingGlass'
import {MagnifyingGlass2_Stroke2_Corner0_Rounded as MagnifyingGlass2} from '#/components/icons/MagnifyingGlass2'
import {Menu_Stroke2_Corner0_Rounded as Menu} from '#/components/icons/Menu'
import {Message_Stroke2_Corner0_Rounded as Message} from '#/components/icons/Message'
import {Moon_Stroke2_Corner0_Rounded as Moon} from '#/components/icons/Moon'
import {MusicNote_Stroke2_Corner0_Rounded as MusicNote} from '#/components/icons/MusicNote'
import {Mute_Stroke2_Corner0_Rounded as Mute} from '#/components/icons/Mute'
import {News2_Stroke2_Corner0_Rounded as News2} from '#/components/icons/News2'
import {Newskie} from '#/components/icons/Newskie'
import {Newspaper_Stroke2_Corner2_Rounded as Newspaper} from '#/components/icons/Newspaper'
import {PageText_Stroke2_Corner0_Rounded as PageText} from '#/components/icons/PageText'
import {PaintRoller_Stroke2_Corner2_Rounded as PaintRoller} from '#/components/icons/PaintRoller'
import {PaperPlane_Stroke2_Corner0_Rounded as PaperPlane} from '#/components/icons/PaperPlane'
import {Pause_Stroke2_Corner0_Rounded as Pause} from '#/components/icons/Pause'
import {Pencil_Stroke2_Corner0_Rounded as Pencil} from '#/components/icons/Pencil'
import {PeopleRemove2_Stroke2_Corner0_Rounded as PeopleRemove} from '#/components/icons/PeopleRemove2'
import {Person_Stroke2_Corner2_Rounded as Person} from '#/components/icons/Person'
import {Phone_Stroke2_Corner0_Rounded as Phone} from '#/components/icons/Phone'
import {PiggyBank_Stroke2_Corner0_Rounded as PiggyBank} from '#/components/icons/PiggyBank'
import {Pin_Stroke2_Corner0_Rounded as Pin} from '#/components/icons/Pin'
import {Pizza_Stroke2_Corner0_Rounded as Pizza} from '#/components/icons/Pizza'
import {Play_Stroke2_Corner0_Rounded as Play} from '#/components/icons/Play'
import {PlusLarge_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {Poop_Stroke2_Corner0_Rounded as Poop} from '#/components/icons/Poop'
import {QrCode_Stroke2_Corner0_Rounded as QrCode} from '#/components/icons/QrCode'
import {OpenQuote_Stroke2_Corner0_Rounded as Quote} from '#/components/icons/Quote'
import {RaisingHand4Finger_Stroke2_Corner2_Rounded as RaisingHand} from '#/components/icons/RaisingHand'
import {Repost_Stroke2_Corner2_Rounded as Repost} from '#/components/icons/Repost'
import {Rose_Stroke2_Corner0_Rounded as Rose} from '#/components/icons/Rose'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsGear} from '#/components/icons/SettingsGear2'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as SettingsSlider} from '#/components/icons/SettingsSlider'
import {Shaka_Stroke2_Corner0_Rounded as Shaka} from '#/components/icons/Shaka'
import {Shapes_Stroke2_Corner0_Rounded as Shapes} from '#/components/icons/Shapes'
import {Shield_Stroke2_Corner0_Rounded as Shield} from '#/components/icons/Shield'
import {SpeakerVolumeFull_Stroke2_Corner0_Rounded as Speaker} from '#/components/icons/Speaker'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as SquareArrowTopRight} from '#/components/icons/SquareArrowTopRight'
import {SquareBehindSquare4_Stroke2_Corner0_Rounded as SquareBehindSquare} from '#/components/icons/SquareBehindSquare4'
import {Star_Stroke2_Corner0_Rounded as Star} from '#/components/icons/Star'
import {StarterPack} from '#/components/icons/StarterPack'
import {StreamingLive_Stroke2_Corner0_Rounded as StreamingLive} from '#/components/icons/StreamingLive'
import {TextSize_Stroke2_Corner0_Rounded as TextSize} from '#/components/icons/TextSize'
import {Ticket_Stroke2_Corner0_Rounded as Ticket} from '#/components/icons/Ticket'
import {TimesLarge_Stroke2_Corner0_Rounded as Times} from '#/components/icons/Times'
import {TitleCase_Stroke2_Corner0_Rounded as TitleCase} from '#/components/icons/TitleCase'
import {Trash_Stroke2_Corner0_Rounded as Trash} from '#/components/icons/Trash'
import {Trending2_Stroke2_Corner2_Rounded as Trending} from '#/components/icons/Trending2'
import {UFO_Stroke2_Corner0_Rounded as UFO} from '#/components/icons/UFO'
import {UserCircle_Stroke2_Corner0_Rounded as UserCircle} from '#/components/icons/UserCircle'
import {Verified_Stroke2_Corner2_Rounded as Verified} from '#/components/icons/Verified'
import {VideoClip_Stroke2_Corner0_Rounded as VideoClip} from '#/components/icons/VideoClip'
import {Warning_Stroke2_Corner0_Rounded as Warning} from '#/components/icons/Warning'
import {Window_Stroke2_Corner2_Rounded as Window} from '#/components/icons/Window'
import {Wrench_Stroke2_Corner2_Rounded as Wrench} from '#/components/icons/Wrench'
import {Zap_Stroke2_Corner0_Rounded as Zap} from '#/components/icons/Zap'
import {Loader} from '#/components/Loader'
import {H1} from '#/components/Typography'
const allIcons = [
  {name: 'Alien', component: Alien},
  {name: 'AndroidLogo', component: AndroidLogo},
  {name: 'Apple', component: Apple},
  {name: 'ArrowTopRight', component: ArrowTopRight},
  {name: 'At', component: At},
  {name: 'Camera', component: Camera},
  {name: 'Atom', component: Atom},
  {name: 'Bell', component: Bell},
  {name: 'BirthdayCake', component: BirthdayCake},
  {name: 'BubbleInfo', component: BubbleInfo},
  {name: 'CalendarDays', component: CalendarDays},
  {name: 'Celebrate', component: Celebrate},
  {name: 'ChevronLeft', component: ChevronLeft},
  {name: 'CircleInfo', component: CircleInfo},
  {name: 'CircleQuestion', component: CircleQuestion},
  {name: 'CodeBrackets', component: CodeBrackets},
  {name: 'CodeLines', component: CodeLines},
  {name: 'Coffee', component: Coffee},
  {name: 'ColorPalette', component: ColorPalette},
  {name: 'Crop', component: Crop},
  {name: 'DotGrid', component: DotGrid},
  {name: 'Download', component: Download},
  {name: 'Earth', component: Earth},
  {name: 'EditBig', component: EditBig},
  {name: 'EmojiArc', component: EmojiArc},
  {name: 'EmojiHeartEyes', component: EmojiHeartEyes},
  {name: 'Envelope', component: Envelope},
  {name: 'EnvelopeOpen', component: EnvelopeOpen},
  {name: 'Explosion', component: Explosion},
  {name: 'Eye', component: Eye},
  {name: 'EyeSlash', component: EyeSlash},
  {name: 'Filter', component: Filter},
  {name: 'FilterTimeline', component: FilterTimeline},
  {name: 'Flag', component: Flag},
  {name: 'FlipImage', component: FlipImage},
  {name: 'FloppyDisk', component: FloppyDisk},
  {name: 'Freeze', component: Freeze},
  {name: 'GameController', component: GameController},
  {name: 'Gif', component: Gif},
  {name: 'Gift', component: Gift},
  {name: 'Globe', component: Globe},
  {name: 'Group', component: Group},
  {name: 'Growth', component: Growth},
  {name: 'Haptic', component: Haptic},
  {name: 'Hashtag', component: Hashtag},
  {name: 'Heart', component: Heart},
  {name: 'Home', component: Home},
  {name: 'HomeOpen', component: HomeOpen},
  {name: 'Image', component: Image},
  {name: 'Key', component: Key},
  {name: 'Lab', component: Lab},
  {name: 'Leaf', component: Leaf},
  {name: 'ListMagnifyingGlass', component: ListMagnifyingGlass},
  {name: 'ListPlus', component: ListPlus},
  {name: 'ListSparkle', component: ListSparkle},
  {name: 'Loader', component: Loader},
  {name: 'Lock', component: Lock},
  {name: 'Logo', component: Logo},
  {name: 'Macintosh', component: Macintosh},
  {name: 'MagnifyingGlass', component: MagnifyingGlass},
  {name: 'MagnifyingGlass2', component: MagnifyingGlass2},
  {name: 'Menu', component: Menu},
  {name: 'Message', component: Message},
  {name: 'Moon', component: Moon},
  {name: 'MusicNote', component: MusicNote},
  {name: 'Mute', component: Mute},
  {name: 'News2', component: News2},
  {name: 'Newskie', component: Newskie},
  {name: 'Newspaper', component: Newspaper},
  {name: 'PageText', component: PageText},
  {name: 'PaintRoller', component: PaintRoller},
  {name: 'PaperPlane', component: PaperPlane},
  {name: 'Pause', component: Pause},
  {name: 'Pencil', component: Pencil},
  {name: 'PeopleRemove', component: PeopleRemove},
  {name: 'Person', component: Person},
  {name: 'Phone', component: Phone},
  {name: 'PiggyBank', component: PiggyBank},
  {name: 'Pin', component: Pin},
  {name: 'Pizza', component: Pizza},
  {name: 'Play', component: Play},
  {name: 'Plus', component: Plus},
  {name: 'Poop', component: Poop},
  {name: 'QrCode', component: QrCode},
  {name: 'Quote', component: Quote},
  {name: 'RaisingHand', component: RaisingHand},
  {name: 'Repost', component: Repost},
  {name: 'Rose', component: Rose},
  {name: 'SettingsGear', component: SettingsGear},
  {name: 'SettingsSlider', component: SettingsSlider},
  {name: 'Shaka', component: Shaka},
  {name: 'Shapes', component: Shapes},
  {name: 'Shield', component: Shield},
  {name: 'Speaker', component: Speaker},
  {name: 'SquareArrowTopRight', component: SquareArrowTopRight},
  {name: 'SquareBehindSquare', component: SquareBehindSquare},
  {name: 'Star', component: Star},
  {name: 'StarterPack', component: StarterPack},
  {name: 'StreamingLive', component: StreamingLive},
  {name: 'TextSize', component: TextSize},
  {name: 'Ticket', component: Ticket},
  {name: 'Times', component: Times},
  {name: 'TitleCase', component: TitleCase},
  {name: 'Trash', component: Trash},
  {name: 'Trending', component: Trending},
  {name: 'UFO', component: UFO},
  {name: 'UserCircle', component: UserCircle},
  {name: 'Verified', component: Verified},
  {name: 'VideoClip', component: VideoClip},
  {name: 'Warning', component: Warning},
  {name: 'Window', component: Window},
  {name: 'Wrench', component: Wrench},
  {name: 'Zap', component: Zap},
]

// Define component props type
type IconDisplayProps = {
  name: string
  Icon: React.ComponentType<any>
}

const IconDisplay = ({name, Icon}: IconDisplayProps) => {
  const t = useTheme()
  return (
    <View style={[a.align_center, a.p_md, a.gap_sm, {width: 112}]}>
      <Icon size="md" fill={t.atoms.text.color} />
      <Text style={[a.text_sm, t.atoms.text]}>{name}</Text>
    </View>
  )
}

export function Icons() {
  const t = useTheme()

  return (
    <View style={[a.gap_xl]}>
      <H1>Icons</H1>

      <View style={[a.gap_xl]}>
        <Text style={[a.text_md, t.atoms.text]}>
          All available icons in the application. Total: {allIcons.length} icons
        </Text>

        <ScrollView horizontal={false}>
          <View style={[a.flex_row, a.flex_wrap, a.gap_md, a.justify_start]}>
            {allIcons.map((icon, index) => (
              <IconDisplay key={index} name={icon.name} Icon={icon.component} />
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={[a.gap_md]}>
        <Text style={[a.text_md, t.atoms.text, a.font_bold]}>Icon Sizes</Text>
        <View style={[a.flex_row, a.gap_xl, a.align_center]}>
          <View style={[a.align_center]}>
            <Globe size="xs" fill={t.atoms.text.color} />
            <Text style={[a.text_sm, t.atoms.text]}>xs</Text>
          </View>
          <View style={[a.align_center]}>
            <Globe size="sm" fill={t.atoms.text.color} />
            <Text style={[a.text_sm, t.atoms.text]}>sm</Text>
          </View>
          <View style={[a.align_center]}>
            <Globe size="md" fill={t.atoms.text.color} />
            <Text style={[a.text_sm, t.atoms.text]}>md</Text>
          </View>
          <View style={[a.align_center]}>
            <Globe size="lg" fill={t.atoms.text.color} />
            <Text style={[a.text_sm, t.atoms.text]}>lg</Text>
          </View>
          <View style={[a.align_center]}>
            <Globe size="xl" fill={t.atoms.text.color} />
            <Text style={[a.text_sm, t.atoms.text]}>xl</Text>
          </View>
        </View>
      </View>

      <View style={[a.gap_md]}>
        <Text style={[a.text_md, t.atoms.text, a.font_bold]}>
          Gradient Icons
        </Text>
        <View style={[a.flex_row, a.gap_xl]}>
          <View style={[a.align_center]}>
            <Globe size="md" gradient="sky" />
            <Text style={[a.text_sm, t.atoms.text]}>sky</Text>
          </View>
          <View style={[a.align_center]}>
            <Globe size="md" gradient="midnight" />
            <Text style={[a.text_sm, t.atoms.text]}>midnight</Text>
          </View>
          <View style={[a.align_center]}>
            <Globe size="md" gradient="sunrise" />
            <Text style={[a.text_sm, t.atoms.text]}>sunrise</Text>
          </View>
          <View style={[a.align_center]}>
            <Globe size="md" gradient="sunset" />
            <Text style={[a.text_sm, t.atoms.text]}>sunset</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

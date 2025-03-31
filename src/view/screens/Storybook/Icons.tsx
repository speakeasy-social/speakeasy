import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
// Import all icons
import * as Alien from '#/components/icons/Alien'
import * as Apple from '#/components/icons/Apple'
import * as Arrow from '#/components/icons/Arrow'
import * as ArrowBoxLeft from '#/components/icons/ArrowBoxLeft'
import * as Bell from '#/components/icons/Bell'
import * as Bell2 from '#/components/icons/Bell2'
import * as BirthdayCake from '#/components/icons/BirthdayCake'
import * as Bubble from '#/components/icons/Bubble'
import * as BubbleInfo from '#/components/icons/BubbleInfo'
import * as BulletList from '#/components/icons/BulletList'
import * as CalendarDays from '#/components/icons/CalendarDays'
import * as Camera from '#/components/icons/Camera'
import * as Chevron from '#/components/icons/Chevron'
import * as CircleInfo from '#/components/icons/CircleInfo'
import * as CircleQuestion from '#/components/icons/CircleQuestion'
import * as CodeBrackets from '#/components/icons/CodeBrackets'
import * as CodeLines from '#/components/icons/CodeLines'
import * as Coffee from '#/components/icons/Coffee'
import * as ColorPalette from '#/components/icons/ColorPalette'
import * as Crop from '#/components/icons/Crop'
import * as DotGrid from '#/components/icons/DotGrid'
import * as Download from '#/components/icons/Download'
import * as EditBig from '#/components/icons/EditBig'
import * as Emoji from '#/components/icons/Emoji'
import * as Envelope from '#/components/icons/Envelope'
import * as EnvelopeOpen from '#/components/icons/EnveopeOpen'
import * as Explosion from '#/components/icons/Explosion'
import * as Eye from '#/components/icons/Eye'
import * as EyeSlash from '#/components/icons/EyeSlash'
import * as Filter from '#/components/icons/Filter'
import * as FilterTimeline from '#/components/icons/FilterTimeline'
import * as Flag from '#/components/icons/Flag'
import * as FlipImage from '#/components/icons/FlipImage'
import * as FloppyDisk from '#/components/icons/FloppyDisk'
import * as Freeze from '#/components/icons/Freeze'
import * as GameController from '#/components/icons/GameController'
import * as Gif from '#/components/icons/Gif'
import * as Gift1 from '#/components/icons/Gift1'
import * as Globe from '#/components/icons/Globe'
import * as Group from '#/components/icons/Group'
import * as Growth from '#/components/icons/Growth'
import * as Haptic from '#/components/icons/Haptic'
import * as Hashtag from '#/components/icons/Hashtag'
import * as Heart2 from '#/components/icons/Heart2'
import * as Home from '#/components/icons/Home'
import * as HomeOpen from '#/components/icons/HomeOpen'
import * as Image from '#/components/icons/Image'
import * as Key from '#/components/icons/Key'
import * as Lab from '#/components/icons/Lab'
import * as Leaf from '#/components/icons/Leaf'
import * as ListMagnifyingGlass from '#/components/icons/ListMagnifyingGlass'
import * as ListPlus from '#/components/icons/ListPlus'
import * as ListSparkle from '#/components/icons/ListSparkle'
import * as Lock from '#/components/icons/Lock'
import * as Logo from '#/components/icons/Logo'
import * as Macintosh from '#/components/icons/Macintosh'
import * as MagnifyingGlass from '#/components/icons/MagnifyingGlass'
import * as MagnifyingGlass2 from '#/components/icons/MagnifyingGlass2'
import * as Menu from '#/components/icons/Menu'
import * as Message from '#/components/icons/Message'
import * as Moon from '#/components/icons/Moon'
import * as MusicNote from '#/components/icons/MusicNote'
import * as Mute from '#/components/icons/Mute'
import * as News2 from '#/components/icons/News2'
import * as Newskie from '#/components/icons/Newskie'
import * as Newspaper from '#/components/icons/Newspaper'
import * as PageText from '#/components/icons/PageText'
import * as PaintRoller from '#/components/icons/PaintRoller'
import * as PaperPlane from '#/components/icons/PaperPlane'
import * as Pause from '#/components/icons/Pause'
import * as Pencil from '#/components/icons/Pencil'
import * as PeopleRemove2 from '#/components/icons/PeopleRemove2'
import * as Person from '#/components/icons/Person'
import * as Phone from '#/components/icons/Phone'
import * as PiggyBank from '#/components/icons/PiggyBank'
import * as Pin from '#/components/icons/Pin'
import * as Pizza from '#/components/icons/Pizza'
import * as Play from '#/components/icons/Play'
import * as Plus from '#/components/icons/Plus'
import * as Poop from '#/components/icons/Poop'
import * as QrCode from '#/components/icons/QrCode'
import * as Quote from '#/components/icons/Quote'
import * as RaisingHand from '#/components/icons/RaisingHand'
import * as Repost from '#/components/icons/Repost'
import * as Rose from '#/components/icons/Rose'
import * as SettingsGear2 from '#/components/icons/SettingsGear2'
import * as SettingsSlider from '#/components/icons/SettingsSlider'
import * as Shaka from '#/components/icons/Shaka'
import * as Shapes from '#/components/icons/Shapes'
import * as Shield from '#/components/icons/Shield'
import * as Speaker from '#/components/icons/Speaker'
import * as SquareArrowTopRight from '#/components/icons/SquareArrowTopRight'
import * as SquareBehindSquare4 from '#/components/icons/SquareBehindSquare4'
import * as Star from '#/components/icons/Star'
import * as StarterPack from '#/components/icons/StarterPack'
import * as StreamingLive from '#/components/icons/StreamingLive'
import * as TextSize from '#/components/icons/TextSize'
import * as Ticket from '#/components/icons/Ticket'
import * as Times from '#/components/icons/Times'
import * as TitleCase from '#/components/icons/TitleCase'
import * as Trash from '#/components/icons/Trash'
import * as Trending2 from '#/components/icons/Trending2'
import * as UFO from '#/components/icons/UFO'
import * as UserCircle from '#/components/icons/UserCircle'
import * as Verified from '#/components/icons/Verified'
import * as VideoClip from '#/components/icons/VideoClip'
import * as Warning from '#/components/icons/Warning'
import * as Window from '#/components/icons/Window'
import * as Wrench from '#/components/icons/Wrench'
import * as Zap from '#/components/icons/Zap'
import * as Loader from '#/components/Loader'
import {H1, Text} from '#/components/Typography'

// Create an array of all icon components with their names
const iconComponents = [
  {name: 'Alien', component: Alien.Alien_Stroke2_Corner0_Rounded},
  {name: 'Apple', component: Apple.Apple_Stroke2_Corner0_Rounded},
  {name: 'Arrow', component: Arrow.ArrowTopRight_Stroke2_Corner0_Rounded},
  {
    name: 'ArrowBoxLeft',
    component: ArrowBoxLeft.ArrowBoxLeft_Stroke2_Corner0_Rounded,
  },
  {name: 'Bell', component: Bell.Bell_Stroke2_Corner0_Rounded},
  {name: 'Bell2', component: Bell2.Bell2_Stroke2_Corner0_Rounded},
  {
    name: 'BirthdayCake',
    component: BirthdayCake.BirthdayCake_Stroke2_Corner2_Rounded,
  },
  {name: 'Bubble', component: Bubble.Bubble_Stroke2_Corner2_Rounded},
  {
    name: 'BubbleInfo',
    component: BubbleInfo.BubbleInfo_Stroke2_Corner2_Rounded,
  },
  {
    name: 'BulletList',
    component: BulletList.BulletList_Stroke2_Corner0_Rounded,
  },
  {
    name: 'CalendarDays',
    component: CalendarDays.CalendarDays_Stroke2_Corner0_Rounded,
  },
  {name: 'Camera', component: Camera.Camera_Stroke2_Corner0_Rounded},
  {name: 'Chevron', component: Chevron.ChevronLeft_Stroke2_Corner0_Rounded},
  {
    name: 'CircleInfo',
    component: CircleInfo.CircleInfo_Stroke2_Corner0_Rounded,
  },
  {
    name: 'CircleQuestion',
    component: CircleQuestion.CircleQuestion_Stroke2_Corner2_Rounded,
  },
  {
    name: 'CodeBrackets',
    component: CodeBrackets.CodeBrackets_Stroke2_Corner2_Rounded,
  },
  {name: 'CodeLines', component: CodeLines.CodeLines_Stroke2_Corner2_Rounded},
  {name: 'Coffee', component: Coffee.Coffee_Stroke2_Corner0_Rounded},
  {
    name: 'ColorPalette',
    component: ColorPalette.ColorPalette_Stroke2_Corner0_Rounded,
  },
  {name: 'Crop', component: Crop.Crop_Stroke2_Corner0_Rounded},
  {name: 'DotGrid', component: DotGrid.DotGrid_Stroke2_Corner0_Rounded},
  {name: 'Download', component: Download.Download_Stroke2_Corner0_Rounded},
  {name: 'EditBig', component: EditBig.EditBig_Stroke2_Corner0_Rounded},
  {name: 'Emoji', component: Emoji.EmojiSmile_Stroke2_Corner0_Rounded},
  {name: 'Envelope', component: Envelope.Envelope_Stroke2_Corner2_Rounded},
  {
    name: 'EnvelopeOpen',
    component: EnvelopeOpen.Envelope_Open_Stroke2_Corner0_Rounded,
  },
  {name: 'Explosion', component: Explosion.Explosion_Stroke2_Corner0_Rounded},
  {name: 'Eye', component: Eye.Eye_Stroke2_Corner0_Rounded},
  {name: 'EyeSlash', component: EyeSlash.EyeSlash_Stroke2_Corner0_Rounded},
  {name: 'Filter', component: Filter.Filter_Stroke2_Corner0_Rounded},
  {
    name: 'FilterTimeline',
    component: FilterTimeline.FilterTimeline_Stroke2_Corner0_Rounded,
  },
  {name: 'Flag', component: Flag.Flag_Stroke2_Corner0_Rounded},
  {
    name: 'FlipImageHorizontal',
    component: FlipImage.FlipHorizontal_Stroke2_Corner0_Rounded,
  },
  {
    name: 'FlipImageVertical',
    component: FlipImage.FlipVertical_Stroke2_Corner0_Rounded,
  },
  {
    name: 'FloppyDisk',
    component: FloppyDisk.FloppyDisk_Stroke2_Corner0_Rounded,
  },
  {name: 'Freeze', component: Freeze.Freeze_Stroke2_Corner2_Rounded},
  {
    name: 'GameController',
    component: GameController.GameController_Stroke2_Corner0_Rounded,
  },
  {name: 'Gif', component: Gif.Gif_Stroke2_Corner0_Rounded},
  {name: 'Gift1', component: Gift1.Gift1_Stroke2_Corner0_Rounded},
  {name: 'Globe', component: Globe.Globe_Stroke2_Corner0_Rounded},
  {name: 'Group', component: Group.Group3_Stroke2_Corner0_Rounded},
  {name: 'Growth', component: Growth.Growth_Stroke2_Corner0_Rounded},
  {name: 'Haptic', component: Haptic.Haptic_Stroke2_Corner2_Rounded},
  {name: 'Hashtag', component: Hashtag.Hashtag_Stroke2_Corner0_Rounded},
  {name: 'Heart2', component: Heart2.Heart2_Stroke2_Corner0_Rounded},
  {name: 'Home', component: Home.Home_Stroke2_Corner0_Rounded},
  {name: 'HomeOpenFilled', component: HomeOpen.HomeOpen_Filled_Corner0_Rounded},
  {name: 'HomeOpenStroke', component: HomeOpen.HomeOpen_Stoke2_Corner0_Rounded},
  {name: 'Image', component: Image.Image_Stroke2_Corner0_Rounded},
  {name: 'Key', component: Key.Key_Stroke2_Corner2_Rounded},
  {name: 'Lab', component: Lab.Lab_Stroke2_Corner0_Rounded},
  {name: 'Leaf', component: Leaf.Leaf_Stroke2_Corner0_Rounded},
  {
    name: 'ListMagnifyingGlass',
    component: ListMagnifyingGlass.ListMagnifyingGlass_Stroke2_Corner0_Rounded,
  },
  {name: 'ListPlus', component: ListPlus.ListPlus_Stroke2_Corner0_Rounded},
  {
    name: 'ListSparkle',
    component: ListSparkle.ListSparkle_Stroke2_Corner0_Rounded,
  },
  {name: 'Loader', component: Loader.Loader},
  {name: 'Lock', component: Lock.Lock_Stroke2_Corner2_Rounded},
  {name: 'Logo', component: Logo.Mark},
  {name: 'Macintosh', component: Macintosh.Macintosh_Stroke2_Corner2_Rounded},
  {
    name: 'MagnifyingGlass',
    component: MagnifyingGlass.MagnifyingGlass_Filled_Stroke2_Corner0_Rounded,
  },
  {
    name: 'MagnifyingGlass2',
    component: MagnifyingGlass2.MagnifyingGlass2_Stroke2_Corner0_Rounded,
  },
  {name: 'Menu', component: Menu.Menu_Stroke2_Corner0_Rounded},
  {name: 'Message', component: Message.Message_Stroke2_Corner0_Rounded},
  {name: 'Moon', component: Moon.Moon_Stroke2_Corner0_Rounded},
  {name: 'MusicNote', component: MusicNote.MusicNote_Stroke2_Corner0_Rounded},
  {name: 'Mute', component: Mute.Mute_Stroke2_Corner0_Rounded},
  {name: 'News2', component: News2.News2_Stroke2_Corner0_Rounded},
  {name: 'Newskie', component: Newskie.Newskie},
  {name: 'Newspaper', component: Newspaper.Newspaper_Stroke2_Corner2_Rounded},
  {name: 'PageText', component: PageText.PageText_Stroke2_Corner0_Rounded},
  {
    name: 'PaintRoller',
    component: PaintRoller.PaintRoller_Stroke2_Corner2_Rounded,
  },
  {
    name: 'PaperPlane',
    component: PaperPlane.PaperPlane_Stroke2_Corner0_Rounded,
  },
  {name: 'Pause', component: Pause.Pause_Stroke2_Corner0_Rounded},
  {name: 'Pencil', component: Pencil.Pencil_Stroke2_Corner0_Rounded},
  {
    name: 'PeopleRemove2',
    component: PeopleRemove2.PeopleRemove2_Stroke2_Corner0_Rounded,
  },
  {name: 'Person', component: Person.Person_Stroke2_Corner0_Rounded},
  {name: 'Phone', component: Phone.Phone_Stroke2_Corner0_Rounded},
  {name: 'PiggyBank', component: PiggyBank.PiggyBank_Stroke2_Corner0_Rounded},
  {name: 'Pin', component: Pin.Pin_Stroke2_Corner0_Rounded},
  {name: 'Pizza', component: Pizza.Pizza_Stroke2_Corner0_Rounded},
  {name: 'Play', component: Play.Play_Stroke2_Corner0_Rounded},
  {name: 'Plus', component: Plus.PlusLarge_Stroke2_Corner0_Rounded},
  {name: 'Poop', component: Poop.Poop_Stroke2_Corner0_Rounded},
  {name: 'QrCode', component: QrCode.QrCode_Stroke2_Corner0_Rounded},
  {name: 'Quote', component: Quote.OpenQuote_Filled_Stroke2_Corner0_Rounded},
  {
    name: 'RaisingHand',
    component: RaisingHand.RaisingHand4Finger_Stroke2_Corner2_Rounded,
  },
  {name: 'Repost', component: Repost.Repost_Stroke2_Corner2_Rounded},
  {name: 'Rose', component: Rose.Rose_Stroke2_Corner0_Rounded},
  {
    name: 'SettingsGear2',
    component: SettingsGear2.SettingsGear2_Stroke2_Corner0_Rounded,
  },
  {
    name: 'SettingsSlider',
    component: SettingsSlider.SettingsSliderVertical_Stroke2_Corner0_Rounded,
  },
  {name: 'Shaka', component: Shaka.Shaka_Stroke2_Corner0_Rounded},
  {name: 'Shapes', component: Shapes.Shapes_Stroke2_Corner0_Rounded},
  {name: 'Shield', component: Shield.Shield_Stroke2_Corner0_Rounded},
  {
    name: 'Speaker',
    component: Speaker.SpeakerVolumeFull_Stroke2_Corner0_Rounded,
  },
  {
    name: 'SquareArrowTopRight',
    component: SquareArrowTopRight.SquareArrowTopRight_Stroke2_Corner0_Rounded,
  },
  {
    name: 'SquareBehindSquare4',
    component: SquareBehindSquare4.SquareBehindSquare4_Stroke2_Corner0_Rounded,
  },
  {name: 'Star', component: Star.Star_Stroke2_Corner0_Rounded},
  {name: 'StarterPack', component: StarterPack.StarterPack},
  {
    name: 'StreamingLive',
    component: StreamingLive.StreamingLive_Stroke2_Corner0_Rounded,
  },
  {name: 'TextSize', component: TextSize.TextSize_Stroke2_Corner0_Rounded},
  {name: 'Ticket', component: Ticket.Ticket_Stroke2_Corner0_Rounded},
  {name: 'Times', component: Times.TimesLarge_Stroke2_Corner0_Rounded},
  {name: 'TitleCase', component: TitleCase.TitleCase_Stroke2_Corner0_Rounded},
  {name: 'Trash', component: Trash.Trash_Stroke2_Corner0_Rounded},
  {name: 'Trending2', component: Trending2.Trending2_Stroke2_Corner2_Rounded},
  {name: 'UFO', component: UFO.UFO_Stroke2_Corner0_Rounded},
  {
    name: 'UserCircle',
    component: UserCircle.UserCircle_Stroke2_Corner0_Rounded,
  },
  {name: 'Verified', component: Verified.Verified_Stroke2_Corner2_Rounded},
  {name: 'VideoClip', component: VideoClip.VideoClip_Stroke2_Corner0_Rounded},
  {name: 'Warning', component: Warning.Warning_Stroke2_Corner0_Rounded},
  {name: 'Window', component: Window.Window_Stroke2_Corner2_Rounded},
  {name: 'Wrench', component: Wrench.Wrench_Stroke2_Corner2_Rounded},
  {name: 'Zap', component: Zap.Zap_Stroke2_Corner0_Rounded},
]

export function Icons() {
  const t = useTheme()
  return (
    <View style={[a.gap_md]}>
      <H1>Icons</H1>

      {/* Size examples */}
      <View style={[a.gap_md]}>
        <Text style={[a.font_bold]}>Size Examples</Text>
        <View style={[a.flex_row, a.gap_xl]}>
          <Globe.Globe_Stroke2_Corner0_Rounded
            size="xs"
            fill={t.atoms.text.color}
          />
          <Globe.Globe_Stroke2_Corner0_Rounded
            size="sm"
            fill={t.atoms.text.color}
          />
          <Globe.Globe_Stroke2_Corner0_Rounded
            size="md"
            fill={t.atoms.text.color}
          />
          <Globe.Globe_Stroke2_Corner0_Rounded
            size="lg"
            fill={t.atoms.text.color}
          />
          <Globe.Globe_Stroke2_Corner0_Rounded
            size="xl"
            fill={t.atoms.text.color}
          />
        </View>
      </View>

      {/* Gradient example */}
      <View style={[a.gap_md]}>
        <Text style={[a.font_bold]}>Gradient Example</Text>
        <View style={[a.flex_row, a.gap_xl]}>
          <Globe.Globe_Stroke2_Corner0_Rounded size="xs" gradient="sky" />
          <Globe.Globe_Stroke2_Corner0_Rounded size="sm" gradient="sky" />
          <Globe.Globe_Stroke2_Corner0_Rounded size="md" gradient="sky" />
          <Globe.Globe_Stroke2_Corner0_Rounded size="lg" gradient="sky" />
          <Globe.Globe_Stroke2_Corner0_Rounded size="xl" gradient="sky" />
        </View>
      </View>

      {/* All icons grid */}
      <View style={[a.gap_md]}>
        <Text style={[a.font_bold]}>All Icons</Text>
        <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
          {iconComponents.map(({name, component: Icon}) => (
            <View
              key={name}
              style={[
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.p_sm,
                t.atoms.bg_contrast_25,
                a.rounded_md,
              ]}>
              <Icon size="md" fill={t.atoms.text.color} />
              <Text style={[a.text_sm]}>{name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

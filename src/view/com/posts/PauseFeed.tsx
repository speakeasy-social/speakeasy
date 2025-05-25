import React from 'react'
import {View} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {useLeaveOptions} from '#/state/preferences/leave-options'
import {useTheme} from '#/alf'
import {atoms as a} from '#/alf/atoms'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'
import {LeaveDialog} from '../modals/EditLeaveOptionsDialog'

function GoodbyeGifDialog({
  control,
  gifUrl,
}: {
  control: Dialog.DialogControlProps
  gifUrl?: string
}) {
  const {_} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Off You Go!`)}>
        <Text>{_(msg`Enjoy your break!`)}</Text>
        <View style={[a.gap_xl, a.align_center]}>
          {gifUrl && <img src={gifUrl} alt="Off You Go!" />}
        </View>
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

export function PauseFeed({
  onKeepScrolling,
  isCompact = false,
  sectionIndex = 0,
  postsViewed = 0,
  feedStartTime,
}: {
  onKeepScrolling?: () => void
  isCompact?: boolean
  sectionIndex?: number
  postsViewed?: number
  feedStartTime: number
}) {
  const {_} = useLingui()
  const t = useTheme()
  const leaveDialogControl = Dialog.useDialogControl()
  const gifDialogControl = Dialog.useDialogControl()
  const options = useLeaveOptions()
  const [gifUrl, setGifUrl] = React.useState<string>()
  const isReducedMotion = useReducedMotion()
  const height = useSharedValue(isCompact ? 60 : 500)
  const navigation = useNavigation()

  React.useEffect(() => {
    height.value = isCompact ? 60 : 500
  }, [isCompact, height])

  const animatedStyle = useAnimatedStyle(() => {
    if (isReducedMotion) {
      return {
        height: height.value,
        opacity: 1,
      }
    }
    return {
      height: withTiming(height.value, {
        duration: 300,
      }),
      opacity: withTiming(1, {
        duration: 300,
      }),
    }
  }, [isReducedMotion])

  const handleClose = () => {
    gifDialogControl.open()
    fetch(
      'https://api.giphy.com/v1/gifs/random?api_key=YOUR_API_KEY&tag=off+you+go&rating=g',
    )
      .then(response => response.json())
      .then(data => {
        setGifUrl(data.data.images.original.url)
        setTimeout(() => window.close(), 3000)
      })
      .catch(error => {
        console.error('Error fetching GIF:', error)
      })
  }

  const containerStyle = [
    a.p_lg,
    a.gap_md,
    a.align_center,
    a.border_t,
    t.atoms.border_contrast_low,
    isCompact ? a.p_sm : a.pt_5xl,
  ]

  const breakTexts = [
    'Take a break, or see more?',
    `Would you like to pause and ${
      options?.[0]?.title?.toLowerCase() || 'go for a walk'
    }?`,
    'Take a break, or see more?',
    `You've seen ${postsViewed} posts.`,
    'Take a break, or see more?',
    `You've been on here for ${Math.floor(
      (Date.now() - feedStartTime) / 60000,
    )} minutes.`,
    'Take a break, or see more?',
  ]
  let breakText = breakTexts[Math.min(sectionIndex, breakTexts.length - 1)]

  if (sectionIndex === 42) {
    breakText = 'This is an infinite scroll (just so you know)'
  }

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      {isCompact ? (
        <Text
          style={[
            a.text_center,
            t.atoms.text_contrast_medium,
            a.text_sm,
            a.my_md,
          ]}>
          {_(msg`Onwards!`)}
        </Text>
      ) : (
        <>
          <Text style={[a.text_center, t.atoms.text_contrast_high, a.text_md]}>
            {_(msg`${breakText}`)}
          </Text>
          {options?.length ? (
            <View style={[a.gap_lg]}>
              {options.map((option, index) => (
                <Button
                  key={index}
                  variant="solid"
                  color="primary"
                  size="large"
                  label={option.title}
                  onPress={() => {
                    if (option.link === 'close') {
                      handleClose()
                    } else if (option.link === 'chat') {
                      // Not sure why it doesn't recognise the route
                      // @ts-ignore
                      navigation.navigate('Messages')
                    } else {
                      window.location.href = option.link
                    }
                  }}>
                  <ButtonText>{option.title}</ButtonText>
                </Button>
              ))}

              <Button
                variant="outline"
                color="secondary"
                size="small"
                label={_(msg`Edit Options`)}
                onPress={() => leaveDialogControl.open()}>
                <ButtonText>{_(msg`Edit Options`)}</ButtonText>
              </Button>
            </View>
          ) : (
            <Button
              style={[a.mt_xl]}
              variant="solid"
              color="primary"
              size="large"
              label={_(msg`Leave`)}
              onPress={() => {
                leaveDialogControl.open()
              }}>
              <ButtonText>{_(msg`Leave`)}</ButtonText>
            </Button>
          )}

          <Button
            style={[a.mt_xl]}
            variant="outline"
            color="primary"
            size="small"
            label={_(msg`Keep Scrolling`)}
            onPress={onKeepScrolling}>
            <ButtonText>{_(msg`Keep Scrolling`)}</ButtonText>
          </Button>

          <LeaveDialog control={leaveDialogControl} />
          <GoodbyeGifDialog control={gifDialogControl} gifUrl={gifUrl} />
        </>
      )}
    </Animated.View>
  )
}

import React, {useState} from 'react'
import {
  Pressable,
  StyleProp,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native'
import {AppBskyEmbedImages} from '@atproto/api'
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {HandleRef, useHandleRef} from '#/lib/hooks/useHandleRef'
import {PostEmbedViewContext} from '#/view/com/util/post-embeds/types'
import {atoms as a, useTheme} from '#/alf'
import {Dimensions} from '../../lightbox/ImageViewing/@types'
import {GalleryItem} from './Gallery'

interface ImageCarouselProps {
  images: AppBskyEmbedImages.ViewImage[]
  onPress?: (
    index: number,
    containerRefs: HandleRef[],
    fetchedDims: (Dimensions | null)[],
  ) => void
  onLongPress?: (index: number) => void
  onPressIn?: (index: number) => void
  style?: StyleProp<ViewStyle>
  viewContext?: PostEmbedViewContext
}

export function ImageCarousel({style, ...props}: ImageCarouselProps) {
  const theme = useTheme()
  const {_} = useLingui()
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useHandleRef()
  const thumbDimsRef = React.useRef<(Dimensions | null)[]>([])
  const {width: windowWidth} = useWindowDimensions()

  const showLeftArrow = currentIndex > 0
  const showRightArrow = currentIndex < props.images.length - 1

  const navigateLeft = () => {
    if (showLeftArrow) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const navigateRight = () => {
    if (showRightArrow) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  // Calculate consistent dimensions for all images
  const maxWidth = Math.min(windowWidth - 16, 550)
  const containerHeight = maxWidth * (4 / 3) // 3:4 aspect ratio for portrait

  return (
    <View style={[style, a.relative, {width: '100%', maxWidth}]}>
      <View
        style={[
          a.rounded_md,
          a.overflow_hidden,
          {
            width: '100%',
            height: containerHeight,
            backgroundColor: theme.palette.black,
          },
        ]}>
        <GalleryItem
          images={props.images}
          index={currentIndex}
          containerRefs={[containerRef]}
          thumbDimsRef={thumbDimsRef}
          onPress={props.onPress}
          onLongPress={props.onLongPress}
          onPressIn={props.onPressIn}
          viewContext={props.viewContext}
          imageStyle={{
            width: '100%',
            height: '100%',
            resizeMode: 'contain',
          }}
        />
      </View>

      {/* Navigation Arrows */}
      {showLeftArrow && (
        <Pressable
          onPress={navigateLeft}
          focusable={false}
          accessibilityRole="button"
          accessibilityLabel={_(msg`Previous image`)}
          accessibilityHint={_(
            msg`Navigate to the previous image in this post`,
          )}
          style={[
            a.align_center,
            a.justify_center,
            a.absolute,
            {
              left: 8,
              top: '50%',
              zIndex: 10,
              transform: [{translateY: -20}],
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              width: 40,
              height: 40,
              borderRadius: 20,
            },
          ]}>
          <View pointerEvents="none">
            <FontAwesomeIcon
              icon="angle-left"
              color={theme.palette.black}
              size={24}
            />
          </View>
        </Pressable>
      )}
      {showRightArrow && (
        <Pressable
          onPress={navigateRight}
          focusable={false}
          accessibilityRole="button"
          accessibilityLabel={_(msg`Next image`)}
          accessibilityHint={_(msg`Navigate to the next image in this post`)}
          style={[
            a.align_center,
            a.justify_center,
            a.absolute,
            {
              right: 8,
              top: '50%',
              zIndex: 10,
              transform: [{translateY: -20}],
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              width: 40,
              height: 40,
              borderRadius: 20,
            },
          ]}>
          <View pointerEvents="none">
            <FontAwesomeIcon
              icon="angle-right"
              color={theme.palette.black}
              size={24}
            />
          </View>
        </Pressable>
      )}

      {/* Dot Count */}
      <View
        style={[
          a.absolute,
          a.flex_row,
          a.justify_center,
          {
            bottom: 16,
            left: 0,
            right: 0,
            zIndex: 10,
            height: 20,
          },
        ]}>
        {props.images.map((_image, index) => (
          <View
            key={index}
            style={{
              width: 8,
              height: 8,
              marginHorizontal: 4,
              borderRadius: 4,
              backgroundColor:
                index === currentIndex
                  ? theme.palette.black
                  : theme.palette.contrast_700,
            }}
          />
        ))}
      </View>
    </View>
  )
}

import {Pressable, StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'
import {AppBskyEmbedImages, AppBskyEmbedVideo} from '@atproto/api'
import {AtUri} from '@atproto/api'
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome'
import {useNavigation} from '@react-navigation/native'

import {NavigationProp} from '#/lib/routes/types'
import {FeedPostSliceItem} from '#/state/queries/post-feed'
import {useTheme} from '#/alf'

interface MediaGridProps {
  items: FeedPostSliceItem[]
}

export function MediaGrid({items}: MediaGridProps) {
  const theme = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const renderMediaItem = (item: FeedPostSliceItem) => {
    const post = item.post
    const embed = post.embed

    // Handle image embeds
    if (AppBskyEmbedImages.isView(embed)) {
      const image = embed.images[0] // Take first image
      return (
        <Pressable
          key={post.uri}
          style={styles.gridItem}
          accessibilityRole="button"
          accessibilityLabel="View post with image"
          accessibilityHint=""
          onPress={() => {
            const uri = new AtUri(post.uri)
            navigation.navigate('PostThread', {
              name: uri.hostname,
              rkey: uri.rkey,
            })
          }}>
          <Image
            source={{uri: image.thumb}}
            style={styles.media}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
      )
    }

    // Handle video embeds
    if (AppBskyEmbedVideo.isView(embed)) {
      return (
        <Pressable
          key={post.uri}
          style={styles.gridItem}
          accessibilityRole="button"
          accessibilityLabel="View post with video"
          accessibilityHint=""
          onPress={() => {
            const uri = new AtUri(post.uri)
            navigation.navigate('PostThread', {
              name: uri.hostname,
              rkey: uri.rkey,
            })
          }}>
          <Image
            source={{uri: embed.thumbnail}}
            style={styles.media}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View
            style={[
              styles.playButton,
              {backgroundColor: theme.palette.primary_500},
            ]}>
            <FontAwesomeIcon icon="play" style={{color: 'white'}} />
          </View>
        </Pressable>
      )
    }

    return null
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {items.map(item => renderMediaItem(item))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    padding: 2,
  },
  gridItem: {
    width: '33%',
    aspectRatio: 1,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  playButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

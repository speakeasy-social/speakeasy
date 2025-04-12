import {StyleSheet, View} from 'react-native'
import {AppBskyFeedDefs} from '@atproto/api'

import {EmbeddedPost} from './EmbeddedPost'

interface PrivateMessageEmbedProps {
  message: string
  publicMessage: string
  decodedEmbed?: AppBskyFeedDefs.PostView
}

export function PrivateMessageEmbed({decodedEmbed}: PrivateMessageEmbedProps) {
  if (!decodedEmbed) {
    return null
  }

  return (
    <View style={[styles.container]}>
      <EmbeddedPost
        post={decodedEmbed}
        style={styles.embeddedPost}
        showAuthor={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  embeddedPost: {
    marginTop: 0,
  },
})

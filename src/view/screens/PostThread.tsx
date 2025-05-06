import React from 'react'
import {useFocusEffect} from '@react-navigation/native'

import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {useSetMinimalShellMode} from '#/state/shell'
import {PostThread as PostThreadComponent} from '#/view/com/post-thread/PostThread'
import * as Layout from '#/components/Layout'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'PostThread' | 'PrivatePostThread'
>
export function PostThreadScreen({route}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()

  const {name, rkey} = route.params
  const isPrivatePost = route.name === 'PrivatePostThread'
  const uri = makeRecordUri(
    name,
    isPrivatePost ? 'social.spkeasy.private-post' : 'app.bsky.feed.post',
    rkey,
  )

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="postThreadScreen">
      <PostThreadComponent uri={uri} />
    </Layout.Screen>
  )
}

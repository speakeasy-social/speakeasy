import React from 'react'
import {View} from 'react-native'
import {Plural} from '@lingui/macro'
import {useFocusEffect} from '@react-navigation/native'

import {usePalette} from '#/lib/hooks/usePalette'
import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {useAgent} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {ProfileFollows as ProfileFollowsComponent} from '#/view/com/profile/ProfileFollows'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {TrustActions} from '#/components/TrustActions'

const PAGE_SIZE = 100

type Props = NativeStackScreenProps<CommonNavigatorParams, 'ProfileFollows'>
export const ProfileFollowsScreen = ({route}: Props) => {
  const {name} = route.params
  const pal = usePalette('default')
  const setMinimalShellMode = useSetMinimalShellMode()
  const agent = useAgent()

  const {data: resolvedDid} = useResolveDidQuery(name)
  const {data: profile} = useProfileQuery({
    did: resolvedDid,
  })

  // Function to load all follows (all pages)
  const loadAllProfiles = React.useCallback(
    async (cursor?: string) => {
      if (!resolvedDid) return {dids: [], nextCursor: ''}
      const res = await agent.app.bsky.graph.getFollows({
        actor: resolvedDid,
        limit: PAGE_SIZE,
        cursor,
      })
      return {
        dids: res.data.follows.map(f => f.did),
        nextCursor: res.data.cursor,
      }
    },
    [agent, resolvedDid],
  )

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="profileFollowsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          {profile && (
            <>
              <Layout.Header.TitleText>
                {sanitizeDisplayName(profile.displayName || profile.handle)}
              </Layout.Header.TitleText>
              <Layout.Header.SubtitleText>
                <Plural
                  value={profile.followsCount ?? 0}
                  one="# following"
                  other="# following"
                />
              </Layout.Header.SubtitleText>
            </>
          )}
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View
          style={[
            a.flex_row,
            a.gap_sm,
            a.p_md,
            a.border_b,
            a.gap_sm,
            a.align_center,
            a.justify_end,
            a.w_full,
            a.mb_sm,
            a.mx_auto,
            pal.border,
            {
              flexDirection: 'row',
              maxWidth: 600,
            },
          ]}>
          <TrustActions loadAllProfiles={loadAllProfiles} />
        </View>
        <ProfileFollowsComponent name={name} />
      </Layout.Content>
    </Layout.Screen>
  )
}

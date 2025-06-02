import React from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect} from '@react-navigation/native'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {useInitialNumToRender} from '#/lib/hooks/useInitialNumToRender'
import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {useTrustedProfiles} from '#/state/queries/trusted'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {ProfileCardWithFollowBtn} from '#/view/com/profile/ProfileCard'
import {List} from '#/view/com/util/List'
import {ViewHeader} from '#/view/com/util/ViewHeader'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {ListFooter, ListMaybePlaceholder} from '#/components/Lists'
import {TrustActions} from '#/components/TrustActions'

const PAGE_SIZE = 100

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Trusted'>

export const ProfileTrustedUsersScreen = (_props: Props) => {
  const {_} = useLingui()
  const setMinimalShellMode = useSetMinimalShellMode()
  const initialNumToRender = useInitialNumToRender()
  const {currentAccount} = useSession()
  const {call: speakeasyApi} = useSpeakeasyApi()

  const [isPTRing, setIsPTRing] = React.useState(false)
  const {
    data: trustedProfiles,
    isLoading,
    error,
    refetch,
  } = useTrustedProfiles(currentAccount?.did)

  const loadAllProfiles = React.useCallback(
    async (cursor?: string) => {
      if (!currentAccount?.did) return {dids: [], nextCursor: ''}
      const res = await speakeasyApi({
        api: 'social.spkeasy.graph.getTrusted',
        query: {
          limit: PAGE_SIZE,
          authorDid: currentAccount.did,
          cursor,
        },
      })
      return {
        dids: res.trusted.map((t: {recipientDid: string}) => t.recipientDid),
        nextCursor: res.cursor,
      }
    },
    [currentAccount?.did, speakeasyApi],
  )

  const onRefresh = React.useCallback(async () => {
    setIsPTRing(true)
    try {
      await refetch()
    } catch (err) {
      logger.error('Failed to refresh trusted users', {message: err})
    }
    setIsPTRing(false)
  }, [refetch, setIsPTRing])

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  if (!trustedProfiles?.length) {
    return (
      <Layout.Screen>
        <ViewHeader title={_(msg`Trusted Users`)} />
        <ListMaybePlaceholder
          isLoading={isLoading}
          isError={!!error}
          emptyType="results"
          emptyMessage={_(msg`No trusted users found.`)}
          errorMessage={cleanError(error)}
          onRetry={error ? refetch : undefined}
          topBorder={false}
          sideBorders={false}
        />
      </Layout.Screen>
    )
  }

  return (
    <Layout.Screen>
      <ViewHeader title={_(msg`Trusted Users`)} />
      <View
        style={[
          a.flex_row,
          a.gap_sm,
          a.p_md,
          {
            flexDirection: 'row',
            gap: 8,
            width: '100%',
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
            justifyContent: 'flex-end',
            alignItems: 'center',
          },
        ]}>
        <TrustActions loadAllProfiles={loadAllProfiles} hideTrustAll={true} />
      </View>
      <List
        data={trustedProfiles}
        renderItem={({item: profile}) => (
          <ProfileCardWithFollowBtn
            key={profile.did}
            profile={profile}
            noBorder={false}
          />
        )}
        keyExtractor={profile => profile.did}
        refreshing={isPTRing}
        onRefresh={onRefresh}
        ListFooterComponent={
          <ListFooter error={cleanError(error)} onRetry={refetch} />
        }
        initialNumToRender={initialNumToRender}
        windowSize={11}
        sideBorders={false}
      />
    </Layout.Screen>
  )
}

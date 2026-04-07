import React from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect, useNavigation} from '@react-navigation/native'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {useInitialNumToRender} from '#/lib/hooks/useInitialNumToRender'
import {
  CommonNavigatorParams,
  NativeStackScreenProps,
  NavigationProp,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {useTrustedProfiles, useTrustedQuery} from '#/state/queries/trusted'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {ProfileCardWithFollowBtn} from '#/view/com/profile/ProfileCard'
import {List} from '#/view/com/util/List'
import {ViewHeader} from '#/view/com/util/ViewHeader'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {ListFooter, ListMaybePlaceholder} from '#/components/Lists'
import {TrustActions} from '#/components/TrustActions'
import {Text} from '#/components/Typography'

const PAGE_SIZE = 100

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Trusted'>

export const ProfileTrustedUsersScreen = (_props: Props) => {
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const setMinimalShellMode = useSetMinimalShellMode()
  const initialNumToRender = useInitialNumToRender()
  const {currentAccount} = useSession()
  const {call: speakeasyApi} = useSpeakeasyApi()

  const [isPTRing, setIsPTRing] = React.useState(false)
  const {
    data: trustedUsers,
    isLoading: isLoadingTrusted,
    error: trustedError,
    refetch: refetchTrusted,
  } = useTrustedQuery(currentAccount?.did)
  const {
    data: trustedProfiles,
    isLoading: isLoadingProfiles,
    error: profilesError,
    refetch: refetchProfiles,
  } = useTrustedProfiles(currentAccount?.did)

  const isLoading = isLoadingTrusted || isLoadingProfiles
  const error = trustedError || profilesError
  const refetch = React.useCallback(async () => {
    await refetchTrusted()
    await refetchProfiles()
  }, [refetchTrusted, refetchProfiles])

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

  // Show loading while either query is fetching
  if (isLoading) {
    return (
      <Layout.Screen>
        <ViewHeader title={_(msg`Trusted Users`)} />
        <ListMaybePlaceholder
          isLoading={true}
          isError={false}
          emptyType="results"
          emptyMessage=""
          topBorder={false}
          sideBorders={false}
        />
      </Layout.Screen>
    )
  }

  if (error) {
    return (
      <Layout.Screen>
        <ViewHeader title={_(msg`Trusted Users`)} />
        <ListMaybePlaceholder
          isLoading={false}
          isError={true}
          emptyType="results"
          emptyMessage={_(msg`No trusted users found.`)}
          errorMessage={cleanError(error)}
          onRetry={refetch}
          topBorder={false}
          sideBorders={false}
        />
      </Layout.Screen>
    )
  }

  // Show empty state when trustedUsers query completed with no results
  // (profiles query won't run when there are no trusted users)
  if (!trustedUsers?.length) {
    return (
      <Layout.Screen>
        <ViewHeader title={_(msg`Trusted Users`)} />
        <View style={[a.flex_1, a.align_center, a.justify_center, a.gap_md]}>
          <Text style={[a.text_md]}>{_(msg`No trusted users found.`)}</Text>
          <Button
            variant="solid"
            color="primary"
            size="large"
            label={_(msg`Trust your Follows`)}
            onPress={() =>
              navigation.navigate('ProfileFollows', {
                name: currentAccount?.handle || '',
              })
            }>
            <ButtonText>{_(msg`Trust your Follows`)}</ButtonText>
          </Button>
        </View>
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
        <Button
          variant="solid"
          color="primary"
          size="small"
          label={_(msg`Invite Friends`)}
          onPress={() => navigation.navigate('InvitesSettings')}>
          <ButtonText>{_(msg`Invite Friends`)}</ButtonText>
        </Button>
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

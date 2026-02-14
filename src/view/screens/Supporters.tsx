import React from 'react'
import {ListRenderItemInfo, View} from 'react-native'
import {useFocusEffect, useLinkProps} from '@react-navigation/native'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useTestimonialsWithProfiles} from '#/state/queries/testimonials'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {ListMaybePlaceholder} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {FEED_PAUSE_CTAS} from '#/constants/pause-feed-cta'
import {TestimonialItem} from '../com/supporters/TestimonialItem'
import {Testimonial} from '../com/supporters/types'
import {List} from '../com/util/List'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Supporters'>

export function SupportersScreen(_props: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()
  const t = useTheme()
  const {currentAccount} = useSession()
  const {onPress: onDonatePress} = useLinkProps({to: '/donate'})
  const openLink = useOpenLink()
  const discordUrl =
    FEED_PAUSE_CTAS.find(cta => cta.id === 'discord')?.url ?? ''

  const {
    data: testimonials,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useTestimonialsWithProfiles(currentAccount?.did)

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  const renderItem = React.useCallback(
    ({item}: ListRenderItemInfo<Testimonial>) => {
      return <TestimonialItem testimonial={item} />
    },
    [],
  )

  const keyExtractor = React.useCallback((item: Testimonial) => item.id, [])

  const ListHeader = React.useMemo(
    () => (
      <View style={[a.px_lg, a.py_lg, a.border_b, t.atoms.border_contrast_low]}>
        <Text style={[a.text_xl, a.font_bold, a.leading_snug, a.text_center]}>
          Speakeasy's vision of social media is made possible by the generous
          support of our community
        </Text>
        <View style={[a.flex_row, a.gap_sm, a.mt_md, a.justify_center]}>
          <Button
            size="small"
            variant="outline"
            color="primary"
            label="Donate"
            onPress={onDonatePress}>
            <ButtonText>Donate</ButtonText>
          </Button>
          <Button
            size="small"
            variant="outline"
            color="primary"
            label="Volunteer"
            onPress={() => openLink(discordUrl)}>
            <ButtonText>Volunteer</ButtonText>
          </Button>
        </View>
      </View>
    ),
    [t.atoms.border_contrast_low, onDonatePress, openLink, discordUrl],
  )

  const onRefresh = React.useCallback(async () => {
    await refetch()
  }, [refetch])

  const showPlaceholder = isLoading || isError || !testimonials?.length

  return (
    <Layout.Screen testID="supportersScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content align="left">
          <Layout.Header.TitleText>Supporters</Layout.Header.TitleText>
        </Layout.Header.Content>
      </Layout.Header.Outer>

      {showPlaceholder ? (
        <ListMaybePlaceholder
          isLoading={isLoading}
          isError={isError}
          emptyTitle="No testimonials yet"
          emptyMessage="Be the first to share your support for Speakeasy!"
          emptyType="results"
          onRetry={refetch}
        />
      ) : (
        <List
          data={testimonials}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[{paddingBottom: 100}]}
          desktopFixedHeight
          onRefresh={onRefresh}
          refreshing={isFetching ?? false}
        />
      )}
    </Layout.Screen>
  )
}

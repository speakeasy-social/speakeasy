import React from 'react'
import {ListRenderItemInfo, View} from 'react-native'
import {useFocusEffect} from '@react-navigation/native'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useTestimonialsWithProfiles} from '#/state/queries/testimonials'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {ListMaybePlaceholder} from '#/components/Lists'
import {H1, Text} from '#/components/Typography'
import {TestimonialItem} from '../com/supporters/TestimonialItem'
import {Testimonial} from '../com/supporters/types'
import {List} from '../com/util/List'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Supporters'>

export function SupportersScreen(_props: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()
  const t = useTheme()
  const {currentAccount} = useSession()
  const openLink = useOpenLink()
  const volunteerUrl = 'https://about.spkeasy.social/volunteer'
  const donateUrl = 'https://about.spkeasy.social/donate'

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
        <H1 style={[a.text_4xl, a.font_bold, a.leading_tight]}>
          Our supporters
        </H1>
        <Text style={[a.text_md, a.leading_snug, a.mt_sm]}>
          Speakeasy's vision of social media is possible by the generous support
          of our community.
        </Text>
        <View style={[a.flex_row, a.gap_sm, a.mt_md]}>
          <Button
            size="large"
            variant="solid"
            color="primary"
            label="Donate now"
            style={[a.rounded_full]}
            onPress={() => openLink(donateUrl)}>
            <ButtonText>Donate now</ButtonText>
          </Button>
          <Button
            size="large"
            variant="outline"
            color="primary"
            label="Become a volunteer"
            style={[a.rounded_full]}
            onPress={() => openLink(volunteerUrl)}>
            <ButtonText>Become a volunteer</ButtonText>
          </Button>
        </View>
      </View>
    ),
    [t.atoms.border_contrast_low, openLink, volunteerUrl, donateUrl],
  )

  const onRefresh = React.useCallback(async () => {
    await refetch()
  }, [refetch])

  const showPlaceholder = isLoading || isError || !testimonials?.length

  return (
    <Layout.Screen testID="supportersScreen">
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

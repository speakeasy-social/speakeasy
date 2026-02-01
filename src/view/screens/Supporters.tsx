import React, {useMemo} from 'react'
import {ListRenderItemInfo, View} from 'react-native'
import {useFocusEffect} from '@react-navigation/native'

import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {
  mockTestimonials,
  sortTestimonialsByRelationship,
} from '../com/supporters/mockData'
import {TestimonialItem} from '../com/supporters/TestimonialItem'
import {Testimonial} from '../com/supporters/types'
import {List} from '../com/util/List'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Supporters'>

export function SupportersScreen({}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()
  const t = useTheme()

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  const sortedTestimonials = useMemo(() => {
    return sortTestimonialsByRelationship(mockTestimonials)
  }, [])

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
      </View>
    ),
    [t.atoms.border_contrast_low],
  )

  return (
    <Layout.Screen testID="supportersScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content align="left">
          <Layout.Header.TitleText>Supporters</Layout.Header.TitleText>
        </Layout.Header.Content>
      </Layout.Header.Outer>

      <List
        data={sortedTestimonials}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[{paddingBottom: 100}]}
        desktopFixedHeight
      />
    </Layout.Screen>
  )
}

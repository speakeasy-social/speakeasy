import {StyleProp, View, ViewStyle} from 'react-native'
import {msg,Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useMutation} from '@tanstack/react-query'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {atoms as a} from '#/alf'
// import { useCallback } from 'react'
import {Button, ButtonText} from '#/components/Button'

const MESSAGE = 'Hello from the front end'

export function CreateTestimonial({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const {_} = useLingui()
  // const t = useTheme()
  const {call} = useSpeakeasyApi()

  const createTestimonial = useMutation({
    mutationFn: async (message: string) => {
      try {
        await call({
          api: 'social.spkeasy.testimonial.create',
          method: 'POST',
          body: {message},
        })
        return true
      } catch (err: any) {
        // setError(err.message || 'Invalid invite code')
        return false
      }
    },
  })

  const onPress = async () => {
    const result = await createTestimonial.mutateAsync(MESSAGE)
    console.log('------ onPress | result: ', result)
  }

  // const onPress = useCallback(async () => {
  //   await call({
  //     api: 'social.spkeasy.testimonial.create',
  //     method: 'POST',
  //     body: { message: MESSAGE },
  //   }).then((data: { status: string }) => data.status)
  // }, [call, MESSAGE])

  return (
    <View testID={testID} style={style}>
      <View
        style={[
          a.flex_col,
          a.align_center,
          a.gap_sm,
          a.px_xl,
          a.pt_xl,
          a.w_full,
        ]}>
        <Button
          onPress={onPress}
          size="large"
          color="primary"
          variant="solid"
          label={_(msg`Create a hardcoded testimonial`)}
          style={[a.rounded_full]}>
          <ButtonText>
            <Trans>Testify!</Trans>
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}

import {useCallback} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import {loadStripe} from '@stripe/stripe-js'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {atoms as a} from '#/alf'

const stripePromise = loadStripe('PRIVATE_KEY')

export function Payment({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const {call: speakeasyApi} = useSpeakeasyApi()
  const fetchClientSecret = useCallback(
    async () =>
      await speakeasyApi({
        api: 'social.spkeasy.actor.createCheckoutSession',
        method: 'POST',
      }).then((data: {clientSecret: string}) => data.clientSecret),
    [speakeasyApi],
  )

  const options = {fetchClientSecret}

  return (
    <View testID={testID} style={style}>
      <View style={[a.flex_col, a.align_center, a.gap_sm, a.w_full]}>
        <div id="checkout">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </View>
    </View>
  )
}

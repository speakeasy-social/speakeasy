import {useCallback} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import {loadStripe} from '@stripe/stripe-js'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {atoms as a} from '#/alf'

const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY)

export function Payment({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const {call} = useSpeakeasyApi()
  const fetchClientSecret = useCallback(
    async () =>
      await call({
        api: 'social.spkeasy.actor.createCheckoutSession',
        method: 'POST',
        body: {unit_amount_decimal: '800'},
      }).then((data: {clientSecret: string}) => data.clientSecret),
    [call],
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

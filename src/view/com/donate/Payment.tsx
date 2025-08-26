import {useCallback} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import {loadStripe} from '@stripe/stripe-js'

import {atoms as a} from '#/alf'

const stripePromise = loadStripe('pk_test_123')

export function Payment({
  style,
  testID,
}: {
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const fetchClientSecret = useCallback(() => {
    // Create a Checkout Session
    return fetch('/create-checkout-session', {
      method: 'POST',
    })
      .then(res => res.json())
      .then(data => data.clientSecret)
  }, [])

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

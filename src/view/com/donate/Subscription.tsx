import {useCallback} from 'react'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import {loadStripe} from '@stripe/stripe-js'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'

const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY)

export function Subscription({amount}: {amount: number}) {
  const {call} = useSpeakeasyApi()
  const fetchClientSecret = useCallback(
    async () =>
      await call({
        api: 'social.spkeasy.actor.donate',
        method: 'POST',
        body: {
          unit_amount: amount,
          mode: 'subscription',
        },
      }).then((data: {clientSecret: string}) => data.clientSecret),
    [call, amount],
  )
  const options = {fetchClientSecret}

  return (
    <div id="checkout" style={{width: '100%'}}>
      <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}

import {useCallback, useMemo} from 'react'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import {loadStripe} from '@stripe/stripe-js'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {getStripePublishableKey} from '#/lib/constants'

export function Form({amount, mode}: {amount: number; mode: string}) {
  const {call} = useSpeakeasyApi()

  const stripePromise = useMemo(() => loadStripe(getStripePublishableKey()), [])

  const fetchClientSecret = useCallback(
    async () =>
      await call({
        api: 'social.spkeasy.actor.donate',
        method: 'POST',
        body: {unit_amount: amount, mode},
      }).then((data: {clientSecret: string}) => data.clientSecret),
    [call, amount, mode],
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

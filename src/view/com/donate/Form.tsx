import {useCallback, useMemo} from 'react'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import {loadStripe} from '@stripe/stripe-js'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {getStripePublishableKey} from '#/lib/constants'
import {useSession} from '#/state/session'

export function Form({
  amount,
  mode,
  currency,
  useAccountEmail,
}: {
  amount: number
  mode: string
  currency: string
  useAccountEmail: boolean
}) {
  const {call} = useSpeakeasyApi()
  const {currentAccount} = useSession()

  const stripePromise = useMemo(() => loadStripe(getStripePublishableKey()), [])

  const fetchClientSecret = useCallback(
    async () => {
      const donorEmail =
        useAccountEmail && currentAccount?.email
          ? currentAccount.email
          : undefined

      return await call({
        api: 'social.spkeasy.actor.donate',
        method: 'POST',
        body: {
          unit_amount: amount,
          mode,
          currency: currency.toLowerCase(),
          ...(donorEmail ? {donorEmail} : {}),
        },
      }).then((data: {clientSecret: string}) => data.clientSecret)
    },
    [call, amount, mode, currency, useAccountEmail, currentAccount],
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

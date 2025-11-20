import {useCallback, useMemo} from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import {loadStripe} from '@stripe/stripe-js'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {getStripePublishableKey} from '#/lib/constants'
import {useSession} from '#/state/session'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {convertAmount} from './util'

export function Form({
  value,
  mode,
  currency,
  useAccountEmail,
  onBack,
}: {
  value: string
  mode: string
  currency: string
  useAccountEmail: boolean
  onBack: () => void
}) {
  const {_} = useLingui()
  const {call} = useSpeakeasyApi()
  const {currentAccount} = useSession()

  const stripePromise = useMemo(() => loadStripe(getStripePublishableKey()), [])

  const fetchClientSecret = useCallback(async () => {
    const donorEmail =
      useAccountEmail && currentAccount?.email
        ? currentAccount.email
        : undefined

    // Convert the string value to Stripe's smallest unit here
    const amount = convertAmount(value, currency)

    return await call({
      api: 'social.spkeasy.actor.donate',
      method: 'POST',
      body: {
        unitAmount: amount,
        mode,
        currency: currency.toLowerCase(),
        ...(donorEmail ? {donorEmail} : {}),
      },
    }).then((data: {clientSecret: string}) => data.clientSecret)
  }, [call, value, mode, currency, useAccountEmail, currentAccount])
  const options = {fetchClientSecret}

  return (
    <View style={[a.flex_col, a.align_center, a.w_full, a.gap_2xl]}>
      <div id="checkout" style={{width: '100%'}}>
        <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
      <Button
        onPress={onBack}
        size="small"
        color="secondary"
        variant="ghost"
        label={_(msg`Go back`)}>
        <ButtonText>
          <Trans>Back</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

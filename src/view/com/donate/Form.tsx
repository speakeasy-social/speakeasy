import {useCallback, useMemo} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/macro'
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
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeft} from '#/components/icons/Chevron'

export function Form({
  amount,
  mode,
  currency,
  useAccountEmail,
  onBack,
}: {
  amount: number
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
  }, [call, amount, mode, currency, useAccountEmail, currentAccount])
  const options = {fetchClientSecret}

  return (
    <View style={[a.w_full]}>
      <View style={[a.px_6xl, a.pb_lg]}>
        <Button
          onPress={onBack}
          size="small"
          color="secondary"
          variant="ghost"
          label={_(msg`Go back to change donation details`)}
          style={[a.justify_start, a.px_0]}>
          <ButtonIcon icon={ChevronLeft} />
          <ButtonText>{_(msg`Back`)}</ButtonText>
        </Button>
      </View>
      <div id="checkout" style={{width: '100%'}}>
        <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </View>
  )
}

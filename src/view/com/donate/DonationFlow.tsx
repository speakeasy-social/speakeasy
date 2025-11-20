import {useCallback, useState} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'

import {Form} from './Form'
import {Intro} from './Intro'
import {Upsell} from './Upsell'
import {getCurrencyFromTimezone, hasCurrencyError, StepState} from './util'

export function DonationFlow({style}: {style?: StyleProp<ViewStyle>}) {
  const [stepState, setStepState] = useState<StepState>({
    currentStep: 'intro',
    disableButtons: true,
  })
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState(false)
  const [selectedValue, setSelectedValue] = useState('')
  const [currency, setCurrency] = useState(getCurrencyFromTimezone())
  const [useAccountEmail, setUseAccountEmail] = useState(true)

  const onPress = (step: StepState['currentStep']) => () => {
    setStepState({
      ...stepState,
      currentStep: step,
    })
  }

  const onBack = useCallback(() => {
    setSelectedValue('')
    setStepState({
      ...stepState,
      currentStep: 'intro',
    })
  }, [stepState])

  const handleOnChange = useCallback(
    (event: any) => {
      const value = event.target.value
      const hasError = hasCurrencyError(value)
      setInputValue(value)
      setInputError(hasError)
      setStepState({
        ...stepState,
        disableButtons: value === '' || hasError,
      })
    },
    [stepState],
  )

  const handleUpsellMonthly = useCallback(
    (value: string) => {
      setSelectedValue(value)
      setStepState({
        ...stepState,
        currentStep: 'subscription',
      })
    },
    [stepState],
  )

  const handleUpsellOneTime = useCallback(() => {
    setSelectedValue(inputValue)
    setStepState({
      ...stepState,
      currentStep: 'payment',
    })
  }, [stepState, inputValue])

  const steps = {
    intro: (
      <Intro
        handleOnChange={handleOnChange}
        inputValue={inputValue}
        hasInputError={inputError}
        disableButtons={stepState.disableButtons}
        onPress={onPress}
        currency={currency}
        onCurrencyChange={setCurrency}
        useAccountEmail={useAccountEmail}
        onUseAccountEmailChange={setUseAccountEmail}
      />
    ),
    upsell: (
      <Upsell
        value={inputValue}
        currency={currency}
        onSelectMonthly={handleUpsellMonthly}
        onSelectOneTime={handleUpsellOneTime}
        onBack={onBack}
      />
    ),
    payment: (
      <Form
        mode="payment"
        value={selectedValue || inputValue}
        currency={currency}
        useAccountEmail={useAccountEmail}
        onBack={onBack}
      />
    ),
    subscription: (
      <Form
        mode="subscription"
        value={selectedValue || inputValue}
        currency={currency}
        useAccountEmail={useAccountEmail}
        onBack={onBack}
      />
    ),
  }

  return <View style={style}>{steps[stepState.currentStep]}</View>
}

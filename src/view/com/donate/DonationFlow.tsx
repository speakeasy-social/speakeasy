import {useCallback, useState} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'

import {Form} from './Form'
import {Intro} from './Intro'
import {
  convertAmount,
  getCurrencyFromTimezone,
  hasCurrencyError,
  StepState,
} from './util'

export function DonationFlow({style}: {style?: StyleProp<ViewStyle>}) {
  const [stepState, setStepState] = useState<StepState>({
    currentStep: 'intro',
    disableButtons: true,
  })
  const [inputState, setInputState] = useState({
    value: '',
    amount: 0,
    hasError: false,
  })
  const [currency, setCurrency] = useState(getCurrencyFromTimezone())
  const [useAccountEmail, setUseAccountEmail] = useState(true)

  const onPress = (step: StepState['currentStep']) => () => {
    setStepState({
      ...stepState,
      currentStep: step,
    })
  }

  const onBack = useCallback(() => {
    setStepState({
      ...stepState,
      currentStep: 'intro',
    })
  }, [stepState])

  const handleOnChange = useCallback(
    (event: any) => {
      const value = event.target.value
      const hasError = hasCurrencyError(value)
      const amount = hasError ? inputState.amount : convertAmount(value)
      setInputState({value, amount, hasError})
      setStepState({
        ...stepState,
        disableButtons: value === '' || hasError,
      })
    },
    [inputState, stepState, setInputState, setStepState],
  )

  const steps = {
    intro: (
      <Intro
        handleOnChange={handleOnChange}
        inputValue={inputState.value}
        hasInputError={inputState.hasError}
        disableButtons={stepState.disableButtons}
        onPress={onPress}
        currency={currency}
        onCurrencyChange={setCurrency}
        useAccountEmail={useAccountEmail}
        onUseAccountEmailChange={setUseAccountEmail}
      />
    ),
    payment: (
      <Form
        mode="payment"
        amount={inputState.amount}
        currency={currency}
        useAccountEmail={useAccountEmail}
        onBack={onBack}
      />
    ),
    subscription: (
      <Form
        mode="subscription"
        amount={inputState.amount}
        currency={currency}
        useAccountEmail={useAccountEmail}
        onBack={onBack}
      />
    ),
  }

  return <View style={style}>{steps[stepState.currentStep]}</View>
}

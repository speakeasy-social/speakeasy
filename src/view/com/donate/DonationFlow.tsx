import {useCallback, useState} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'

import {Form} from './Form'
import {Intro} from './Intro'
import {convertAmount, hasCurrencyError, StepState} from './util'

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

  const onPress = (step: StepState['currentStep']) => () => {
    setStepState({
      ...stepState,
      currentStep: step,
    })
  }

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
        hasInputError={inputState.hasError}
        disableButtons={stepState.disableButtons}
        onPress={onPress}
      />
    ),
    payment: <Form mode="payment" amount={inputState.amount} />,
    subscription: <Form mode="subscription" amount={inputState.amount} />,
  }

  return <View style={style}>{steps[stepState.currentStep]}</View>
}

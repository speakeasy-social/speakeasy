import {useCallback, useState} from 'react'
import {StyleProp, View, ViewStyle} from 'react-native'

import {Intro} from './Intro'
import {Payment} from './Payment'
import {convertAmount, hasCurrencyError} from './util'

type StepState = {
  currentStep: 'intro' | 'payment'
  disableButtons: boolean
}

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

  const handleStepForward = () => {
    setStepState({
      ...stepState,
      currentStep: 'payment',
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
        hasInputError={inputState.hasError}
        disableButtons={stepState.disableButtons}
        handleOnChange={handleOnChange}
        handleStepForward={handleStepForward}
      />
    ),
    payment: <Payment amount={inputState.amount} />,
  }

  return <View style={style}>{steps[stepState.currentStep]}</View>
}

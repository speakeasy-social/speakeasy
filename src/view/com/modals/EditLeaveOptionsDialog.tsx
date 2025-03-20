import React from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {
  useLeaveOptions,
  useSetLeaveOptions,
} from '#/state/preferences/leave-options'
import {atoms as a} from '#/alf/atoms'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Text} from '#/components/Typography'

export function LeaveDialog({control}: {control: Dialog.DialogControlProps}) {
  const {_} = useLingui()
  const options = useLeaveOptions()
  const setOptions = useSetLeaveOptions()

  const defaultOptions = [
    {title: 'Read a Book', link: 'https://bookshop.org/'},
    {
      title: 'Message a Friend',
      link: 'https://web.whatsapp.com/send?text=Hey!%20What%27s%20up%3F',
    },
    {title: 'Take a Breath', link: 'https://insighttimer.com/'},
    {title: 'Go for a Walk', link: 'close'},
  ]

  const [localOptions, setLocalOptions] = React.useState(
    options || defaultOptions,
  )

  const updateOption = (
    index: number,
    field: 'title' | 'link',
    value: string,
  ) => {
    const newOptions = [...localOptions]
    newOptions[index] = {...newOptions[index], [field]: value}
    setLocalOptions(newOptions)
  }

  const handleSave = () => {
    setOptions(localOptions)
    control.close()
  }

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Set your leave options`)}>
        <View style={[a.gap_xl]}>
          <Text style={[a.text_center, a.text_lg]}>
            {_(
              msg`Where would you like to go when taking breaks from Speakeasy?`,
            )}
          </Text>

          <View style={[a.gap_xl]}>
            {localOptions.map((option, index) => (
              <View key={index} style={[a.gap_md]}>
                <Text style={[a.text_md]}>{_(msg`Option ${index + 1}`)}</Text>
                <TextField.Input
                  defaultValue={option.title}
                  onChangeText={text => updateOption(index, 'title', text)}
                  label={_(msg`Description`)}
                />
                <TextField.Input
                  defaultValue={option.link}
                  onChangeText={text => updateOption(index, 'link', text)}
                  label={_(msg`URL`)}
                />
              </View>
            ))}
          </View>

          <View style={[a.gap_md]}>
            <Button
              variant="solid"
              color="primary"
              size="large"
              label={_(msg`Save Options`)}
              onPress={handleSave}>
              <ButtonText>{_(msg`Save Options`)}</ButtonText>
            </Button>
            <Button
              variant="outline"
              color="secondary"
              size="large"
              label={_(msg`Cancel`)}
              onPress={() => control.close()}>
              <ButtonText>{_(msg`Cancel`)}</ButtonText>
            </Button>
          </View>
        </View>
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

import React, {useCallback} from 'react'
import Animated, {
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {IS_INTERNAL} from '#/lib/app-info'
import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {useGate} from '#/lib/statsig/statsig'
import {isNative} from '#/platform/detection'
import {
  useSetShowInteractionNumbers,
  useShowInteractionNumbers,
} from '#/state/preferences/show-interaction-numbers'
import {useSetThemePrefs, useThemePrefs} from '#/state/shell'
import {SettingsListItem as AppIconSettingsListItem} from '#/screens/Settings/AppIconSettings/SettingsListItem'
import {atoms as a, native, useAlf, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import * as ToggleButton from '#/components/forms/ToggleButton'
import {Props as SVGIconProps} from '#/components/icons/common'
import {Phone_Stroke2_Corner0_Rounded as PhoneIcon} from '#/components/icons/Phone'
import {TextSize_Stroke2_Corner0_Rounded as TextSize} from '#/components/icons/TextSize'
import {TitleCase_Stroke2_Corner0_Rounded as Aa} from '#/components/icons/TitleCase'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import * as SettingsList from './components/SettingsList'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AppearanceSettings'>
export function AppearanceSettingsScreen({}: Props) {
  const {_} = useLingui()
  const {fonts} = useAlf()
  const gate = useGate()

  const {colorMode} = useThemePrefs()
  const {setColorMode} = useSetThemePrefs()
  const showInteractionNumbers = useShowInteractionNumbers()
  const setShowInteractionNumbers = useSetShowInteractionNumbers()

  const onChangeAppearance = useCallback(
    (keys: string[]) => {
      const appearance = keys.find(key => key !== colorMode) as
        | 'system'
        | 'light'
        | 'dark'
        | undefined
      if (!appearance) return
      setColorMode(appearance)
    },
    [setColorMode, colorMode],
  )

  const onChangeFontFamily = useCallback(
    (values: string[]) => {
      const next = values[0] === 'system' ? 'system' : 'theme'
      fonts.setFontFamily(next)
    },
    [fonts],
  )

  const onChangeFontScale = useCallback(
    (values: string[]) => {
      const next = values[0] || ('0' as any)
      fonts.setFontScale(next)
    },
    [fonts],
  )

  return (
    <LayoutAnimationConfig skipExiting skipEntering>
      <Layout.Screen testID="preferencesThreadsScreen">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Appearance</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <Layout.Content>
          <SettingsList.Container>
            <AppearanceToggleButtonGroup
              title={_(msg`Color mode`)}
              icon={PhoneIcon}
              items={[
                {
                  label: _(msg`System`),
                  name: 'system',
                },
                {
                  label: _(msg`Light`),
                  name: 'light',
                },
                {
                  label: _(msg`Dark`),
                  name: 'dark',
                },
              ]}
              values={[colorMode]}
              onChange={onChangeAppearance}
            />

            <Animated.View layout={native(LinearTransition)}>
              <SettingsList.Divider />

              <AppearanceToggleButtonGroup
                title={_(msg`Font`)}
                description={_(
                  msg`For the best experience, we recommend using the theme font.`,
                )}
                icon={Aa}
                items={[
                  {
                    label: _(msg`System`),
                    name: 'system',
                  },
                  {
                    label: _(msg`Theme`),
                    name: 'theme',
                  },
                ]}
                values={[fonts.family]}
                onChange={onChangeFontFamily}
              />

              <AppearanceToggleButtonGroup
                title={_(msg`Font size`)}
                icon={TextSize}
                items={[
                  {
                    label: _(msg`Smaller`),
                    name: '-1',
                  },
                  {
                    label: _(msg`Default`),
                    name: '0',
                  },
                  {
                    label: _(msg`Larger`),
                    name: '1',
                  },
                ]}
                values={[fonts.scale]}
                onChange={onChangeFontScale}
              />

              <SettingsList.Divider />

              <Toggle.Item
                type="checkbox"
                name="show-interaction-numbers"
                label={_(msg`Display interaction numbers`)}
                value={showInteractionNumbers}
                onChange={value => setShowInteractionNumbers(value)}>
                <SettingsList.Item>
                  <SettingsList.ItemText>
                    <Trans>Display interaction numbers</Trans>
                  </SettingsList.ItemText>
                  <Toggle.Platform />
                </SettingsList.Item>
              </Toggle.Item>

              {isNative && IS_INTERNAL && gate('debug_subscriptions') && (
                <>
                  <SettingsList.Divider />
                  <AppIconSettingsListItem />
                </>
              )}
            </Animated.View>
          </SettingsList.Container>
        </Layout.Content>
      </Layout.Screen>
    </LayoutAnimationConfig>
  )
}

export function AppearanceToggleButtonGroup({
  title,
  description,
  icon: Icon,
  items,
  values,
  onChange,
}: {
  title: string
  description?: string
  icon: React.ComponentType<SVGIconProps>
  items: {
    label: string
    name: string
  }[]
  values: string[]
  onChange: (values: string[]) => void
}) {
  const t = useTheme()
  return (
    <>
      <SettingsList.Group contentContainerStyle={[a.gap_sm]} iconInset={false}>
        <SettingsList.ItemIcon icon={Icon} />
        <SettingsList.ItemText>{title}</SettingsList.ItemText>
        {description && (
          <Text
            style={[
              a.text_sm,
              a.leading_snug,
              t.atoms.text_contrast_medium,
              a.w_full,
            ]}>
            {description}
          </Text>
        )}
        <ToggleButton.Group label={title} values={values} onChange={onChange}>
          {items.map(item => (
            <ToggleButton.Button
              key={item.name}
              label={item.label}
              name={item.name}>
              <ToggleButton.ButtonText>{item.label}</ToggleButton.ButtonText>
            </ToggleButton.Button>
          ))}
        </ToggleButton.Group>
      </SettingsList.Group>
    </>
  )
}

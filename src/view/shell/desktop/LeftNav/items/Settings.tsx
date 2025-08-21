import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {
  SettingsGear2_Filled_Corner0_Rounded as SettingsFilled,
  SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon,
} from '#/components/icons/SettingsGear2'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

const Settings = () => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/settings"
      icon={
        <SettingsIcon
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
          style={pal.text}
        />
      }
      iconFilled={
        <SettingsFilled
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
          style={pal.text}
        />
      }
      label={_(msg`Settings`)}
    />
  )
}

export default Settings

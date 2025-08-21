import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {
  Bell_Filled_Corner0_Rounded as BellFilled,
  Bell_Stroke2_Corner0_Rounded as Bell,
} from '#/components/icons/Bell'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

const Notifications = () => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/notifications"
      icon={<Bell aria-hidden={true} width={NAV_ICON_WIDTH} style={pal.text} />}
      iconFilled={
        <BellFilled
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
          style={pal.text}
        />
      }
      label={_(msg`Notifications`)}
    />
  )
}

export default Notifications

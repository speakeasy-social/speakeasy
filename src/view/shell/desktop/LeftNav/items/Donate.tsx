import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {Growth_Stroke2_Corner0_Rounded as Growth} from '#/components/icons/Growth'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

const Donate = () => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/donate"
      icon={
        <Growth style={pal.text} aria-hidden={true} width={NAV_ICON_WIDTH} />
      }
      iconFilled={
        <Growth style={pal.text} aria-hidden={true} width={NAV_ICON_WIDTH} />
      }
      label={_(msg`Donate`)}
    />
  )
}

export default Donate

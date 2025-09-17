import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {PiggyBank_Stroke2_Corner0_Rounded as PiggyBank} from '#/components/icons/PiggyBank'
import {NAV_ICON_WIDTH, NavItem} from '../LeftNav'

const Supporters = () => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/supporters"
      icon={
        <PiggyBank style={pal.text} aria-hidden={true} width={NAV_ICON_WIDTH} />
      }
      iconFilled={
        <PiggyBank style={pal.text} aria-hidden={true} width={NAV_ICON_WIDTH} />
      }
      label={_(msg`Supporters`)}
    />
  )
}

export default Supporters

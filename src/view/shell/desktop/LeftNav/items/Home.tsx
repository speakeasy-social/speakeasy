import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {useGate} from '#/lib/statsig/statsig'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilled,
  HomeOpen_Stoke2_Corner0_Rounded as HomeIcon,
} from '#/components/icons/HomeOpen'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

interface Props {
  gate: ReturnType<typeof useGate>
  hasHomeBadge: boolean
}

const Home = ({gate, hasHomeBadge}: Props) => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/"
      hasNew={hasHomeBadge && gate('remove_show_latest_button')}
      icon={
        <HomeIcon aria-hidden={true} width={NAV_ICON_WIDTH} style={pal.text} />
      }
      iconFilled={
        <HomeFilled
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
          style={pal.text}
        />
      }
      label={_(msg`Home`)}
    />
  )
}

export default Home

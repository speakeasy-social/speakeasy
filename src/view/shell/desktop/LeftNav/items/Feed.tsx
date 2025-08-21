import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {useGate} from '#/lib/statsig/statsig'
import {News2_Stroke2_Corner0_Rounded as News} from '#/components/icons/News2'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

interface Props {
  gate: ReturnType<typeof useGate>
  hasHomeBadge: boolean
}

const Feed = ({gate, hasHomeBadge}: Props) => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/feed"
      hasNew={hasHomeBadge && gate('remove_show_latest_button')}
      icon={<News aria-hidden={true} width={NAV_ICON_WIDTH} style={pal.text} />}
      iconFilled={
        <News aria-hidden={true} width={NAV_ICON_WIDTH} style={pal.text} />
      }
      label={_(msg`Feed`)}
    />
  )
}

export default Feed

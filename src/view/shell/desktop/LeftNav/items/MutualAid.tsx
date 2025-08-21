import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartFilled,
  Heart2_Stroke2_Corner0_Rounded as Heart,
} from '#/components/icons/Heart2'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

interface Props {
  onPress: () => void
}

const MutualAid = ({onPress}: Props) => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/mutual"
      icon={
        <Heart aria-hidden={true} width={NAV_ICON_WIDTH} style={pal.text} />
      }
      iconFilled={
        <HeartFilled
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
          style={pal.text}
        />
      }
      label={_(msg`Mutual Aid`)}
      onPress={onPress}
    />
  )
}

export default MutualAid

import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {
  Group3_Stroke2_Corner0_Rounded as Group,
  Group3_Stroke2_Corner0_Rounded as GroupFilled,
} from '#/components/icons/Group'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

interface Props {
  onPress: () => void
}

const Groups = ({onPress}: Props) => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/groups"
      icon={
        <Group aria-hidden={true} width={NAV_ICON_WIDTH} style={pal.text} />
      }
      iconFilled={
        <GroupFilled
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
          style={pal.text}
        />
      }
      label={_(msg`Groups`)}
      onPress={onPress}
    />
  )
}

export default Groups
